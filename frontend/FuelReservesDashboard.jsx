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
  Activity, BarChart2, Plane, ChevronRight,
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

// ---------------------------------------------------------------------------
// MOCK DATA – Aviación v3.1.0
// ---------------------------------------------------------------------------
const MOCK_AVIATION_FUEL = [
  { country:"Estados Unidos", iso3:"USA", jet_a1_days:55, jet_a1_mt:28.5, daily_consumption_kt:518, status:"seguro",
    major_airports:[
      {iata:"ATL",name:"Hartsfield-Jackson",city:"Atlanta",     jet_a1_days:58,jet_a1_kt:285,daily_kt:4.9,status:"seguro"},
      {iata:"LAX",name:"Los Ángeles Intl",  city:"Los Ángeles", jet_a1_days:52,jet_a1_kt:260,daily_kt:5.0,status:"seguro"},
      {iata:"ORD",name:"O'Hare Intl",       city:"Chicago",     jet_a1_days:54,jet_a1_kt:238,daily_kt:4.4,status:"seguro"},
      {iata:"JFK",name:"John F. Kennedy",   city:"Nueva York",  jet_a1_days:50,jet_a1_kt:215,daily_kt:4.3,status:"seguro"},
      {iata:"DFW",name:"Dallas/Ft. Worth",  city:"Dallas",      jet_a1_days:56,jet_a1_kt:224,daily_kt:4.0,status:"seguro"},
    ]},
  { country:"EAU",            iso3:"ARE", jet_a1_days:62, jet_a1_mt:9.2,  daily_consumption_kt:148, status:"seguro",
    major_airports:[
      {iata:"DXB",name:"Dubai Intl",     city:"Dubai",     jet_a1_days:65,jet_a1_kt:320,daily_kt:4.9,status:"seguro"},
      {iata:"AUH",name:"Abu Dhabi Intl", city:"Abu Dhabi", jet_a1_days:58,jet_a1_kt:145,daily_kt:2.5,status:"seguro"},
    ]},
  { country:"Japón",          iso3:"JPN", jet_a1_days:58, jet_a1_mt:7.4,  daily_consumption_kt:127, status:"seguro",
    major_airports:[
      {iata:"HND",name:"Tokyo Haneda", city:"Tokio", jet_a1_days:60,jet_a1_kt:165,daily_kt:2.8,status:"seguro"},
      {iata:"NRT",name:"Tokyo Narita", city:"Tokio", jet_a1_days:55,jet_a1_kt:120,daily_kt:2.2,status:"seguro"},
      {iata:"KIX",name:"Osaka Kansai", city:"Osaka", jet_a1_days:52,jet_a1_kt:62, daily_kt:1.2,status:"seguro"},
    ]},
  { country:"Alemania",       iso3:"DEU", jet_a1_days:48, jet_a1_mt:5.8,  daily_consumption_kt:121, status:"seguro",
    major_airports:[
      {iata:"FRA",name:"Frankfurt Main",     city:"Frankfurt",jet_a1_days:48,jet_a1_kt:175,daily_kt:3.6,status:"seguro"},
      {iata:"MUC",name:"Múnich Franz Josef", city:"Múnich",   jet_a1_days:46,jet_a1_kt:92, daily_kt:2.0,status:"seguro"},
      {iata:"BER",name:"Berlín Brandenburg", city:"Berlín",   jet_a1_days:44,jet_a1_kt:35, daily_kt:0.8,status:"seguro"},
    ]},
  { country:"Francia",        iso3:"FRA", jet_a1_days:42, jet_a1_mt:4.8,  daily_consumption_kt:114, status:"seguro",
    major_airports:[
      {iata:"CDG",name:"Charles de Gaulle",city:"París",jet_a1_days:42,jet_a1_kt:145,daily_kt:3.5,status:"seguro"},
      {iata:"ORY",name:"Orly",            city:"París",jet_a1_days:38,jet_a1_kt:45, daily_kt:1.2,status:"advertencia"},
    ]},
  { country:"España",         iso3:"ESP", jet_a1_days:40, jet_a1_mt:2.9,  daily_consumption_kt:72,  status:"seguro",
    major_airports:[
      {iata:"MAD",name:"Adolfo Suárez Barajas",city:"Madrid",    jet_a1_days:40,jet_a1_kt:95,daily_kt:2.4,status:"seguro"},
      {iata:"BCN",name:"El Prat",               city:"Barcelona", jet_a1_days:38,jet_a1_kt:62,daily_kt:1.6,status:"advertencia"},
      {iata:"PMI",name:"Palma de Mallorca",     city:"Palma",     jet_a1_days:35,jet_a1_kt:28,daily_kt:0.8,status:"crítico"},
    ]},
  { country:"Reino Unido",    iso3:"GBR", jet_a1_days:38, jet_a1_mt:3.9,  daily_consumption_kt:103, status:"advertencia",
    major_airports:[
      {iata:"LHR",name:"London Heathrow",city:"Londres",   jet_a1_days:38,jet_a1_kt:118,daily_kt:3.1,status:"advertencia"},
      {iata:"LGW",name:"London Gatwick", city:"Londres",   jet_a1_days:35,jet_a1_kt:42, daily_kt:1.2,status:"crítico"},
      {iata:"MAN",name:"Manchester",     city:"Manchester",jet_a1_days:40,jet_a1_kt:28, daily_kt:0.7,status:"advertencia"},
    ]},
  { country:"Turquía",        iso3:"TUR", jet_a1_days:28, jet_a1_mt:3.1,  daily_consumption_kt:111, status:"advertencia",
    major_airports:[
      {iata:"IST",name:"Istanbul",      city:"Estambul",jet_a1_days:28,jet_a1_kt:185,daily_kt:6.6,status:"advertencia"},
      {iata:"SAW",name:"Sabiha Gökçen", city:"Estambul",jet_a1_days:25,jet_a1_kt:65, daily_kt:2.6,status:"advertencia"},
    ]},
  { country:"Singapur",       iso3:"SGP", jet_a1_days:32, jet_a1_mt:2.8,  daily_consumption_kt:88,  status:"advertencia",
    major_airports:[
      {iata:"SIN",name:"Changi",city:"Singapur",jet_a1_days:32,jet_a1_kt:280,daily_kt:8.8,status:"advertencia"},
    ]},
  { country:"China",          iso3:"CHN", jet_a1_days:25, jet_a1_mt:22.0, daily_consumption_kt:880, status:"advertencia",
    major_airports:[
      {iata:"PEK",name:"Beijing Capital",  city:"Pekín",     jet_a1_days:24,jet_a1_kt:520,daily_kt:21.7,status:"advertencia"},
      {iata:"PVG",name:"Shanghai Pudong",  city:"Shanghái",  jet_a1_days:26,jet_a1_kt:480,daily_kt:18.5,status:"advertencia"},
      {iata:"PKX",name:"Beijing Daxing",   city:"Pekín",     jet_a1_days:22,jet_a1_kt:285,daily_kt:13.0,status:"advertencia"},
      {iata:"CAN",name:"Guangzhou Baiyun", city:"Guangzhou", jet_a1_days:23,jet_a1_kt:340,daily_kt:14.8,status:"advertencia"},
    ]},
];

