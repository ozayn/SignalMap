/**
 * X-axis year labels for charts: Gregorian vs Iranian (Solar Hijri) vs both.
 * Display-only: underlying series dates remain ISO Gregorian.
 */

export type ChartAxisYearMode = "gregorian" | "jalali" | "both";

function isoUtcYmdToJalaliYearString(isoYmd: string): string {
  const m = isoYmd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const gy = Number(m[1]);
  const gmo = Number(m[2]);
  const gd = Number(m[3]);
  const dt = new Date(Date.UTC(gy, gmo - 1, gd));
  const parts = new Intl.DateTimeFormat("en", {
    calendar: "persian",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(dt);
  return parts.find((p) => p.type === "year")?.value ?? "";
}

/** Category or time axis: value is an ISO date string like YYYY-MM-DD (or year prefix). */
export function formatChartCategoryAxisYearLabel(value: string, mode: ChartAxisYearMode): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const yPrefix = value.match(/^(\d{4})/);
  const gyStr = m ? m[1]! : yPrefix ? yPrefix[1]! : "";
  if (!gyStr) return value;

  const isoForJalali = m ? `${m[1]}-${m[2]}-${m[3]}` : `${gyStr}-01-01`;

  if (mode === "gregorian") {
    return gyStr;
  }

  const jy = isoUtcYmdToJalaliYearString(isoForJalali);
  if (mode === "jalali") {
    return jy || gyStr;
  }

  return jy ? `${gyStr} (${jy})` : gyStr;
}

/** Time axis: value is epoch milliseconds (UTC). */
export function formatChartTimeAxisYearLabel(ms: number, mode: ChartAxisYearMode): string {
  const iso = new Date(ms).toISOString().slice(0, 10);
  return formatChartCategoryAxisYearLabel(iso, mode);
}

/** Tooltip line: `Year: 2005 (1384)` / `سال: …` using the same rules as the axis. */
export function formatChartTooltipYearLine(
  dateStr: string,
  mode: ChartAxisYearMode,
  locale?: "en" | "fa"
): string {
  const prefix = locale === "fa" ? "سال" : "Year";
  const trimmed = dateStr.trim();
  let iso = "";
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    iso = trimmed.slice(0, 10);
  } else if (/^\d{4}$/.test(trimmed)) {
    iso = `${trimmed}-01-01`;
  } else if (/^\d{4}/.test(trimmed)) {
    iso = `${trimmed.slice(0, 4)}-01-01`;
  }
  const body = iso ? formatChartCategoryAxisYearLabel(iso, mode) : trimmed;
  return `${prefix}: ${body}`;
}
