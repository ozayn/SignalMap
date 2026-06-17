"use client";

import * as echarts from "echarts";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { ECharts } from "echarts";

/** Minimum container width/height before ECharts init or resize. */
export const CHART_MIN_LAYOUT_PX = 2;

const DEBOUNCE_MS = 125;

export function isChartLayoutDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_CHART_LAYOUT_DEBUG === "1"
  );
}

/** Temporary diagnostics: chart id, container width, height, and lifecycle phase. */
export function logChartContainerLayout(
  chartId: string,
  el: HTMLElement | null | undefined,
  phase: string
): void {
  if (!isChartLayoutDebugEnabled()) return;
  const width = el?.clientWidth ?? 0;
  const height = el?.clientHeight ?? 0;
  // eslint-disable-next-line no-console -- opt-in chart layout diagnostics
  console.debug(`[chart-layout] id=${chartId} phase=${phase} width=${width} height=${height}`);
}

export function readChartContainerSize(
  el: HTMLElement | null | undefined
): { width: number; height: number } | null {
  if (!el || !el.isConnected) return null;
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (width < CHART_MIN_LAYOUT_PX || height < CHART_MIN_LAYOUT_PX) return null;
  return { width, height };
}

export function resizeEchartsToContainer(
  chart: ECharts | null | undefined,
  el: HTMLElement | null | undefined,
  chartId?: string
): boolean {
  const size = readChartContainerSize(el);
  if (!chart || !size) {
    if (chartId) logChartContainerLayout(chartId, el, "resize-skipped");
    return false;
  }
  if (chartId) logChartContainerLayout(chartId, el, "resize");
  try {
    chart.resize({ width: size.width, height: size.height });
    return true;
  } catch {
    return false;
  }
}

/** Double requestAnimationFrame resize after mount — helps mobile Safari / PWA layout. */
export function requestEchartsContainerResize(
  chart: ECharts | null | undefined,
  el: HTMLElement | null | undefined,
  chartId?: string
): void {
  requestAnimationFrame(() => {
    if (!resizeEchartsToContainer(chart, el, chartId)) return;
    requestAnimationFrame(() => {
      resizeEchartsToContainer(chart, el, chartId);
    });
  });
}

/** Init only when the container has positive layout dimensions. */
export function getOrInitEcharts(
  el: HTMLElement,
  chartId: string,
  existing?: ECharts | null
): ECharts | null {
  const size = readChartContainerSize(el);
  logChartContainerLayout(chartId, el, size ? "init" : "init-deferred-zero");
  if (!size) return null;

  let chart = existing ?? echarts.getInstanceByDom(el);
  if (!chart) {
    chart = echarts.init(el, undefined, {
      renderer: "canvas",
      width: size.width,
      height: size.height,
    });
  }
  return chart;
}

export type UseEchartsContainerLayoutOptions = {
  /** Bump layout revision when width/height changes by more than this (px). Default 48. */
  sizeChangeRevisionThreshold?: number;
};

/**
 * ResizeObserver + window/orientation/visualViewport/visibility/pageshow listeners.
 * Bumps `layoutRevision` when the container transitions from zero to usable size so
 * chart init effects can re-run. Pair with `getOrInitEcharts` in a useEffect that
 * depends on `layoutRevision`.
 */
export function useEchartsContainerLayout(
  containerRef: RefObject<HTMLElement | null>,
  chartId: string,
  options: UseEchartsContainerLayoutOptions = {}
): {
  layoutRevision: number;
  resizeChart: (chart: ECharts | null | undefined) => void;
} {
  const threshold = options.sizeChangeRevisionThreshold ?? 48;
  const [layoutRevision, setLayoutRevision] = useState(0);
  const chartInstanceRef = useRef<ECharts | null | undefined>(null);

  const resizeChart = useCallback(
    (chart: ECharts | null | undefined) => {
      chartInstanceRef.current = chart;
      requestEchartsContainerResize(chart, containerRef.current, chartId);
    },
    [containerRef, chartId]
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let prevOk = readChartContainerSize(el) !== null;
    let prevW = el.clientWidth;
    let prevH = el.clientHeight;
    let debResize: ReturnType<typeof setTimeout> | undefined;

    const scheduleResize = () => {
      clearTimeout(debResize);
      debResize = setTimeout(() => {
        resizeEchartsToContainer(chartInstanceRef.current ?? null, el, chartId);
      }, DEBOUNCE_MS);
    };

    const run = (phase: string) => {
      if (!el.isConnected) return;
      const size = readChartContainerSize(el);
      const ok = size !== null;
      const w = el.clientWidth;
      const h = el.clientHeight;
      logChartContainerLayout(chartId, el, phase);

      if (ok && !prevOk) {
        setLayoutRevision((n) => n + 1);
      } else if (
        ok &&
        prevOk &&
        threshold > 0 &&
        (Math.abs(w - prevW) > threshold || Math.abs(h - prevH) > threshold)
      ) {
        setLayoutRevision((n) => n + 1);
      }
      prevOk = ok;
      prevW = w;
      prevH = h;
      scheduleResize();
    };

    const ro = new ResizeObserver(() => run("resize-observer"));
    ro.observe(el);

    const onWindowResize = () => run("window-resize");
    const onOrientation = () => run("orientationchange");
    const onViewportResize = () => run("visual-viewport");
    const onVisibility = () => {
      if (document.visibilityState === "visible") run("visibility-visible");
    };
    const onPageShow = (e: PageTransitionEvent) => {
      run(e.persisted ? "pageshow-bfcache" : "pageshow");
    };

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onOrientation);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    run("mount");
    requestAnimationFrame(() => run("mount-raf"));

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onOrientation);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      clearTimeout(debResize);
    };
  }, [containerRef, chartId, threshold]);

  return { layoutRevision, resizeChart };
}
