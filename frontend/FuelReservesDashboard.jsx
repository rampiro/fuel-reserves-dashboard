/**
 * FuelReservesDashboard.jsx  v3.0.0
 * Dashboard de Reservas Estratégicas de Combustible
 *
 * Secciones:
 *  1. KPI cards globales
 *  2. Tabla filtrable de ~45 países
 *  3. Gráfico de barras cobertura
 *  4. Precio WTI/Brent vs días de cobertura global
 *  5. Alertas de Suministro Geopolítico
 *  6. Tráfico Estrecho de Ormuz
 *
 * Para conectar con backend real:
 *   - Descomenta los useEffect de cada sección
 *   - Cambia API_BASE a tu URL de despliegue
 */

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, ReferenceLine,
  ComposedChart, Line, Area, Legend,
} from "recharts";
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
  TrendingUp, TrendingDown, Anchor, Globe, Zap, Ship,
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Activity, BarChart2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const API_BASE = "http://localhost:8000";

const STATUS_CONFIG = {
  seguro:       { color: "#34d399", bg: "bg-emerald-900/40", border: "border-emerald-700", label: "Seguro",       icon: CheckCircle },
  advertencia:  { color: "#f59e0b", bg: "bg-amber-900/40",   border: "border-amber-700",   label: "Advertencia",  icon: AlertTriangle },
  "crítico":    { color: "#ef4444", bg: "bg-red-900/40",     border: "border-red-700",     label: "Crítico",      icon: XCircle },
};

const SEVERITY_CONFIG = {
  high:   { color: "#ef4444", label: "Alta",   badge: "bg-red-900/60 text-red-300 border-red-700" },
  medium: { color: "#f59e0b", label: "Media",  badge: "bg-amber-900/60 text-amber-300 border-amber-700" },
  low:    { color: "#34d399", label: "Baja",   badge: "bg-emerald-900/60 text-emerald-300 border-emerald-700" },
};

const REGIONS = ["Todas las regiones", "Europa", "Oriente Medio", "Asia-Pacífico", "América", "África"];

