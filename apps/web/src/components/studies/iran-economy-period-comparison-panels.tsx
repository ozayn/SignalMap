"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart, type ChartSeries, type TimelineEvent } from "@/components/timeline-chart";
import { GdpDecompositionChartSkeleton } from "@/components/studies/gdp-decomposition-chart-ui";
import { CHART_LINE_SYMBOL_SIZE } from "@/lib/chart-series-markers";
import { SIGNAL_CONCEPT } from "@/lib/signalmap-chart-colors";
import { enEconomic, faEconomic } from "@/lib/signalmap-i18n/economic-terms";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import {
  iranFxLevelsHasNonPositiveValuesInRange,
  iranFxLevelsSuggestLogDefaultInRange,
} from "@/lib/iran-fx-chart-log-default";
import {
  PovertyHeadcountPppInfoTrigger,
  PovertyHeadcountPppMutedNote,
} from "@/components/poverty-chart-ppp-note";
import {
  buildPovertyHeadcountCoverageExtras,
  buildSparseWdiLineCoverageExtras,
} from "@/lib/poverty-chart-data-coverage";
import type { GdpDecompositionCoverage } from "@/lib/gdp-decomposition-coverage";
import type { ChartPeriodOverlayBandInput } from "@/lib/iran-iraq-war-chart-overlay";

/** Taller plot area than default study charts; tuned for long-run Iran macro panels. */
const IPC_COMPARISON_CHART_HEIGHT =
  "h-[min(52dvh,400px)] max-md:landscape:h-[min(40dvh,300px)] md:h-[26rem] lg:h-96";
const FX_COMPARISON_GRID_LEFT = 92;
const FX_COMPARISON_GRID_RIGHT = "32px";

type Point = { date: string; value: number };
type GdpDecompMode = "nominal" | "real";

