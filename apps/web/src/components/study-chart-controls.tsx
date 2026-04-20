"use client";

import { Button } from "@/components/ui/button";
import type { ChartRangeGranularity } from "@/lib/chart-study-range";
import {
  clampDateToBounds,
  monthInputToEndDay,
  monthInputToStartDay,
  normalizeChartRangeBound,
  toMonthInputMinMax,
  toYearInputMinMax,
} from "@/lib/chart-study-range";

export type StudyChartControlsProps = {
  minDate: string;
  maxDate: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onExportPng: () => void;
  disabledExport?: boolean;
  /** Picker resolution; defaults to day (`type="date"`). */
  granularity?: ChartRangeGranularity;
};

/**
 * Compact per-chart toolbar: start/end range (granularity-aware) and PNG export.
 * Bounds are always `YYYY-MM-DD` at the chart layer; this component maps UI to those strings.
 */
export function StudyChartControls({
  minDate,
  maxDate,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onExportPng,
  disabledExport,
  granularity = "day",
}: StudyChartControlsProps) {
  const minD = minDate.slice(0, 10);
  const maxD = maxDate.slice(0, 10);

  if (granularity === "year") {
    const { min: yMin, max: yMax } = toYearInputMinMax(minD, maxD);
    const startY = startValue ? parseInt(startValue.slice(0, 4), 10) : NaN;
    const endY = endValue ? parseInt(endValue.slice(0, 4), 10) : NaN;
    return (
      <div className="flex flex-wrap items-center gap-3 pb-1.5 border-b border-border/40">
        <label className="flex w-[5.5rem] flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">Start year</span>
          <input
            type="number"
            min={yMin}
            max={yMax}
            step={1}
            value={Number.isFinite(startY) ? startY : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onStartChange("");
                return;
              }
              const y = parseInt(raw, 10);
              if (!Number.isFinite(y)) return;
              const clamped = Math.min(yMax, Math.max(yMin, y));
              onStartChange(normalizeChartRangeBound(String(clamped), false));
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
          />
        </label>
        <label className="flex w-[5.5rem] flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">End year</span>
          <input
            type="number"
            min={yMin}
            max={yMax}
            step={1}
            value={Number.isFinite(endY) ? endY : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onEndChange("");
                return;
              }
              const y = parseInt(raw, 10);
              if (!Number.isFinite(y)) return;
              const clamped = Math.min(yMax, Math.max(yMin, y));
              onEndChange(normalizeChartRangeBound(String(clamped), true));
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={onExportPng}
          disabled={disabledExport}
        >
          Export PNG
        </Button>
      </div>
    );
  }

  if (granularity === "month") {
    const { min: mMin, max: mMax } = toMonthInputMinMax(minD, maxD);
    return (
      <div className="flex flex-wrap items-center gap-3 pb-1.5 border-b border-border/40">
        <label className="flex min-w-[8.5rem] flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">Start</span>
          <input
            type="month"
            min={mMin}
            max={mMax}
            value={startValue ? startValue.slice(0, 7) : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                onStartChange("");
                return;
              }
              const day = monthInputToStartDay(v);
              onStartChange(clampDateToBounds(day, minD, maxD));
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
          />
        </label>
        <label className="flex min-w-[8.5rem] flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">End</span>
          <input
            type="month"
            min={mMin}
            max={mMax}
            value={endValue ? endValue.slice(0, 7) : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                onEndChange("");
                return;
              }
              const day = monthInputToEndDay(v);
              onEndChange(clampDateToBounds(day, minD, maxD));
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={onExportPng}
          disabled={disabledExport}
        >
          Export PNG
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pb-1.5 border-b border-border/40">
      <label className="flex min-w-[9.5rem] flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">Start</span>
        <input
          type="date"
          min={minD}
          max={maxD}
          value={startValue ? startValue.slice(0, 10) : ""}
          onChange={(e) => onStartChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
        />
      </label>
      <label className="flex min-w-[9.5rem] flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/90">End</span>
        <input
          type="date"
          min={minD}
          max={maxD}
          value={endValue ? endValue.slice(0, 10) : ""}
          onChange={(e) => onEndChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 text-xs"
        onClick={onExportPng}
        disabled={disabledExport}
      >
        Export PNG
      </Button>
    </div>
  );
}
