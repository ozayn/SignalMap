"use client";

import { formatStatDate } from "@/lib/utils";

type SeriesStatInput = {
  label: string;
  unit: string;
  points: Array<{ date: string; value: number }>;
};

type MultiSeriesStatsProps = {
  series: SeriesStatInput[];
  /** Optional time range to filter points (start, end) - same as chart. */
  timeRange?: [string, string];
};

function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Number.isInteger(value) || Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function computeStats(points: Array<{ date: string; value: number }>, timeRange?: [string, string]) {
  let filtered = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (timeRange?.[0] && timeRange?.[1]) {
    filtered = filtered.filter((p) => p.date >= timeRange[0] && p.date <= timeRange[1]);
  }
  if (filtered.length === 0) {
    return {
      latestValue: null,
      latestDate: null,
      avgValue: null,
      minValue: null,
      minDate: null,
      maxValue: null,
      maxDate: null,
    };
  }
  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const values = filtered.map((p) => p.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const minPoint = filtered.find((p) => p.value === minVal);
  const maxPoint = filtered.find((p) => p.value === maxVal);
  return {
    latestValue: sorted[0]!.value,
    latestDate: sorted[0]!.date,
    avgValue: sum / values.length,
    minValue: minVal,
    minDate: minPoint?.date ?? null,
    maxValue: maxVal,
    maxDate: maxPoint?.date ?? null,
  };
}

export function MultiSeriesStats({ series, timeRange }: MultiSeriesStatsProps) {
  if (!series || series.length < 2 || series.length >= 3) return null;

  const showDates = true;

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {series.map((s) => {
        const stats = computeStats(s.points, timeRange);
        const hasAny =
          stats.latestValue != null ||
          stats.avgValue != null ||
          stats.minValue != null ||
          stats.maxValue != null;
        if (!hasAny) return null;

        const StatCell = ({
          value,
          date,
        }: { value: number | null; date: string | null }) => (
          <span className="text-right">
            <span
              className="font-medium tabular-nums block"
              title={date ? formatStatDate(date) : undefined}
            >
              {value != null ? formatStatValue(value) : "—"}
            </span>
            {showDates && date && (
              <span className="text-xs text-muted-foreground block">{formatStatDate(date)}</span>
            )}
          </span>
        );

        return (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-card px-4 py-3 w-fit"
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto",
              rowGap: 4,
              columnGap: 12,
            }}
          >
            <div className="col-span-2 font-medium text-foreground text-sm mb-0.5">
              {s.label} ({s.unit})
            </div>
            <span className="text-xs text-muted-foreground">Latest</span>
            <StatCell value={stats.latestValue} date={stats.latestDate} />
            <span className="text-xs text-muted-foreground">Avg</span>
            <span className="font-medium tabular-nums text-right">
              {stats.avgValue != null ? formatStatValue(stats.avgValue) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">Min</span>
            <StatCell value={stats.minValue} date={stats.minDate} />
            <span className="text-xs text-muted-foreground">Max</span>
            <StatCell value={stats.maxValue} date={stats.maxDate} />
          </div>
        );
      })}
    </div>
  );
}
