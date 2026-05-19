/**
 * Rolling time-series statistics: trailing mean and standard deviation.
 * Gap-aware — skips window positions that span too long a calendar gap.
 */

import type { ChartSeries } from "@/components/timeline-chart";

export type TSPoint = { date: string; value: number };

const DAY_MS = 86_400_000;

function parseDate(d: string): number {
  return new Date(d.slice(0, 10)).getTime();
}

function expectedIntervalMs(granularity: "day" | "month" | "year"): number {
  switch (granularity) {
    case "day":
      return DAY_MS;
    case "month":
      return 30.4375 * DAY_MS;
    case "year":
      return 365.25 * DAY_MS;
  }
}

export function defaultRollingWindow(granularity: "day" | "month" | "year"): number {
  switch (granularity) {
    case "day":
      return 30;
    case "month":
      return 12;
    case "year":
      return 5;
  }
}

export function rollingWindowLabel(window: number, granularity: "day" | "month" | "year"): string {
  switch (granularity) {
    case "day":
      return `${window}-day`;
    case "month":
      return `${window}-month`;
    case "year":
      return `${window}-year`;
  }
}

export function rollingMean(
  points: TSPoint[],
  window: number,
  granularity: "day" | "month" | "year"
): TSPoint[] {
  if (window < 2 || points.length < window) return [];
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < window) return [];
  const maxSpanMs = window * expectedIntervalMs(granularity) * 1.5;
  const result: TSPoint[] = [];
  for (let i = window - 1; i < sorted.length; i++) {
    const span = parseDate(sorted[i]!.date) - parseDate(sorted[i - window + 1]!.date);
    if (span > maxSpanMs) continue;
    let sum = 0;
    let count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const val = sorted[j]!.value;
      if (Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    const minRequired = Math.ceil(window / 2);
    if (count < minRequired) continue;
    result.push({ date: sorted[i]!.date, value: sum / count });
  }
  return result;
}

export function rollingStdDev(
  points: TSPoint[],
  window: number,
  granularity: "day" | "month" | "year"
): TSPoint[] {
  if (window < 2 || points.length < window) return [];
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < window) return [];
  const maxSpanMs = window * expectedIntervalMs(granularity) * 1.5;
  const result: TSPoint[] = [];
  for (let i = window - 1; i < sorted.length; i++) {
    const span = parseDate(sorted[i]!.date) - parseDate(sorted[i - window + 1]!.date);
    if (span > maxSpanMs) continue;
    const vals: number[] = [];
    for (let j = i - window + 1; j <= i; j++) {
      const val = sorted[j]!.value;
      if (Number.isFinite(val)) vals.push(val);
    }
    const minRequired = Math.ceil(window / 2);
    if (vals.length < minRequired) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    result.push({ date: sorted[i]!.date, value: Math.sqrt(variance) });
  }
  return result;
}

const ROLLING_VOL_COLOR = "#9ca3af";

/** Default max output points per overlay series; keeps ECharts render fast for dense daily data. */
const DEFAULT_OVERLAY_DISPLAY_CAP = 2000;

function downsampleEvenly<T>(arr: T[], maxN: number): T[] {
  if (arr.length <= maxN) return arr;
  const step = arr.length / maxN;
  const out: T[] = new Array(maxN);
  for (let i = 0; i < maxN; i++) out[i] = arr[Math.floor(i * step)]!;
  if (out[maxN - 1] !== arr[arr.length - 1]) out[maxN - 1] = arr[arr.length - 1]!;
  return out;
}

/**
 * Build additional ChartSeries entries for rolling average and/or volatility
 * derived from a single primary series. Returns 0–2 entries.
 *
 * Rolling stats are computed on the full series (accuracy preserved) and then
 * downsampled to ``maxOutputPoints`` for display/export to keep render fast.
 */
export function buildRollingOverlays(opts: {
  primaryKey: string;
  primaryLabel: string;
  primaryColor: string;
  primaryPoints: TSPoint[];
  primaryUnit: string;
  primaryYAxisIndex: 0 | 1 | 2;
  config: { showAvg: boolean; showVol: boolean; window: number };
  granularity: "day" | "month" | "year";
  maxOutputPoints?: number;
}): ChartSeries[] {
  const {
    primaryKey,
    primaryLabel,
    primaryColor,
    primaryPoints,
    primaryUnit,
    primaryYAxisIndex,
    config,
    granularity,
    maxOutputPoints = DEFAULT_OVERLAY_DISPLAY_CAP,
  } = opts;
  if (!config.showAvg && !config.showVol) return [];
  const extra: ChartSeries[] = [];
  const wLabel = rollingWindowLabel(config.window, granularity);

  if (config.showAvg) {
    const avgPts = rollingMean(primaryPoints, config.window, granularity);
    if (avgPts.length > 0) {
      extra.push({
        key: `${primaryKey}__ravg`,
        label: `${primaryLabel} (${wLabel} avg)`,
        yAxisIndex: primaryYAxisIndex,
        unit: primaryUnit,
        points: downsampleEvenly(avgPts, maxOutputPoints),
        color: primaryColor,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: false,
      });
    }
  }

  if (config.showVol) {
    const volPts = rollingStdDev(primaryPoints, config.window, granularity);
    if (volPts.length > 0) {
      extra.push({
        key: `${primaryKey}__rvol`,
        label: `${primaryLabel} (${wLabel} σ)`,
        yAxisIndex: primaryYAxisIndex,
        unit: primaryUnit,
        points: downsampleEvenly(volPts, maxOutputPoints),
        color: ROLLING_VOL_COLOR,
        linePattern: "dotted",
        lineWidth: 1.5,
        showSymbol: false,
      });
    }
  }

  return extra;
}
