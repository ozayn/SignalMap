"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart, type TimelineEvent } from "@/components/timeline-chart";
import { CHART_LINE_SYMBOL_SIZE, CHART_LINE_SYMBOL_SIZE_MINI } from "@/lib/chart-series-markers";
import { SIGNAL_CONCEPT } from "@/lib/signalmap-chart-colors";
import { enEconomic, faEconomic } from "@/lib/signalmap-i18n/economic-terms";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import {
  iranFxLevelsHasNonPositiveValuesInRange,
  iranFxLevelsSuggestLogDefaultInRange,
} from "@/lib/iran-fx-chart-log-default";

type Point = { date: string; value: number };

export type IranEconomyPeriodComparisonPanelsProps = {
  isFa: boolean;
  L: (isFa: boolean, en: string, fa: string) => string;
  studyTitle: string;
  chartLocaleForCharts: "en" | "fa" | undefined;
  chartYearAxisLabel: ChartAxisYearMode | undefined;
  timeRange: [string, string];
  regimeArea: { xStart: string; xEnd: string; label: string };
  focusGregorianYearRange: { startYear: number; endYear: number };
  focusHoverHint: { en: string; fa: string };
  events: TimelineEvent[];
  exportStudyHeading: string;
  studyChartExportSource: (isFa: boolean, parts: (string | null | undefined)[]) => string | undefined;
  recoInflationIranPoints: Point[];
  recoInflationSource: { name?: string; url?: string; publisher?: string } | null;
  recoGdpGrowthPoints: Point[];
  recoImportsPoints: Point[];
  recoExportsPoints: Point[];
  recoManufacturingPoints: Point[];
  recoIndustryPoints: Point[];
  recoIsiSource: { name?: string; url?: string; publisher?: string } | null;
  recoIsiIndicatorIds: Record<string, string> | null;
  recoOilRentsPoints: Point[];
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
  recoImportsPoints,
  recoExportsPoints,
  recoManufacturingPoints,
  recoIndustryPoints,
  recoIsiSource,
  recoIsiIndicatorIds,
  recoOilRentsPoints,
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
}: IranEconomyPeriodComparisonPanelsProps) {
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "1. CPI inflation (% YoY)", `۱. ${faEconomic.cpiInflation} (${faEconomic.yoyAnnual})`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {L(isFa, "WDI FP.CPI.TOTL.ZG — Iran.", "WDI FP.CPI.TOTL.ZG — ایران.")}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {recoInflationIranPoints.length > 0 ? (
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={exportStudyHeading}
                  exportPresentationTitle={L(isFa, `${studyTitle} — Inflation`, `${studyTitle} — ${faEconomic.inflation}`)}
                  exportSourceFooter={studyChartExportSource(isFa, [recoInflationSource?.name ?? "World Bank WDI", "FP.CPI.TOTL.ZG"])}
                  data={recoInflationIranPoints}
                  valueKey="value"
                  label={L(isFa, "CPI inflation", faEconomic.cpiInflation)}
                  unit="%"
                  events={events}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-inflation"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
          <Card className="chart-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "2. Real GDP growth (annual %)", `۲. ${faEconomic.realGdpGrowth} (٪ سالانه)`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {L(isFa, "WDI NY.GDP.MKTP.KD.ZG — Iran.", "WDI NY.GDP.MKTP.KD.ZG — ایران.")}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
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
                  label={L(isFa, enEconomic.realGdpGrowth, faEconomic.realGdpGrowth)}
                  unit="%"
                  events={events}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-gdp-growth"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{L(isFa, "3. Oil rents (% of GDP)", `۳. ${faEconomic.oilRentsPctGdp}`)}</CardTitle>
              <p className="text-xs text-muted-foreground">WDI NY.GDP.PETR.RT.ZS — Iran.</p>
            </CardHeader>
            <CardContent className="pt-0">
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
                  events={events}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-oil-rents"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "4. Exchange rate: official vs open market (annual)", `۴. ${faEconomic.fxTitleOfficialVsOpenAnnual}`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "Official: annual policy/WDI series; open: calendar-year mean of the merged open-market series.",
                  "رسمی: سالانه WDI/FCRF؛ بازار: میانگین سری ادغام‌شده بازار آزاد در همان سال میلادی."
                )}
              </p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {recoFxOfficialPoints.length > 0 || recoOpenAnnualMean.length > 0 ? (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
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
                    timeRange={timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="iran-ipc-fx-levels"
                    showChartControls
                    chartHeight="h-56 md:h-64"
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
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-fx-spread"
                  showChartControls
                  chartHeight="h-48 md:h-56"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "5. Broad money (M2) growth vs CPI inflation (annual %)", `۵. ${faEconomic.liquidityAndCpiTitle}`)}
              </CardTitle>
              <p className="text-xs text-muted-foreground max-w-3xl">
                {L(
                  isFa,
                  "Broad money (M2) growth and CPI inflation (same definitions as the M2 study).",
                  `${faEconomic.m2Growth} و ${faEconomic.cpiInflation}؛ همان تعاریف مطالعهٔ نقدینگی.`
                )}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
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
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                    {
                      key: "cpi",
                      label: L(isFa, "CPI inflation", faEconomic.cpiInflation),
                      yAxisIndex: 0,
                      unit: L(isFa, "% YoY", "٪ سالانه"),
                      points: recoM2CpiPoints,
                      color: SIGNAL_CONCEPT.inflation,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                  ]}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-m2-cpi"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "6. Imports & exports (% of GDP)", `۶. ${faEconomic.importsExportsPctGdp}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                    {
                      key: "exp",
                      label: L(isFa, "Exports", faEconomic.exports),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoExportsPoints,
                      color: SIGNAL_CONCEPT.isi_exports,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                  ]}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-trade"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "7. Manufacturing & industry (% of GDP)", `۷. ${faEconomic.manufacturingIndustryPanelTitle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                    {
                      key: "ind",
                      label: L(isFa, "Industry value added", faEconomic.industryValueAdded),
                      yAxisIndex: 0,
                      unit: "%",
                      points: recoIndustryPoints,
                      color: SIGNAL_CONCEPT.isi_industry,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                  ]}
                  timeRange={timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-industry"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {L(isFa, "8. Real minimum wage (purchasing power)", `۸. حداقل دستمزد واقعی (${faEconomic.purchasingPower})`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  exportFileStem="iran-ipc-real-wage"
                  showChartControls
                  chartHeight="h-56 md:h-64"
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
        </div>
      ) : null}
    </>
  );
}
