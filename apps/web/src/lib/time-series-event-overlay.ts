import type { ChartRangeGranularity } from "@/lib/chart-study-range";

/**
 * Master "Event overlay" control for time-series `TimelineChart`s: when off, no markers
 * (and PNG export should match; charts receive an empty `events` array).
 */
export function withTimeSeriesEventOverlay<T>(showOverlay: boolean, events: readonly T[] | null | undefined): T[] {
  if (!showOverlay) return [];
  if (!events?.length) return [];
  return events.slice() as T[];
}

/** True when the x-axis list is one bucket per (Gregorian) year so events should map by year, not by `dateStr >= event`. */
export function resolveTimeSeriesEventAlignToCalendarYearBucket(input: {
  chartRangeGranularity?: ChartRangeGranularity;
  useYearlyMultiSeries: boolean;
}): boolean {
  return input.chartRangeGranularity === "year" || input.useYearlyMultiSeries;
}

function normalizeEventDateKey(eventDate: string): string {
  if (eventDate.length >= 10) return eventDate.slice(0, 10);
  if (eventDate.length === 4) return `${eventDate}-01-01`;
  return eventDate;
}

/**
 * Resolves the category index for a point-in-time event.
 * For annual / one-bucket-per-year charts, an event in mid-2011 maps to 2011’s key (e.g. 2011-01-01), not the next year.
 */
export function findTimeSeriesEventCategoryIndex(
  dates: readonly string[],
  eventDate: string,
  alignToCalendarYearBucket: boolean
): number | null {
  if (dates.length === 0) return null;
  const d10 = normalizeEventDateKey(eventDate);
  const y = d10.slice(0, 4);

  if (alignToCalendarYearBucket) {
    for (let i = 0; i < dates.length; i++) {
      if (dates[i]!.slice(0, 4) === y) return i;
    }
    return null;
  }

  const idx = dates.indexOf(d10);
  if (idx >= 0) return idx;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i]! >= d10) return i;
  }
  return dates.length - 1;
}

/**
 * Resolves [startIdx, endIdx] for a date range (inclusive) on the category axis.
 * Year-bucket mode: includes every year key whose calendar year lies between the event’s start and end years (inclusive).
 */
export function findTimeSeriesEventRangeCategoryIndices(
  dates: readonly string[],
  dateStart: string,
  dateEnd: string,
  alignToCalendarYearBucket: boolean
): { startIdx: number; endIdx: number } | null {
  if (dates.length === 0) return null;
  if (alignToCalendarYearBucket) {
    const yStart = parseInt(dateStart.slice(0, 4), 10);
    const yEnd = parseInt(dateEnd.slice(0, 4), 10);
    if (!Number.isFinite(yStart) || !Number.isFinite(yEnd)) return null;
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < dates.length; i++) {
      const y = parseInt(dates[i]!.slice(0, 4), 10);
      if (!Number.isFinite(y)) continue;
      if (y >= yStart && y <= yEnd) {
        if (startIdx < 0) startIdx = i;
        endIdx = i;
      }
    }
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return null;
    return { startIdx, endIdx };
  }

  const startIdx = dates.findIndex((d) => d >= dateStart);
  let endIdx = -1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i]! <= dateEnd) {
      endIdx = i;
      break;
    }
  }
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return null;
  return { startIdx, endIdx };
}

/**
 * Min shape for `buildEventOverlay` input events (maps to ECharts `markLine` `xAxis` values).
 */
export type TimeSeriesEventOverlayItem = {
  id: string;
  date?: string;
  date_start?: string;
  date_end?: string;
};

/**
 * Point-in-time marker positions (vertical lines) for the current category/time keys.
 * Range / `markArea` bands use `findTimeSeriesEventRangeCategoryIndices` in the chart (presidential trim, etc.).
 */
export function buildEventOverlay<T extends TimeSeriesEventOverlayItem>(input: {
  events: readonly T[];
  dates: readonly string[];
  minDate: string;
  maxDate: string;
  alignToCalendarYearBucket: boolean;
}): { pointMarkers: { xAxis: string; event: T }[] } {
  const { events, dates, minDate, maxDate, alignToCalendarYearBucket } = input;
  const pointMarkers: { xAxis: string; event: T }[] = [];

  for (const ev of events) {
    if (ev.date == null) continue;
    const d = ev.date;
    if (d < minDate || d > maxDate) continue;
    const idx = findTimeSeriesEventCategoryIndex(dates, d, alignToCalendarYearBucket);
    if (idx == null) continue;
    pointMarkers.push({ xAxis: dates[idx]!, event: ev });
  }

  return { pointMarkers };
}
