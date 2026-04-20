import { slugifyChartFilename } from "@/lib/chart-export";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import type { ChartRangeGranularity } from "@/lib/chart-study-range";
import { normalizeChartRangeBound } from "@/lib/chart-study-range";

/**
 * Human-readable date span for export filenames (hyphen-safe; final download still runs `slugifyChartFilename`).
 */
export function formatStudyChartExportFilenameRangeSegment(
  startIso: string,
  endIso: string,
  granularity?: ChartRangeGranularity
): string {
  const a = startIso.slice(0, 10);
  const b = endIso.slice(0, 10);
  if (granularity === "year" || (a.endsWith("-01-01") && b.endsWith("-12-31"))) {
    const y0 = a.slice(0, 4);
    const y1 = b.slice(0, 4);
    if (/^\d{4}$/.test(y0) && /^\d{4}$/.test(y1)) return `${y0}-${y1}`;
  }
  if (granularity === "month") {
    return `${a.slice(0, 4)}${a.slice(5, 7)}-${b.slice(0, 4)}${b.slice(5, 7)}`;
  }
  return `${a.replace(/-/g, "")}-${b.replace(/-/g, "")}`;
}

/**
 * Builds a self-describing PNG stem: study identity, locale, optional year-axis mode, optional custom range.
 * `chartFileStem` disambiguates multi-panel studies (e.g. Dutch disease) when it differs from `studySlug`.
 */
export function buildStudyChartExportFilenameStem(input: {
  studySlug: string;
  chartFileStem?: string;
  locale: "en" | "fa";
  yearAxisMode: ChartAxisYearMode;
  selectedStart: string;
  selectedEnd: string;
  defaultStart: string;
  defaultEnd: string;
  rangeGranularity?: ChartRangeGranularity;
}): string {
  const coreStudy = slugifyChartFilename(input.studySlug);
  const corePanel = input.chartFileStem ? slugifyChartFilename(input.chartFileStem) : "";
  const identity =
    corePanel && corePanel !== coreStudy ? `${coreStudy}-${corePanel}` : coreStudy;

  const parts: string[] = [identity, input.locale];

  const mode = input.yearAxisMode;
  if (mode !== "gregorian") {
    parts.push(mode === "jalali" ? "iranian" : slugifyChartFilename(mode));
  }

  const ns = normalizeChartRangeBound(input.selectedStart.slice(0, 10), false);
  const ne = normalizeChartRangeBound(input.selectedEnd.slice(0, 10), true);
  const nds = normalizeChartRangeBound(input.defaultStart.slice(0, 10), false);
  const nde = normalizeChartRangeBound(input.defaultEnd.slice(0, 10), true);
  if (ns && ne && nds && nde && (ns !== nds || ne !== nde)) {
    parts.push(formatStudyChartExportFilenameRangeSegment(ns, ne, input.rangeGranularity));
  }

  return parts.join("-");
}
