/**
 * Shared SignalMap chart colors: deterministic keys for countries and macro concepts.
 * ECharts `TimelineChart` and study pages set `lineStyle` / `itemStyle` from this map
 * (plus explicit `ChartSeries.color` when needed) — not from the default ECharts palette.
 */

/** WDI / comparator geographies; keys match `ChartSeries.key` where used. */
export const SIGNAL_COUNTRY: Record<string, string> = {
  iran: "#f59e0b",
  us: "#2563eb",
  /** Aliases (same as `us` for WDI) */
  usa: "#2563eb",
  united_states: "#2563eb",
  china: "#dc2626",
  turkey: "#10b981",
  saudi_arabia: "#9333ea",
  /** EIA/Comtrade oil *volume* series (short key); WDI uses `saudi_arabia`. */
  saudi: "#15803d",
  germany: "#6b7280",
  brazil: "#059669",
  argentina: "#0284c7",
  india: "#ea580c",
  world: "#262626",
  /** Volumes: Russia and aggregate — not WDI Gini/GDP but shared across oil charts */
  russia: "#b91c1c", // clear red, distinct from china #dc2626 (slightly different hue/weight in plot)
  total: "#737373",
};

/** Recurring economic / oil series semantics (one meaning → one color everywhere). */
export const SIGNAL_CONCEPT: Record<string, string> = {
  oil_price: "#dc2626",
  oil_production: "#2563eb",
  oil_revenue: "#16a34a",
  /** Price × volume–style “capacity” proxies: distinct from oil price (red) and revenue (green). */
  export_capacity: "#5b21b6",
  exports: "#059669",
  imports: "#4f46e5",
  gdp: "#dc2626",
  consumption: "#2563eb",
  investment: "#16a34a",
  inflation: "#0ea5e9", // when used as a single “headline” color (rare; country lines use SIGNAL_COUNTRY)
  gini: "#64748b", // line A / neutral when two poverty lines; country panels use SIGNAL_COUNTRY
  poverty: "#0d9488", // line B / second poverty line
  gold_spot: "#ca8a04",
  /** USD→Toman and generic FX in secondary position */
  exchange_rate: "#0284c7",
  /** Official vs open toman/USD: reference pair */
  fx_official: "#2563eb",
  fx_open: "#16a34a",
  fx_spread: "#f97316",
  /** Broad money (M2) growth — Iran WDI FM.LBL.BMNY.ZG */
  broad_money_m2: "#7c3aed",
  /** Wage / labour */
  wage_nominal: "#2563eb",
  wage_real: "#16a34a",
  wage_index: "#a855f7",
  /** Dutch / ISI index overlays (indexed shares) */
  dutch_oil_rents: "#2563eb",
  dutch_manufacturing: "#16a34a",
  dutch_imports: "#4f46e5",
  dutch_fx_index: "#64748b",
  isi_imports: "#4f46e5",
  isi_exports: "#059669",
  isi_manufacturing: "#15803d",
  isi_industry: "#ca8a04",
  /** Hydrocarbon rent decomposition semantics */
  oil_rents: "#d97706",
  natural_gas_rents: "#0f766e",
  remainder_gdp_proxy: "#6b7280",
};

// Oil economy “indexed overview” re-exports (same as concepts above)
export const OIL_ECONOMY_COLOR_PRODUCTION = SIGNAL_CONCEPT.oil_production;
export const OIL_ECONOMY_COLOR_PRICE = SIGNAL_CONCEPT.oil_price;
export const OIL_ECONOMY_COLOR_REVENUE = SIGNAL_CONCEPT.oil_revenue;

