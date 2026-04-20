/**
 * Display-only indexing for Iran GDP levels (consumption, GDP, investment).
 * Each series is divided by its own value in the chosen base calendar year.
 */

export type GdpLevelPoint = { date: string; value: number };

function numericValue(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** First four characters → calendar year (robust to trailing time / timezone suffixes). */
export function yearFromIsoDate(isoDate: string): number {
  const y = parseInt(isoDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : NaN;
}

/** One value per calendar year (first point in that year after sorting by date string). */
function valueByYear(points: GdpLevelPoint[]): Map<number, number> {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const m = new Map<number, number>();
  for (const p of sorted) {
    const y = yearFromIsoDate(p.date);
    if (!Number.isFinite(y)) continue;
    const v = numericValue(p.value);
    if (v == null) continue;
    if (!m.has(y)) m.set(y, v);
  }
  return m;
}

function isValidCommonBase(
  c: Map<number, number>,
  g: Map<number, number>,
  i: Map<number, number>,
  year: number
): boolean {
  const cv = c.get(year);
  const gv = g.get(year);
  const iv = i.get(year);
  return (
    cv != null &&
    gv != null &&
    iv != null &&
    cv !== 0 &&
    gv !== 0 &&
    iv !== 0 &&
    Number.isFinite(cv) &&
    Number.isFinite(gv) &&
    Number.isFinite(iv)
  );
}

/**
 * Earliest calendar year where all three series have finite, non-zero values.
 * Uses year keys (not full date strings) so minor date formatting differences across
 * series cannot break the base.
 */
export function firstCommonBaseYear(
  consumption: GdpLevelPoint[],
  gdp: GdpLevelPoint[],
  investment: GdpLevelPoint[]
): number | null {
  if (!consumption.length || !gdp.length || !investment.length) return null;
  const c = valueByYear(consumption);
  const g = valueByYear(gdp);
  const i = valueByYear(investment);
  const years = [...new Set([...c.keys(), ...g.keys(), ...i.keys()])].sort((a, b) => a - b);
  for (const y of years) {
    if (isValidCommonBase(c, g, i, y)) return y;
  }
  return null;
}

/**
 * Resolve base year: try ``preferredGregorianYears`` in order (e.g. 1976 ≈ Solar 1355 for Iran),
 * then fall back to ``firstCommonBaseYear``.
 */
export function resolveIndexedBaseYear(
  consumption: GdpLevelPoint[],
  gdp: GdpLevelPoint[],
  investment: GdpLevelPoint[],
  options?: { preferredGregorianYears?: number[] }
): number | null {
  if (!consumption.length || !gdp.length || !investment.length) return null;
  const c = valueByYear(consumption);
  const g = valueByYear(gdp);
  const i = valueByYear(investment);
  for (const y of options?.preferredGregorianYears ?? []) {
    if (isValidCommonBase(c, g, i, y)) return y;
  }
  const years = [...new Set([...c.keys(), ...g.keys(), ...i.keys()])].sort((a, b) => a - b);
  for (const y of years) {
    if (isValidCommonBase(c, g, i, y)) return y;
  }
  return null;
}

/** indexed_value = value / value_in_base_year for that series (display only). */
export function indexSeriesAtBaseYear(points: GdpLevelPoint[], baseYear: number): GdpLevelPoint[] {
  const byY = valueByYear(points);
  const baseVal = byY.get(baseYear);
  if (baseVal == null || baseVal === 0 || !Number.isFinite(baseVal)) {
    return points.map((p) => ({ ...p, value: Number.NaN }));
  }
  return points.map((p) => {
    const v = numericValue(p.value);
    if (v == null || v === 0) return { ...p, value: Number.NaN };
    return { ...p, value: v / baseVal };
  });
}

/**
 * Cross-country GDP comparison: index = 100 × (value / value in base year).
 * Tries calendar year 2000 first, then earliest year with a usable base value for that series.
 */
export function indexGdpComparisonTo100Base2000(points: GdpLevelPoint[]): GdpLevelPoint[] {
  const years = [...new Set(points.map((p) => yearFromIsoDate(p.date)))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  const tryYears = years.includes(2000) ? [2000, ...years.filter((y) => y !== 2000)] : [2000, ...years];
  for (const y of tryYears) {
    const scaled = indexSeriesAtBaseYear(points, y).map((p) => ({
      ...p,
      value: Number.isFinite(p.value) ? 100 * p.value : Number.NaN,
    }));
    if (scaled.some((p) => Number.isFinite(p.value))) return scaled;
  }
  return points.map((p) => ({ ...p, value: Number.NaN }));
}

export function baseYearToIsoDate(year: number): string {
  return `${year}-01-01`;
}

/** Gregorian ISO date (YYYY-MM-DD) → Persian calendar year label for tooltips (Latin digits). */
export function persianYearLabelFromIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y)) return isoDate.slice(0, 4);
  const dt = new Date(Date.UTC(y, (Number.isFinite(m) ? m : 1) - 1, Number.isFinite(d) ? d : 1));
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric" }).formatToParts(dt);
    const yr = parts.find((p) => p.type === "year")?.value;
    return yr ?? isoDate.slice(0, 4);
  } catch {
    return isoDate.slice(0, 4);
  }
}
