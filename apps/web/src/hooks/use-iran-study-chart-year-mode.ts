"use client";

import { useState } from "react";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";

/**
 * Shared Gregorian / Iranian (Solar Hijri) / Both axis mode for Iran-focused study charts.
 * One state object per study page — pass `yearAxisMode` into every `TimelineChart` `xAxisYearLabel`
 * when the study supports the control (`supportsIranStudyChartYearAxis`).
 */
export function useIranStudyChartYearMode() {
  const [yearAxisMode, setYearAxisMode] = useState<ChartAxisYearMode>("gregorian");
  return { yearAxisMode, setYearAxisMode };
}
