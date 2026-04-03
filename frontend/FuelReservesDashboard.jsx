/**
 * FuelReservesDashboard.jsx
 * Dashboard de Reservas Estratégicas de Combustible
 *
 * Para usar con backend real, reemplaza MOCK_DATA y activa el useEffect
 * que llama a /api/reserves (ver comentarios en el código).
 *
 * Dependencias: React, recharts, lucide-react
 */

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import {
  Search, AlertTriangle, CheckCircle, XCircle,
  Globe, RefreshCw, ChevronUp, ChevronDown,
  Flame, BarChart2, ShieldAlert, ShieldCheck
} from "lucide-react";

// ---------------------------------------------------------------------------
// DATOS DE EJEMPLO (sustituye por fetch a /api/reserves en producción)
// ---------------------------------------------------------------------------
const MOCK_DATA = {
  reserves: [
    { country: "Estados Unidos",  region: "América",        reserves_total: 1_800_000_000, daily_consumption: 20_000_000, coverage_days: 90,  status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "EIA"   },
    { country: "Japón",           region: "Asia-Pacífico",  reserves_total:   580_000_000, daily_consumption:  3_500_000, coverage_days: 165, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "Países Bajos",    region: "Europa",         reserves_total:   180_000_000, daily_consumption:  1_000_000, coverage_days: 180, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "EAU",             region: "Oriente Medio",  reserves_total:   180_000_000, daily_consumption:  1_000_000, coverage_days: 180, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "OPEP"  },
    { country: "Rusia",           region: "Europa",         reserves_total:   500_000_000, daily_consumption:  3_700_000, coverage_days: 135, status: "seguro",      last_updated: "2026-04-03T08:00:00Z", source: "IEA"   },
    { country: "Corea del Sur",   region: "Asia-Pacífico",  reserves_total:   320_000_000, daily_consumption:  2_800_000, coverage_days: 114, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "Arabia Saudí",    region: "Oriente Medio",  reserves_total:   450_000_000, daily_consumption:  4_000_000, coverage_days: 112, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "OPEP"  },
    { country: "Alemania",        region: "Europa",         reserves_total:   295_000_000, daily_consumption:  2_900_000, coverage_days: 101, status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "España",          region: "Europa",         reserves_total:   120_000_000, daily_consumption:  1_250_000, coverage_days: 96,  status: "seguro",      last_updated: "2026-04-03T10:30:00Z", source: "CORES" },
    { country: "Francia",         region: "Europa",         reserves_total:   240_000_000, daily_consumption:  2_500_000, coverage_days: 96,  status: "seguro",      last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "Italia",          region: "Europa",         reserves_total:   130_000_000, daily_consumption:  1_700_000, coverage_days: 76,  status: "advertencia", last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "Canadá",          region: "América",        reserves_total:   190_000_000, daily_consumption:  2_500_000, coverage_days: 76,  status: "advertencia", last_updated: "2026-04-03T10:00:00Z", source: "EIA"   },
    { country: "Reino Unido",     region: "Europa",         reserves_total:   125_000_000, daily_consumption:  1_800_000, coverage_days: 69,  status: "advertencia", last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "China",           region: "Asia-Pacífico",  reserves_total:   900_000_000, daily_consumption: 16_000_000, coverage_days: 56,  status: "advertencia", last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "Singapur",        region: "Asia-Pacífico",  reserves_total:    75_000_000, daily_consumption:  1_500_000, coverage_days: 50,  status: "advertencia", last_updated: "2026-04-03T09:00:00Z", source: "IEA"   },
    { country: "Turquía",         region: "Europa",         reserves_total:    50_000_000, daily_consumption:  1_000_000, coverage_days: 50,  status: "advertencia", last_updated: "2026-04-03T09:00:00Z", source: "IEA"   },
    { country: "Australia",       region: "Asia-Pacífico",  reserves_total:    60_000_000, daily_consumption:  1_000_000, coverage_days: 60,  status: "advertencia", last_updated: "2026-04-03T10:00:00Z", source: "IEA"   },
    { country: "India",           region: "Asia-Pacífico",  reserves_total:   185_000_000, daily_consumption:  5_000_000, coverage_days: 37,  status: "crítico",     last_updated: "2026-04-03T09:00:00Z", source: "IEA"   },
    { country: "Brasil",          region: "América",        reserves_total:   120_000_000, daily_consumption:  3_300_000, coverage_days: 36,  status: "crítico",     last_updated: "2026-04-03T09:00:00Z", source: "IEA"   },
    { country: "México",          region: "América",        reserves_total:     7_500_000, daily_consumption:  1_250_000, coverage_days: 6,   status: "crítico",     last_updated: "2026-04-03T09:15:00Z", source: "IEA"   },
  ],
  global_stats: {
    total_reserves:    6_309_500_000,
    average_coverage:  87,
    critical_countries: 3,
    safe_countries:     10,
  },
};

