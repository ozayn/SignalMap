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

/** Toolbar row: inputs and export share one baseline (bottom-aligned). */
const TOOLBAR_ROW =
  "flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border/40 pb-2";

/** Caption above each control; fixed min-height so Export lines up with inputs. */
const FIELD_LABEL =
  "mb-0.5 block min-h-[0.875rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

/** Shared 32px control height with charts’ range inputs. */
const CONTROL_INPUT =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";

const EXPORT_BUTTON =
  "h-8 shrink-0 rounded-md px-2.5 text-xs font-normal leading-none";

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

  const exportButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={EXPORT_BUTTON}
      onClick={onExportPng}
      disabled={disabledExport}
    >
      Export PNG
    </Button>
  );

  if (granularity === "year") {
    const { min: yMin, max: yMax } = toYearInputMinMax(minD, maxD);
    const startY = startValue ? parseInt(startValue.slice(0, 4), 10) : NaN;
    const endY = endValue ? parseInt(endValue.slice(0, 4), 10) : NaN;
    return (
      <div className={TOOLBAR_ROW}>
        <label className="flex w-[5.5rem] shrink-0 flex-col">
          <span className={FIELD_LABEL}>Start Year</span>
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
            className={CONTROL_INPUT}
          />
        </label>
        <label className="flex w-[5.5rem] shrink-0 flex-col">
          <span className={FIELD_LABEL}>End Year</span>
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
            className={CONTROL_INPUT}
          />
        </label>
        {exportButton}
      </div>
    );
  }

  if (granularity === "month") {
    const { min: mMin, max: mMax } = toMonthInputMinMax(minD, maxD);
    return (
      <div className={TOOLBAR_ROW}>
        <label className="flex min-w-[9rem] shrink-0 flex-col">
          <span className={FIELD_LABEL}>Start Month</span>
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
            className={CONTROL_INPUT}
          />
        </label>
        <label className="flex min-w-[9rem] shrink-0 flex-col">
          <span className={FIELD_LABEL}>End Month</span>
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
            className={CONTROL_INPUT}
          />
        </label>
        {exportButton}
      </div>
    );
  }

  return (
    <div className={TOOLBAR_ROW}>
      <label className="flex min-w-[10.5rem] shrink-0 flex-col">
        <span className={FIELD_LABEL}>Start Date</span>
        <input
          type="date"
          min={minD}
          max={maxD}
          value={startValue ? startValue.slice(0, 10) : ""}
          onChange={(e) => onStartChange(e.target.value)}
          className={CONTROL_INPUT}
        />
      </label>
      <label className="flex min-w-[10.5rem] shrink-0 flex-col">
        <span className={FIELD_LABEL}>End Date</span>
        <input
          type="date"
          min={minD}
          max={maxD}
          value={endValue ? endValue.slice(0, 10) : ""}
          onChange={(e) => onEndChange(e.target.value)}
          className={CONTROL_INPUT}
        />
      </label>
      {exportButton}
    </div>
  );
}