const MOCK_AIRLINE_STRATEGY = [
  {airline:"Delta Air Lines",    iata_code:"DL",country:"EE.UU.",      alliance:"SkyTeam",      has_own_supply:true,  own_supply_note:"Propietaria de Monroe Energy (refinería Trainer, PA). Cubre ~80% demanda doméstica.",         futures_pct:50,spot_pct:50,hedge_months_fwd:12,annual_fuel_mt:10.8},
  {airline:"Southwest Airlines", iata_code:"WN",country:"EE.UU.",      alliance:"LCC",          has_own_supply:false, own_supply_note:"Sin refinería. Líder histórico en cobertura financiera vía opciones y swaps.",               futures_pct:70,spot_pct:30,hedge_months_fwd:18,annual_fuel_mt:7.2},
  {airline:"United Airlines",    iata_code:"UA",country:"EE.UU.",      alliance:"Star Alliance", has_own_supply:false, own_supply_note:"Sin activos de refinería. Compras a BP, Shell, Valero.",                                    futures_pct:40,spot_pct:60,hedge_months_fwd:9, annual_fuel_mt:10.1},
  {airline:"American Airlines",  iata_code:"AA",country:"EE.UU.",      alliance:"oneworld",      has_own_supply:false, own_supply_note:"Históricamente mínimo hedging. Máxima exposición spot del sector.",                        futures_pct:20,spot_pct:80,hedge_months_fwd:3, annual_fuel_mt:10.5},
  {airline:"Ryanair",            iata_code:"FR",country:"Irlanda",     alliance:"LCC",          has_own_supply:false, own_supply_note:"Sin refinería. Contratos con BP Aviation y Shell Aviation.",                                futures_pct:55,spot_pct:45,hedge_months_fwd:12,annual_fuel_mt:4.9},
  {airline:"IAG (BA/Iberia)",    iata_code:"IB",country:"UK/España",   alliance:"oneworld",      has_own_supply:false, own_supply_note:"Sin refinería. Contratos con Shell, Vitol y Total.",                                      futures_pct:60,spot_pct:40,hedge_months_fwd:12,annual_fuel_mt:6.8},
  {airline:"Lufthansa Group",    iata_code:"LH",country:"Alemania",    alliance:"Star Alliance", has_own_supply:false, own_supply_note:"LH Solutions gestiona hedging centralizado para Swiss, Austrian y Brussels.",               futures_pct:68,spot_pct:32,hedge_months_fwd:18,annual_fuel_mt:8.4},
  {airline:"Emirates",           iata_code:"EK",country:"EAU",         alliance:"Independent",   has_own_supply:true,  own_supply_note:"Acceso preferencial a Jet-A1 vía ENOC y ADNOC.",                                         futures_pct:45,spot_pct:55,hedge_months_fwd:9, annual_fuel_mt:12.5},
  {airline:"Qatar Airways",      iata_code:"QR",country:"Qatar",       alliance:"oneworld",      has_own_supply:true,  own_supply_note:"Respaldo de QatarEnergy. Precios de transferencia preferentes.",                           futures_pct:50,spot_pct:50,hedge_months_fwd:12,annual_fuel_mt:6.9},
  {airline:"Air France-KLM",     iata_code:"AF",country:"Francia/NLD", alliance:"SkyTeam",       has_own_supply:false, own_supply_note:"Sin refinería. Suministro de TotalEnergies y Shell.",                                    futures_pct:63,spot_pct:37,hedge_months_fwd:12,annual_fuel_mt:7.1},
  {airline:"Singapore Airlines", iata_code:"SQ",country:"Singapur",   alliance:"Star Alliance", has_own_supply:false, own_supply_note:"Sin refinería. Contratos con ExxonMobil y Shell en Changi.",                             futures_pct:55,spot_pct:45,hedge_months_fwd:12,annual_fuel_mt:5.0},
  {airline:"Turkish Airlines",   iata_code:"TK",country:"Turquía",    alliance:"Star Alliance", has_own_supply:false, own_supply_note:"Parcial respaldo estatal vía BOTAŞ/Tüpraş. Hedging limitado.",                           futures_pct:30,spot_pct:70,hedge_months_fwd:6, annual_fuel_mt:5.8},
];