// ---------------------------------------------------------------------------
// CONSTANTES DE CONFIGURACIÓN
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  seguro:      { color: "#10b981", barColor: "#10b981", label: "Seguro",      Icon: ShieldCheck  },
  advertencia: { color: "#f59e0b", barColor: "#f59e0b", label: "Advertencia", Icon: AlertTriangle },
  crítico:     { color: "#ef4444", barColor: "#ef4444", label: "Crítico",     Icon: ShieldAlert  },
};

const REGIONS = ["Todas", "América", "Europa", "Asia-Pacífico", "Oriente Medio"];

const fmt = (n) => new Intl.NumberFormat("es-ES").format(n);
const fmtM = (n) => `${(n / 1_000_000).toFixed(1)} M`;

// ---------------------------------------------------------------------------
// SUBCOMPONENTES
// ---------------------------------------------------------------------------
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
      <div className="rounded-lg p-3" style={{ backgroundColor: color + "22" }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.advertencia;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44` }}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronUp size={14} className="text-gray-600" />;
  return dir === "asc"
    ? <ChevronUp size={14} className="text-blue-400" />
    : <ChevronDown size={14} className="text-blue-400" />;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white font-semibold">{d.country}</p>
      <p className="text-gray-400">{d.coverage_days} días de cobertura</p>
      <StatusBadge status={d.status} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function FuelReservesDashboard() {
  const [data, setData]             = useState(MOCK_DATA);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("Todas");
  const [regionFilter, setRegion]   = useState("Todas");
  const [sortKey, setSortKey]       = useState("coverage_days");
  const [sortDir, setSortDir]       = useState("asc");
  const [chartView, setChartView]   = useState("bottom");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ----- Para producción: activa este bloque y elimina MOCK_DATA -----
  // useEffect(() => { refreshData(); }, []);
  const refreshData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reserves");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...data.reserves];
    if (search)        rows = rows.filter(r => r.country.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "Todas") rows = rows.filter(r => r.status === statusFilter.toLowerCase());
    if (regionFilter !== "Todas") rows = rows.filter(r => r.region === regionFilter);
    rows.sort((a, b) => {
      const v = sortDir === "asc" ? 1 : -1;
      if (typeof a[sortKey] === "number") return (a[sortKey] - b[sortKey]) * v;
      return a[sortKey].localeCompare(b[sortKey]) * v;
    });
    return rows;
  }, [data, search, statusFilter, regionFilter, sortKey, sortDir]);

  const chartData = useMemo(() => {
    const sorted = [...data.reserves].sort((a, b) => a.coverage_days - b.coverage_days);
    return chartView === "bottom" ? sorted.slice(0, 10) : sorted.slice(-10).reverse();
  }, [data, chartView]);

  const th = (label, key) => (
    <th
      key={key}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => handleSort(key)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  );

  const stats = data.global_stats;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame size={28} className="text-orange-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Reservas Estratégicas de Combustible</h1>
            <p className="text-xs text-gray-500">Monitor global en tiempo real · Fuentes: IEA · EIA · OPEP · CORES</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Actualizado: {lastRefresh.toLocaleTimeString("es-ES")}
          </span>
          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* ── KPI CARDS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Globe}
            label="Reservas Mundiales"
            value={fmtM(stats.total_reserves)}
            sub="barriles totales"
            color="#60a5fa"
          />
          <KpiCard
            icon={BarChart2}
            label="Cobertura Media Global"
            value={`${stats.average_coverage} días`}
            sub="umbral crítico: 90 días"
            color="#a78bfa"
          />
          <KpiCard
            icon={ShieldAlert}
            label="Países en Estado Crítico"
            value={stats.critical_countries}
            sub="< 30 días de cobertura"
            color="#f87171"
          />
          <KpiCard
            icon={ShieldCheck}
            label="Países en Estado Seguro"
            value={stats.safe_countries}
            sub="≥ 90 días de cobertura"
            color="#34d399"
          />
        </div>

        {/* ── FILTROS ───────────────────────────────────────────────── */}
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
          <select
            value={regionFilter}
            onChange={e => setRegion(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {["Todas", "Seguro", "Advertencia", "Crítico"].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="text-gray-500 text-xs ml-auto">{filtered.length} países</span>
        </div>

        {/* ── TABLA ─────────────────────────────────────────────────── */}
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
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-sm font-semibold" style={{ color: barColor }}>
                            {row.coverage_days}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono">
                          {row.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(row.last_updated).toLocaleDateString("es-ES")}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No se encontraron resultados para los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── GRÁFICO ───────────────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Días de Cobertura por País</h2>
            <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-lg p-1">
              <button
                onClick={() => setChartView("bottom")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartView === "bottom" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}
              >
                Menores reservas
              </button>
              <button
                onClick={() => setChartView("top")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartView === "top" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}
              >
                Mayores reservas
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="country"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "90d umbral", fill: "#f59e0b", fontSize: 11 }} />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "30d crítico", fill: "#ef4444", fontSize: 11 }} />
              <Bar dataKey="coverage_days" radius={[4, 4, 0, 0]}>
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
      </main>

      <footer className="px-6 py-4 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>Dashboard de Reservas Estratégicas de Combustible · Actualización cada 24h</span>
        <span>Fuentes: IEA · EIA · OPEP · CORES</span>
      </footer>
    </div>
  );
}
