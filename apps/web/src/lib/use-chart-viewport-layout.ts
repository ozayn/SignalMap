"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Portrait: narrow width. Landscape phone: width often exceeds 768px but height is small —
 * second clause keeps "compact" chart chrome (subtitle y-label, tighter grid, etc.).
 */
const COMPACT_MEDIA = "(max-width: 767px), ((max-width: 1024px) and (max-height: 560px))";

const DEBOUNCE_MS = 125;

export type ChartViewportLayout = {
  /** Compact / phone chart layout (not desktop `md`). */
  isCompact: boolean;
  /** Compact viewport in landscape (wider plot, slightly more x ticks). */
  isLandscapeCompact: boolean;
  /** Bumps when compact mode or orientation-relevant layout changes (remerge ECharts option). */
  viewportRevision: number;
};

/**
 * Tracks viewport signals used by study `TimelineChart`: width/height breakpoints, orientation,
 * and `visualViewport` (mobile browser chrome). Pair with ResizeObserver on the chart DOM for
 * `chart.resize()`.
 */
export function useChartViewportLayout(): ChartViewportLayout {
  const [isCompact, setIsCompact] = useState(false);
  const [isLandscapeCompact, setIsLandscapeCompact] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const prev = useRef({ compact: false, land: false });

  const syncLayout = useCallback((): { compact: boolean; land: boolean } => {
    if (typeof window === "undefined") {
      return { compact: false, land: false };
    }
    const mq = window.matchMedia(COMPACT_MEDIA);
    const compact = mq.matches;
    const land = compact && window.innerWidth > window.innerHeight;
    setIsCompact(compact);
    setIsLandscapeCompact(land);
    const changed = prev.current.compact !== compact || prev.current.land !== land;
    prev.current = { compact, land };
    if (changed) {
      setViewportRevision((n) => n + 1);
    }
    return { compact, land };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(COMPACT_MEDIA);
    let deb: ReturnType<typeof setTimeout> | undefined;

    const debouncedSync = () => {
      clearTimeout(deb);
      deb = setTimeout(() => {
        syncLayout();
      }, DEBOUNCE_MS);
    };

    const immediateSync = () => {
      clearTimeout(deb);
      syncLayout();
    };

    syncLayout();

    const onMqChange = () => {
      syncLayout();
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("resize", debouncedSync);
    window.addEventListener("orientationchange", immediateSync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", debouncedSync);

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", debouncedSync);
      window.removeEventListener("orientationchange", immediateSync);
      vv?.removeEventListener("resize", debouncedSync);
      clearTimeout(deb);
    };
  }, [syncLayout]);

  return { isCompact, isLandscapeCompact, viewportRevision };
}
