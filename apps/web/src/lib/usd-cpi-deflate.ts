/** Calendar year used as the CPI anchor for “real USD” display (internal; not user-selectable). */
export const USD_CPI_REAL_BASE_YEAR = 2020;

export type UsdPoint = { date: string; value: number };

function monthKeyFromIsoDate(dateStr: string): string {
  const t = dateStr.trim();
  if (t.length >= 7) return t.slice(0, 7);
  if (t.length >= 4) return `${t.slice(0, 4)}-01`;
  return "1970-01";
}

/** Map YYYY-MM → CPI index (1982-84=100). */
export function cpiMonthlyToMonthMap(cpiPoints: UsdPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of cpiPoints) {
    const mk = monthKeyFromIsoDate(p.date);
    if (Number.isFinite(p.value) && p.value > 0) m.set(mk, p.value);
  }
  return m;
}

function averageCpiInCalendarYear(cpiByMonth: Map<string, number>, year: number): number | null {
  const vals: number[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const mk = `${year}-${String(mo).padStart(2, "0")}`;
    const v = cpiByMonth.get(mk);
    if (v != null && v > 0) vals.push(v);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function cpiForObservation(cpiByMonth: Map<string, number>, dateStr: string): number | null {
  const mk = monthKeyFromIsoDate(dateStr);
  const direct = cpiByMonth.get(mk);
  if (direct != null && direct > 0) return direct;
  const y = parseInt(dateStr.slice(0, 4), 10);
  if (!Number.isFinite(y)) return null;
  return averageCpiInCalendarYear(cpiByMonth, y);
}

/**
 * Deflate nominal USD levels to constant purchasing power in `baseYear` USD
 * using US CPIAUCSL (monthly): value_t × (CPI_base_year_avg / CPI_t).
 */
export function deflateNominalUsdPointsWithUsCpi(
  nominal: UsdPoint[],
  cpiMonthly: UsdPoint[],
  baseYear: number = USD_CPI_REAL_BASE_YEAR
): UsdPoint[] {
  if (nominal.length === 0 || cpiMonthly.length === 0) return nominal;
  const cpiByMonth = cpiMonthlyToMonthMap(cpiMonthly);
  const baseCpi = averageCpiInCalendarYear(cpiByMonth, baseYear);
  if (baseCpi == null || baseCpi <= 0) return nominal;

  const out: UsdPoint[] = [];
  for (const p of nominal) {
    if (!Number.isFinite(p.value)) continue;
    const ct = cpiForObservation(cpiByMonth, p.date);
    if (ct == null || ct <= 0) continue;
    const v = (p.value * baseCpi) / ct;
    out.push({ date: p.date, value: Math.round(v * 100) / 100 });
  }
  return out.length > 0 ? out : nominal;
}