/** ECharts / timeline legacy keys / chart-specific keys → canonical color (hex). */
const LEGACY_KEY: Record<string, string> = {
  oil: SIGNAL_CONCEPT.oil_price,
  proxy: SIGNAL_CONCEPT.export_capacity,
  gold: SIGNAL_CONCEPT.gold_spot,
  fx: SIGNAL_CONCEPT.exchange_rate,
  official: SIGNAL_CONCEPT.fx_official,
  open: SIGNAL_CONCEPT.fx_open,
  spread: SIGNAL_CONCEPT.fx_spread,
  nominal: SIGNAL_CONCEPT.wage_nominal,
  real: SIGNAL_CONCEPT.wage_real,
  index: SIGNAL_CONCEPT.wage_index,
  // Oil economy
  oe_prod: SIGNAL_CONCEPT.oil_production,
  oe_price: SIGNAL_CONCEPT.oil_price,
  oe_rev: SIGNAL_CONCEPT.oil_revenue,
  oe_idx_prod: SIGNAL_CONCEPT.oil_production,
  oe_idx_price: SIGNAL_CONCEPT.oil_price,
  oe_idx_rev: SIGNAL_CONCEPT.oil_revenue,
  // GDP / national accounts (page-level keys)
  dual_level_consumption: SIGNAL_CONCEPT.consumption,
  dual_level_investment: SIGNAL_CONCEPT.investment,
  dual_level_gdp: SIGNAL_CONCEPT.gdp,
  level_consumption: SIGNAL_CONCEPT.consumption,
  level_investment: SIGNAL_CONCEPT.investment,
  level_gdp: SIGNAL_CONCEPT.gdp,
  /** Nominal GDP proxy split (WDI oil rents % × NY.GDP.MKTP.CD) */
  gdp_non_oil_proxy: SIGNAL_CONCEPT.remainder_gdp_proxy,
  gdp_oil_proxy: SIGNAL_CONCEPT.oil_rents,
  gdp_remainder_proxy: SIGNAL_CONCEPT.remainder_gdp_proxy,
  gdp_oil_proxy_hydro: SIGNAL_CONCEPT.oil_rents,
  gdp_gas_proxy_hydro: SIGNAL_CONCEPT.natural_gas_rents,
  real_gdp_remainder_proxy: SIGNAL_CONCEPT.remainder_gdp_proxy,
  real_gdp_oil_proxy_hydro: SIGNAL_CONCEPT.oil_rents,
  real_gdp_gas_proxy_hydro: SIGNAL_CONCEPT.natural_gas_rents,
  pct_consumption: SIGNAL_CONCEPT.consumption,
  pct_investment: SIGNAL_CONCEPT.investment,
  gdp_nominal: SIGNAL_CONCEPT.gdp,
  // poverty
  pov_dday: "#64748b",
  pov_lmic: SIGNAL_CONCEPT.poverty,
  // Dutch disease indexed overview
  dutch_ov_oil: SIGNAL_CONCEPT.dutch_oil_rents,
  dutch_ov_mfg: SIGNAL_CONCEPT.dutch_manufacturing,
  dutch_ov_imp: SIGNAL_CONCEPT.dutch_imports,
  dutch_ov_fx: SIGNAL_CONCEPT.dutch_fx_index,
  // ISI indexed
  isi_ov_imp: SIGNAL_CONCEPT.isi_imports,
  isi_ov_exp: SIGNAL_CONCEPT.isi_exports,
  isi_ov_mfg: SIGNAL_CONCEPT.isi_manufacturing,
  isi_ov_ind: SIGNAL_CONCEPT.isi_industry,
};

/** Sufficiently large, visually separated hues for unmapped `ChartSeries` keys. */
export const SIGNAL_FALLBACK_LINE_PALETTE: readonly string[] = [
  "#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#0d9488", "#f97316", "#db2777", "#0891b2",
  "#4f46e5", "#a16207", "#be123c", "#0f766e", "#64748b", "#ea580c", "#1d4ed8", "#991b1b",
  "#0f172a", "#65a30d", "#5b21b6", "#b45309", "#0369a1",
] as const;

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance2(a: string, b: string): number {
  const A = hexToRgbTuple(a) ?? [128, 128, 128];
  const B = hexToRgbTuple(b) ?? [0, 0, 0];
  const d0 = A[0]! - B[0]!;
  const d1 = A[1]! - B[1]!;
  const d2 = A[2]! - B[2]!;
  return d0 * d0 + d1 * d1 + d2 * d2;
}

