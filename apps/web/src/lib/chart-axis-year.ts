/**
 * X-axis year labels for charts: Gregorian calendar year vs Iranian (Solar Hijri) year.
 * Display-only: underlying series dates remain ISO Gregorian.
 */

export type ChartAxisYearMode = "gregorian" | "jalali";

/** Category or time axis: value is an ISO date string like YYYY-MM-DD (or prefix). */
export function formatChartCategoryAxisYearLabel(value: string, mode: ChartAxisYearMode): string {
  if (mode !== "jalali") {
    const y = value.match(/^(\d{4})/);
    return y ? y[1]! : value;
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const y = value.match(/^(\d{4})/);
    return y ? y[1]! : value;
  }
  const gy = Number(m[1]);
  const gmo = Number(m[2]);
  const gd = Number(m[3]);
  const dt = new Date(Date.UTC(gy, gmo - 1, gd));
  const parts = new Intl.DateTimeFormat("en", {
    calendar: "persian",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(dt);
  return parts.find((p) => p.type === "year")?.value ?? String(gy);
}

/** Time axis: value is epoch milliseconds (UTC). */
export function formatChartTimeAxisYearLabel(ms: number, mode: ChartAxisYearMode): string {
  if (mode !== "jalali") {
    return String(new Date(ms).getUTCFullYear());
  }
  const iso = new Date(ms).toISOString().slice(0, 10);
  return formatChartCategoryAxisYearLabel(iso, "jalali");
}
