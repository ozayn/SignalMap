"use client";

import { formatChartAxisNumber, formatGdpLevelsAxisTick } from "@/lib/format-compact-decimal";
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
  locale?: "en" | "fa";
};

/** Stats row: same compact rules as chart y-axes (k/M/B; Farsi words + digits). */
function formatStatValue(value: number, unit: string, locale: "en" | "fa"): string {
  if (!Number.isFinite(value)) return "—";
  const t = formatGdpLevelsAxisTick(value, unit || "—", locale);
  if (t !== "") return t;
  return formatChartAxisNumber(value, locale);
}

function formatStatDateForLocale(dateStr: string, locale: "en" | "fa"): string {
  if (locale !== "fa") return formatStatDate(dateStr);
  const parts = dateStr.split("-");
  const includeDay = parts.length >= 3 && /^\d{1,2}/.test(parts[2] ?? "");
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    ...(includeDay ? { day: "numeric" as const } : {}),
  });
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

export function MultiSeriesStats({ series, timeRange, locale = "en" }: MultiSeriesStatsProps) {
  if (!series || series.length < 2) return null;

  const isFa = locale === "fa";
  const t = (en: string, fa: string) => (isFa ? fa : en);
  const showDates = true;

  return (
    <div className="flex flex-wrap gap-3 mb-3 min-w-0">
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
              title={date ? formatStatDateForLocale(date, locale) : undefined}
            >
              {value != null ? formatStatValue(value, s.unit, locale) : "—"}
            </span>
            {showDates && date && (
              <span className="text-xs text-muted-foreground block">{formatStatDateForLocale(date, locale)}</span>
            )}
          </span>
        );

        return (
          <div
            key={s.label}
            className="rounded-md border border-border/70 bg-muted/15 px-3 py-2.5 min-w-0 flex-1 min-w-[200px] sm:flex-none sm:w-fit"
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
            <span className="text-xs text-muted-foreground">{t("Latest", "آخرین")}</span>
            <StatCell value={stats.latestValue} date={stats.latestDate} />
            <span className="text-xs text-muted-foreground">{t("Avg", "میانگین")}</span>
            <span className="font-medium tabular-nums text-right">
              {stats.avgValue != null ? formatStatValue(stats.avgValue, s.unit, locale) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">{t("Min", "کمینه")}</span>
            <StatCell value={stats.minValue} date={stats.minDate} />
            <span className="text-xs text-muted-foreground">{t("Max", "بیشینه")}</span>
            <StatCell value={stats.maxValue} date={stats.maxDate} />
          </div>
        );
      })}
    </div>
  );
}
