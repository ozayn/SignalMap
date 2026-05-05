"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeChartRangeBound, toYearInputMinMax, yearDraftFromBoundIso } from "@/lib/chart-study-range";

export type StudyChartControlsMode = "full" | "exportOnly";

export type StudyChartControlsProps = {
  minDate: string;
  maxDate: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onExportPng: () => void;
  disabledExport?: boolean;
  /**
   * `exportOnly`: single Export PNG button (e.g. when the parent page owns range controls or the chart is year-scoped).
   * `full`: start/end + export (default).
   */
  mode?: StudyChartControlsMode;
  /** Visible labels for year range inputs (default English). */
  startYearLabel?: string;
  endYearLabel?: string;
};

/** Toolbar row: inputs and export share one baseline (bottom-aligned). */
const TOOLBAR_ROW =
  "flex flex-wrap items-end gap-x-2 gap-y-1.5 border-b border-border/40 pb-1.5 md:gap-x-3 md:gap-y-2 md:pb-2";

/** Caption above each control; fixed min-height so Export lines up with inputs. */
const FIELD_LABEL =
  "mb-0 block min-h-[0.75rem] text-[9px] font-medium uppercase tracking-wide text-muted-foreground md:mb-0.5 md:min-h-[0.875rem] md:text-[10px]";

/** Shared 32px control height with charts’ range inputs. */
const CONTROL_INPUT =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";

const EXPORT_BUTTON =
  "h-8 shrink-0 rounded-md px-2.5 text-xs font-normal leading-none";

/**
 * Compact per-chart toolbar: start/end as **calendar years** and PNG export.
 * Edits are **string-based** while typing; values commit on blur or Enter (clamped, start ≤ end).
 * The chart may still be daily or monthly; values are normalized to `YYYY-01-01` / `YYYY-12-31` (see `normalizeChartRangeBound`).
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
  mode = "full",
  startYearLabel = "Start Year",
  endYearLabel = "End Year",
}: StudyChartControlsProps) {
  const uid = useId().replace(/:/g, "");
  const startId = `study-chart-range-start-${uid}`;
  const endId = `study-chart-range-end-${uid}`;
  const startLabelId = `study-chart-range-start-${uid}-cap`;
  const endLabelId = `study-chart-range-end-${uid}-cap`;

  const minD = minDate.slice(0, 10);
  const maxD = maxDate.slice(0, 10);
  const { min: yMin, max: yMax } = toYearInputMinMax(minD, maxD);

  const [draftStart, setDraftStart] = useState(() => yearDraftFromBoundIso(startValue));
  const [draftEnd, setDraftEnd] = useState(() => yearDraftFromBoundIso(endValue));
  const startFocus = useRef(false);
  const endFocus = useRef(false);

  useEffect(() => {
    if (!startFocus.current) setDraftStart(yearDraftFromBoundIso(startValue));
  }, [startValue]);

  useEffect(() => {
    if (!endFocus.current) setDraftEnd(yearDraftFromBoundIso(endValue));
  }, [endValue]);

  const otherYear = useCallback(
    (iso: string) => {
      if (!iso || !iso.trim()) return null;
      const y = parseInt(iso.slice(0, 4), 10);
      return Number.isFinite(y) ? y : null;
    },
    []
  );

  const commitStart = useCallback(() => {
    const raw = draftStart.trim();
    if (raw === "") {
      onStartChange("");
      return;
    }
    const y = parseInt(raw, 10);
    if (!Number.isFinite(y)) {
      setDraftStart(yearDraftFromBoundIso(startValue));
      return;
    }
    let c = Math.min(yMax, Math.max(yMin, y));
    const endY = otherYear(endValue);
    if (endY != null && c > endY) c = endY;
    onStartChange(normalizeChartRangeBound(String(c), false));
    setDraftStart(String(c));
  }, [draftStart, yMin, yMax, endValue, startValue, onStartChange, otherYear]);

  const commitEnd = useCallback(() => {
    const raw = draftEnd.trim();
    if (raw === "") {
      onEndChange("");
      return;
    }
    const y = parseInt(raw, 10);
    if (!Number.isFinite(y)) {
      setDraftEnd(yearDraftFromBoundIso(endValue));
      return;
    }
    let c = Math.min(yMax, Math.max(yMin, y));
    const startY = otherYear(startValue);
    if (startY != null && c < startY) c = startY;
    onEndChange(normalizeChartRangeBound(String(c), true));
    setDraftEnd(String(c));
  }, [draftEnd, yMin, yMax, startValue, endValue, onEndChange, otherYear]);

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

  if (mode === "exportOnly") {
    return (
      <div className={`${TOOLBAR_ROW} flex-wrap justify-end`} aria-label="Chart export">
        {exportButton}
      </div>
    );
  }

  return (
    <div className={TOOLBAR_ROW}>
      <div className="flex min-w-0 shrink-0 items-end gap-2 md:contents">
      <label className="flex w-[4.25rem] shrink-0 flex-col md:w-[5.5rem]" dir="ltr" htmlFor={startId}>
        <span className={FIELD_LABEL} id={startLabelId}>
          {startYearLabel}
        </span>
        <input
          id={startId}
          name={startId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-labelledby={startLabelId}
          value={draftStart}
          onChange={(e) => setDraftStart(e.target.value)}
          onFocus={() => {
            startFocus.current = true;
          }}
          onBlur={() => {
            startFocus.current = false;
            commitStart();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className={CONTROL_INPUT}
        />
      </label>
      <label className="flex w-[4.25rem] shrink-0 flex-col md:w-[5.5rem]" dir="ltr" htmlFor={endId}>
        <span className={FIELD_LABEL} id={endLabelId}>
          {endYearLabel}
        </span>
        <input
          id={endId}
          name={endId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-labelledby={endLabelId}
          value={draftEnd}
          onChange={(e) => setDraftEnd(e.target.value)}
          onFocus={() => {
            endFocus.current = true;
          }}
          onBlur={() => {
            endFocus.current = false;
            commitEnd();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className={CONTROL_INPUT}
        />
      </label>
      </div>
      {exportButton}
    </div>
  );
}
