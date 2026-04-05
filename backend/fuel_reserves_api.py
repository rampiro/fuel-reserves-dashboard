"""
fuel_reserves_api.py  v3.0.0
===========================
Backend FastAPI – Dashboard de Reservas Estratégicas de Combustible.

APIs reales integradas:
  - EIA doméstica  → stocks semanales EE.UU. (/v2/petroleum/stoc/wstk/data/)
  - EIA internacional → stocks ~50 países  (/v2/international/data/)
  - EIA precio crudo → WTI/Brent spot diario (/v2/petroleum/pri/spt/data/)
  - CORES (España)  → Excel mensual (cores.es)

Nuevas secciones (v3):
  - /api/price-history   → serie histórica WTI + Brent (30 días)
  - /api/supply-alerts   → alertas geopolíticas curadas (hardcoded + expandible)
  - /api/hormuz          → tráfico buques Estrecho de Ormuz (mock realista 2026)

Configuración rápida:
  1. cp .env.example .env  →  añade EIA_API_KEY
  2. pip install -r requirements.txt
  3. uvicorn fuel_reserves_api:app --reload --port 8000

Documentación interactiva: http://localhost:8000/docs
EIA API (gratuita): https://www.eia.gov/opendata/register.php
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from time import time
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------------------------
load_dotenv()

EIA_API_KEY = os.getenv("EIA_API_KEY", "")
EIA_BASE    = "https://api.eia.gov/v2"
CORES_BASE  = "https://www.cores.es/sites/default/files/archivos/estadisticas"

THRESHOLD_CRITICAL = 30
THRESHOLD_WARNING  = 90
CACHE_TTL = 86_400   # 24 h

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger("fuel-api")

# ---------------------------------------------------------------------------
# FACETS EIA INTERNACIONAL
# activityId=5 → stocks al cierre del período
# productId=55  → Total petroleum + other liquids
# ---------------------------------------------------------------------------
EIA_ACTIVITY_STOCKS       = "5"
EIA_PRODUCT_TOTAL_PETROL  = "55"

# Mapa ISO3 → (nombre, región, consumo_diario_bbl)
COUNTRY_MAP: dict[str, tuple[str, str, float]] = {
    # ── EUROPA ──────────────────────────────────────────────────────────────
    "NLD": ("Países Bajos",     "Europa",         1_000_000),
    "DEU": ("Alemania",         "Europa",         2_900_000),
    "FRA": ("Francia",          "Europa",         2_500_000),
    "ITA": ("Italia",           "Europa",         1_700_000),
    "GBR": ("Reino Unido",      "Europa",         1_800_000),
    "NOR": ("Noruega",          "Europa",           240_000),
    "SWE": ("Suecia",           "Europa",           340_000),
    "BEL": ("Bélgica",          "Europa",           680_000),
    "AUT": ("Austria",          "Europa",           290_000),
    "POL": ("Polonia",          "Europa",           600_000),
    "PRT": ("Portugal",         "Europa",           250_000),
    "GRC": ("Grecia",           "Europa",           380_000),
    "ROU": ("Rumanía",          "Europa",           200_000),
    "HUN": ("Hungría",          "Europa",           180_000),
    "CZE": ("Rep. Checa",       "Europa",           200_000),
    "SVK": ("Eslovaquia",       "Europa",            80_000),
    "FIN": ("Finlandia",        "Europa",           200_000),
    "DNK": ("Dinamarca",        "Europa",           180_000),
    "CHE": ("Suiza",            "Europa",           290_000),
    "TUR": ("Turquía",          "Europa",         1_000_000),
    "UKR": ("Ucrania",          "Europa",           300_000),
    "RUS": ("Rusia",            "Europa",         3_700_000),
    # ── ORIENTE MEDIO ───────────────────────────────────────────────────────
    "SAU": ("Arabia Saudí",     "Oriente Medio",  4_000_000),
    "ARE": ("EAU",              "Oriente Medio",  1_000_000),
    "IRN": ("Irán",             "Oriente Medio",  2_000_000),
    "IRQ": ("Irak",             "Oriente Medio",    900_000),
    "KWT": ("Kuwait",           "Oriente Medio",    500_000),
    "QAT": ("Qatar",            "Oriente Medio",    300_000),
    "ISR": ("Israel",           "Oriente Medio",    270_000),
    # ── ASIA-PACÍFICO ────────────────────────────────────────────────────────
    "JPN": ("Japón",            "Asia-Pacífico",  3_500_000),
    "KOR": ("Corea del Sur",    "Asia-Pacífico",  2_800_000),
    "CHN": ("China",            "Asia-Pacífico", 16_000_000),
    "IND": ("India",            "Asia-Pacífico",  5_000_000),
    "AUS": ("Australia",        "Asia-Pacífico",  1_000_000),
    "SGP": ("Singapur",         "Asia-Pacífico",  1_500_000),
    "IDN": ("Indonesia",        "Asia-Pacífico",  1_800_000),
    "THA": ("Tailandia",        "Asia-Pacífico",  1_300_000),
    "PHL": ("Filipinas",        "Asia-Pacífico",    450_000),
    "TWN": ("Taiwán",           "Asia-Pacífico",  1_100_000),
    "VNM": ("Vietnam",          "Asia-Pacífico",    400_000),
    "PAK": ("Pakistán",         "Asia-Pacífico",    550_000),
    "BGD": ("Bangladesh",       "Asia-Pacífico",    130_000),
    "NZL": ("Nueva Zelanda",    "Asia-Pacífico",    160_000),
    "MYS": ("Malasia",          "Asia-Pacífico",    750_000),
    # ── AMERICA ─────────────────────────────────────────────────────────────
    "CAN": ("Canadá",           "América",        2_500_000),
    "MEX": ("México",           "América",        1_250_000),
    "BRA": ("Brasil",           "América",        3_300_000),
    "ARG": ("Argentina",        "América",          800_000),
    "COL": ("Colombia",         "América",          350_000),
    "CHL": ("Chile",            "América",          350_000),
    "VEN": ("Venezuela",        "América",          600_000),
    "PER": ("Perú",             "América",          240_000),
    # ── AFRICA ──────────────────────────────────────────────────────────────
    "NGA": ("Nigeria",          "África",           500_000),
    "ZAF": ("Sudáfrica",        "África",           600_000),
    "EGY": ("Egipto",           "África",           900_000),
    "DZA": ("Argelia",          "África",           500_000),
    "LBY": ("Libia",            "África",           280_000),
    "MAR": ("Marruecos",        "África",           230_000),
    # España gestionada por CORES (ver abajo)
}

# ---------------------------------------------------------------------------
# MODELOS PYDANTIC
# ---------------------------------------------------------------------------
class CountryReserve(BaseModel):
    country:             str
    region:              str
    reserves_total:      float
    daily_consumption:   float
    coverage_days:       float
    status:              str
    last_updated:        str
    source:              str

class GlobalStats(BaseModel):
    total_reserves:      float
    average_coverage:    float
    critical_countries:  int
    safe_countries:      int

class ReservesResponse(BaseModel):
    reserves:     list[CountryReserve]
    global_stats: GlobalStats

class PricePoint(BaseModel):
    date:  str
    wti:   Optional[float] = None
    brent: Optional[float] = None

class SupplyAlert(BaseModel):
    id:               int
    date:             str
    region:           str
    severity:         str
    alert_type:       str
    title:            str
    summary:          str
    barrel_impact:    float
    affected_iso3:    list[str]

class HormuzVesselFlag(BaseModel):
    flag:    str
    count:   int
    pct:     float

class HormuzHistoryPoint(BaseModel):
    date:      str
    vessels:   int
    oil_mb:    float

class HormuzData(BaseModel):
    date:           str
    daily_vessels:  int
    daily_oil_mb:   float
    trend_7d_pct:   float
    status:         str
    by_flag:        list[HormuzVesselFlag]
    history_7d:     list[HormuzHistoryPoint]

# ---------------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------------
def compute_status(days: float) -> str:
    if days < THRESHOLD_CRITICAL: return "crítico"
    if days < THRESHOLD_WARNING:  return "advertencia"
    return "seguro"

def compute_coverage(reserves: float, consumption: float) -> float:
    return round(reserves / consumption, 1) if consumption > 0 else 0.0

def make_reserve(country, region, reserves_bbl, consumption, source) -> CountryReserve:
    days = compute_coverage(reserves_bbl, consumption)
    return CountryReserve(
        country=country, region=region,
        reserves_total=reserves_bbl, daily_consumption=consumption,
        coverage_days=days, status=compute_status(days),
        last_updated=datetime.now(timezone.utc).isoformat(), source=source,
    )

# ---------------------------------------------------------------------------
# CLIENTE EIA – STOCKS DOMÉSTICOS (EE.UU.)
# ---------------------------------------------------------------------------
class EIAUsClient:
    async def get(self) -> Optional[CountryReserve]:
        if not EIA_API_KEY:
            return None
        url = (
            f"{EIA_BASE}/petroleum/stoc/wstk/data/"
            f"?api_key={EIA_API_KEY}"
            f"&frequency=weekly&data[0]=value"
            f"&facets[area][]=NUS"
            f"&sort[0][column]=period&sort[0][direction]=desc&length=1"
        )
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get(url); r.raise_for_status()
            rows = r.json().get("response", {}).get("data", [])
            if not rows: return None
            reserves_bbl = float(rows[0]["value"]) * 1_000
            return make_reserve("Estados Unidos", "América", reserves_bbl, 20_000_000, "EIA")
        except Exception as e:
            logger.error("EIA US stocks: %s", e)
            return None

# ---------------------------------------------------------------------------
# CLIENTE EIA – INTERNACIONAL (~55 países)
# ---------------------------------------------------------------------------
class EIAInternationalClient:
    async def _fetch_country(self, session: httpx.AsyncClient, iso3: str) -> Optional[CountryReserve]:
        name, region, consumption = COUNTRY_MAP[iso3]
        url = (
            f"{EIA_BASE}/international/data/"
            f"?api_key={EIA_API_KEY}"
            f"&frequency=annual&data[0]=value"
            f"&facets[activityId][]={EIA_ACTIVITY_STOCKS}"
            f"&facets[productId][]={EIA_PRODUCT_TOTAL_PETROL}"
            f"&facets[countryRegionId][]={iso3}"
            f"&sort[0][column]=period&sort[0][direction]=desc&length=1"
        )
        try:
            r = await session.get(url); r.raise_for_status()
            rows = r.json().get("response", {}).get("data", [])
            if not rows or rows[0].get("value") is None:
                return None
            reserves_bbl = float(rows[0]["value"]) * 1_000_000
            return make_reserve(name, region, reserves_bbl, consumption, "EIA-International")
        except Exception as e:
            logger.error("EIA intl %s: %s", iso3, e)
            return None

    async def get_all(self) -> list[CountryReserve]:
        if not EIA_API_KEY:
            return []
        async with httpx.AsyncClient(timeout=30) as session:
            tasks   = [self._fetch_country(session, iso3) for iso3 in COUNTRY_MAP]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, CountryReserve)]

# ---------------------------------------------------------------------------
# CLIENTE EIA – PRECIO CRUDO (WTI + Brent spot diario)
# ---------------------------------------------------------------------------
class EIAOilPriceClient:
    async def get_history(self, days: int = 30) -> list[PricePoint]:
        if not EIA_API_KEY:
            return _oil_price_fallback(days)
        url_wti = (
            f"{EIA_BASE}/petroleum/pri/spt/data/"
            f"?api_key={EIA_API_KEY}"
            f"&frequency=daily&data[0]=value"
            f"&facets[series][]=RWTC"
            f"&sort[0][column]=period&sort[0][direction]=desc&length={days}"
        )
        url_brt = url_wti.replace("RWTC", "RBRTE")
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r_wti, r_brt = await asyncio.gather(c.get(url_wti), c.get(url_brt))
                r_wti.raise_for_status(); r_brt.raise_for_status()
            wti_rows = {row["period"]: float(row["value"])
                        for row in r_wti.json().get("response", {}).get("data", [])
                        if row.get("value") is not None}
            brt_rows = {row["period"]: float(row["value"])
                        for row in r_brt.json().get("response", {}).get("data", [])
                        if row.get("value") is not None}
            all_dates = sorted(set(wti_rows) | set(brt_rows), reverse=True)[:days]
            return [PricePoint(date=d, wti=wti_rows.get(d), brent=brt_rows.get(d))
                    for d in all_dates]
        except Exception as e:
            logger.error("EIA oil price: %s", e)
            return _oil_price_fallback(days)

# ---------------------------------------------------------------------------
# CLIENTE CORES – ESPAÑA
# ---------------------------------------------------------------------------
class CORESClient:
    async def get(self) -> Optional[CountryReserve]:
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            return None
        today = datetime.now()
        mes   = today.month - 1 if today.month > 1 else 12
        anio  = today.year    if today.month > 1 else today.year - 1
        url   = f"{CORES_BASE}/existencias_{anio}{mes:02d}.xlsx"
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
            try:
                r = await c.get(url); r.raise_for_status()
            except httpx.HTTPError:
                return None
        import io, openpyxl
        wb  = openpyxl.load_workbook(io.BytesIO(r.content), data_only=True)
        ws  = wb.active
        raw = ws["B5"].value
        if not raw: return None
        reserves_bbl = float(raw) * 1_000 * 7.33
        return make_reserve("España", "Europa", reserves_bbl, 1_250_000, "CORES")

# ---------------------------------------------------------------------------
# ALERTAS GEOPOLÍTICAS 2026 (curadas; conectar a NewsAPI/GDELT en producción)
# ---------------------------------------------------------------------------
SUPPLY_ALERTS: list[dict] = [
    {
        "id": 1, "date": "2026-04-02",
        "region": "Oriente Medio", "severity": "high", "alert_type": "conflicto",
        "title": "Tensiones Irán-Arabia Saudí escalan en el Golfo",
        "summary": (
            "Escalonamiento de tensiones reduce tráfico en el Estrecho de Ormuz "
            "un 12%. La EIA eleva la estimación de precio en +$4.2/bbl y alerta "
            "de posible interrupción de 1.5 Mbb/d si continúa el conflicto."
        ),
        "barrel_impact": +4.2,
        "affected_iso3": ["IRN", "SAU", "ARE", "IRQ", "KWT"],
    },
    {
        "id": 2, "date": "2026-03-28",
        "region": "Mar Rojo", "severity": "high", "alert_type": "seguridad_maritima",
        "title": "Ataques Houthi continúan — desvío por Cabo de Buena Esperanza",
        "summary": (
            "Rerouting masivo alarga rutas de suministro en ~14 días y eleva "
            "costes de flete un 38%. Impacto estimado: +$2.8/bbl en spread Brent-WTI."
        ),
        "barrel_impact": +2.8,
        "affected_iso3": ["SAU", "ARE", "EGY"],
    },
    {
        "id": 3, "date": "2026-03-15",
        "region": "Global", "severity": "medium", "alert_type": "tratado",
        "title": "G7+ acuerda liberación de 45 Mbb de reservas estratégicas",
        "summary": (
            "Los países del G7 coordinan una liberación conjunta de 45 millones "
            "de barriles de reservas estratégicas para contrarrestar la subida de precios. "
            "El mercado reacciona con una caída de -$6.1/bbl."
        ),
        "barrel_impact": -6.1,
        "affected_iso3": ["USA", "DEU", "FRA", "GBR", "JPN", "ITA", "CAN"],
    },
    {
        "id": 4, "date": "2026-02-22",
        "region": "América del Sur", "severity": "medium", "alert_type": "produccion",
        "title": "Venezuela aumenta producción un 18% tras acuerdo con operadores occidentales",
        "summary": (
            "Nuevo acuerdo eleva la producción venezolana a 1.1 Mbb/d. "
            "Primer incremento significativo desde 2019. Impacto bajista "
            "de -$1.9/bbl en crudo latinoamericano."
        ),
        "barrel_impact": -1.9,
        "affected_iso3": ["VEN", "COL", "BRA"],
    },
    {
        "id": 5, "date": "2026-02-10",
        "region": "África Occidental", "severity": "low", "alert_type": "nuevo_yacimiento",
        "title": "Nigeria: descubrimiento offshore de 800 Mbb en Golfo de Guinea",
        "summary": (
            "TotalEnergies y NNPC confirman yacimiento de ~800 millones de barriles "
            "en bloque OPL-245. Producción estimada para 2029. "
            "Impacto inmediato mínimo: -$0.5/bbl en expectativas a largo plazo."
        ),
        "barrel_impact": -0.5,
        "affected_iso3": ["NGA"],
    },
    {
        "id": 6, "date": "2026-01-30",
        "region": "Asia-Pacífico", "severity": "medium", "alert_type": "demanda",
        "title": "China aumenta importaciones al nivel más alto desde 2023",
        "summary": (
            "Recuperación económica china impulsa importaciones de crudo a 12.3 Mbb/d, "
            "máximo desde octubre 2023. Presión alcista de +$3.1/bbl en crudos asiáticos."
        ),
        "barrel_impact": +3.1,
        "affected_iso3": ["CHN", "SAU", "RUS", "IRQ"],
    },
    {
        "id": 7, "date": "2026-01-18",
        "region": "Europa", "severity": "low", "alert_type": "infraestructura",
        "title": "Oleoducto Druzhba reanuda flujo tras mantenimiento en tramo europeo",
        "summary": (
            "El tramo europeo del oleoducto Druzhba reanuda operaciones tras "
            "15 días de mantenimiento. Polonia y Hungría recuperan suministro normal. "
            "Efecto bajista moderado en diferenciales europeos."
        ),
        "barrel_impact": -0.8,
        "affected_iso3": ["POL", "HUN", "CZE", "SVK", "DEU"],
    },
]

# ---------------------------------------------------------------------------
# TRÁFICO ESTRECHO DE ORMUZ – mock realista abril 2026
# Referencia EIA: ~21 tankers/día en condiciones normales
# Situación actual: reducido por tensiones Irán-Arabia Saudí
# ---------------------------------------------------------------------------
HORMUZ_DATA: dict = {
    "date": "2026-04-03",
    "daily_vessels":  21,
    "daily_oil_mb":   17.2,
    "trend_7d_pct":   -8.6,
    "status":         "restringido",
    "by_flag": [
        {"flag": "Islas Marshall", "count": 6, "pct": 28.6},
        {"flag": "Panamá",         "count": 5, "pct": 23.8},
        {"flag": "Liberia",        "count": 4, "pct": 19.0},
        {"flag": "Malta",          "count": 3, "pct": 14.3},
        {"flag": "Grecia",         "count": 2, "pct":  9.5},
        {"flag": "Singapur",       "count": 1, "pct":  4.8},
    ],
    "history_7d": [
        {"date": "2026-03-28", "vessels": 23, "oil_mb": 18.8},
        {"date": "2026-03-29", "vessels": 24, "oil_mb": 19.6},
        {"date": "2026-03-30", "vessels": 22, "oil_mb": 18.0},
        {"date": "2026-03-31", "vessels": 20, "oil_mb": 16.4},
        {"date": "2026-04-01", "vessels": 21, "oil_mb": 17.2},
        {"date": "2026-04-02", "vessels": 20, "oil_mb": 16.3},
        {"date": "2026-04-03", "vessels": 21, "oil_mb": 17.2},
    ],
}

# ---------------------------------------------------------------------------
# FALLBACK – precios petróleo (serie sintética realista 2026)
# ---------------------------------------------------------------------------
def _oil_price_fallback(n: int = 30) -> list[PricePoint]:
    import random, math
    random.seed(42)
    base_wti = 85.4
    pts = []
    for i in range(n):
        from datetime import timedelta
        d     = (datetime(2026, 4, 3) - timedelta(days=i)).strftime("%Y-%m-%d")
        noise = math.sin(i * 0.4) * 2.1 + random.uniform(-1.2, 1.2)
        pts.append(PricePoint(
            date=d,
            wti=round(base_wti + noise, 2),
            brent=round(base_wti + noise + random.uniform(2.5, 4.5), 2),
        ))
    return pts

# ---------------------------------------------------------------------------
# FALLBACK – reservas por país (~37 países)
# ---------------------------------------------------------------------------
_FALLBACK: list[dict] = [
    {"country":"Estados Unidos","region":"América",      "reserves_total":1_800_000_000,"daily_consumption":20_000_000,"coverage_days":90,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Japón",         "region":"Asia-Pacífico","reserves_total":580_000_000,  "daily_consumption":3_500_000, "coverage_days":165, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Países Bajos",  "region":"Europa",       "reserves_total":180_000_000,  "daily_consumption":1_000_000, "coverage_days":180, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Alemania",      "region":"Europa",       "reserves_total":295_000_000,  "daily_consumption":2_900_000, "coverage_days":101, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Francia",       "region":"Europa",       "reserves_total":240_000_000,  "daily_consumption":2_500_000, "coverage_days":96,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Reino Unido",   "region":"Europa",       "reserves_total":125_000_000,  "daily_consumption":1_800_000, "coverage_days":69,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Italia",        "region":"Europa",       "reserves_total":130_000_000,  "daily_consumption":1_700_000, "coverage_days":76,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"España",        "region":"Europa",       "reserves_total":120_000_000,  "daily_consumption":1_250_000, "coverage_days":96,  "status":"seguro",      "source":"CORES-fallback"},
    {"country":"Noruega",       "region":"Europa",       "reserves_total":50_000_000,   "daily_consumption":240_000,   "coverage_days":208, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Polonia",       "region":"Europa",       "reserves_total":55_000_000,   "daily_consumption":600_000,   "coverage_days":91,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Bélgica",       "region":"Europa",       "reserves_total":65_000_000,   "daily_consumption":680_000,   "coverage_days":95,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Suecia",        "region":"Europa",       "reserves_total":30_000_000,   "daily_consumption":340_000,   "coverage_days":88,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Turquía",       "region":"Europa",       "reserves_total":50_000_000,   "daily_consumption":1_000_000, "coverage_days":50,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Rusia",         "region":"Europa",       "reserves_total":500_000_000,  "daily_consumption":3_700_000, "coverage_days":135, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Ucrania",       "region":"Europa",       "reserves_total":20_000_000,   "daily_consumption":300_000,   "coverage_days":66,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Arabia Saudí",  "region":"Oriente Medio","reserves_total":450_000_000,  "daily_consumption":4_000_000, "coverage_days":112, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"EAU",           "region":"Oriente Medio","reserves_total":180_000_000,  "daily_consumption":1_000_000, "coverage_days":180, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Irán",          "region":"Oriente Medio","reserves_total":290_000_000,  "daily_consumption":2_000_000, "coverage_days":145, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Irak",          "region":"Oriente Medio","reserves_total":140_000_000,  "daily_consumption":900_000,   "coverage_days":155, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Kuwait",        "region":"Oriente Medio","reserves_total":95_000_000,   "daily_consumption":500_000,   "coverage_days":190, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Qatar",         "region":"Oriente Medio","reserves_total":40_000_000,   "daily_consumption":300_000,   "coverage_days":133, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Corea del Sur", "region":"Asia-Pacífico","reserves_total":320_000_000,  "daily_consumption":2_800_000, "coverage_days":114, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"China",         "region":"Asia-Pacífico","reserves_total":900_000_000,  "daily_consumption":16_000_000,"coverage_days":56,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"India",         "region":"Asia-Pacífico","reserves_total":185_000_000,  "daily_consumption":5_000_000, "coverage_days":37,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Australia",     "region":"Asia-Pacífico","reserves_total":60_000_000,   "daily_consumption":1_000_000, "coverage_days":60,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Singapur",      "region":"Asia-Pacífico","reserves_total":75_000_000,   "daily_consumption":1_500_000, "coverage_days":50,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Indonesia",     "region":"Asia-Pacífico","reserves_total":90_000_000,   "daily_consumption":1_800_000, "coverage_days":50,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Tailandia",     "region":"Asia-Pacífico","reserves_total":55_000_000,   "daily_consumption":1_300_000, "coverage_days":42,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Taiwán",        "region":"Asia-Pacífico","reserves_total":95_000_000,   "daily_consumption":1_100_000, "coverage_days":86,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Malasia",       "region":"Asia-Pacífico","reserves_total":65_000_000,   "daily_consumption":750_000,   "coverage_days":86,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Vietnam",       "region":"Asia-Pacífico","reserves_total":22_000_000,   "daily_consumption":400_000,   "coverage_days":55,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Canadá",        "region":"América",      "reserves_total":190_000_000,  "daily_consumption":2_500_000, "coverage_days":76,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"México",        "region":"América",      "reserves_total":7_500_000,    "daily_consumption":1_250_000, "coverage_days":6,   "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Brasil",        "region":"América",      "reserves_total":120_000_000,  "daily_consumption":3_300_000, "coverage_days":36,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Argentina",     "region":"América",      "reserves_total":70_000_000,   "daily_consumption":800_000,   "coverage_days":87,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Colombia",      "region":"América",      "reserves_total":30_000_000,   "daily_consumption":350_000,   "coverage_days":85,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Venezuela",     "region":"América",      "reserves_total":200_000_000,  "daily_consumption":600_000,   "coverage_days":333, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Chile",         "region":"América",      "reserves_total":28_000_000,   "daily_consumption":350_000,   "coverage_days":80,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Perú",          "region":"América",      "reserves_total":18_000_000,   "daily_consumption":240_000,   "coverage_days":75,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Nigeria",       "region":"África",       "reserves_total":60_000_000,   "daily_consumption":500_000,   "coverage_days":120, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Sudáfrica",     "region":"África",       "reserves_total":25_000_000,   "daily_consumption":600_000,   "coverage_days":41,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Egipto",        "region":"África",       "reserves_total":35_000_000,   "daily_consumption":900_000,   "coverage_days":38,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Argelia",       "region":"África",       "reserves_total":65_000_000,   "daily_consumption":500_000,   "coverage_days":130, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Libia",         "region":"África",       "reserves_total":45_000_000,   "daily_consumption":280_000,   "coverage_days":160, "status":"seguro",      "source":"EIA-fallback"},
]

def _fallback_rows() -> list[CountryReserve]:
    now = datetime.now(timezone.utc).isoformat()
    return [CountryReserve(**{**r, "last_updated": now}) for r in _FALLBACK]

def compute_global_stats(reserves: list[CountryReserve]) -> GlobalStats:
    total   = sum(r.reserves_total  for r in reserves)
    avg_cov = sum(r.coverage_days   for r in reserves) / max(len(reserves), 1)
    return GlobalStats(
        total_reserves     = round(total, 0),
        average_coverage   = round(avg_cov, 1),
        critical_countries = sum(1 for r in reserves if r.status == "crítico"),
        safe_countries     = sum(1 for r in reserves if r.status == "seguro"),
    )

# ---------------------------------------------------------------------------
# CACHÉ EN MEMORIA (24 horas)
# ---------------------------------------------------------------------------
_cache: dict = {"data": None, "ts": 0.0}

async def get_cached_reserves() -> list[CountryReserve]:
    if _cache["data"] and (time() - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]
    logger.info("Cache miss – consultando APIs EIA…")
    us_data, intl_data, spain_data = await asyncio.gather(
        EIAUsClient().get(),
        EIAInternationalClient().get_all(),
        CORESClient().get(),
        return_exceptions=True,
    )
    results: list[CountryReserve] = []
    if isinstance(us_data, CountryReserve):   results.append(us_data)
    if isinstance(intl_data, list):           results.extend(intl_data)
    if isinstance(spain_data, CountryReserve):
        results = [r for r in results if r.country != "España"]
        results.append(spain_data)
    if len(results) < 5:
        logger.warning("Menos de 5 países – usando fallback.")
        results = _fallback_rows()
    _cache["data"] = results
    _cache["ts"]   = time()
    logger.info("Cache actualizado: %d países.", len(results))
    return results

# ---------------------------------------------------------------------------
# APP FASTAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title       = "API de Reservas Estratégicas de Combustible",
    description = (
        "Monitoreo de stocks de petróleo por país + precio crudo (WTI/Brent) + "
        "alertas geopolíticas + tráfico Estrecho de Ormuz. "
        "Fuentes: EIA (EE.UU. + Internacional), CORES (España). "
        "Clave EIA gratuita en https://www.eia.gov/opendata/register.php"
    ),
    version = "3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/api/reserves", response_model=ReservesResponse, summary="Reservas de todos los países")
async def get_all_reserves(
    region: Optional[str] = Query(None, description="Filtrar por región"),
    status: Optional[str] = Query(None, description="seguro | advertencia | crítico"),
):
    reserves = await get_cached_reserves()
    if region: reserves = [r for r in reserves if r.region.lower() == region.lower()]
    if status: reserves = [r for r in reserves if r.status.lower() == status.lower()]
    return ReservesResponse(reserves=reserves, global_stats=compute_global_stats(reserves))


@app.get("/api/reserves/{country}", response_model=CountryReserve)
async def get_country_reserve(country: str):
    reserves = await get_cached_reserves()
    match = next((r for r in reserves if r.country.lower() == country.lower()), None)
    if not match:
        raise HTTPException(404, detail=f"País '{country}' no encontrado.")
    return match


@app.get("/api/alerts", response_model=list[CountryReserve])
async def get_alerts(threshold: int = Query(THRESHOLD_WARNING)):
    reserves = await get_cached_reserves()
    return sorted([r for r in reserves if r.coverage_days < threshold], key=lambda r: r.coverage_days)


@app.get("/api/stats", response_model=GlobalStats)
async def get_stats():
    return compute_global_stats(await get_cached_reserves())


@app.get("/api/price-history", response_model=list[PricePoint], summary="Precio WTI + Brent (30 días)")
async def get_price_history(days: int = Query(30, ge=7, le=90)):
    return await EIAOilPriceClient().get_history(days)


@app.get("/api/supply-alerts", response_model=list[SupplyAlert], summary="Alertas geopolíticas de suministro")
async def get_supply_alerts():
    return [SupplyAlert(**a) for a in SUPPLY_ALERTS]


@app.get("/api/hormuz", response_model=HormuzData, summary="Tráfico buques Estrecho de Ormuz")
async def get_hormuz():
    return HormuzData(
        **{
            **HORMUZ_DATA,
            "by_flag":    [HormuzVesselFlag(**f) for f in HORMUZ_DATA["by_flag"]],
            "history_7d": [HormuzHistoryPoint(**h) for h in HORMUZ_DATA["history_7d"]],
        }
    )


@app.post("/api/cache/invalidate")
async def invalidate_cache():
    _cache["data"] = None; _cache["ts"] = 0.0
    return {"message": "Caché invalidada. La próxima petición actualizará desde EIA."}


@app.get("/health")
async def health():
    return {
        "status":           "ok",
        "timestamp":        datetime.now(timezone.utc).isoformat(),
        "eia_key_set":      bool(EIA_API_KEY),
        "cache_age_sec":    round(time() - _cache["ts"], 0) if _cache["ts"] else None,
        "countries_cached": len(_cache["data"]) if _cache["data"] else 0,
    }


@app.get("/api/eia/explore", summary="[Debug] Explorar metadatos EIA internacional")
async def eia_explore():
    if not EIA_API_KEY:
        raise HTTPException(400, "EIA_API_KEY no configurada en .env")
    url = f"{EIA_BASE}/international?api_key={EIA_API_KEY}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url); r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fuel_reserves_api:app", host="0.0.0.0", port=8000, reload=True)
