"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_EXPORT_CHART_FONT_SIZES,
  type ExportChartFontSizes,
  type ExportChartSettings,
} from "@/lib/chart-export-presentation";

const FONT_MIN = 8;
const FONT_MAX = 56;

const FONT_PRESET_SMALL: ExportChartFontSizes = {
  title: 28,
  axisName: 20,
  axisTick: 18,
  legend: 17,
  source: 15,
};

const FONT_PRESET_LARGE: ExportChartFontSizes = {
  title: 38,
  axisName: 27,
  axisTick: 25,
  legend: 24,
  source: 20,
};

function clampFont(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_EXPORT_CHART_FONT_SIZES.title;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)));
}

function clampFontSizes(s: ExportChartFontSizes): ExportChartFontSizes {
  return {
    title: clampFont(s.title),
    axisName: clampFont(s.axisName),
    axisTick: clampFont(s.axisTick),
    legend: clampFont(s.legend),
    source: clampFont(s.source),
  };
}

export type ExportChartModalProps = {
  open: boolean;
  onClose: () => void;
  defaultTitle: string;
  defaultFontSizes: ExportChartFontSizes;
  onExport: (settings: ExportChartSettings) => void;
  /** Optional: set `dir` on the dialog for FA title typing. */
  titleDir?: "ltr" | "rtl";
};

/**
 * Minimal “Export chart” dialog: edit slide title and presentation font sizes, then download PNG.
 * Export-only; does not change the live chart.
 */
export function ExportChartModal({
  open,
  onClose,
  defaultTitle,
  defaultFontSizes,
  onExport,
  titleDir = "ltr",
}: ExportChartModalProps) {
  const [titleText, setTitleText] = useState(defaultTitle);
  const [fontSizes, setFontSizes] = useState<ExportChartFontSizes>(defaultFontSizes);

  useEffect(() => {
    if (!open) return;
    setTitleText(defaultTitle);
    setFontSizes({ ...defaultFontSizes });
  }, [open, defaultTitle, defaultFontSizes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const resetDefaults = useCallback(() => {
    setTitleText(defaultTitle);
    setFontSizes({ ...defaultFontSizes });
  }, [defaultTitle, defaultFontSizes]);

  const applyPreset = useCallback((preset: ExportChartFontSizes) => {
    setFontSizes(clampFontSizes(preset));
  }, []);

  const updateFont = useCallback((key: keyof ExportChartFontSizes, raw: string) => {
    const n = parseInt(raw, 10);
    setFontSizes((prev) => ({ ...prev, [key]: clampFont(n) }));
  }, []);

  const handleDownload = useCallback(() => {
    onExport({
      titleText,
      fontSizes: clampFontSizes(fontSizes),
    });
  }, [fontSizes, onExport, titleText]);

  if (!open) return null;

  const titleInputClass =
    "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";

  const numberInputClass =
    "h-9 w-[4.25rem] shrink-0 rounded-md border border-input bg-background px-2 py-1 text-right text-sm tabular-nums text-foreground shadow-sm outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";

  const row = "flex items-center justify-between gap-3";
  const rowLabel = "min-w-0 text-sm text-foreground";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close export dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-chart-modal-title"
        className="relative z-[81] w-full max-w-md rounded-lg border border-border bg-background px-4 pb-4 pt-3 shadow-lg"
      >
        <h2 id="export-chart-modal-title" className="text-base font-semibold leading-tight text-foreground">
          Export chart
        </h2>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          These options apply to the downloaded PNG only.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="export-chart-title-input">
              Title
            </label>
            <input
              id="export-chart-title-input"
              name="export_chart_title"
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              className={titleInputClass}
              dir={titleDir}
              spellCheck={false}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave blank to hide title</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Font preset</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-normal"
                onClick={() => applyPreset(FONT_PRESET_SMALL)}
              >
                Small
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-normal"
                onClick={() => applyPreset({ ...DEFAULT_EXPORT_CHART_FONT_SIZES })}
              >
                Default
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-normal"
                onClick={() => applyPreset(FONT_PRESET_LARGE)}
              >
                Large
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Text</p>
            <div className="space-y-1.5">
              <div className={row}>
                <label className={rowLabel} htmlFor="export-font-title">
                  Title
                </label>
                <input
                  id="export-font-title"
                  name="export_font_title"
                  type="number"
                  inputMode="numeric"
                  min={FONT_MIN}
                  max={FONT_MAX}
                  value={fontSizes.title}
                  onChange={(e) => updateFont("title", e.target.value)}
                  className={numberInputClass}
                />
              </div>
              <div className={row}>
                <label className={rowLabel} htmlFor="export-font-source">
                  Source text
                </label>
                <input
                  id="export-font-source"
                  name="export_font_source"
                  type="number"
                  inputMode="numeric"
                  min={FONT_MIN}
                  max={FONT_MAX}
                  value={fontSizes.source}
                  onChange={(e) => updateFont("source", e.target.value)}
                  className={numberInputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Axes</p>
            <div className="space-y-1.5">
              <div className={row}>
                <label className={rowLabel} htmlFor="export-font-axis-name">
                  Axis labels
                </label>
                <input
                  id="export-font-axis-name"
                  name="export_font_axis_name"
                  type="number"
                  inputMode="numeric"
                  min={FONT_MIN}
                  max={FONT_MAX}
                  value={fontSizes.axisName}
                  onChange={(e) => updateFont("axisName", e.target.value)}
                  className={numberInputClass}
                />
              </div>
              <div className={row}>
                <label className={rowLabel} htmlFor="export-font-axis-tick">
                  Tick labels
                </label>
                <input
                  id="export-font-axis-tick"
                  name="export_font_axis_tick"
                  type="number"
                  inputMode="numeric"
                  min={FONT_MIN}
                  max={FONT_MAX}
                  value={fontSizes.axisTick}
                  onChange={(e) => updateFont("axisTick", e.target.value)}
                  className={numberInputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Legend</p>
            <div className={row}>
              <label className={rowLabel} htmlFor="export-font-legend">
                Legend
              </label>
              <input
                id="export-font-legend"
                name="export_font_legend"
                type="number"
                inputMode="numeric"
                min={FONT_MIN}
                max={FONT_MAX}
                value={fontSizes.legend}
                onChange={(e) => updateFont("legend", e.target.value)}
                className={numberInputClass}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="self-start text-left text-xs text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/40"
            onClick={resetDefaults}
          >
            Reset defaults
          </button>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="min-w-[5.5rem]" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="default" size="sm" className="min-w-[7.5rem]" onClick={handleDownload}>
              Download PNG
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
