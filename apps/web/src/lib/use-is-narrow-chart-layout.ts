"use client";

import { useChartViewportLayout } from "@/lib/use-chart-viewport-layout";

/** @deprecated Prefer {@link useChartViewportLayout}; kept for call sites that only need a boolean. */
export function useIsNarrowChartLayout(): boolean {
  return useChartViewportLayout().isCompact;
}
