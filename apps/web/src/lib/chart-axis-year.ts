/**
 * X-axis year labels for charts: Gregorian vs Iranian (Solar Hijri) vs both.
 * Display-only: underlying series dates remain ISO Gregorian.
 *
 * "Both" mode uses a vertical stack (Gregorian above Solar Hijri), not parentheses,
 * for axes and tooltips. Tight inline UI may use `formatChartYearBothInlineCompact`.
 */

import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";

export type ChartAxisYearMode = "gregorian" | "jalali" | "both";

/** Matches ``chartLocale`` on ``TimelineChart`` for Persian digit display. */
export type ChartAxisNumeralLocale = "en" | "fa";

export type ChartAxisYearDisplayParts = {
  gregorian: string;
  /** Solar Hijri calendar year (Latin digits), or null if conversion failed. */
  jalali: string | null;
};

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

/** Category axis tick value (often YYYY-MM-DD) → Gregorian year + optional Solar Hijri year. */
export function getChartAxisYearDisplayParts(value: string): ChartAxisYearDisplayParts {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const yPrefix = value.match(/^(\d{4})/);
  const gyStr = m ? m[1]! : yPrefix ? yPrefix[1]! : "";
  if (!gyStr) return { gregorian: "", jalali: null };

  const isoForJalali = m ? `${m[1]}-${m[2]}-${m[3]}` : `${gyStr}-01-01`;
  const jy = isoUtcYmdToJalaliYearString(isoForJalali);
  return { gregorian: gyStr, jalali: jy || null };
}

/** Single-line dual calendar for prose / axis titles (middle dot, no parentheses). */
export function formatChartYearBothInlineCompact(value: string, chartLocale?: ChartAxisNumeralLocale): string {
  const { gregorian, jalali } = getChartAxisYearDisplayParts(value);
  if (!gregorian) return value;
  const raw = jalali ? `${gregorian} · ${jalali}` : gregorian;
  return localizeChartNumericDisplayString(raw, chartLocale);
}

/** Category or time axis: value is an ISO date string like YYYY-MM-DD (or year prefix). */
export function formatChartCategoryAxisYearLabel(
  value: string,
  mode: ChartAxisYearMode,
  chartLocale?: ChartAxisNumeralLocale
): string {
  const { gregorian, jalali } = getChartAxisYearDisplayParts(value);
  if (!gregorian) return value;

  let raw: string;
  if (mode === "gregorian") {
    raw = gregorian;
  } else if (mode === "jalali") {
    raw = jalali ?? gregorian;
  } else {
    raw = jalali ? `${gregorian}\n${jalali}` : gregorian;
  }
  return localizeChartNumericDisplayString(raw, chartLocale);
}

/** Time axis: value is epoch milliseconds (UTC). */
export function formatChartTimeAxisYearLabel(
  ms: number,
  mode: ChartAxisYearMode,
  chartLocale?: ChartAxisNumeralLocale
): string {
  const iso = new Date(ms).toISOString().slice(0, 10);
  return formatChartCategoryAxisYearLabel(iso, mode, chartLocale);
}

export type ChartTooltipYearLineColors = {
  /** Gregorian digits (primary). */
  gregorianColor: string;
  /** Solar Hijri line (muted). */
  jalaliColor: string;
  /** "Year:" / "سال:" label. */
  labelColor: string;
};

/**
 * Tooltip block for the calendar year line(s). Uses HTML when ``mode === "both"`` so
 * Gregorian vs Solar Hijri can use different sizes and colors (joined with ``<br/>`` elsewhere).
 */
export function formatChartTooltipYearLine(
  dateStr: string,
  mode: ChartAxisYearMode,
  locale?: "en" | "fa",
  colors?: ChartTooltipYearLineColors,
  chartLocale?: ChartAxisNumeralLocale
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

  const { gregorian, jalali } = iso ? getChartAxisYearDisplayParts(iso) : { gregorian: "", jalali: null as string | null };

  const numeralLoc = chartLocale ?? locale ?? "en";

  if (mode === "both" && gregorian && jalali) {
    const gc = colors?.gregorianColor ?? "inherit";
    const jc = colors?.jalaliColor ?? "#737373";
    const lc = colors?.labelColor ?? "inherit";
    const gDisp = localizeChartNumericDisplayString(gregorian, numeralLoc);
    const jDisp = localizeChartNumericDisplayString(jalali, numeralLoc);
    const html =
      `<div style="line-height:1.38">` +
      `<span style="display:block;color:${lc}">${prefix}:</span>` +
      `<span style="display:block;margin-top:3px;font-weight:500;color:${gc}">${gDisp}</span>` +
      `<span style="display:block;margin-top:2px;font-size:0.82em;color:${jc}">${jDisp}</span>` +
      `</div>`;
    return html;
  }

  const body = iso ? formatChartCategoryAxisYearLabel(iso, mode, numeralLoc) : localizeChartNumericDisplayString(trimmed, numeralLoc);
  return localizeChartNumericDisplayString(`${prefix}: ${body}`, numeralLoc);
}