// ---------------------------------------------------------------------------
// MOCK DATA – ~44 países
// ---------------------------------------------------------------------------
const MOCK_RESERVES = [
  // EUROPA
  { country:"Estados Unidos", region:"América",       reserves_total:1_800_000_000, daily_consumption:20_000_000, coverage_days:90,  status:"seguro",      source:"EIA",          last_updated:"2026-04-03T00:00:00Z" },
  { country:"Japón",          region:"Asia-Pacífico", reserves_total:580_000_000,   daily_consumption:3_500_000,  coverage_days:165, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Países Bajos",   region:"Europa",        reserves_total:180_000_000,   daily_consumption:1_000_000,  coverage_days:180, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Alemania",       region:"Europa",        reserves_total:295_000_000,   daily_consumption:2_900_000,  coverage_days:101, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Francia",        region:"Europa",        reserves_total:240_000_000,   daily_consumption:2_500_000,  coverage_days:96,  status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Reino Unido",    region:"Europa",        reserves_total:125_000_000,   daily_consumption:1_800_000,  coverage_days:69,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Italia",         region:"Europa",        reserves_total:130_000_000,   daily_consumption:1_700_000,  coverage_days:76,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"España",         region:"Europa",        reserves_total:120_000_000,   daily_consumption:1_250_000,  coverage_days:96,  status:"seguro",      source:"CORES",        last_updated:"2026-04-03T00:00:00Z" },
  { country:"Noruega",        region:"Europa",        reserves_total:50_000_000,    daily_consumption:240_000,    coverage_days:208, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Polonia",        region:"Europa",        reserves_total:55_000_000,    daily_consumption:600_000,    coverage_days:91,  status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Bélgica",        region:"Europa",        reserves_total:65_000_000,    daily_consumption:680_000,    coverage_days:95,  status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Suecia",         region:"Europa",        reserves_total:30_000_000,    daily_consumption:340_000,    coverage_days:88,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Turquía",        region:"Europa",        reserves_total:50_000_000,    daily_consumption:1_000_000,  coverage_days:50,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Rusia",          region:"Europa",        reserves_total:500_000_000,   daily_consumption:3_700_000,  coverage_days:135, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Ucrania",        region:"Europa",        reserves_total:20_000_000,    daily_consumption:300_000,    coverage_days:66,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  // ORIENTE MEDIO
  { country:"Arabia Saudí",   region:"Oriente Medio", reserves_total:450_000_000,   daily_consumption:4_000_000,  coverage_days:112, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"EAU",            region:"Oriente Medio", reserves_total:180_000_000,   daily_consumption:1_000_000,  coverage_days:180, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Irán",           region:"Oriente Medio", reserves_total:290_000_000,   daily_consumption:2_000_000,  coverage_days:145, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Irak",           region:"Oriente Medio", reserves_total:140_000_000,   daily_consumption:900_000,    coverage_days:155, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Kuwait",         region:"Oriente Medio", reserves_total:95_000_000,    daily_consumption:500_000,    coverage_days:190, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Qatar",          region:"Oriente Medio", reserves_total:40_000_000,    daily_consumption:300_000,    coverage_days:133, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  // ASIA-PACÍFICO
  { country:"Corea del Sur",  region:"Asia-Pacífico", reserves_total:320_000_000,   daily_consumption:2_800_000,  coverage_days:114, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"China",          region:"Asia-Pacífico", reserves_total:900_000_000,   daily_consumption:16_000_000, coverage_days:56,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"India",          region:"Asia-Pacífico", reserves_total:185_000_000,   daily_consumption:5_000_000,  coverage_days:37,  status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Australia",      region:"Asia-Pacífico", reserves_total:60_000_000,    daily_consumption:1_000_000,  coverage_days:60,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Singapur",       region:"Asia-Pacífico", reserves_total:75_000_000,    daily_consumption:1_500_000,  coverage_days:50,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Indonesia",      region:"Asia-Pacífico", reserves_total:90_000_000,    daily_consumption:1_800_000,  coverage_days:50,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Tailandia",      region:"Asia-Pacífico", reserves_total:55_000_000,    daily_consumption:1_300_000,  coverage_days:42,  status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Taiwán",         region:"Asia-Pacífico", reserves_total:95_000_000,    daily_consumption:1_100_000,  coverage_days:86,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Malasia",        region:"Asia-Pacífico", reserves_total:65_000_000,    daily_consumption:750_000,    coverage_days:86,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Vietnam",        region:"Asia-Pacífico", reserves_total:22_000_000,    daily_consumption:400_000,    coverage_days:55,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  // AMERICA
  { country:"Canadá",         region:"América",       reserves_total:190_000_000,   daily_consumption:2_500_000,  coverage_days:76,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"México",         region:"América",       reserves_total:7_500_000,     daily_consumption:1_250_000,  coverage_days:6,   status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Brasil",         region:"América",       reserves_total:120_000_000,   daily_consumption:3_300_000,  coverage_days:36,  status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Argentina",      region:"América",       reserves_total:70_000_000,    daily_consumption:800_000,    coverage_days:87,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Colombia",       region:"América",       reserves_total:30_000_000,    daily_consumption:350_000,    coverage_days:85,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Venezuela",      region:"América",       reserves_total:200_000_000,   daily_consumption:600_000,    coverage_days:333, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Chile",          region:"América",       reserves_total:28_000_000,    daily_consumption:350_000,    coverage_days:80,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Perú",           region:"América",       reserves_total:18_000_000,    daily_consumption:240_000,    coverage_days:75,  status:"advertencia", source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  // AFRICA
  { country:"Nigeria",        region:"África",        reserves_total:60_000_000,    daily_consumption:500_000,    coverage_days:120, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Sudáfrica",      region:"África",        reserves_total:25_000_000,    daily_consumption:600_000,    coverage_days:41,  status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Egipto",         region:"África",        reserves_total:35_000_000,    daily_consumption:900_000,    coverage_days:38,  status:"crítico",     source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Argelia",        region:"África",        reserves_total:65_000_000,    daily_consumption:500_000,    coverage_days:130, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
  { country:"Libia",          region:"África",        reserves_total:45_000_000,    daily_consumption:280_000,    coverage_days:160, status:"seguro",      source:"EIA-Intl",     last_updated:"2026-04-03T00:00:00Z" },
];

// Mock price history (30 days)
const MOCK_PRICE_HISTORY = (() => {
  const pts = [];
  const base = 85.4;
  for (let i = 29; i >= 0; i--) {
    const d = new Date("2026-04-03");
    d.setDate(d.getDate() - i);
    const noise = Math.sin(i * 0.4) * 2.1 + (Math.random() * 2.4 - 1.2);
    pts.push({
      date: d.toISOString().slice(0, 10),
      wti:   Math.round((base + noise) * 100) / 100,
      brent: Math.round((base + noise + 3.4) * 100) / 100,
    });
  }
  return pts;
})();

// Mock supply alerts
const MOCK_ALERTS = [
  { id:1, date:"2026-04-02", region:"Oriente Medio",   severity:"high",   alert_type:"conflicto",         title:"Tensiones Irán-Arabia Saudí escalan en el Golfo", barrel_impact:+4.2, affected_iso3:["IRN","SAU","ARE","IRQ","KWT"], summary:"Escalonamiento reduce tráfico en Ormuz un 12%. EIA eleva estimación +$4.2/bbl." },
  { id:2, date:"2026-03-28", region:"Mar Rojo",         severity:"high",   alert_type:"seguridad_maritima",title:"Ataques Houthi — desvío por Cabo de Buena Esperanza", barrel_impact:+2.8, affected_iso3:["SAU","ARE","EGY"], summary:"Rerouting alarga rutas ~14 días, +38% costes de flete. +$2.8/bbl spread Brent-WTI." },
  { id:3, date:"2026-03-15", region:"Global",            severity:"medium", alert_type:"tratado",           title:"G7+ libera 45 Mbb de reservas estratégicas", barrel_impact:-6.1, affected_iso3:["USA","DEU","FRA","GBR","JPN"], summary:"Coordinación G7 produce caída de -$6.1/bbl. Mercados se estabilizan temporalmente." },
  { id:4, date:"2026-02-22", region:"América del Sur",   severity:"medium", alert_type:"produccion",        title:"Venezuela aumenta producción un 18%", barrel_impact:-1.9, affected_iso3:["VEN","COL","BRA"], summary:"Acuerdo eleva producción venezolana a 1.1 Mbb/d. Impacto bajista -$1.9/bbl." },
  { id:5, date:"2026-02-10", region:"África Occidental", severity:"low",    alert_type:"nuevo_yacimiento",  title:"Nigeria: descubrimiento offshore de 800 Mbb", barrel_impact:-0.5, affected_iso3:["NGA"], summary:"TotalEnergies confirma yacimiento en OPL-245. Producción estimada 2029." },
  { id:6, date:"2026-01-30", region:"Asia-Pacífico",     severity:"medium", alert_type:"demanda",           title:"China alcanza máximo de importaciones desde 2023", barrel_impact:+3.1, affected_iso3:["CHN","SAU","RUS"], summary:"Importaciones chinas 12.3 Mbb/d. Presión alcista +$3.1/bbl en crudos asiáticos." },
];

// Mock Hormuz data
const MOCK_HORMUZ = {
  date: "2026-04-03",
  daily_vessels: 21,
  daily_oil_mb: 17.2,
  trend_7d_pct: -8.6,
  status: "restringido",
  by_flag: [
    { flag:"Islas Marshall", count:6, pct:28.6 },
    { flag:"Panamá",         count:5, pct:23.8 },
    { flag:"Liberia",        count:4, pct:19.0 },
    { flag:"Malta",          count:3, pct:14.3 },
    { flag:"Grecia",         count:2, pct:9.5  },
    { flag:"Singapur",       count:1, pct:4.8  },
  ],
  history_7d: [
    { date:"2026-03-28", vessels:23, oil_mb:18.8 },
    { date:"2026-03-29", vessels:24, oil_mb:19.6 },
    { date:"2026-03-30", vessels:22, oil_mb:18.0 },
    { date:"2026-03-31", vessels:20, oil_mb:16.4 },
    { date:"2026-04-01", vessels:21, oil_mb:17.2 },
    { date:"2026-04-02", vessels:20, oil_mb:16.3 },
    { date:"2026-04-03", vessels:21, oil_mb:17.2 },
  ],
};

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
const fmt  = n => n?.toLocaleString("es-ES", { maximumFractionDigits: 0 }) ?? "—";
const fmtM = n => n == null ? "—" : (n / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " M";

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["advertencia"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border}`}
          style={{ color: cfg.color }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function KpiCard({ title, value, sub, color, Icon }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{title}</span>
        {Icon && <Icon size={16} style={{ color }} />}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={12} className="text-gray-600 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp size={12} className="text-blue-400 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-400 ml-1 inline" />;
}

// Custom tooltip for price chart
function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>${p.value?.toFixed(2)}</strong>
        </p>
      ))}
    </div>
  );
}

function HormuzTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function AlertCard({ alert }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.low;
  const isUp = alert.barrel_impact > 0;
  return (
    <div className="bg-gray-850 border border-gray-700 rounded-lg p-3 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${sev.badge}`}>{sev.label}</span>
          <span className="text-xs text-gray-500">{alert.region}</span>
          <span className="text-xs text-gray-600">{alert.date}</span>
        </div>
        <span className={`text-xs font-bold whitespace-nowrap flex items-center gap-0.5 ${isUp ? "text-red-400" : "text-emerald-400"}`}>
          {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
          {isUp ? "+" : ""}{alert.barrel_impact.toFixed(1)} $/bbl
        </span>
      </div>
      <p className="text-sm font-medium text-white leading-snug mb-1">{alert.title}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{alert.summary}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN DASHBOARD
// ---------------------------------------------------------------------------
export default function FuelReservesDashboard() {
  const [data,         setData]         = useState(MOCK_RESERVES);
  const [priceHistory, setPriceHistory] = useState(MOCK_PRICE_HISTORY);
  const [supplyAlerts, setSupplyAlerts] = useState(MOCK_ALERTS);
  const [hormuz,       setHormuz]       = useState(MOCK_HORMUZ);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [loading,      setLoading]      = useState(false);

  const [search,       setSearch]       = useState("");
  const [regionFilter, setRegion]       = useState("Todas las regiones");
  const [statusFilter, setStatus]       = useState("Todas");
  const [sortCol,      setSortCol]      = useState("coverage_days");
  const [sortDir,      setSortDir]      = useState("asc");
  const [chartView,    setChartView]    = useState("bottom");

  // Uncomment to fetch from real API:
  // useEffect(() => { refreshData(); }, []);
  const refreshData = async () => {
    setLoading(true);
    try {
      const [res, price, alerts, horm] = await Promise.all([
        fetch(`${API_BASE}/api/reserves`).then(r => r.json()),
        fetch(`${API_BASE}/api/price-history`).then(r => r.json()),
        fetch(`${API_BASE}/api/supply-alerts`).then(r => r.json()),
        fetch(`${API_BASE}/api/hormuz`).then(r => r.json()),
      ]);
      setData(res.reserves);
      setPriceHistory(price);
      setSupplyAlerts(alerts);
      setHormuz(horm);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Derived stats
  const stats = useMemo(() => ({
    total:           data.length,
    critical_count:  data.filter(r => r.status === "crítico").length,
    warning_count:   data.filter(r => r.status === "advertencia").length,
    safe_count:      data.filter(r => r.status === "seguro").length,
    avg_coverage:    Math.round(data.reduce((s, r) => s + r.coverage_days, 0) / Math.max(data.length, 1)),
    total_reserves:  data.reduce((s, r) => s + r.reserves_total, 0),
  }), [data]);

  // Filtered + sorted table
  const filtered = useMemo(() => {
    let rows = [...data];
    if (search)       rows = rows.filter(r => r.country.toLowerCase().includes(search.toLowerCase()));
    if (regionFilter !== "Todas las regiones") rows = rows.filter(r => r.region === regionFilter);
    if (statusFilter !== "Todas") rows = rows.filter(r => r.status === statusFilter);
    rows.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [data, search, regionFilter, statusFilter, sortCol, sortDir]);

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // Chart data – coverage bar
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) =>
      chartView === "bottom" ? a.coverage_days - b.coverage_days : b.coverage_days - a.coverage_days
    );
    return sorted.slice(0, 15);
  }, [data, chartView]);

  // Price chart data – add avg_coverage as second axis
  const priceChartData = useMemo(() => {
    const avgCov = stats.avg_coverage;
    return priceHistory.map((p, i) => ({
      ...p,
      avg_coverage: avgCov + Math.sin(i * 0.3) * 3,  // slight variation for demo
      dateShort: p.date.slice(5),  // MM-DD
    }));
  }, [priceHistory, stats.avg_coverage]);

  const th = (label, col) => (
    <th onClick={() => toggleSort(col)}
        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white whitespace-nowrap select-none">
      {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  const hormuzStatusColor = hormuz.status === "restringido" ? "#f59e0b" : hormuz.status === "crítico" ? "#ef4444" : "#34d399";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── HEADER ── */}
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Reservas Estratégicas de Combustible</h1>
            <p className="text-xs text-gray-500 mt-0.5">Global Fuel Reserves Dashboard · 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Actualizado: {lastRefresh.toLocaleTimeString("es-ES")}
          </span>
          <button onClick={refreshData} disabled={loading}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 flex flex-col gap-5">

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Países" value={stats.total} sub="con datos disponibles" color="#60a5fa" Icon={Globe} />
          <KpiCard title="Cobertura media" value={`${stats.avg_coverage}d`} sub="días de reservas" color="#a78bfa" Icon={Activity} />
          <KpiCard title="Total reservas" value={fmtM(stats.total_reserves)} sub="barriles" color="#38bdf8" Icon={BarChart2} />
          <KpiCard title="En estado seguro" value={stats.safe_count} sub="≥90 días cobertura" color="#34d399" Icon={CheckCircle} />
          <KpiCard title="Advertencia" value={stats.warning_count} sub="30–89 días" color="#f59e0b" Icon={AlertTriangle} />
          <KpiCard title="Estado crítico" value={stats.critical_count} sub="<30 días" color="#ef4444" Icon={XCircle} />
        </div>

        {/* ── FILTERS ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar país…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
            />
          </div>
          <select value={regionFilter} onChange={e => setRegion(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {["Todas","seguro","advertencia","crítico"].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter===s ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
          <span className="text-gray-500 text-xs ml-auto">{filtered.length} países</span>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-900">
                <tr>
                  {th("País",              "country")}
                  {th("Región",            "region")}
                  {th("Reservas (M bbl)",  "reserves_total")}
                  {th("Consumo/día (bbl)", "daily_consumption")}
                  {th("Días cobertura",    "coverage_days")}
                  {th("Estado",            "status")}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Fuente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.map((row, i) => {
                  const pct = Math.min((row.coverage_days / 200) * 100, 100);
                  const barColor = STATUS_CONFIG[row.status]?.color ?? "#6f7280";
                  return (
                    <tr key={i} className="hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3 font-medium text-white text-sm">{row.country}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{row.region}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm font-mono">{fmtM(row.reserves_total)}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm font-mono">{fmt(row.daily_consumption)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, backgroundColor:barColor }} />
                          </div>
                          <span className="text-sm font-semibold" style={{ color:barColor }}>{row.coverage_days}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono">{row.source}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(row.last_updated).toLocaleDateString("es-ES")}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No se encontraron resultados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROW: COVERAGE CHART + PRICE VS RESERVES ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Coverage Bar Chart */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Días de Cobertura por País</h2>
              <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-lg p-1">
                <button onClick={() => setChartView("bottom")}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartView==="bottom" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  Menores
                </button>
                <button onClick={() => setChartView("top")}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartView==="top" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  Mayores
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top:4, right:10, left:0, bottom:60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="country" tick={{ fill:"#9ca3af", fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill:"#9ca3af", fontSize:11 }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
                    <p className="font-medium text-white">{payload[0]?.payload?.country}</p>
                    <p className="text-gray-400">{payload[0]?.value} días de cobertura</p>
                    <StatusBadge status={payload[0]?.payload?.status} />
                  </div>
                ) : null} cursor={{ fill:"rgba(255,255,255,0.05)" }} />
                <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 4" label={{ value:"90d umbral", fill:"#f59e0b", fontSize:11 }} />
                <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" label={{ value:"30d crítico", fill:"#ef4444", fontSize:11 }} />
                <Bar dataKey="coverage_days" radius={[4,4,0,0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={STATUS_CONFIG[entry.status]?.color ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Seguro (≥90d)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Advertencia (30–89d)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Crítico (&lt;30d)</span>
            </div>
          </div>

          {/* Price vs Coverage Chart */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Precio del Barril vs Cobertura Global</h2>
                <p className="text-xs text-gray-500 mt-0.5">WTI · Brent · Días cobertura media (eje dcho.)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-amber-400">${priceHistory.at(-1)?.wti?.toFixed(1)}</span>
                <span className="text-xs text-gray-500">WTI/bbl</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={priceChartData} margin={{ top:4, right:40, left:0, bottom:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="dateShort" tick={{ fill:"#9ca3af", fontSize:10 }} interval={4} />
                <YAxis yAxisId="price" domain={["auto","auto"]} tick={{ fill:"#9ca3af", fontSize:10 }}
                       tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="days" orientation="right" tick={{ fill:"#9ca3af", fontSize:10 }}
                       tickFormatter={v => `${v}d`} />
                <Tooltip content={<PriceTooltip />} />
                <Legend wrapperStyle={{ fontSize:"11px", color:"#9ca3af" }} />
                <Area yAxisId="price" type="monotone" dataKey="wti"   name="WTI $/bbl"
                      stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} dot={false} />
                <Line  yAxisId="price" type="monotone" dataKey="brent" name="Brent $/bbl"
                      stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line  yAxisId="days"  type="monotone" dataKey="avg_coverage" name="Cobertura media (d)"
                      stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── ROW: SUPPLY ALERTS + HORMUZ ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* Supply Alerts */}
          <div className="xl:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Alertas de Suministro</h2>
              <span className="ml-auto text-xs text-gray-500">Geopolítica en tiempo real</span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight:"420px" }}>
              {supplyAlerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
            </div>
            <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-700">
              Fuente: IEA · EIA · Reuters · Análisis interno. En producción, conectar a NewsAPI/GDELT.
            </p>
          </div>

          {/* Hormuz */}
          <div className="xl:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Ship size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Estrecho de Ormuz</h2>
              <span className="ml-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium`}
                      style={{ color:hormuzStatusColor, borderColor:hormuzStatusColor, background:`${hormuzStatusColor}22` }}>
                  {hormuz.status.charAt(0).toUpperCase()+hormuz.status.slice(1)}
                </span>
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-300">{hormuz.daily_vessels}</p>
                <p className="text-xs text-gray-500 mt-0.5">buques/día</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-300">{hormuz.daily_oil_mb}</p>
                <p className="text-xs text-gray-500 mt-0.5">Mbb/día</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${hormuz.trend_7d_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {hormuz.trend_7d_pct > 0 ? "+" : ""}{hormuz.trend_7d_pct}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">vs hace 7 días</p>
              </div>
            </div>

            {/* 7-day traffic chart */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Tráfico últimos 7 días</p>
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart data={hormuz.history_7d} margin={{ top:2, right:0, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill:"#9ca3af", fontSize:9 }} tickFormatter={d=>d.slice(5)} />
                  <YAxis yAxisId="v" hide />
                  <YAxis yAxisId="o" orientation="right" hide />
                  <Tooltip content={<HormuzTooltip />} />
                  <Bar yAxisId="v" dataKey="vessels" name="Buques" fill="#60a5fa" radius={[2,2,0,0]} />
                  <Line yAxisId="o" type="monotone" dataKey="oil_mb" name="Mbb/día" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Flag breakdown */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Distribución por pabellón</p>
              <div className="flex flex-col gap-1.5">
                {hormuz.by_flag.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-32 truncate">{f.flag}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width:`${f.pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">{f.count} ({f.pct}%)</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                Nota: Datos basados en AIS público + estimaciones EIA. En producción, integrar MarineTraffic/VesselFinder API.
              </p>
            </div>
          </div>
        </div>

      </main>

      <footer className="px-6 py-4 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>Dashboard de Reservas Estratégicas de Combustible · v3.0.0 · Actualización cada 24h</span>
        <span>Fuentes: EIA · CORES · IEA · AIS/MarineTraffic</span>
      </footer>
    </div>
  );
}