function firstAvailableYear(points: Point[]): number | null {
  let first: number | null = null;
  for (const p of points) {
    const y = Number.parseInt(p.date.slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    if (first == null || y < first) first = y;
  }
  return first;
}

function trimSeriesFromYear(points: Point[], startYear: number | null): Point[] {
  if (startYear == null) return points;
  return points.filter((p) => {
    const y = Number.parseInt(p.date.slice(0, 4), 10);
    return Number.isFinite(y) && y >= startYear;
  });
}

function deriveRentsDecomposition(gdpPoints: Point[], sharePointsByDate: Map<string, number>) {
  const rentsProxy: Point[] = [];
  const remainderProxy: Point[] = [];
  const totalGdp: Point[] = [];
  for (const gdp of gdpPoints) {
    if (!Number.isFinite(gdp.value)) continue;
    const sharePct = sharePointsByDate.get(gdp.date);
    if (!Number.isFinite(sharePct)) continue;
    const rentsValue = (gdp.value * (sharePct as number)) / 100;
    rentsProxy.push({ date: gdp.date, value: rentsValue });
    remainderProxy.push({ date: gdp.date, value: gdp.value - rentsValue });
    totalGdp.push(gdp);
  }
  return { rentsProxy, remainderProxy, totalGdp };
}

function deriveOilGasDecomposition(
  gdpPoints: Point[],
  oilShareByDate: Map<string, number>,
  gasShareByDate: Map<string, number>
) {
  const oilProxy: Point[] = [];
  const gasProxy: Point[] = [];
  const remainderProxy: Point[] = [];
  const totalGdp: Point[] = [];
  for (const gdp of gdpPoints) {
    if (!Number.isFinite(gdp.value)) continue;
    const oilPct = oilShareByDate.get(gdp.date);
    const gasPct = gasShareByDate.get(gdp.date);
    if (!Number.isFinite(oilPct) || !Number.isFinite(gasPct)) continue;
    const oilValue = (gdp.value * (oilPct as number)) / 100;
    const gasValue = (gdp.value * (gasPct as number)) / 100;
    oilProxy.push({ date: gdp.date, value: oilValue });
    gasProxy.push({ date: gdp.date, value: gasValue });
    remainderProxy.push({ date: gdp.date, value: gdp.value - oilValue - gasValue });
    totalGdp.push(gdp);
  }
  return { oilProxy, gasProxy, remainderProxy, totalGdp };
}

export type IranEconomyPeriodComparisonPanelsProps = {
  isFa: boolean;
  L: (isFa: boolean, en: string, fa: string) => string;
  studyTitle: string;
  chartLocaleForCharts: "en" | "fa" | undefined;
  chartYearAxisLabel: ChartAxisYearMode | undefined;
  timeRange: [string, string];
  /** When omitted (e.g. IR 1979– outer-only preset), charts zoom to `timeRange` without a shaded focus band. */
  regimeArea?: { xStart: string; xEnd: string; label: string };
  focusGregorianYearRange: { startYear: number; endYear: number };
  focusHoverHint: { en: string; fa: string };
  events: TimelineEvent[];
  exportStudyHeading: string;
  studyChartExportSource: (isFa: boolean, parts: (string | null | undefined)[]) => string | undefined;
  recoInflationIranPoints: Point[];
  recoInflationSource: { name?: string; url?: string; publisher?: string } | null;
  recoGdpGrowthPoints: Point[];
  recoDemandConsumptionPoints: Point[];
  recoDemandInvestmentPoints: Point[];
  recoDemandGdpPoints: Point[];
  recoGdpDecompNonOilPoints: Point[];
  recoGdpDecompOilPoints: Point[];
  recoGdpDecompCoverage: GdpDecompositionCoverage | null;
  recoDemandRealConsumptionPoints: Point[];
  recoDemandRealInvestmentPoints: Point[];
  recoDemandRealGdpPoints: Point[];
  recoDemandNominalSource: { name?: string; url?: string; publisher?: string } | null;
  recoDemandIndicatorIds: Record<string, string> | null;
  recoImportsPoints: Point[];
  recoExportsPoints: Point[];
  recoManufacturingPoints: Point[];
  recoIndustryPoints: Point[];
  recoIsiSource: { name?: string; url?: string; publisher?: string } | null;
  recoIsiIndicatorIds: Record<string, string> | null;
  recoOilRentsPoints: Point[];
  recoNaturalGasRentsPoints: Point[];
  recoExternalDebtPctGdpPoints: Point[];
  recoExternalDebtUsdPoints: Point[];
  recoExternalDebtSource: { name?: string; url?: string; publisher?: string } | null;
  recoExternalDebtIndicatorIds: Record<string, string> | null;
  recoDutchSource: { name?: string; url?: string; publisher?: string } | null;
  recoM2Points: Point[];
  recoM2CpiPoints: Point[];
  recoMoneyCitation: { en: string; fa: string } | null;
  recoMoneyWdiSource: { name?: string; url?: string; publisher?: string } | null;
  recoMoneyIndicatorIds: { broad_money_growth: string; cpi_inflation_yoy_iran: string } | null;
  recoFxOfficialPoints: Point[];
  recoOpenAnnualMean: Point[];
  recoFxSpreadPctPoints: Point[];
  recoFxOfficialSource: { name?: string; url?: string; publisher?: string } | null;
  recoFxOpenSource: { name?: string; url?: string; publisher?: string } | null;
  ipcWageRealKTomans: Point[];
  ipcWageSource: { nominal: string; cpi: string } | null;
  ipcWageLoadFailed: boolean;
  recoLoading: boolean;
  recoLoadFailed: boolean;
  recoLoadDetail: string | null;
  recoWelfareGiniIranPoints: Point[];
  recoWelfareGiniSource: { name?: string; url?: string; publisher?: string } | null;
  recoWelfareGiniIndicatorId: string;
  recoWelfarePovertyDdayPoints: Point[];
  recoWelfarePovertyLmicPoints: Point[];
  recoWelfarePovertyDdayShort: string;
  recoWelfarePovertyLmicShort: string;
  recoWelfarePovertyDdayTitle: string;
  recoWelfarePovertyLmicTitle: string;
  recoWelfarePovertySource: { name?: string; url?: string; publisher?: string } | null;
  recoWelfarePovertyDdayId: string;
  recoWelfarePovertyLmicId: string;
  /** Optional contextual x-bands (e.g. Iran–Iraq War), same Gregorian keys as series. */
  chartPeriodOverlayBands?: ChartPeriodOverlayBandInput[];
  /** Vertical markLine at Gregorian 1979 when in range (default on in study header). */
  showRevolution1979Marker?: boolean;
};

export function IranEconomyPeriodComparisonPanels({
  isFa,
  L,
  studyTitle,
  chartLocaleForCharts,
  chartYearAxisLabel,
  timeRange,
  regimeArea,
  focusGregorianYearRange,
  focusHoverHint,
  events,
  exportStudyHeading,
  studyChartExportSource,
  recoInflationIranPoints,
  recoInflationSource,
  recoGdpGrowthPoints,
  recoDemandConsumptionPoints,
  recoDemandInvestmentPoints,
  recoDemandGdpPoints,
  recoGdpDecompNonOilPoints,
  recoGdpDecompOilPoints,
  recoGdpDecompCoverage,
  recoDemandRealConsumptionPoints,
  recoDemandRealInvestmentPoints,
  recoDemandRealGdpPoints,
  recoDemandNominalSource,
  recoDemandIndicatorIds,
  recoImportsPoints,
  recoExportsPoints,
  recoManufacturingPoints,
  recoIndustryPoints,
  recoIsiSource,
  recoIsiIndicatorIds,
  recoOilRentsPoints,
  recoNaturalGasRentsPoints,
  recoExternalDebtPctGdpPoints,
  recoExternalDebtUsdPoints,
  recoExternalDebtSource,
  recoExternalDebtIndicatorIds,
  recoDutchSource,
  recoM2Points,
  recoM2CpiPoints,
  recoMoneyCitation,
  recoMoneyWdiSource,
  recoMoneyIndicatorIds,
  recoFxOfficialPoints,
  recoOpenAnnualMean,
  recoFxSpreadPctPoints,
  recoFxOfficialSource,
  recoFxOpenSource,
  ipcWageRealKTomans,
  ipcWageSource,
  ipcWageLoadFailed,
  recoLoading,
  recoLoadFailed,
  recoLoadDetail,
  recoWelfareGiniIranPoints,
  recoWelfareGiniSource,
  recoWelfareGiniIndicatorId,
  recoWelfarePovertyDdayPoints,
  recoWelfarePovertyLmicPoints,
  recoWelfarePovertyDdayShort,
  recoWelfarePovertyLmicShort,
  recoWelfarePovertyDdayTitle,
  recoWelfarePovertyLmicTitle,
  recoWelfarePovertySource,
  recoWelfarePovertyDdayId,
  recoWelfarePovertyLmicId,
  chartPeriodOverlayBands,
  showRevolution1979Marker = false,
}: IranEconomyPeriodComparisonPanelsProps) {
  const revolution1979Marker = useMemo(
    () =>
      showRevolution1979Marker
        ? { enabled: true as const, label: L(isFa, "1979 Revolution", "انقلاب ۱۳۵۷") }
        : undefined,
    [showRevolution1979Marker, isFa, L]
  );

  const welfarePovertyCoverage = useMemo(
    () =>
      buildPovertyHeadcountCoverageExtras(
        recoWelfarePovertyDdayPoints,
        recoWelfarePovertyLmicPoints,
        timeRange,
        focusGregorianYearRange.endYear
      ),
    [recoWelfarePovertyDdayPoints, recoWelfarePovertyLmicPoints, timeRange, focusGregorianYearRange.endYear]
  );

  const welfareGiniCoverage = useMemo(
    () =>
      buildSparseWdiLineCoverageExtras(
        recoWelfareGiniIranPoints,
        timeRange,
        focusGregorianYearRange.endYear
      ),
    [recoWelfareGiniIranPoints, timeRange, focusGregorianYearRange.endYear]
  );

  const externalDebtContextEvents = useMemo<TimelineEvent[]>(
    () => [
      {
        id: "ext-debt-borrowing-surge-1991",
        layer: "iran_core",
        date: "1991-01-01",
        title: "Foreign borrowing surge during reconstruction period",
        title_fa: "افزایش استقراض خارجی در دوره بازسازی",
      },
      {
        id: "ext-debt-peak-1995",
        layer: "iran_core",
        date: "1995-01-01",
        title: "Debt peak and rescheduling pressures",
        title_fa: "اوج بدهی و فشار بازپرداخت",
      },
    ],
    []
  );

  const externalDebtChartEvents = useMemo(
    () => [...externalDebtContextEvents, ...events],
    [externalDebtContextEvents, events]
  );
  const fxSharedTimeRange = timeRange;

  const nominalDecompOverlapStartYear = useMemo(() => {
    const gdpStart = firstAvailableYear(recoDemandGdpPoints);
    const oilStart = firstAvailableYear(recoOilRentsPoints);
    if (gdpStart == null || oilStart == null) return null;
    return Math.max(gdpStart, oilStart);
  }, [recoDemandGdpPoints, recoOilRentsPoints]);

  const realDecompOverlapStartYear = useMemo(() => {
    const gdpStart = firstAvailableYear(recoDemandRealGdpPoints);
    const oilStart = firstAvailableYear(recoOilRentsPoints);
    if (gdpStart == null || oilStart == null) return null;
    return Math.max(gdpStart, oilStart);
  }, [recoDemandRealGdpPoints, recoOilRentsPoints]);

  const nominalHydroDecompOverlapStartYear = useMemo(() => {
    const gdpStart = firstAvailableYear(recoDemandGdpPoints);
    const oilStart = firstAvailableYear(recoOilRentsPoints);
    const gasStart = firstAvailableYear(recoNaturalGasRentsPoints);
    if (gdpStart == null || oilStart == null || gasStart == null) return null;
    return Math.max(gdpStart, oilStart, gasStart);
  }, [recoDemandGdpPoints, recoOilRentsPoints, recoNaturalGasRentsPoints]);

  const realHydroDecompOverlapStartYear = useMemo(() => {
    const gdpStart = firstAvailableYear(recoDemandRealGdpPoints);
    const oilStart = firstAvailableYear(recoOilRentsPoints);
    const gasStart = firstAvailableYear(recoNaturalGasRentsPoints);
    if (gdpStart == null || oilStart == null || gasStart == null) return null;
    return Math.max(gdpStart, oilStart, gasStart);
  }, [recoDemandRealGdpPoints, recoOilRentsPoints, recoNaturalGasRentsPoints]);

  const ipcGdpDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
    if (
      recoGdpDecompNonOilPoints.length === 0 ||
      recoGdpDecompOilPoints.length === 0 ||
      recoDemandGdpPoints.length === 0
    ) {
      return null;
    }
    return [
      {
        key: "gdp_non_oil_proxy",
        label: L(isFa, "Non-oil GDP proxy", "GDP غیرنفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: recoGdpDecompNonOilPoints,
        color: SIGNAL_CONCEPT.remainder_gdp_proxy,
        smooth: true,
        showSymbol: false,
        stack: "gdp_nom_decomp",
        stackedArea: true,
      },
      {
        key: "gdp_oil_proxy",
        label: L(isFa, "Oil rents proxy", "رانت نفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: recoGdpDecompOilPoints,
        color: SIGNAL_CONCEPT.oil_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_nom_decomp",
        stackedArea: true,
      },
      {
        key: "level_gdp",
        label: L(isFa, "Total GDP", "GDP کل"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: trimSeriesFromYear(recoDemandGdpPoints, nominalDecompOverlapStartYear),
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [recoGdpDecompNonOilPoints, recoGdpDecompOilPoints, recoDemandGdpPoints, isFa, nominalDecompOverlapStartYear, L]);

  const ipcRealGdpDecomposition = useMemo(() => {
    if (recoDemandRealGdpPoints.length === 0 || recoOilRentsPoints.length === 0) return null;
    const oilRentsPctByDate = new Map<string, number>();
    for (const p of recoOilRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      oilRentsPctByDate.set(p.date, p.value);
    }
    const { rentsProxy: oilProxy, remainderProxy: nonOilProxy, totalGdp } = deriveRentsDecomposition(
      recoDemandRealGdpPoints,
      oilRentsPctByDate
    );
    return {
      oilProxy,
      nonOilProxy,
      totalGdp,
      overlapYears: totalGdp.length,
      realGdpYearsInWindow: recoDemandRealGdpPoints.length,
    };
  }, [recoDemandRealGdpPoints, recoOilRentsPoints]);

  const ipcNominalHydrocarbonDecomposition = useMemo(() => {
    if (
      recoDemandGdpPoints.length === 0 ||
      recoOilRentsPoints.length === 0 ||
      recoNaturalGasRentsPoints.length === 0
    ) {
      return null;
    }
    const oilByDate = new Map<string, number>();
    const gasByDate = new Map<string, number>();
    for (const p of recoOilRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      oilByDate.set(p.date, p.value);
    }
    for (const p of recoNaturalGasRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      gasByDate.set(p.date, p.value);
    }
    return deriveOilGasDecomposition(recoDemandGdpPoints, oilByDate, gasByDate);
  }, [recoDemandGdpPoints, recoOilRentsPoints, recoNaturalGasRentsPoints]);

  const ipcRealHydrocarbonDecomposition = useMemo(() => {
    if (
      recoDemandRealGdpPoints.length === 0 ||
      recoOilRentsPoints.length === 0 ||
      recoNaturalGasRentsPoints.length === 0
    ) {
      return null;
    }
    const oilByDate = new Map<string, number>();
    const gasByDate = new Map<string, number>();
    for (const p of recoOilRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      oilByDate.set(p.date, p.value);
    }
    for (const p of recoNaturalGasRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      gasByDate.set(p.date, p.value);
    }
    return deriveOilGasDecomposition(recoDemandRealGdpPoints, oilByDate, gasByDate);
  }, [recoDemandRealGdpPoints, recoOilRentsPoints, recoNaturalGasRentsPoints]);

  const ipcGdpDecompPartialNote = useMemo(() => {
    if (!recoGdpDecompCoverage || recoLoading || recoLoadFailed) return null;
    const g = recoGdpDecompCoverage.gdp_usd.years_in_window;
    const o = recoGdpDecompCoverage.overlap_years_count;
    if (o > 0 && o < g) {
      return L(
        isFa,
        "Only years with both GDP (current US$, NY.GDP.MKTP.CD) and oil rents (% of GDP, NY.GDP.PETR.RT.ZS) are included in the stacked view. Years are joined on Gregorian calendar years, independent of the axis label mode.",
        "فقط سال‌هایی که هم GDP (دلار جاری، NY.GDP.MKTP.CD) و هم رانت نفتی٪ GDP (NY.GDP.PETR.RT.ZS) موجود است در نمای ستونی آمده‌اند. تطبیق بر اساس سال میلادی است و به حالت نمایش محور (شمسی/میلادی) وابسته نیست."
      );
    }
    return null;
  }, [recoGdpDecompCoverage, recoLoading, recoLoadFailed, isFa]);

  const ipcRealGdpDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
    if (!ipcRealGdpDecomposition) return null;
    if (
      ipcRealGdpDecomposition.nonOilProxy.length === 0 ||
      ipcRealGdpDecomposition.oilProxy.length === 0 ||
      ipcRealGdpDecomposition.totalGdp.length === 0
    ) {
      return null;
    }
    return [
      {
        key: "real_gdp_non_oil_proxy",
        label: L(isFa, "Non-oil GDP proxy", "GDP غیرنفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealGdpDecomposition.nonOilProxy, realDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.remainder_gdp_proxy,
        smooth: true,
        showSymbol: false,
        stack: "gdp_real_decomp",
        stackedArea: true,
      },
      {
        key: "real_gdp_oil_proxy",
        label: L(isFa, "Oil rents proxy", "رانت نفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealGdpDecomposition.oilProxy, realDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.oil_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_real_decomp",
        stackedArea: true,
      },
      {
        key: "real_level_gdp",
        label: L(isFa, "Total GDP", "GDP کل"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealGdpDecomposition.totalGdp, realDecompOverlapStartYear),
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [ipcRealGdpDecomposition, isFa, L, realDecompOverlapStartYear]);

  const ipcNominalHydrocarbonDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
    if (!ipcNominalHydrocarbonDecomposition) return null;
    if (
      ipcNominalHydrocarbonDecomposition.remainderProxy.length === 0 ||
      ipcNominalHydrocarbonDecomposition.oilProxy.length === 0 ||
      ipcNominalHydrocarbonDecomposition.gasProxy.length === 0 ||
      ipcNominalHydrocarbonDecomposition.totalGdp.length === 0
    ) {
      return null;
    }
    return [
      {
        key: "gdp_remainder_proxy",
        label: L(isFa, "Remainder GDP proxy", "باقیمانده GDP (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: trimSeriesFromYear(ipcNominalHydrocarbonDecomposition.remainderProxy, nominalHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.remainder_gdp_proxy,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_nom_decomp",
        stackedArea: true,
      },
      {
        key: "gdp_oil_proxy_hydro",
        label: L(isFa, "Oil rents proxy", "رانت نفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: trimSeriesFromYear(ipcNominalHydrocarbonDecomposition.oilProxy, nominalHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.oil_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_nom_decomp",
        stackedArea: true,
      },
      {
        key: "gdp_gas_proxy_hydro",
        label: L(isFa, "Natural gas rents proxy", "رانت گاز طبیعی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: trimSeriesFromYear(ipcNominalHydrocarbonDecomposition.gasProxy, nominalHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.natural_gas_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_nom_decomp",
        stackedArea: true,
      },
      {
        key: "level_gdp_hydro",
        label: L(isFa, "Total GDP", "GDP کل"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: trimSeriesFromYear(ipcNominalHydrocarbonDecomposition.totalGdp, nominalHydroDecompOverlapStartYear),
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [ipcNominalHydrocarbonDecomposition, isFa, L, nominalHydroDecompOverlapStartYear]);

  const ipcRealHydrocarbonDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
    if (!ipcRealHydrocarbonDecomposition) return null;
    if (
      ipcRealHydrocarbonDecomposition.remainderProxy.length === 0 ||
      ipcRealHydrocarbonDecomposition.oilProxy.length === 0 ||
      ipcRealHydrocarbonDecomposition.gasProxy.length === 0 ||
      ipcRealHydrocarbonDecomposition.totalGdp.length === 0
    ) {
      return null;
    }
    return [
      {
        key: "real_gdp_remainder_proxy",
        label: L(isFa, "Remainder GDP proxy", "باقیمانده GDP (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealHydrocarbonDecomposition.remainderProxy, realHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.remainder_gdp_proxy,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_real_decomp",
        stackedArea: true,
      },
      {
        key: "real_gdp_oil_proxy_hydro",
        label: L(isFa, "Oil rents proxy", "رانت نفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealHydrocarbonDecomposition.oilProxy, realHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.oil_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_real_decomp",
        stackedArea: true,
      },
      {
        key: "real_gdp_gas_proxy_hydro",
        label: L(isFa, "Natural gas rents proxy", "رانت گاز طبیعی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealHydrocarbonDecomposition.gasProxy, realHydroDecompOverlapStartYear),
        color: SIGNAL_CONCEPT.natural_gas_rents,
        smooth: true,
        showSymbol: false,
        stack: "gdp_hydro_real_decomp",
        stackedArea: true,
      },
      {
        key: "real_level_gdp_hydro",
        label: L(isFa, "Total GDP", "GDP کل"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: trimSeriesFromYear(ipcRealHydrocarbonDecomposition.totalGdp, realHydroDecompOverlapStartYear),
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [ipcRealHydrocarbonDecomposition, isFa, L, realHydroDecompOverlapStartYear]);

  const [ipcGdpDecompMode, setIpcGdpDecompMode] = useState<GdpDecompMode>("real");
  const [ipcDemandMode, setIpcDemandMode] = useState<GdpDecompMode>("real");
  const ipcSelectedGdpDecompMultiSeries =
    ipcGdpDecompMode === "real" ? ipcRealGdpDecompositionMultiSeries : ipcGdpDecompositionMultiSeries;
  const ipcSelectedHydroDecompMultiSeries =
    ipcGdpDecompMode === "real" ? ipcRealHydrocarbonDecompositionMultiSeries : ipcNominalHydrocarbonDecompositionMultiSeries;
  const ipcSelectedDecompOverlapStartYear =
    ipcGdpDecompMode === "real" ? realDecompOverlapStartYear : nominalDecompOverlapStartYear;
  const ipcSelectedHydroDecompOverlapStartYear =
    ipcGdpDecompMode === "real" ? realHydroDecompOverlapStartYear : nominalHydroDecompOverlapStartYear;
  const ipcGdpDecompTimeRange = useMemo<[string, string]>(() => {
    const defaultStart = Number.parseInt((timeRange[0] ?? "").slice(0, 4), 10);
    const effectiveStartYear =
      ipcSelectedDecompOverlapStartYear != null
        ? ipcSelectedDecompOverlapStartYear
        : Number.isFinite(defaultStart)
          ? defaultStart
          : 1960;
    return [`${effectiveStartYear}-01-01`, timeRange[1]];
  }, [ipcSelectedDecompOverlapStartYear, timeRange]);
  const ipcHydroDecompTimeRange = useMemo<[string, string]>(() => {
    const defaultStart = Number.parseInt((timeRange[0] ?? "").slice(0, 4), 10);
    const effectiveStartYear =
      ipcSelectedHydroDecompOverlapStartYear != null
        ? ipcSelectedHydroDecompOverlapStartYear
        : Number.isFinite(defaultStart)
          ? defaultStart
          : 1960;
    return [`${effectiveStartYear}-01-01`, timeRange[1]];
  }, [ipcSelectedHydroDecompOverlapStartYear, timeRange]);
  const ipcDemandNominalMultiSeries = useMemo(
    (): ChartSeries[] => [
      {
        key: "level_consumption",
        label: L(isFa, "Final consumption expenditure", "مصرف"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: recoDemandConsumptionPoints,
        color: SIGNAL_CONCEPT.consumption,
        symbol: "circle",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
      {
        key: "level_investment",
        label: L(isFa, "Gross capital formation (investment)", "سرمایه‌گذاری"),
        yAxisIndex: 0,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: recoDemandInvestmentPoints,
        color: SIGNAL_CONCEPT.investment,
        symbol: "diamond",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
      {
        key: "level_gdp",
        label: L(isFa, "GDP", "تولید ناخالص داخلی"),
        yAxisIndex: 1,
        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
        points: recoDemandGdpPoints,
        color: SIGNAL_CONCEPT.gdp,
        symbol: "triangle",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
    ],
    [isFa, L, recoDemandConsumptionPoints, recoDemandInvestmentPoints, recoDemandGdpPoints]
  );
  const ipcDemandRealMultiSeries = useMemo(
    (): ChartSeries[] => [
      {
        key: "real_consumption",
        label: L(isFa, "Final consumption expenditure", "مصرف"),
        yAxisIndex: 0,
        unit: L(isFa, "constant US$", "دلار ثابت"),
        points: recoDemandRealConsumptionPoints,
        color: SIGNAL_CONCEPT.consumption,
        symbol: "circle",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
      {
        key: "real_investment",
        label: L(isFa, "Gross capital formation (investment)", "سرمایه‌گذاری"),
        yAxisIndex: 0,
        unit: L(isFa, "constant US$", "دلار ثابت"),
        points: recoDemandRealInvestmentPoints,
        color: SIGNAL_CONCEPT.investment,
        symbol: "diamond",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
      {
        key: "real_gdp",
        label: L(isFa, "GDP", "تولید ناخالص داخلی"),
        yAxisIndex: 1,
        unit: L(isFa, "constant US$", "دلار ثابت"),
        points: recoDemandRealGdpPoints,
        color: SIGNAL_CONCEPT.gdp,
        symbol: "triangle",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        smooth: true,
      },
    ],
    [isFa, L, recoDemandRealConsumptionPoints, recoDemandRealInvestmentPoints, recoDemandRealGdpPoints]
  );
  const ipcSelectedDemandMultiSeries = ipcDemandMode === "real" ? ipcDemandRealMultiSeries : ipcDemandNominalMultiSeries;
  const ipcHasNominalDemandData =
    recoDemandConsumptionPoints.length > 0 || recoDemandInvestmentPoints.length > 0 || recoDemandGdpPoints.length > 0;
  const ipcHasRealDemandData =
    recoDemandRealConsumptionPoints.length > 0 || recoDemandRealInvestmentPoints.length > 0 || recoDemandRealGdpPoints.length > 0;
  const ipcSelectedGdpDecompPartialNote = useMemo(() => {
    if (ipcGdpDecompMode === "nominal") return ipcGdpDecompPartialNote;
    if (!ipcRealGdpDecomposition || recoLoading || recoLoadFailed) return null;
    const g = ipcRealGdpDecomposition.realGdpYearsInWindow;
    const o = ipcRealGdpDecomposition.overlapYears;
    if (o > 0 && o < g) {
      return L(
        isFa,
        "Only years with both real GDP (NY.GDP.MKTP.KD) and oil rents (% of GDP, NY.GDP.PETR.RT.ZS) are included in the stacked view. Years are joined on Gregorian calendar years, independent of the axis label mode.",
        "فقط سال‌هایی که هم GDP واقعی (NY.GDP.MKTP.KD) و هم رانت نفتی٪ GDP (NY.GDP.PETR.RT.ZS) موجود است در نمای ستونی آمده‌اند. تطبیق بر اساس سال میلادی است و به حالت نمایش محور (شمسی/میلادی) وابسته نیست."
      );
    }
    return null;
  }, [ipcGdpDecompMode, ipcGdpDecompPartialNote, ipcRealGdpDecomposition, recoLoading, recoLoadFailed, isFa, L]);

  const [fxLevelsLogScale, setFxLevelsLogScale] = useState(false);
  const fxLogDefaultAppliedRef = useRef(false);
  const fxDataKeyRef = useRef("");

  const fxDataKey = `${timeRange[0]}\u0000${timeRange[1]}\u0000${recoFxOfficialPoints.length}\u0000${recoOpenAnnualMean.length}`;
  useEffect(() => {
    if (fxDataKeyRef.current !== fxDataKey) {
      fxDataKeyRef.current = fxDataKey;
      fxLogDefaultAppliedRef.current = false;
    }
  }, [fxDataKey]);

  useEffect(() => {
    if (fxLogDefaultAppliedRef.current) return;
    if (recoFxOfficialPoints.length === 0 && recoOpenAnnualMean.length === 0) return;
    setFxLevelsLogScale(
      iranFxLevelsSuggestLogDefaultInRange(recoFxOfficialPoints, recoOpenAnnualMean, timeRange, "long_run")
    );
    fxLogDefaultAppliedRef.current = true;
  }, [recoFxOfficialPoints, recoOpenAnnualMean, fxDataKey]);

  const fxLevelsLogNote =
    fxLevelsLogScale &&
    iranFxLevelsHasNonPositiveValuesInRange(recoFxOfficialPoints, recoOpenAnnualMean, timeRange)
      ? L(
          isFa,
          "Log scale: years with zero or negative rates are omitted from the plot.",
          "مقیاس لگاریتمی: سال‌هایی با نرخ صفر یا منفی از نمودار حذف شده‌اند."
        )
      : undefined;

  return (
    <>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl mb-4">
        {L(isFa, enEconomic.annualWdiVsMarketNoteEn, faEconomic.annualWdiVsMarketNoteFa)}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl mb-4 border-l-2 border-border pl-3">
        {L(
          isFa,
          "This view keeps the long-run series visible while highlighting a selected historical window. The shaded band is a visual aid for comparison; it does not imply causality.",
          "«در این نما کل روند بلندمدت دیده می‌شود و یک دوره تاریخی انتخابی با سایه مشخص می‌شود. این سایه فقط برای مقایسه بصری است و به معنی رابطه علّی نیست.»"
        )}
      </p>
      {recoLoading && !recoLoadFailed ? (
        <p className="text-sm text-muted-foreground mb-4">{L(isFa, "Loading macro series…", "در حال بارگذاری سری‌های کلان…")}</p>
      ) : null}
      {recoLoadFailed ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
          <p className="text-sm font-medium text-foreground">{L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}</p>
          {recoLoadDetail ? <p className="text-xs text-muted-foreground font-mono break-words">{recoLoadDetail}</p> : null}
        </div>
      ) : null}
      {!recoLoadFailed ? (
        <div className="grid gap-4 md:grid-cols-2 max-w-6xl">
          <Card className="chart-card border-border">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "1. CPI inflation", `۱. ${faEconomic.cpiInflation} (${faEconomic.yoyAnnual})`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {L(isFa, "WDI FP.CPI.TOTL.ZG — Iran.", "WDI FP.CPI.TOTL.ZG — ایران.")}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoInflationIranPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(isFa, `${studyTitle} — Inflation`, `${studyTitle} — ${faEconomic.inflation}`)}
                  exportSourceFooter={studyChartExportSource(isFa, [recoInflationSource?.name ?? "World Bank WDI", "FP.CPI.TOTL.ZG"])}
                  data={recoInflationIranPoints}
                  valueKey="value"
                  label={L(isFa, "CPI inflation", "تورم")}
                  unit="%"
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-inflation"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  seriesColor="hsl(0, 84%, 59%)"
                  gridLeft={80}
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "2. Real GDP growth", `۲. ${faEconomic.realGdpGrowth} (٪ سالانه)`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {L(isFa, "WDI NY.GDP.MKTP.KD.ZG — Iran.", "WDI NY.GDP.MKTP.KD.ZG — ایران.")}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoGdpGrowthPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — ${enEconomic.realGdpGrowth}`,
                    `${studyTitle} — ${faEconomic.realGdpGrowth}`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoIsiSource?.name ?? "World Bank WDI",
                    recoIsiIndicatorIds?.gdp_growth_pct ?? "NY.GDP.MKTP.KD.ZG",
                  ])}
                  data={recoGdpGrowthPoints}
                  valueKey="value"
                  label={L(isFa, enEconomic.realGdpGrowth, "رشد GDP")}
                  unit="%"
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-gdp-growth"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  seriesColor="hsl(217, 91%, 59%)"
                  gridLeft={80}
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(
                  isFa,
                  recoExternalDebtPctGdpPoints.length > 0
                    ? "External debt (% of GDP)"
                    : "External debt (USD)",
                  recoExternalDebtPctGdpPoints.length > 0
                    ? "بدهی خارجی (% از تولید ناخالص داخلی)"
                    : "بدهی خارجی (دلار)"
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                {L(
                  isFa,
                  "External debt measures obligations to non-resident creditors. It does not include domestic debt.",
                  "«بدهی خارجی شامل بدهی به وام‌دهندگان خارجی است و بدهی داخلی را شامل نمی‌شود.»"
                )}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoExternalDebtPctGdpPoints.length > 0 || recoExternalDebtUsdPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    recoExternalDebtPctGdpPoints.length > 0
                      ? `${studyTitle} — External debt (% of GDP)`
                      : `${studyTitle} — External debt (USD)`,
                    recoExternalDebtPctGdpPoints.length > 0
                      ? `${studyTitle} — بدهی خارجی (% از GDP)`
                      : `${studyTitle} — بدهی خارجی (دلار)`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoExternalDebtSource?.name ?? "World Bank WDI",
                    recoExternalDebtPctGdpPoints.length > 0
                      ? recoExternalDebtIndicatorIds?.external_debt_pct_gdp ?? "derived:DT.DOD.DECT.CD/NY.GDP.MKTP.CD*100"
                      : recoExternalDebtIndicatorIds?.external_debt_usd ?? "DT.DOD.DECT.CD",
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(
                    isFa,
                    recoExternalDebtPctGdpPoints.length > 0 ? "External debt (% of GDP)" : "External debt (USD)",
                    recoExternalDebtPctGdpPoints.length > 0
                      ? "بدهی خارجی (% از تولید ناخالص داخلی)"
                      : "بدهی خارجی (دلار)"
                  )}
                  events={externalDebtChartEvents}
                  multiSeries={[
                    {
                      key: recoExternalDebtPctGdpPoints.length > 0 ? "external_debt_pct_gdp" : "external_debt_usd",
                      label: L(
                        isFa,
                        recoExternalDebtPctGdpPoints.length > 0 ? "External debt (% of GDP)" : "External debt (USD)",
                        recoExternalDebtPctGdpPoints.length > 0
                          ? "بدهی خارجی (% از تولید ناخالص داخلی)"
                          : "بدهی خارجی (دلار)"
                      ),
                      yAxisIndex: 0,
                      unit: recoExternalDebtPctGdpPoints.length > 0 ? L(isFa, "% of GDP", "درصدی از تولید ناخالص داخلی") : L(isFa, "current US$", "دلار جاری آمریکا"),
                      points: recoExternalDebtPctGdpPoints.length > 0 ? recoExternalDebtPctGdpPoints : recoExternalDebtUsdPoints,
                      color: SIGNAL_CONCEPT.gdp,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                      smooth: false,
                    },
                  ]}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  forceTimeAxis
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem={
                    recoExternalDebtPctGdpPoints.length > 0
                      ? "iran-ipc-external-debt-pct-gdp"
                      : "iran-ipc-external-debt-usd"
                  }
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                  multiSeriesYAxisNameOverrides={{
                    0: recoExternalDebtPctGdpPoints.length > 0
                      ? L(isFa, "% of GDP", "درصدی از تولید ناخالص داخلی")
                      : L(isFa, "External debt (current US$)", "بدهی خارجی (دلار جاری)"),
                  }}
                  yAxisDetailNote={L(
                    isFa,
                    "Annual data; sparse years remain blank (no interpolation).",
                    "داده‌ها سالانه‌اند و سال‌های پراکنده بدون درون‌یابی خالی می‌مانند."
                  )}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "No data available", "داده‌ای در دسترس نیست")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1.5 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {ipcGdpDecompMode === "real"
                  ? L(
                      isFa,
                      "GDP decomposition (real)",
                      "تفکیک GDP (واقعی)"
                    )
                  : L(isFa, "GDP decomposition (nominal)", "تفکیک GDP (اسمی)")}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                {L(isFa, "Oil & gas rents vs remainder of GDP", "رانت نفت و گاز در برابر باقیمانده GDP")}
              </p>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {ipcGdpDecompMode === "real"
                  ? L(
                      isFa,
                      "WDI NY.GDP.MKTP.KD (GDP, constant 2015 US$), NY.GDP.PETR.RT.ZS (oil rents % of GDP), and NY.GDP.NGAS.RT.ZS (natural gas rents % of GDP).",
                      "WDI NY.GDP.MKTP.KD (GDP، دلار ثابت ۲۰۱۵)، NY.GDP.PETR.RT.ZS (رانت نفتی٪ GDP) و NY.GDP.NGAS.RT.ZS (رانت گاز طبیعی٪ GDP)."
                    )
                  : L(
                      isFa,
                      "WDI NY.GDP.MKTP.CD (GDP, current US$), NY.GDP.PETR.RT.ZS (oil rents % of GDP), and NY.GDP.NGAS.RT.ZS (natural gas rents % of GDP) — nominal levels only.",
                      "WDI NY.GDP.MKTP.CD (GDP، دلار جاری)، NY.GDP.PETR.RT.ZS (رانت نفتی٪ GDP) و NY.GDP.NGAS.RT.ZS (رانت گاز طبیعی٪ GDP) — فقط سطح اسمی."
                    )}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoLoading && !recoLoadFailed ? (
                <div className="space-y-2" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    {L(isFa, "Loading data…", "در حال بارگذاری داده‌ها…")}
                  </p>
                  <GdpDecompositionChartSkeleton className={IPC_COMPARISON_CHART_HEIGHT} />
                </div>
              ) : recoLoadFailed ? (
                <p className="text-xs text-destructive py-6">
                  {recoLoadDetail?.trim() ||
                    L(
                      isFa,
                      "Could not load macro data for this window.",
                      "بارگذاری دادهٔ کلان برای این بازه انجام نشد."
                    )}
                </p>
              ) : ipcSelectedHydroDecompMultiSeries ? (
                <div className="space-y-0">
                  <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                    <button
                      type="button"
                      onClick={() => setIpcGdpDecompMode("nominal")}
                      className={`px-2.5 py-1 text-xs rounded ${
                        ipcGdpDecompMode === "nominal"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {L(isFa, "Nominal", "اسمی")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIpcGdpDecompMode("real")}
                      className={`px-2.5 py-1 text-xs rounded ${
                        ipcGdpDecompMode === "real"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {L(isFa, "Real", "واقعی")}
                    </button>
                  </div>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={exportStudyHeading}
                    exportPresentationTitle={L(
                      isFa,
                      ipcGdpDecompMode === "real"
                        ? `${studyTitle} — GDP decomposition (real) — Oil & gas rents vs remainder of GDP`
                        : `${studyTitle} — GDP decomposition (nominal) — Oil & gas rents vs remainder of GDP`,
                      ipcGdpDecompMode === "real"
                        ? `${studyTitle} — تفکیک GDP (واقعی) — رانت نفت و گاز در برابر باقیمانده GDP`
                        : `${studyTitle} — تفکیک GDP (اسمی) — رانت نفت و گاز در برابر باقیمانده GDP`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      recoDemandNominalSource?.name ?? "World Bank WDI",
                      ipcGdpDecompMode === "real"
                        ? recoDemandIndicatorIds?.gdp_kd ?? "NY.GDP.MKTP.KD"
                        : recoDemandIndicatorIds?.gdp_usd ?? "NY.GDP.MKTP.CD",
                      recoDemandIndicatorIds?.oil_rents_pct_gdp ?? "NY.GDP.PETR.RT.ZS",
                      recoDemandIndicatorIds?.natural_gas_rents_pct_gdp ?? "NY.GDP.NGAS.RT.ZS",
                      ipcGdpDecompMode === "real"
                        ? "Derived: NY.GDP.MKTP.KD×NY.GDP.PETR.RT.ZS/100 (oil), NY.GDP.MKTP.KD×NY.GDP.NGAS.RT.ZS/100 (gas)"
                        : "Derived: NY.GDP.MKTP.CD×NY.GDP.PETR.RT.ZS/100 (oil), NY.GDP.MKTP.CD×NY.GDP.NGAS.RT.ZS/100 (gas)",
                      ipcGdpDecompMode === "real"
                        ? "Derived: NY.GDP.MKTP.KD−oil−gas (remainder)"
                        : "Derived: NY.GDP.MKTP.CD−oil−gas (remainder)",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(
                      isFa,
                      ipcGdpDecompMode === "real" ? "GDP decomposition (real)" : "GDP decomposition (nominal)",
                      ipcGdpDecompMode === "real" ? "تفکیک GDP (واقعی)" : "تفکیک GDP (اسمی)"
                    )}
                    events={events}
                    multiSeries={ipcSelectedHydroDecompMultiSeries}
                    timeRange={ipcHydroDecompTimeRange}
                    chartPeriodOverlayBands={chartPeriodOverlayBands}
                    revolution1979Marker={revolution1979Marker}
                    chartRangeGranularity="year"
                    forceTimeRangeAxis
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem={
                      ipcGdpDecompMode === "real"
                        ? "iran-ipc-gdp-decomposition-hydrocarbon-real"
                        : "iran-ipc-gdp-decomposition-hydrocarbon-nominal"
                    }
                    showChartControls
                    chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                    mutedEventLines
                    multiSeriesValueFormat="gdp_absolute"
                    multiSeriesYAxisNameOverrides={{
                      0:
                        ipcGdpDecompMode === "real"
                          ? L(isFa, "GDP (constant 2015 US$)", "تولید ناخالص داخلی (دلار ثابت ۲۰۱۵)")
                          : L(isFa, "GDP (current US$)", "تولید ناخالص داخلی (دلار جاری آمریکا)"),
                    }}
                    regimeArea={regimeArea}
                    focusGregorianYearRange={focusGregorianYearRange}
                    focusHoverHint={focusHoverHint}
                    gridLeft={80}
                  />
                  <p className="text-xs text-muted-foreground mt-2 max-w-3xl leading-relaxed">
                    {L(
                      isFa,
                      "This is a proxy decomposition using WDI oil and natural gas rents as shares of GDP. It is not an official non-oil GDP series.",
                      "این یک تفکیک تقریبی بر پایه سهم رانت نفت و گاز طبیعی WDI از GDP است و سری رسمی GDP غیرنفتی نیست."
                    )}
                  </p>
                </div>
              ) : (ipcGdpDecompMode === "real" ? recoDemandRealGdpPoints.length : recoDemandGdpPoints.length) > 0 ? (
                <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                  {L(
                    isFa,
                    ipcGdpDecompMode === "real"
                      ? "No overlapping real-GDP, oil-rents, and natural-gas-rents data for this window (join uses Gregorian calendar years)."
                      : "No overlapping GDP, oil-rents, and natural-gas-rents data for this window (join uses Gregorian calendar years).",
                    ipcGdpDecompMode === "real"
                      ? "برای این بازه دادهٔ هم‌پوشان GDP واقعی، رانت نفتی و رانت گاز طبیعی (با کلید سال میلادی) وجود ندارد."
                      : "برای این بازه دادهٔ هم‌پوشان GDP، رانت نفتی و رانت گاز طبیعی (با کلید سال میلادی) وجود ندارد."
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground py-6">
                  {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(
                  isFa,
                  ipcDemandMode === "real"
                    ? "3. Consumption, investment, and GDP (real)"
                    : "3. Consumption, investment, and GDP (nominal)",
                  ipcDemandMode === "real"
                    ? `۳. مصرف، سرمایه‌گذاری و تولید ناخالص داخلی (واقعی)`
                    : `۳. مصرف، سرمایه‌گذاری و تولید ناخالص داخلی (اسمی)`
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {ipcDemandMode === "real"
                  ? L(
                      isFa,
                      "WDI constant 2015 US$: NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD — Iran. Real series only (separate from nominal chart).",
                      "WDI دلار ثابت ۲۰۱۵: NE.CON.TOTL.KD، NE.GDI.TOTL.KD، NY.GDP.MKTP.KD — ایران. فقط سری‌های واقعی (جدای از نمودار اسمی)."
                    )
                  : L(
                      isFa,
                      "WDI current US$: NE.CON.TOTL.CD (consumption), NE.GDI.TOTL.CD (investment), NY.GDP.MKTP.CD (GDP) — Iran. Nominal only (not mixed with constant-price series).",
                      "WDI دلار جاری: NE.CON.TOTL.CD (مصرف)، NE.GDI.TOTL.CD (سرمایه‌گذاری)، NY.GDP.MKTP.CD (GDP) — ایران. فقط اسمی (بدون ترکیب با سری‌های قیمت ثابت)."
                    )}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setIpcDemandMode("nominal")}
                  className={`px-2.5 py-1 text-xs rounded ${
                    ipcDemandMode === "nominal"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {L(isFa, "Nominal", "اسمی")}
                </button>
                <button
                  type="button"
                  onClick={() => setIpcDemandMode("real")}
                  className={`px-2.5 py-1 text-xs rounded ${
                    ipcDemandMode === "real"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {L(isFa, "Real", "واقعی")}
                </button>
              </div>
              {(ipcDemandMode === "real" ? ipcHasRealDemandData : ipcHasNominalDemandData) ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    ipcDemandMode === "real"
                      ? `${studyTitle} — Consumption, investment, GDP (real)`
                      : `${studyTitle} — Consumption, investment, GDP (nominal)`,
                    ipcDemandMode === "real"
                      ? `${studyTitle} — مصرف، سرمایه‌گذاری و GDP (واقعی)`
                      : `${studyTitle} — مصرف، سرمایه‌گذاری و GDP (اسمی)`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoDemandNominalSource?.name ?? "World Bank WDI",
                    ipcDemandMode === "real"
                      ? recoDemandIndicatorIds?.consumption_kd ?? "NE.CON.TOTL.KD"
                      : recoDemandIndicatorIds?.consumption_usd ?? "NE.CON.TOTL.CD",
                    ipcDemandMode === "real"
                      ? recoDemandIndicatorIds?.investment_kd ?? "NE.GDI.TOTL.KD"
                      : recoDemandIndicatorIds?.investment_usd ?? "NE.GDI.TOTL.CD",
                    ipcDemandMode === "real"
                      ? recoDemandIndicatorIds?.gdp_kd ?? "NY.GDP.MKTP.KD"
                      : recoDemandIndicatorIds?.gdp_usd ?? "NY.GDP.MKTP.CD",
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(
                    isFa,
                    ipcDemandMode === "real" ? "Real demand aggregates" : "Nominal demand aggregates",
                    ipcDemandMode === "real" ? "جمع تقاضای واقعی" : "جمع تقاضای اسمی"
                  )}
                  events={events}
                  multiSeries={ipcSelectedDemandMultiSeries}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  forceTimeRangeAxis
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem={ipcDemandMode === "real" ? "iran-ipc-demand-real" : "iran-ipc-demand-nominal"}
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                  multiSeriesValueFormat="gdp_absolute"
                  multiSeriesYAxisNameOverrides={{
                    0:
                      ipcDemandMode === "real"
                        ? L(
                            isFa,
                            "Consumption & investment (constant US$)",
                            "مصرف و سرمایه‌گذاری (دلار ثابت)"
                          )
                        : L(
                            isFa,
                            "Consumption & investment (current US$)",
                            "مصرف و سرمایه‌گذاری (دلار جاری آمریکا)"
                          ),
                    1:
                      ipcDemandMode === "real"
                        ? L(isFa, "GDP (constant US$)", "تولید ناخالص داخلی (دلار ثابت)")
                        : L(isFa, "GDP (current US$)", "تولید ناخالص داخلی (دلار جاری آمریکا)"),
                  }}
                />
              ) : ipcHasNominalDemandData ? (
                <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                  {L(
                    isFa,
                    "Constant-price (real) series did not load (empty response). The nominal chart uses an older-compatible payload; deploy the latest SignalMap API and hard-refresh, or wait for CDN cache to expire.",
                    "سری‌های قیمت ثابت (واقعی) بارگذاری نشدند (پاسخ خالی). نمودار اسمی با پاسخ قدیمی‌تر سازگار است؛ آخرین API را مستقر کنید و صفحه را سخت‌ریفرش کنید، یا تا انقضای کش CDN صبر کنید."
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground py-6">
                  {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">{L(isFa, "5. Oil rents (% of GDP)", `۵. ${faEconomic.oilRentsPctGdp}`)}</CardTitle>
              <p className="text-xs text-muted-foreground">WDI NY.GDP.PETR.RT.ZS — Iran.</p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoOilRentsPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — Oil rents (% of GDP)`,
                    `${studyTitle} — ${faEconomic.oilRentsPctGdp}`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [recoDutchSource?.name ?? "World Bank WDI", "NY.GDP.PETR.RT.ZS"])}
                  data={recoOilRentsPoints}
                  valueKey="value"
                  label={L(isFa, enEconomic.oilRentsPctGdp, faEconomic.oilRentsPctGdp)}
                  unit="%"
                  seriesColor={SIGNAL_CONCEPT.oil_rents}
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-oil-rents"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "Natural gas rents (% of GDP)", "رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                {L(
                  isFa,
                  "Natural gas rents are estimated resource rents as a share of GDP. They are not the same as government gas revenue or export revenue.",
                  "رانت گاز طبیعی برآوردی از رانت منابع طبیعی به‌عنوان درصدی از تولید ناخالص داخلی است و معادل درآمد دولت یا صادرات گاز نیست."
                )}
              </p>
              <p className="text-xs text-muted-foreground">WDI NY.GDP.NGAS.RT.ZS — Iran.</p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoNaturalGasRentsPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — Natural gas rents (% of GDP)`,
                    `${studyTitle} — رانت گاز طبیعی (% از GDP)`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [recoDutchSource?.name ?? "World Bank WDI", "NY.GDP.NGAS.RT.ZS"])}
                  data={recoNaturalGasRentsPoints}
                  valueKey="value"
                  label={L(isFa, "Natural gas rents (% of GDP)", "رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
                  unit={L(isFa, "% of GDP", "درصدی از تولید ناخالص داخلی")}
                  seriesColor={SIGNAL_CONCEPT.natural_gas_rents}
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  forceTimeAxis
                  exportFileStem="iran-ipc-natural-gas-rents"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : recoOilRentsPoints.length > 0 ? (
                <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                  {L(
                    isFa,
                    "No natural gas rents data available for this window.",
                    "برای این بازه داده‌ای برای رانت گاز طبیعی در دسترس نیست."
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "6. Exchange rate: official vs open market (annual)", `۶. ${faEconomic.fxTitleOfficialVsOpenAnnual}`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "Official: annual policy/WDI series; open: calendar-year mean of the merged open-market series.",
                  "رسمی: سالانه WDI/FCRF؛ بازار: میانگین سری ادغام‌شده بازار آزاد در همان سال میلادی."
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-3 pt-0">
              {recoFxOfficialPoints.length > 0 || recoOpenAnnualMean.length > 0 ? (
                <>
                  <label
                    className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                    htmlFor="ipc-fx-levels-log-scale"
                  >
                    <input
                      id="ipc-fx-levels-log-scale"
                      name="ipc_fx_levels_log_scale"
                      type="checkbox"
                      checked={fxLevelsLogScale}
                      onChange={(e) => setFxLevelsLogScale(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "Log scale", "مقیاس لگاریتمی")}
                  </label>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={exportStudyHeading}
                    exportPresentationTitle={L(isFa, `${studyTitle} — FX levels`, `${studyTitle} — ${faEconomic.exchangeRate}`)}
                    exportSourceFooter={studyChartExportSource(isFa, [recoFxOfficialSource?.name, recoFxOpenSource?.name])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Toman per USD", faEconomic.tomanPerUsd)}
                    events={events}
                    multiSeries={[
                      {
                        key: "official",
                        label: L(isFa, "Official exchange rate (annual)", faEconomic.officialRateAnnual),
                        yAxisIndex: 0,
                        unit: L(isFa, "toman/USD", "تومان/دلار"),
                        points: recoFxOfficialPoints,
                        color: SIGNAL_CONCEPT.fx_official,
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "open_mean",
                        label: L(isFa, "Open-market exchange rate (annual mean)", faEconomic.openMarketAnnualMean),
                        yAxisIndex: 0,
                        unit: L(isFa, "toman/USD", "تومان/دلار"),
                        points: recoOpenAnnualMean,
                        color: SIGNAL_CONCEPT.fx_open,
                        symbol: "diamond",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                    ]}
                    timeRange={fxSharedTimeRange}
                    chartPeriodOverlayBands={chartPeriodOverlayBands}
                    revolution1979Marker={revolution1979Marker}
                    chartRangeGranularity="year"
                    forceTimeAxis
                    forceTimeRangeAxis
                    xAxisYearLabel={chartYearAxisLabel}
                    gridLeft={FX_COMPARISON_GRID_LEFT}
                    gridRight={FX_COMPARISON_GRID_RIGHT}
                    gridContainLabel={false}
                    exportFileStem="iran-ipc-fx-levels"
                    showChartControls
                    chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                    mutedEventLines
                    regimeArea={regimeArea}
                    focusGregorianYearRange={focusGregorianYearRange}
                    focusHoverHint={focusHoverHint}
                    yAxisLog={fxLevelsLogScale}
                    multiSeriesYAxisNameOverrides={{
                      0: fxLevelsLogScale
                        ? L(isFa, "toman/USD (log scale)", "تومان به ازای دلار (مقیاس لگاریتمی)")
                        : L(isFa, "toman/USD", "تومان به ازای دلار"),
                    }}
                    yAxisDetailNote={fxLevelsLogNote}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "FX data unavailable for this window.", "داده نرخ در این بازه در دسترس نیست.")}</p>
              )}
              {recoFxSpreadPctPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(isFa, `${studyTitle} — FX spread`, `${studyTitle} — ${faEconomic.fxSpread}`)}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoFxOfficialSource?.name,
                    recoFxOpenSource?.name,
                    "Derived: (annual mean open / official − 1) × 100",
                  ])}
                  data={recoFxSpreadPctPoints}
                  valueKey="value"
                  label={L(isFa, "FX spread (%)", faEconomic.fxSpreadPct)}
                  unit="%"
                  events={events}
                  timeRange={fxSharedTimeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  forceTimeAxis
                  forceTimeRangeAxis
                  xAxisYearLabel={chartYearAxisLabel}
                  gridLeft={FX_COMPARISON_GRID_LEFT}
                  gridRight={FX_COMPARISON_GRID_RIGHT}
                  gridContainLabel={false}
                  exportFileStem="iran-ipc-fx-spread"
                  showChartControls
                    chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {L(
                    isFa,
                    "Percent spread is shown only for years with both an official rate and an annual mean open-market rate.",
                    "شکاف درصدی وقتی نمایش داده می‌شود که برای یک سال هم نرخ رسمی و هم میانگین بازار موجود باشد."
                  )}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "7. Broad money (M2) growth vs CPI inflation", `۷. ${faEconomic.liquidityAndCpiTitle}`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "Broad money (M2) growth and CPI inflation (same definitions as the M2 study).",
                  `${faEconomic.m2Growth} و ${faEconomic.cpiInflation}؛ همان تعاریف مطالعهٔ نقدینگی.`
                )}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoM2Points.length > 0 || recoM2CpiPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — M2 and CPI`,
                    `${studyTitle} — ${faEconomic.m2Growth} و ${faEconomic.cpiInflation}`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoMoneyCitation ? (isFa ? recoMoneyCitation.fa : recoMoneyCitation.en) : null,
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(isFa, "Broad money growth & inflation", faEconomic.growthLiquidityAndInflationAxis)}
                  events={events}
                  multiSeries={[
                    {
                      key: "m2",
                      label: L(isFa, "M2 growth", faEconomic.m2Growth),
                      yAxisIndex: 0,
                      unit: L(isFa, "% YoY", "٪ سالانه"),
                      points: recoM2Points,
                      color: SIGNAL_CONCEPT.broad_money_m2,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                    {
                      key: "cpi",
                      label: L(isFa, "CPI inflation", faEconomic.cpiInflation),
                      yAxisIndex: 0,
                      unit: L(isFa, "% YoY", "٪ سالانه"),
                      points: recoM2CpiPoints,
                      color: SIGNAL_CONCEPT.inflation,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                  ]}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-m2-cpi"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  multiSeriesYAxisNameOverrides={{
                    0: L(isFa, "Percent per year", "درصد در سال"),
                  }}
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "8. Imports & exports (% of GDP)", `۸. ${faEconomic.importsExportsPctGdp}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoImportsPoints.length > 0 || recoExportsPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — Trade`,
                    `${studyTitle} — تجارت (${faEconomic.gdpPctUnit})`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoIsiSource?.name ?? "World Bank WDI",
                    recoIsiIndicatorIds?.imports_pct_gdp,
                    recoIsiIndicatorIds?.exports_pct_gdp,
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(isFa, "% of GDP", faEconomic.pctOfGdp)}
                  events={events}
                  multiSeries={[
                    {
                      key: "imp",
                      label: L(isFa, "Imports", faEconomic.imports),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoImportsPoints,
                      color: SIGNAL_CONCEPT.isi_imports,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                    {
                      key: "exp",
                      label: L(isFa, "Exports", faEconomic.exports),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoExportsPoints,
                      color: SIGNAL_CONCEPT.isi_exports,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                  ]}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-trade"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "9. Manufacturing & industry (% of GDP)", `۹. ${faEconomic.manufacturingIndustryPanelTitle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoManufacturingPoints.length > 0 || recoIndustryPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — Industry`,
                    `${studyTitle} — ${faEconomic.manufacturingIndustryPanelTitle}`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoIsiSource?.name ?? "World Bank WDI",
                    recoIsiIndicatorIds?.manufacturing_pct_gdp,
                    recoIsiIndicatorIds?.industry_pct_gdp,
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(isFa, "% of GDP", faEconomic.pctOfGdp)}
                  events={events}
                  multiSeries={[
                    {
                      key: "mfg",
                      label: L(isFa, "Manufacturing value added", faEconomic.manufacturingValueAdded),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoManufacturingPoints,
                      color: SIGNAL_CONCEPT.isi_manufacturing,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                    {
                      key: "ind",
                      label: L(isFa, "Industry value added", faEconomic.industryValueAdded),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoIndustryPoints,
                      color: SIGNAL_CONCEPT.isi_industry,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                  ]}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-industry"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">{L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "10. Real minimum wage (purchasing power)", `۱۰. حداقل دستمزد واقعی (${faEconomic.purchasingPower})`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {ipcWageLoadFailed ? (
                <p className="text-xs text-muted-foreground py-4">{L(isFa, "Wage series could not be loaded.", "سری دستمزد بارگذاری نشد.")}</p>
              ) : ipcWageRealKTomans.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(isFa, `${studyTitle} — Real wage`, `${studyTitle} — دستمزد واقعی`)}
                  exportSourceFooter={studyChartExportSource(isFa, [ipcWageSource?.nominal, ipcWageSource?.cpi])}
                  data={ipcWageRealKTomans}
                  valueKey="value"
                  label={L(isFa, "Real wage (thousand tomans/month)", "دستمزد واقعی (هزار تومان در ماه)")}
                  unit={L(isFa, "k tomans/month", "هزار تومان/ماه")}
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-real-wage"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">
                  {L(
                    isFa,
                    "No overlapping real-wage points in this window (series may start after the outer range begins).",
                    "نقطهٔ هم‌پوشان دستمزد واقعی در این بازه نیست (سری ممکن است دیرتر از آغاز بازه بیرونی شروع شود)."
                  )}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="md:col-span-2 mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {L(isFa, "Welfare and distribution", "رفاه و توزیع")}
            </h3>
          </div>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1 px-4 py-2.5">
              <CardTitle className="text-base font-semibold">{L(isFa, "Gini index", "ضریب جینی")}</CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "WDI SI.POV.GINI (income inequality, 0–100). Survey-based; many years have no published value.",
                  "WDI SI.POV.GINI (نابرابری درآمد، ۰–۱۰۰). مبتنی بر نظرسنجی؛ بسیاری از سال‌ها بدون مقدار منتشرشده‌اند."
                )}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoWelfareGiniIranPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(isFa, `${studyTitle} — Gini index`, `${studyTitle} — ضریب جینی`)}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoWelfareGiniSource?.name ?? "World Bank WDI",
                    recoWelfareGiniIndicatorId || "SI.POV.GINI",
                  ])}
                  data={recoWelfareGiniIranPoints}
                  valueKey="value"
                  label={L(isFa, "Gini index", "ضریب جینی")}
                  unit={L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)")}
                  events={events}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-welfare-gini"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                  dataCoverageGapMarkArea={welfareGiniCoverage.gapMarkArea}
                  dataCoverageLastMarkLine={
                    welfareGiniCoverage.lastMarkLineX
                      ? {
                          xAxis: welfareGiniCoverage.lastMarkLineX,
                          label: L(isFa, "Last available data", "آخرین داده موجود"),
                        }
                      : undefined
                  }
                  yAxisDetailNote={L(
                    isFa,
                    "This indicator is based on survey data and is only available for selected years.",
                    "«این شاخص مبتنی بر داده‌های پیمایشی است و فقط برای برخی سال‌ها در دسترس است.»"
                  )}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                  {L(
                    isFa,
                    "No Gini estimate in this outer window (SI.POV.GINI is sparse for Iran in WDI).",
                    "در این پنجرهٔ بیرونی برآورد جینی نیست (SI.POV.GINI برای ایران در WDI پراکنده است)."
                  )}
                </p>
              )}
              {welfareGiniCoverage.lines.length > 0 ? (
                <div className="mt-2 space-y-0.5 max-w-3xl">
                  {welfareGiniCoverage.lines.map((ln, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                      {L(isFa, ln.en, ln.fa)}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className="chart-card border-border md:col-span-2">
            <CardHeader className="space-y-1.5 px-4 py-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <CardTitle className="text-base font-semibold flex-1 min-w-0 mb-0">
                  {L(isFa, "Poverty headcount", "نرخ فقر")}
                </CardTitle>
                <PovertyHeadcountPppInfoTrigger isFa={isFa} />
              </div>
              <PovertyHeadcountPppMutedNote isFa={isFa} />
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "World Bank international poverty lines for Iran (share of population below each line). Threshold text follows WDI metadata (PPP revisions).",
                  "خطوط فقر بین‌المللی بانک جهانی برای ایران (سهم جمعیت زیر هر خط). متن آستانه طبق فرادادهٔ WDI (بازنگری‌های PPP) است."
                )}
              </p>
              {recoWelfarePovertyDdayTitle || recoWelfarePovertyLmicTitle ? (
                <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1 space-y-0.5 max-w-3xl">
                  {recoWelfarePovertyDdayTitle ? <li>{recoWelfarePovertyDdayTitle}</li> : null}
                  {recoWelfarePovertyLmicTitle ? <li>{recoWelfarePovertyLmicTitle}</li> : null}
                </ul>
              ) : null}
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {recoWelfarePovertyDdayPoints.length > 0 || recoWelfarePovertyLmicPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(
                    isFa,
                    `${studyTitle} — Poverty headcount`,
                    `${studyTitle} — نرخ فقر`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    recoWelfarePovertySource?.name ?? "World Bank WDI",
                    recoWelfarePovertyDdayId || "SI.POV.DDAY",
                    recoWelfarePovertyLmicId || "SI.POV.LMIC",
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(isFa, "Poverty headcount ratio", "نرخ شمارش فقر")}
                  events={events}
                  multiSeries={[
                    {
                      key: "pov_dday",
                      label: recoWelfarePovertyDdayShort || "SI.POV.DDAY",
                      yAxisIndex: 0,
                      unit: L(isFa, "% of population", "٪ از جمعیت"),
                      points: recoWelfarePovertyDdayPoints,
                      color: SIGNAL_CONCEPT.gini,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                    {
                      key: "pov_lmic",
                      label: recoWelfarePovertyLmicShort || "SI.POV.LMIC",
                      yAxisIndex: 0,
                      unit: L(isFa, "% of population", "٪ از جمعیت"),
                      points: recoWelfarePovertyLmicPoints,
                      color: SIGNAL_CONCEPT.poverty,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    },
                  ]}
                  timeRange={timeRange}
                  chartPeriodOverlayBands={chartPeriodOverlayBands}
                  revolution1979Marker={revolution1979Marker}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-welfare-poverty"
                  showChartControls
                  chartHeight={IPC_COMPARISON_CHART_HEIGHT}
                  mutedEventLines
                  forceTimeAxis
                  regimeArea={regimeArea}
                  focusGregorianYearRange={focusGregorianYearRange}
                  focusHoverHint={focusHoverHint}
                  multiSeriesYAxisNameOverrides={{
                    0: L(isFa, "Poverty headcount (% of population)", "نرخ فقر (٪ از جمعیت)"),
                  }}
                  dataCoverageGapMarkArea={welfarePovertyCoverage.gapMarkArea}
                  dataCoverageLastMarkLine={
                    welfarePovertyCoverage.lastMarkLineX
                      ? {
                          xAxis: welfarePovertyCoverage.lastMarkLineX,
                          label: L(isFa, "Last available data", "آخرین داده موجود"),
                        }
                      : undefined
                  }
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                  {L(
                    isFa,
                    "No poverty headcount observations in this outer window (SI.POV.DDAY / SI.POV.LMIC are sparse in WDI).",
                    "در این پنجرهٔ بیرونی دادهٔ شمارش فقر نیست (SI.POV.DDAY و SI.POV.LMIC در WDI پراکنده‌اند)."
                  )}
                </p>
              )}
              {welfarePovertyCoverage.lines.length > 0 ? (
                <div className="mt-2 space-y-0.5 max-w-3xl">
                  {welfarePovertyCoverage.lines.map((ln, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                      {L(isFa, ln.en, ln.fa)}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
