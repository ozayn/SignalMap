"use client";

import { useState, useCallback, useDeferredValue, useMemo } from "react";
import {
  buildRollingOverlays,
  defaultRollingWindow,
  rollingWindowLabel,
  type TSPoint,
} from "@/lib/rolling-stats";
import type { ChartSeries } from "@/components/timeline-chart";

export type RollingStatsState = {
  showAvg: boolean;
  showVol: boolean;
  window: number;
};

export function useRollingStats(granularity: "day" | "month" | "year"): [
  RollingStatsState,
  {
    toggleAvg: () => void;
    toggleVol: () => void;
    setWindow: (w: number) => void;
  },
] {
  const defW = defaultRollingWindow(granularity);
  const [showAvg, setShowAvg] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const [window, setWindow] = useState(defW);

  const toggleAvg = useCallback(() => setShowAvg((v) => !v), []);
  const toggleVol = useCallback(() => setShowVol((v) => !v), []);
  const setW = useCallback(
    (w: number) => setWindow(Math.max(2, Math.min(100, w))),
    []
  );

  return [{ showAvg, showVol, window }, { toggleAvg, toggleVol, setWindow: setW }];
}

/**
 * Lazy + memoized rolling overlays.
 * - Skips computation entirely when both toggles are off.
 * - Uses ``useDeferredValue`` so toggle clicks feel instant: React commits the
 *   checkbox flip first, then runs the expensive useMemo in a non-blocking
 *   transition. ``isComputing`` is true while the deferred value catches up.
 * - useMemo deps are primitive so unrelated re-renders (hover, tooltip,
 *   export dialog) do not retrigger the rolling computation.
 */
export function useRollingOverlays(opts: {
  primaryKey: string;
  primaryLabel: string;
  primaryColor: string;
  primaryPoints: TSPoint[];
  primaryUnit: string;
  primaryYAxisIndex: 0 | 1 | 2;
  config: RollingStatsState;
  granularity: "day" | "month" | "year";
}): { overlays: ChartSeries[]; isComputing: boolean } {
  const {
    primaryKey,
    primaryLabel,
    primaryColor,
    primaryPoints,
    primaryUnit,
    primaryYAxisIndex,
    config,
    granularity,
  } = opts;

  const dShowAvg = useDeferredValue(config.showAvg);
  const dShowVol = useDeferredValue(config.showVol);
  const dWindow = useDeferredValue(config.window);
  const dPoints = useDeferredValue(primaryPoints);

  const overlays = useMemo(() => {
    if (!dShowAvg && !dShowVol) return [];
    if (!dPoints || dPoints.length === 0) return [];
    return buildRollingOverlays({
      primaryKey,
      primaryLabel,
      primaryColor,
      primaryPoints: dPoints,
      primaryUnit,
      primaryYAxisIndex,
      config: { showAvg: dShowAvg, showVol: dShowVol, window: dWindow },
      granularity,
    });
  }, [
    primaryKey,
    primaryLabel,
    primaryColor,
    primaryUnit,
    primaryYAxisIndex,
    granularity,
    dPoints,
    dShowAvg,
    dShowVol,
    dWindow,
  ]);

  const isComputing =
    (dShowAvg !== config.showAvg ||
      dShowVol !== config.showVol ||
      dWindow !== config.window) &&
    (config.showAvg || config.showVol);

  return { overlays, isComputing };
}

export function RollingStatsControls({
  state,
  actions,
  granularity,
  computing = false,
}: {
  state: RollingStatsState;
  actions: { toggleAvg: () => void; toggleVol: () => void; setWindow: (w: number) => void };
  granularity: "day" | "month" | "year";
  computing?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(state.window));

  const commitWindow = useCallback(() => {
    const v = parseInt(draft, 10);
    if (Number.isFinite(v) && v >= 2) {
      actions.setWindow(v);
    } else {
      setDraft(String(state.window));
    }
  }, [draft, actions, state.window]);

  const active = state.showAvg || state.showVol;

  return (
    <details className="text-xs text-zinc-500 dark:text-zinc-400">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        Analysis
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.showAvg}
            onChange={actions.toggleAvg}
            className="accent-blue-500 h-3.5 w-3.5"
          />
          Rolling average
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.showVol}
            onChange={actions.toggleVol}
            className="accent-blue-500 h-3.5 w-3.5"
          />
          Rolling volatility (std. dev.)
        </label>
        {active && (
          <label className="flex items-center gap-1.5">
            Window:
            <input
              type="number"
              min={2}
              max={100}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitWindow}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitWindow();
              }}
              className="w-12 rounded border border-zinc-300 dark:border-zinc-600 bg-transparent px-1.5 py-0.5 text-xs text-center tabular-nums"
            />
            <span className="text-zinc-400 dark:text-zinc-500">
              {rollingWindowLabel(state.window, granularity)}
            </span>
          </label>
        )}
        {active && computing && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
            Computing analysis…
          </span>
        )}
        {active && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic max-w-xs">
            Rolling statistics smooth short-term noise and highlight longer-run instability. They are descriptive, not predictive.
          </span>
        )}
      </div>
    </details>
  );
}
