"""
fuel_reserves_api.py
====================
Backend FastAPI para el Dashboard de Reservas Estratégicas de Combustible.

APIs reales integradas:
  - EIA doméstica  → stocks semanales de EE.UU. (api.eia.gov/v2/petroleum/...)
  - EIA internacional → stocks anuales/mensuales por país (api.eia.gov/v2/international/...)
  - CORES (España) → descarga automática del Excel mensual (cores.es)

Configuración rápida:
  1. Copia .env.example a .env y añade tu EIA_API_KEY.
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

# Umbrales de la Agencia Internacional de Energía / Directiva UE
THRESHOLD_CRITICAL = 30   # días → crítico
THRESHOLD_WARNING  = 90   # días → advertencia (mínimo IEA)

CACHE_TTL = 86_400        # 24 horas en segundos

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger("fuel-api")

# ---------------------------------------------------------------------------
# FACETS DE LA API EIA INTERNACIONAL
# Puedes explorar todos los valores en:
#   https://api.eia.gov/v2/international?api_key=TU_CLAVE
#
# activityId relevantes:
#   1  = Producción
#   2  = Consumo
#   3  = Importaciones
#   4  = Exportaciones
#   5  = Stocks al cierre del período  ← el que usamos para reservas
#
# productId relevantes para petróleo:
#   53 = Petróleo crudo (crude oil)
#   55 = Petróleo crudo + NGPL + otros líquidos (total)
#   57 = Productos petrolíferos refinados
#
# Códigos de país: ISO-3166 alpha-3
# ---------------------------------------------------------------------------
EIA_ACTIVITY_STOCKS      = "5"
EIA_PRODUCT_TOTAL_PETROL = "55"   # Total petroleum and other liquids

# Mapa: código ISO3 → (nombre visible, región, consumo diario en bbl)
COUNTRY_MAP: dict[str, tuple[str, str, float]] = {
    # ISO3         nombre             región             consumo bbl/día
    "JPN": ("Japón",           "Asia-Pacífico",   3_500_000),
    "NLD": ("Países Bajos",    "Europa",           1_000_000),
    "RUS": ("Rusia",           "Europa",           3_700_000),
    "KOR": ("Corea del Sur",   "Asia-Pacífico",   2_800_000),
    "SAU": ("Arabia Saudí",    "Oriente Medio",   4_000_000),
    "ARE": ("EAU",             "Oriente Medio",   1_000_000),
    "DEU": ("Alemania",        "Europa",           2_900_000),
    "FRA": ("Francia",         "Europa",           2_500_000),
    "ITA": ("Italia",          "Europa",           1_700_000),
    "GBR": ("Reino Unido",     "Europa",           1_800_000),
    "CAN": ("Canadá",          "América",          2_500_000),
    "CHN": ("China",           "Asia-Pacífico",  16_000_000),
    "IND": ("India",           "Asia-Pacífico",   5_000_000),
    "AUS": ("Australia",       "Asia-Pacífico",   1_000_000),
    "SGP": ("Singapur",        "Asia-Pacífico",   1_500_000),
    "TUR": ("Turquía",         "Europa",           1_000_000),
    "MEX": ("México",          "América",          1_250_000),
    "BRA": ("Brasil",          "América",          3_300_000),
    # España se gestiona por CORES (ver abajo)
}

# ---------------------------------------------------------------------------
# MODELOS PYDANTIC
# ---------------------------------------------------------------------------
class CountryReserve(BaseModel):
    country:           str
    region:            str
    reserves_total:    float   # barriles
    daily_consumption: float   # barriles/día
    coverage_days:     float
    status:            str     # seguro | advertencia | crítico
    last_updated:      str     # ISO 8601
    source:            str

class GlobalStats(BaseModel):
    total_reserves:     float
    average_coverage:   float
    critical_countries: int
    safe_countries:     int

class ReservesResponse(BaseModel):
    reserves:     list[CountryReserve]
    global_stats: GlobalStats

# ---------------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------------
def compute_status(days: float) -> str:
    if days < THRESHOLD_CRITICAL:
        return "crítico"
    if days < THRESHOLD_WARNING:
        return "advertencia"
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
# CLIENTE EIA — STOCKS DOMÉSTICOS (EE.UU.)
# Endpoint: /v2/petroleum/stoc/wstk/data/
# Frecuencia semanal; unidad: miles de barriles
# ---------------------------------------------------------------------------
class EIAUsClient:
    async def get(self) -> Optional[CountryReserve]:
        if not EIA_API_KEY:
            logger.warning("EIA_API_KEY no configurada.")
            return None
        url = (
            f"{EIA_BASE}/petroleum/stoc/wstk/data/"
            f"?api_key={EIA_API_KEY}"
            f"&frequency=weekly"
            f"&data[0]=value"
            f"&facets[area][]=NUS"
            f"&sort[0][column]=period&sort[0][direction]=desc"
            f"&length=1"
        )
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get(url)
                r.raise_for_status()
            rows = r.json().get("response", {}).get("data", [])
            if not rows:
                return None
            reserves_bbl = float(rows[0]["value"]) * 1_000  # miles bbl → bbl
            return make_reserve("Estados Unidos", "América", reserves_bbl, 20_000_000, "EIA")
        except Exception as e:
            logger.error("EIA US stocks: %s", e)
            return None

# ---------------------------------------------------------------------------
# CLIENTE EIA INTERNACIONAL
# Endpoint: /v2/international/data/
# activityId=5 (stocks), productId=55 (total petroleum + other liquids)
# Unidad: millones de barriles → convertimos a barriles
# Frecuencia: anual (es la más completa para cobertura global)
# ---------------------------------------------------------------------------
class EIAInternationalClient:

    async def _fetch_country(self, session: httpx.AsyncClient, iso3: str) -> Optional[CountryReserve]:
        name, region, consumption = COUNTRY_MAP[iso3]
        url = (
            f"{EIA_BASE}/international/data/"
            f"?api_key={EIA_API_KEY}"
            f"&frequency=annual"
            f"&data[0]=value"
            f"&facets[activityId][]={EIA_ACTIVITY_STOCKS}"
            f"&facets[productId][]={EIA_PRODUCT_TOTAL_PETROL}"
            f"&facets[countryRegionId][]={iso3}"
            f"&sort[0][column]=period&sort[0][direction]=desc"
            f"&length=1"
        )
        try:
            r = await session.get(url)
            r.raise_for_status()
            rows = r.json().get("response", {}).get("data", [])
            if not rows or rows[0].get("value") is None:
                logger.warning("EIA intl: sin datos para %s", iso3)
                return None
            # La unidad del API es millones de barriles para stocks
            reserves_bbl = float(rows[0]["value"]) * 1_000_000
            return make_reserve(name, region, reserves_bbl, consumption, "EIA-International")
        except Exception as e:
            logger.error("EIA intl %s: %s", iso3, e)
            return None

    async def get_all(self) -> list[CountryReserve]:
        if not EIA_API_KEY:
            logger.warning("EIA_API_KEY no configurada. Usando fallback.")
            return []
        # Llamadas concurrentes — una por país
        async with httpx.AsyncClient(timeout=25) as session:
            tasks = [self._fetch_country(session, iso3) for iso3 in COUNTRY_MAP]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, CountryReserve)]

# ---------------------------------------------------------------------------
# CLIENTE CORES — ESPAÑA
# CORES publica un Excel mensual en cores.es; lo descargamos y parseamos.
# Si el Excel no está disponible (primeros días del mes), caemos a fallback.
# ---------------------------------------------------------------------------
class CORESClient:
    async def get(self) -> Optional[CountryReserve]:
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            logger.warning("openpyxl no instalado (pip install openpyxl). Saltando CORES.")
            return None

        today  = datetime.now()
        # El informe del mes anterior suele publicarse a mediados del mes siguiente
        mes    = today.month - 1 if today.month > 1 else 12
        anio   = today.year    if today.month > 1 else today.year - 1
        url    = f"{CORES_BASE}/existencias_{anio}{mes:02d}.xlsx"

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
            try:
                r = await c.get(url)
                r.raise_for_status()
            except httpx.HTTPError:
                logger.warning("CORES: no se pudo descargar %s", url)
                return None

        import io, openpyxl
        wb  = openpyxl.load_workbook(io.BytesIO(r.content), data_only=True)
        ws  = wb.active

        # El valor de reservas totales en kt suele estar en B5 de la hoja principal.
        # Ajusta la celda si CORES cambia el formato del informe.
        raw = ws["B5"].value
        if not raw:
            return None

        reserves_bbl = float(raw) * 1_000 * 7.33   # kt → bbl (1 t crudo ≈ 7.33 bbl)
        return make_reserve("España", "Europa", reserves_bbl, 1_250_000, "CORES")

# ---------------------------------------------------------------------------
# DATOS DE FALLBACK (cuando las APIs no responden o la clave es inválida)
# Basados en datos públicos del BP Statistical Review y la IEA 2023.
# ---------------------------------------------------------------------------
_FALLBACK: list[dict] = [
    {"country":"Estados Unidos", "region":"América",       "reserves_total":1_800_000_000,"daily_consumption":20_000_000,"coverage_days":90,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Japón",          "region":"Asia-Pacífico", "reserves_total":580_000_000,  "daily_consumption":3_500_000, "coverage_days":165, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Países Bajos",   "region":"Europa",         "reserves_total":180_000_000,  "daily_consumption":1_000_000, "coverage_days":180, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"EAU",            "region":"Oriente Medio",  "reserves_total":180_000_000,  "daily_consumption":1_000_000, "coverage_days":180, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Rusia",          "region":"Europa",         "reserves_total":500_000_000,  "daily_consumption":3_700_000, "coverage_days":135, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Corea del Sur",  "region":"Asia-Pacífico", "reserves_total":320_000_000,  "daily_consumption":2_800_000, "coverage_days":114, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Arabia Saudí",   "region":"Oriente Medio",  "reserves_total":450_000_000,  "daily_consumption":4_000_000, "coverage_days":112, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Alemania",       "region":"Europa",         "reserves_total":295_000_000,  "daily_consumption":2_900_000, "coverage_days":101, "status":"seguro",      "source":"EIA-fallback"},
    {"country":"España",         "region":"Europa",         "reserves_total":120_000_000,  "daily_consumption":1_250_000, "coverage_days":96,  "status":"seguro",      "source":"CORES-fallback"},
    {"country":"Francia",        "region":"Europa",         "reserves_total":240_000_000,  "daily_consumption":2_500_000, "coverage_days":96,  "status":"seguro",      "source":"EIA-fallback"},
    {"country":"Italia",         "region":"Europa",         "reserves_total":130_000_000,  "daily_consumption":1_700_000, "coverage_days":76,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Canadá",         "region":"América",        "reserves_total":190_000_000,  "daily_consumption":2_500_000, "coverage_days":76,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Reino Unido",    "region":"Europa",         "reserves_total":125_000_000,  "daily_consumption":1_800_000, "coverage_days":69,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"China",          "region":"Asia-Pacífico", "reserves_total":900_000_000,  "daily_consumption":16_000_000,"coverage_days":56,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Singapur",       "region":"Asia-Pacífico", "reserves_total":75_000_000,   "daily_consumption":1_500_000, "coverage_days":50,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Turquía",        "region":"Europa",         "reserves_total":50_000_000,   "daily_consumption":1_000_000, "coverage_days":50,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"Australia",      "region":"Asia-Pacífico", "reserves_total":60_000_000,   "daily_consumption":1_000_000, "coverage_days":60,  "status":"advertencia", "source":"EIA-fallback"},
    {"country":"India",          "region":"Asia-Pacífico", "reserves_total":185_000_000,  "daily_consumption":5_000_000, "coverage_days":37,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"Brasil",         "region":"América",        "reserves_total":120_000_000,  "daily_consumption":3_300_000, "coverage_days":36,  "status":"crítico",     "source":"EIA-fallback"},
    {"country":"México",         "region":"América",        "reserves_total":7_500_000,    "daily_consumption":1_250_000, "coverage_days":6,   "status":"crítico",     "source":"EIA-fallback"},
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
        logger.info("Cache hit — sirviendo datos en memoria.")
        return _cache["data"]

    logger.info("Cache miss — consultando APIs de EIA…")
    eia_us   = EIAUsClient()
    eia_intl = EIAInternationalClient()
    cores    = CORESClient()

    us_data, intl_data, spain_data = await asyncio.gather(
        eia_us.get(),
        eia_intl.get_all(),
        cores.get(),
        return_exceptions=True,
    )

    results: list[CountryReserve] = []

    if isinstance(us_data, CountryReserve):
        results.append(us_data)

    if isinstance(intl_data, list):
        results.extend(intl_data)

    if isinstance(spain_data, CountryReserve):
        # CORES tiene prioridad sobre EIA para España
        results = [r for r in results if r.country != "España"]
        results.append(spain_data)

    if len(results) < 5:
        logger.warning("Menos de 5 países obtenidos de APIs. Usando datos de fallback.")
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
        "Monitoreo de stocks de petróleo por país. "
        "Fuentes: EIA (EE.UU. + Internacional), CORES (España). "
        "Clave EIA gratuita en https://www.eia.gov/opendata/register.php"
    ),
    version     = "2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],   # En producción restringe al dominio de Lovable
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
@app.get(
    "/api/reserves",
    response_model = ReservesResponse,
    summary        = "Obtener todas las reservas",
    description    = "Devuelve reservas de todos los países con estadísticas globales. Soporta filtros opcionales.",
)
async def get_all_reserves(
    region: Optional[str] = Query(None, description="Filtrar por región (ej. Europa, América)"),
    status: Optional[str] = Query(None, description="seguro | advertencia | crítico"),
):
    reserves = await get_cached_reserves()
    if region:
        reserves = [r for r in reserves if r.region.lower() == region.lower()]
    if status:
        reserves = [r for r in reserves if r.status.lower() == status.lower()]
    return ReservesResponse(reserves=reserves, global_stats=compute_global_stats(reserves))


@app.get(
    "/api/reserves/{country}",
    response_model = CountryReserve,
    summary        = "Reservas por país",
)
async def get_country_reserve(country: str):
    reserves = await get_cached_reserves()
    match = next((r for r in reserves if r.country.lower() == country.lower()), None)
    if not match:
        raise HTTPException(404, detail=f"País '{country}' no encontrado.")
    return match


@app.get(
    "/api/alerts",
    response_model = list[CountryReserve],
    summary        = "Países por debajo del umbral de cobertura",
)
async def get_alerts(
    threshold: int = Query(THRESHOLD_WARNING, description="Días de cobertura mínimos (default 90)"),
):
    reserves = await get_cached_reserves()
    return sorted(
        [r for r in reserves if r.coverage_days < threshold],
        key=lambda r: r.coverage_days,
    )


@app.get(
    "/api/stats",
    response_model = GlobalStats,
    summary        = "Estadísticas globales",
)
async def get_stats():
    return compute_global_stats(await get_cached_reserves())


@app.post(
    "/api/cache/invalidate",
    summary = "Forzar actualización de datos",
)
async def invalidate_cache():
    _cache["data"] = None
    _cache["ts"]   = 0.0
    return {"message": "Caché invalidada. La próxima petición actualizará desde EIA."}


@app.get("/health")
async def health():
    return {
        "status":        "ok",
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "eia_key_set":   bool(EIA_API_KEY),
        "cache_age_sec": round(time() - _cache["ts"], 0) if _cache["ts"] else None,
    }


# ---------------------------------------------------------------------------
# EIA EXPLORER — endpoint de diagnóstico para explorar facets disponibles
# Útil para verificar qué activityId/productId devuelve tu clave
# ---------------------------------------------------------------------------
@app.get("/api/eia/explore", summary="[Debug] Explorar metadatos de EIA internacional")
async def eia_explore():
    if not EIA_API_KEY:
        raise HTTPException(400, "EIA_API_KEY no configurada en .env")
    url = f"{EIA_BASE}/international?api_key={EIA_API_KEY}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url)
        r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# PUNTO DE ENTRADA
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fuel_reserves_api:app", host="0.0.0.0", port=8000, reload=True)