const MOCK_AIRLINE_RUNWAY = [
  {airline:"Qatar Airways",     iata_code:"QR",country:"Qatar",       runway_days:90,fuel_reserve_mt:1.70,daily_consumption_kt:18.9,status:"seguro",     hedged_until:"Oct 2026",risk_note:"Respaldo estatal QatarEnergy. Mayor colchón del sector."},
  {airline:"Southwest Airlines",iata_code:"WN",country:"EE.UU.",      runway_days:75,fuel_reserve_mt:1.48,daily_consumption_kt:19.7,status:"seguro",     hedged_until:"Ago 2026",risk_note:"Cobertura financiera más sólida de las aerolíneas de EE.UU."},
  {airline:"Emirates",          iata_code:"EK",country:"EAU",         runway_days:65,fuel_reserve_mt:2.23,daily_consumption_kt:34.3,status:"seguro",     hedged_until:"Jul 2026",risk_note:"Acceso prioritario ENOC/ADNOC mitiga riesgo de desabastecimiento."},
  {airline:"Lufthansa Group",   iata_code:"LH",country:"Alemania",    runway_days:60,fuel_reserve_mt:1.38,daily_consumption_kt:23.0,status:"seguro",     hedged_until:"Jul 2026",risk_note:"Cobertura LH Solutions ~68% forward a 18 meses."},
  {airline:"Delta Air Lines",   iata_code:"DL",country:"EE.UU.",      runway_days:55,fuel_reserve_mt:1.63,daily_consumption_kt:29.6,status:"seguro",     hedged_until:"Jun 2026",risk_note:"Monroe Energy: suministro físico directo ~80% doméstico."},
  {airline:"Singapore Airlines",iata_code:"SQ",country:"Singapur",   runway_days:55,fuel_reserve_mt:0.75,daily_consumption_kt:13.7,status:"seguro",     hedged_until:"Jun 2026",risk_note:"Hub estratégico de Changi asegura suministro prioritario."},
  {airline:"IAG (BA/Iberia)",   iata_code:"IB",country:"UK/España",   runway_days:50,fuel_reserve_mt:0.93,daily_consumption_kt:18.6,status:"seguro",     hedged_until:"Jun 2026",risk_note:"60% cubierto a 12m. Mayor exposición en LGW."},
  {airline:"Air France-KLM",    iata_code:"AF",country:"Francia/NLD", runway_days:45,fuel_reserve_mt:0.87,daily_consumption_kt:19.5,status:"seguro",     hedged_until:"Jun 2026",risk_note:"63% hedgeado. Dependencia CDG/AMS si suministros europeos se tensan."},
  {airline:"Ryanair",           iata_code:"FR",country:"Irlanda",     runway_days:45,fuel_reserve_mt:0.60,daily_consumption_kt:13.5,status:"seguro",     hedged_until:"Jun 2026",risk_note:"55% cubierto. Modelo LCC expone márgenes en escenario spot alto."},
  {airline:"United Airlines",   iata_code:"UA",country:"EE.UU.",      runway_days:40,fuel_reserve_mt:1.10,daily_consumption_kt:27.7,status:"advertencia",hedged_until:"May 2026",risk_note:"40% hedgeado. Exposición relevante si crudo rebasa $100/bbl."},
  {airline:"Turkish Airlines",  iata_code:"TK",country:"Turquía",    runway_days:35,fuel_reserve_mt:0.56,daily_consumption_kt:15.9,status:"advertencia",hedged_until:"May 2026",risk_note:"30% cubierto. Lira débil + tensiones regionales elevan riesgo."},
  {airline:"American Airlines", iata_code:"AA",country:"EE.UU.",      runway_days:25,fuel_reserve_mt:0.72,daily_consumption_kt:28.7,status:"crítico",    hedged_until:"Abr 2026",risk_note:"Mínimo hedging histórico. Mayor vulnerabilidad spot del sector."},
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
    { date:"2026-03-28", vessels:2k, oil_mb:18.8 },
    { date:"2026-03-29", vessels:24, oil_mb:19.6 },
    { date:"2026-03-30", vessels:22, oil_mb:18.0 },
    { date:"2026-03-31", vessels:2k, oil_mb:16.4 },
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

// Runway bar (días de operaciones)
function RunwayBar({ days, max = 100 }) {
  const pct = Math.min((days / max) * 100, 100);
  const color = days >= 60 ? "#34d399" : days >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width:`${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color }}>{days}d</span>
    </div>
  );
}

// Hedge bar (futuros vs spot)
function HedgeBar({ futures, spot }) {
  return (
    <div className="flex items-center gap-1 w-full">
      <div className="flex-1 h-2 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width:`${futures}%` }} title={`Futuros ${futures}%`} />
        <div className="h-full bg-orange-400" style={{ width:`${spot}%` }} title={`Spot ${spot}%`} />
      </div>
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

  // Aviation section state
  const [avTab,        setAvTab]        = useState("runway");
  const [avExpanded,   setAvExpanded]   = useState({});
  const [aviationFuel, setAviationFuel] = useState(MOCK_AVIATION_FUEL);
  const [airlineStrat, setAirlineStrat] = useState(MOCK_AIRLINE_STRATEGY);
  const [airlineRwy,   setAirlineRwy]   = useState(MOCK_AIRLINE_RUNWAY);

  // Uncomment to fetch from real API:
  // useEffect(() => { refreshData(); }, []);
  const refreshData = async () => {
    setLoading(true);
    try {
      const [res, price, alerts, horm, avFuel, alStrat, alRwy] = await Promise.all([
        fetch(`${API_BASE}/api/reserves`).then(r => r.json()),
        fetch(`${API_BASE}/api/price-history`).then(r => r.json()),
        fetch(`${API_BASE}/api/supply-alerts`).then(r => r.json()),
        fetch(`${API_BASE}/api/hormuz`).then(r => r.json()),
        fetch(`${API_BASE}/api/aviation-fuel`).then(r => r.json()),
        fetch(`${API_BASE}/api/airline-strategy`).then(r => r.json()),
        fetch(`${API_BASE}/api/airline-runway`).then(r => r.json()),
      ]);
      setData(res.reserves);
      setPriceHistory(price);
      setSupplyAlerts(alerts);
      setHormuz(horm);
      if (avFuel?.countries)  setAviationFuel(avFuel.countries);
      if (alStrat?.airlines)  setAirlineStrat(alStrat.airlines);
      if (alRwy?.airlines)    setAirlineRwy(alRwy.airlines);
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
                    <Cell key={idx} fill={STATUS_CONFIG[entry.status]?.color ?? "#6f7280"} />
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

        {/* ── AVIATION FUEL SECTION ── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          {/* Header + tabs */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Plane size={16} className="text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Aviación · Jet-A1 &amp; Queroseno</h2>
            <div className="ml-auto flex gap-1 flex-wrap">
              {[["runway","Días Operación"],["strategy","Estrategia Compra"],["airports","Aeropuertos"]].map(([t,label]) => (
                <button key={t} onClick={() => setAvTab(t)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${avTab===t ? "bg-sky-900/60 border-sky-600 text-sky-300" : "border-gray-600 text-gray-500 hover:text-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB A – Días de Operaciones */}
          {avTab === "runway" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Estimación de días de vuelo restantes antes de cancelación total · basado en reservas declaradas + cobertura financiera (futuros) · Fuente: informes anuales / IATA
              </p>
              {/* Legend */}
              <div className="flex gap-4 mb-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-emerald-500 inline-block"/>≥60 días: Seguro</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-amber-400 inline-block"/>40–59: Advertencia</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-red-500 inline-block"/>&lt;40: Crítico</span>
              </div>
              <div className="flex flex-col gap-2">
                {airlineRwy.map(a => (
                  <div key={a.iata_code} className="bg-gray-900 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        <span className="text-xs font-bold text-gray-400">{a.iata_code}</span>
                      </div>
                      <div className="w-44 flex-shrink-0">
                        <p className="text-xs font-semibold text-white truncate">{a.airline}</p>
                        <p className="text-xs text-gray-500">{a.country}</p>
                      </div>
                      <RunwayBar days={a.runway_days} max={100} />
                      <div className="w-28 flex-shrink-0 text-right">
                        <p className="text-xs text-gray-500">cub. hasta</p>
                        <p className="text-xs text-gray-300 font-medium">{a.hedged_until}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 ml-11">{a.risk_note}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-700">
                Nota: Días = reservas declaradas / consumo diario. Incluye cobertura financiera via futuros. En producción, actualizar con datos trimestrales 10-K/20-F.
              </p>
            </div>
          )}

          {/* TAB B – Estrategia de Compra */}
          {avTab === "strategy" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Política de compra de combustible por aerolínea · % cubierto con futuros vs spot · Fuente: informes anuales 2025 / IATA Fuel Monitor
              </p>
              {/* Legend */}
              <div className="flex gap-4 mb-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-emerald-500 inline-block"/>Futuros</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-orange-400 inline-block"/>Spot</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-2 pr-3 font-medium">Aerolínea</th>
                      <th className="text-left py-2 pr-3 font-medium">Alianza</th>
                      <th className="text-center py-2 pr-3 font-medium">Suministro propio</th>
                      <th className="text-left py-2 pr-3 font-medium w-40">Futuros / Spot</th>
                      <th className="text-center py-2 pr-3 font-medium">Meses fwd</th>
                      <th className="text-right py-2 font-medium">Mt/año</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...airlineStrat].sort((a,b) => b.futures_pct - a.futures_pct).map(a => (
                      <tr key={a.iata_code} className="border-b border-gray-700/50 hover:bg-gray-700/30 group">
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-white">{a.airline}</span>
                          <span className="text-gray-500 ml-1">({a.iata_code})</span>
                        </td>
                        <td className="py-2 pr-3 text-gray-400">{a.alliance}</td>
                        <td className="py-2 pr-3 text-center">
                          {a.has_own_supply
                            ? <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700 font-medium">Sí</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <HedgeBar futures={a.futures_pct} spot={a.spot_pct} />
                            <span className="text-emerald-400 font-bold w-8 text-right">{a.futures_pct}%</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-center text-gray-300">{a.hedge_months_fwd}m</td>
                        <td className="py-2 text-right text-gray-300">{a.annual_fuel_mt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Own supply detail */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">Aerolíneas con suministro propio:</p>
                {airlineStrat.filter(a => a.has_own_supply).map(a => (
                  <div key={a.iata_code} className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-2 mb-2">
                    <p className="text-xs font-semibold text-emerald-300">{a.airline} ({a.iata_code})</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.own_supply_note}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-700">
                Fuente: Informes anuales 2025. En producción, integrar Bloomberg Fuel Hedging Monitor o datos IATA API.
              </p>
            </div>
          )}

          {/* TAB C – Aeropuertos */}
          {avTab === "airports" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Reservas de Jet-A1 en tierra por aeropuerto · días de cobertura · Fuente: IATA / EUROCONTROL / CORES / CAAC
              </p>
              <div className="flex flex-col gap-2">
                {aviationFuel.map(c => (
                  <div key={c.iso3} className="bg-gray-900 rounded-lg overflow-hidden">
                    {/* Country header */}
                    <button
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-700/40 transition-colors"
                      onClick={() => setAvExpanded(prev => ({ ...prev, [c.iso3]: !prev[c.iso3] }))}
                    >
                      <ChevronRight size={14} className={`text-gray-500 transition-transform ${avExpanded[c.iso3] ? "rotate-90" : ""}`} />
                      <span className="text-xs font-semibold text-white w-36 text-left">{c.country}</span>
                      <RunwayBar days={c.jet_a1_days} max={70} />
                      <span className="text-xs text-gray-500 w-24 text-right">{c.jet_a1_mt} Mt total</span>
                      <StatusBadge status={c.status} />
                    </button>
                    {/* Airport rows */}
                    {avExpanded[c.iso3] && (
                      <div className="border-t border-gray-700">
                        <div className="grid grid-cols-5 gap-2 px-4 py-1 text-xs text-gray-600 font-medium border-b border-gray-700/50">
                          <span>IATA</span><span>Aeropuerto</span><span>Ciudad</span><span>Días</span><span>Estado</span>
                        </div>
                        {c.major_airports.map(ap => (
                          <div key={ap.iata} className="grid grid-cols-5 gap-2 px-4 py-2 text-xs border-b border-gray-700/30 hover:bg-gray-700/20">
                            <span className="font-bold text-sky-400">{ap.iata}</span>
                            <span className="text-gray-300 truncate">{ap.name}</span>
                            <span className="text-gray-500">{ap.city}</span>
                            <span className="font-semibold" style={{ color: ap.jet_a1_days >= 50 ? "#34d399" : ap.jet_a1_days >= 35 ? "#f59e0b" : "#ef4444" }}>{ap.jet_a1_days}d</span>
                            <StatusBadge status={ap.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-700">
                Nota: Datos en tierra (into-plane). En producción, integrar IATA Ground Fuel Management API o datos de operadores de aeropuertos.
              </p>
            </div>
          )}
        </div>

      </main>

      <footer className="px-6 py-4 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>Dashboard de Reservas Estratégicas de Combustible · v3.1.0 · Actualización cada 24h</span>
        <span>Fuentes: EIA · CORES · IEA · AIS/MarineTraffic · IATA · EUROCONTROL</span>
      </footer>
    </div>
  );
}