/**
 * Picks a fallback for one series, avoiding colors already used on the same chart
 * (best-effort when keys are not in the shared map).
 */
export function pickNonCollidingFallback(used: ReadonlySet<string>, seedIndex: number, salt = 0): string {
  const n = SIGNAL_FALLBACK_LINE_PALETTE.length;
  for (let o = 0; o < n; o += 1) {
    const c = SIGNAL_FALLBACK_LINE_PALETTE[(seedIndex + salt * 3 + o) % n]!;
    if (!used.has(c)) return c;
  }
  return SIGNAL_FALLBACK_LINE_PALETTE[seedIndex % n] ?? "#64748b";
}

type ResolveSeries = { key: string; color?: string; yAxisIndex: number };
type ThemeT = { chartPrimary: string; chart2: string; gold: string; oilColorMuted: string; mutedFg: string };

export const OIL_PRODUCTION_VOLUME_KEYS: readonly string[] = ["us", "saudi", "russia", "iran", "total"];

const PRODUCTION_COUNTRY: Record<string, string> = {
  us: SIGNAL_COUNTRY.us,
  saudi: SIGNAL_COUNTRY.saudi,
  russia: SIGNAL_COUNTRY.russia,
  iran: SIGNAL_COUNTRY.iran,
  total: SIGNAL_COUNTRY.total,
};

export function isOilProductionVolumeKey(key: string): boolean {
  return (OIL_PRODUCTION_VOLUME_KEYS as readonly string[]).includes(key);
}

function colorFromMapOrTheme(s: ResolveSeries, theme: ThemeT): string {
  if (SIGNAL_COUNTRY[s.key] != null) {
    return SIGNAL_COUNTRY[s.key]!;
  }
  if (LEGACY_KEY[s.key] != null) {
    return LEGACY_KEY[s.key]!;
  }
  if (PRODUCTION_COUNTRY[s.key] != null) {
    return PRODUCTION_COUNTRY[s.key]!;
  }
  const isGold = s.key === "gold";
  const isOfficial = s.key === "official";
  const isOpen = s.key === "open";
  const isSpread = s.key === "spread";
  const isWageNominal = s.key === "nominal";
  const isWageReal = s.key === "real";
  const isWageIndex = s.key === "index";
  if (isGold) return theme.gold;
  if (isOfficial) return theme.chartPrimary;
  if (isOpen) return theme.chart2;
  if (isSpread) return theme.oilColorMuted;
  if (isWageNominal) return theme.chartPrimary;
  if (isWageReal) return theme.chart2;
  if (isWageIndex) return theme.oilColorMuted;
  if (s.yAxisIndex === 1 && !isWageIndex) {
    return theme.oilColorMuted;
  }
  return theme.mutedFg;
}

/**
 * Per-chart resolution: explicit `s.color` wins, then shared keys (countries / legacy
 * / concepts), then theme; finally a non-colliding pass on `SIGNAL_FALLBACK_LINE_PALETTE`.
 */
export function resolveTimelineMultiSeriesColors(
  series: ReadonlyArray<ResolveSeries>,
  theme: ThemeT
): string[] {
  const out: string[] = new Array(series.length);
  for (let i = 0; i < series.length; i += 1) {
    const s = series[i]!;
    if (s.color && s.color.trim() !== "") {
      out[i] = s.color;
    } else {
      out[i] = colorFromMapOrTheme(s, theme);
    }
  }
  const used = new Set<string>();
  for (let j = 0; j < out.length; j += 1) {
    const s = series[j]!;
    let c = out[j]!;
    if (s.color && s.color.trim() !== "") {
      used.add(c);
      continue;
    }
    if (used.has(c)) {
      c = pickNonCollidingFallback(used, j, 3);
    }
    for (let k = 0; k < j; k += 1) {
      if (series[k]!.color) continue;
      if (colorDistance2(c, out[k]!) < 2000) {
        c = pickNonCollidingFallback(used, j, j + 5);
        break;
      }
    }
    out[j] = c;
    used.add(c);
  }
  return out;
}
