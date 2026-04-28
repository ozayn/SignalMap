"use client";

import { useState } from "react";
import { useIsNarrowChartLayout } from "@/lib/use-is-narrow-chart-layout";

/**
 * On viewports below `md`, tucks study chart header controls (checkboxes, selects)
 * behind a collapsed "Controls ▾" row so the chart stays visually dominant.
 */
export function StudyChartHeaderControlsShell({ children }: { children: React.ReactNode }) {
  const narrow = useIsNarrowChartLayout();
  const [open, setOpen] = useState(false);

  if (!narrow) {
    return <div className="flex flex-wrap items-center gap-3 pt-2">{children}</div>;
  }

  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-muted/15">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Controls</span>
        <span className="shrink-0 text-[10px] opacity-80 tabular-nums" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border/50 px-2.5 pb-2.5 pt-1">{children}</div>
      ) : null}
    </div>
  );
}
