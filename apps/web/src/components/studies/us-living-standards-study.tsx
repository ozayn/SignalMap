"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NominalRealToggle } from "@/components/nominal-real-toggle";
import { TimelineChart } from "@/components/timeline-chart";
import { DataObservations } from "@/components/data-observations";
import { LearningNote } from "@/components/learning-note";
import { ConceptsUsed } from "@/components/concepts-used";
import { SourceInfo, type SourceInfoItem } from "@/components/source-info";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { trackEvent } from "@/lib/analytics";
import { getStudyById } from "@/lib/studies";
import {
  DEFAULT_INDEX_PREFERRED_YEAR,
  formatIndexEquals100Label,
  formatIndexedToEquals100Subtitle,
  formatSharedIndexBaseNote,
} from "@/lib/indexed-chart-base";
import { SIGNAL_CONCEPT, SIGNAL_COUNTRY } from "@/lib/signalmap-chart-colors";

type Point = { date: string; value: number };

type HouseholdGoodsItemMeta = {
  label: string;
  benchmark_year?: number;
  benchmark_price_usd?: number;
  cpi_fred_series?: string;
  cpi_continuation_series?: string;
  cpi_source?: string;
  cpi_start_year?: number;
  hours_start_year?: number | null;
  hours_end_year?: number | null;
};

type LivingStandardsBundle = {
  series: Record<string, Point[]>;
  fred_series: Record<string, string>;
  reference_sources: Record<string, string>;
  real_base_year: number;
  productivity_compensation_base_year: number;
  hours_of_work?: {
    methodology_note?: string;
    wage_fred_series?: string;
    wage_source?: string;
    wage_tradeoffs?: string;
    rent_hours_start_year?: number | null;
    tuition_hours_start_year?: number | null;
    rent_hours_end_year?: number | null;
    tuition_hours_end_year?: number | null;
  };
  household_goods?: {
    methodology_note?: string;
    wage_fred_series?: string;
    items?: Record<string, HouseholdGoodsItemMeta>;
  };
  source?: { name?: string; url?: string };
  partial?: boolean;
  series_warnings?: Record<string, string>;
};

const STUDY_ID = "us-living-standards";
const study = getStudyById(STUDY_ID);

function wdiFredFooter(codes: string | string[], note?: string): string {
  const list = Array.isArray(codes) ? codes.join(", ") : codes;
  return `Source: FRED — United States — ${list}${note ? `; ${note}` : ""}`;
}

function seriesTimeRange(points: Point[]): [string, string] | undefined {
  if (points.length === 0) return undefined;
  let lo = points[0]!.date;
  let hi = points[0]!.date;
  for (const p of points) {
    if (p.date < lo) lo = p.date;
    if (p.date > hi) hi = p.date;
  }
  return [lo.slice(0, 10), hi.slice(0, 10)];
}

function hoursWorkChartFooter(wageCode: string, expenseSource: string): string {
  return `Source: FRED ${wageCode} (average hourly wage); ${expenseSource}; method: price ÷ average hourly wage`;
}

const HOURS_Y_AXIS_LABEL = "Hours at average hourly wage";

const HOURS_CHART_RENT_LABEL = "Hours of work to afford one month of median rent";
const HOURS_CHART_TUITION_LABEL = "Hours of work to afford one year of public tuition";
const HOURS_CHART_HOUSEHOLD_LABEL = "Hours of work to afford household goods";

const HOURS_CHART_RENT_METHOD =
  "Estimated as median monthly rent divided by the average hourly wage.";
const HOURS_CHART_TUITION_METHOD =
  "Estimated as published in-state public tuition divided by the average hourly wage.";
const HOURS_CHART_HOUSEHOLD_METHOD =
  "Estimated as representative prices divided by the average hourly wage.";

const HOURS_OF_WORK_METHODOLOGY_NOTE =
  "Hours-of-work estimates use historical wage proxies to approximate how many hours an average worker would need to work to cover the selected expense. The series are intended as contextual affordability signals rather than precise household budget calculations.";

/** Household goods hours chart — distinct color + line pattern per good. */
const HOUSEHOLD_GOODS_SERIES_STYLE = {
  refrigerator: { color: "#2563eb", linePattern: "solid" as const, symbol: "circle" as const },
  washing_machine: { color: "#0d9488", linePattern: "dashed" as const, symbol: "rect" as const },
  television: { color: "#f97316", linePattern: "dotted" as const, symbol: "triangle" as const },
  vacuum_cleaner: { color: "#7c3aed", linePattern: "solid" as const, symbol: "diamond" as const },
};

type MonetaryDisplayMode = "nominal" | "real";

export function UsLivingStandardsStudy() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<LivingStandardsBundle | null>(null);
  const [homePriceMode, setHomePriceMode] = useState<MonetaryDisplayMode>("nominal");
  const [tuitionMode, setTuitionMode] = useState<MonetaryDisplayMode>("real");

  const timeRange = useMemo(() => {
    const end = new Date().toISOString().slice(0, 10);
    return { start: "1970-01-01", end };
  }, []);

  useEffect(() => {
    trackEvent("study_viewed", { study_id: STUDY_ID });
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    async function run() {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({ start: timeRange.start, end: timeRange.end });
        const res = await fetch(`/api/signals/us/living-standards-bundle?${qs.toString()}`, {
          cache: "no-store",
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setBundle((await res.json()) as LivingStandardsBundle);
      } catch (e) {
        if (ctl.signal.aborted) return;
        setBundle(null);
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }
    void run();
    return () => ctl.abort();
  }, [timeRange.end, timeRange.start]);

  const s = bundle?.series ?? {};
  const fred = bundle?.fred_series ?? {};
  const realBaseYear = bundle?.real_base_year ?? 2022;
  const prodBaseYear = bundle?.productivity_compensation_base_year ?? DEFAULT_INDEX_PREFERRED_YEAR;
  const prodIndexUnit = formatIndexEquals100Label(prodBaseYear);
  const prodIndexFallbackNote = formatSharedIndexBaseNote(prodBaseYear, DEFAULT_INDEX_PREFERRED_YEAR);

  const commonChartProps = {
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    chartHeight: "h-56 md:h-64",
    timeRange: [timeRange.start, timeRange.end] as [string, string],
  };

  const realToggleLabel = `Real (${realBaseYear} US$)`;

  const homePriceChart = useMemo(() => {
    const isReal = homePriceMode === "real";
    const mspus = fred.median_home_price_usd ?? "MSPUS";
    const cpi = fred.cpi_all_items_index ?? "CPIAUCSL";
    return {
      data: isReal ? (s.median_home_price_real_usd ?? []) : (s.median_home_price_usd ?? []),
      label: isReal ? `Median home price (real, ${realBaseYear} US$)` : "Median home price",
      unit: isReal ? `Constant ${realBaseYear} US$` : "Nominal US$",
      exportSourceFooter: isReal
        ? wdiFredFooter([mspus, cpi], `MSPUS deflated to ${realBaseYear} dollars with CPI-U`)
        : wdiFredFooter(mspus, "annual mean of quarterly MSPUS"),
      exportFileStem: isReal ? "us-living-standards-median-home-price-real" : "us-living-standards-median-home-price",
      sectionTitle: isReal
        ? `2. Housing — median home price (real, ${realBaseYear} US$)`
        : "2. Housing — median home price",
    };
  }, [fred, homePriceMode, realBaseYear, s]);

  const tuitionChart = useMemo(() => {
    const isReal = tuitionMode === "real";
    const cpi = fred.cpi_all_items_index ?? "CPIAUCSL";
    return {
      data: isReal ? (s.public_tuition_real_usd ?? []) : (s.public_tuition_annual_usd ?? []),
      label: isReal ? `Public tuition (real, ${realBaseYear} US$)` : "Public university tuition",
      unit: isReal ? `Constant ${realBaseYear} US$` : "Nominal US$ per academic year",
      exportSourceFooter: isReal
        ? wdiFredFooter(cpi, `College Board anchors deflated to ${realBaseYear} dollars`)
        : "Source: College Board (reference anchors) — published in-state public four-year tuition; interpolated between anchor years",
      exportFileStem: isReal ? "us-living-standards-tuition-real" : "us-living-standards-tuition-nominal",
      sectionTitle: isReal
        ? `3. Education — public university tuition (real, ${realBaseYear} US$)`
        : "3. Education — public university tuition",
    };
  }, [fred, realBaseYear, s, tuitionMode]);

  const refSources = bundle?.reference_sources ?? {};
  const hoursOfWorkMeta = bundle?.hours_of_work;
  const householdGoodsMeta = bundle?.household_goods;
  const hoursOfWorkWageSeriesId =
    fred.average_hourly_earnings_household_goods_usd ??
    hoursOfWorkMeta?.wage_fred_series ??
    householdGoodsMeta?.wage_fred_series ??
    "AHETPI";
  const hoursOfWorkMethodologyNote =
    hoursOfWorkMeta?.methodology_note ??
    refSources.hours_of_work_methodology ??
    HOURS_OF_WORK_METHODOLOGY_NOTE;

  const sourceItems: SourceInfoItem[] = useMemo(
    () => [
      {
        label: "Median household income (real)",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.median_household_income_real_usd ?? "MEHOINUSA672N"}`,
        sourceDetail: "United States",
        unitLabel: "Real US$ (CPI-U adjusted in source)",
      },
      {
        label: "Median home price",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.median_home_price_usd ?? "MSPUS"}`,
        sourceDetail: "United States; annual mean of quarterly observations",
        unitLabel: "Nominal US$",
      },
      {
        label: "House-price-to-income ratio",
        sourceName: "SignalMap derived",
        sourceUrl: "https://fred.stlouisfed.org",
        sourceDetail: "MSPUS / MEHOINUSA672N",
        unitLabel: "Ratio (nominal home price / real median household income)",
        unitNote: "Mixed nominal/real units — interpret as contextual affordability signal, not a formal housing-affordability index.",
      },
      {
        label: "Public university tuition (nominal)",
        sourceName: "College Board (reference anchors)",
        sourceUrl: "https://research.collegeboard.org/trends/college-pricing",
        sourceDetail: "Published in-state public four-year averages; interpolated between anchor years",
        unitLabel: "Nominal US$ per academic year",
      },
      {
        label: "Public university tuition (real)",
        sourceName: "SignalMap derived",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.cpi_all_items_index ?? "CPIAUCSL"}`,
        sourceDetail: `College Board anchors deflated with CPI-U to ${realBaseYear} dollars`,
        unitLabel: `Constant ${realBaseYear} US$`,
      },
      {
        label: "Tuition relative to household income",
        sourceName: "SignalMap derived",
        sourceDetail: "Nominal tuition / real median household income",
        unitLabel: "Ratio",
      },
      {
        label: "Productivity vs compensation",
        sourceName: "FRED",
        sourceUrl: "https://fred.stlouisfed.org",
        sourceDetail: `Nonfarm business sector indexes; ${formatIndexedToEquals100Subtitle(prodBaseYear)}`,
        unitLabel: `${formatIndexedToEquals100Subtitle(prodBaseYear)} — ${fred.productivity_index ?? "OPHNFB"} vs ${fred.hourly_compensation_index ?? "COMPNFB"}`,
      },
      {
        label: "Average hourly earnings (hours-of-work charts)",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        sourceDetail:
          "Production and nonsupervisory employees, total private; annual mean (1964+). CES0500000003 (all employees) begins 2006 — AHETPI used here for longer history.",
        unitLabel: "Nominal US$ per hour",
      },
      {
        label: "Median gross rent",
        sourceName: "U.S. Census Bureau (reference anchors)",
        sourceUrl: "https://www.census.gov",
        sourceDetail: "Historical median gross rent; interpolated between anchor years",
        unitLabel: "Nominal US$ per month",
      },
      {
        label: HOURS_CHART_RENT_LABEL,
        sourceName: "SignalMap derived",
        sourceDetail:
          refSources.hours_for_month_rent ??
          `Median gross rent (Census reference anchors) ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: HOURS_CHART_RENT_METHOD,
      },
      {
        label: HOURS_CHART_TUITION_LABEL,
        sourceName: "SignalMap derived",
        sourceDetail:
          refSources.hours_for_year_tuition ??
          `College Board tuition anchors ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: HOURS_CHART_TUITION_METHOD,
      },
      {
        label: HOURS_CHART_HOUSEHOLD_LABEL,
        sourceName: "SignalMap derived",
        sourceDetail: `CPI- or PPI-anchored estimated prices ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: `${HOURS_CHART_HOUSEHOLD_METHOD} Refrigerator (CUSR0000SAH3 proxy), washing machine (WPU12410220/WPU1241), television (CUSR0000SERA + retail anchors), vacuum cleaner (CUSR0000SAH3 proxy). Each series starts when its price and wage data overlap.`,
      },
    ],
    [fred, prodBaseYear, realBaseYear, refSources]
  );

  const hoursRentPoints = s.hours_for_month_rent ?? [];
  const hoursTuitionPoints = s.hours_for_year_tuition ?? [];
  const householdGoodsMultiSeries = useMemo(
    () => [
      {
        key: "refrigerator",
        label: "Refrigerator",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_refrigerator ?? [],
        ...HOUSEHOLD_GOODS_SERIES_STYLE.refrigerator,
      },
      {
        key: "washing_machine",
        label: "Washing machine",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_washing_machine ?? [],
        ...HOUSEHOLD_GOODS_SERIES_STYLE.washing_machine,
      },
      {
        key: "television",
        label: "Television",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_television ?? [],
        ...HOUSEHOLD_GOODS_SERIES_STYLE.television,
      },
      {
        key: "vacuum_cleaner",
        label: "Vacuum cleaner",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_vacuum_cleaner ?? [],
        ...HOUSEHOLD_GOODS_SERIES_STYLE.vacuum_cleaner,
      },
    ],
    [s]
  );

  const householdGoodsSourceFooter = useMemo(() => {
    const itemSources = Object.entries(householdGoodsMeta?.items ?? {})
      .filter(([, meta]) => meta.cpi_source)
      .map(([key, meta]) => `${meta.label ?? key}: ${meta.cpi_source}`);
    const expenseSource =
      itemSources.length > 0
        ? itemSources.join("; ")
        : [
            refSources.hours_for_refrigerator,
            refSources.hours_for_washing_machine,
            refSources.hours_for_television,
          ]
            .filter(Boolean)
            .join("; ");
    return hoursWorkChartFooter(hoursOfWorkWageSeriesId, expenseSource);
  }, [householdGoodsMeta?.items, hoursOfWorkWageSeriesId, refSources]);

  const hoursChartBaseProps = {
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    chartHeight: "h-56 md:h-64",
  };

  const hasAnyHoursChart =
    hoursRentPoints.length > 0 ||
    hoursTuitionPoints.length > 0 ||
    householdGoodsMultiSeries.some((row) => row.points.length > 0);

  return (
    <section className="space-y-4">
      <div className="mb-2 space-y-2 border-b border-border/60 pb-6">
        <Link href="/studies" className="text-xs text-muted-foreground hover:text-foreground">
          Back to studies
        </Link>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground md:text-3xl">
          {study?.title ?? "US living standards and affordability"}
        </h1>
        {study?.subtitle ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{study.subtitle}</p>
        ) : null}
      </div>

      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Study framing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
          <p>
            This study does not attempt to determine whether life was universally better or worse in the past.
            Instead, it examines how different dimensions of economic life evolved over time using inflation-adjusted
            and relative measures of affordability.
          </p>
          <p>
            Wages, housing, education, healthcare, and everyday goods can move in different directions at once.
            The charts below are meant for exploratory comparison — not to settle ideological debates about progress
            or decline.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-muted/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Key patterns to look for</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Real median household income and nominal home prices often diverge, so price-to-income ratios can rise even when incomes grow.</li>
            <li>Public tuition and rent can outpace hourly earnings in some decades while appliances may take fewer hours of work as manufacturing productivity improves.</li>
            <li>Productivity and hourly compensation indexes can decouple — productivity growth does not automatically translate into proportional wage growth.</li>
            <li>Reference-price series for tuition, rent, and appliances use published anchors and interpolation; treat them as contextual signals, not precise retail transactions.</li>
          </ul>
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading data…</p>
      ) : loadError ? (
        <p className="py-8 text-sm text-destructive">Failed to load study data: {loadError}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 1. Income */}
          <Card className="border-border md:col-span-2">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">1. Income</CardTitle>
              <p className="text-xs text-muted-foreground">Median household income (real)</p>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.median_household_income_real_usd ?? []).length > 0 ? (
                <>
                  <TimelineChart
                    data={s.median_household_income_real_usd ?? []}
                    valueKey="value"
                    label="Real median household income"
                    unit="Real US$"
                    seriesColor={SIGNAL_COUNTRY.us}
                    exportSourceFooter={wdiFredFooter(fred.median_household_income_real_usd ?? "MEHOINUSA672N")}
                    exportFileStem="us-living-standards-median-income"
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    FRED real median household income is CPI-U-adjusted in the source series. It describes the middle
                    household, not the full distribution of earnings or wealth.
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          {/* 2. Housing */}
          <Card className="border-border">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{homePriceChart.sectionTitle}</CardTitle>
                <NominalRealToggle
                  mode={homePriceMode}
                  onChange={setHomePriceMode}
                  realLabel={realToggleLabel}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {homePriceChart.data.length > 0 ? (
                <TimelineChart
                  data={homePriceChart.data}
                  valueKey="value"
                  label={homePriceChart.label}
                  unit={homePriceChart.unit}
                  seriesColor={SIGNAL_CONCEPT.gdp}
                  exportSourceFooter={homePriceChart.exportSourceFooter}
                  exportFileStem={homePriceChart.exportFileStem}
                  {...commonChartProps}
                />
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">2. Housing — price-to-income ratio</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.house_price_to_income_ratio ?? []).length > 0 ? (
                <>
                  <TimelineChart
                    data={s.house_price_to_income_ratio ?? []}
                    valueKey="value"
                    label="House price / median income"
                    unit="Ratio"
                    seriesColor="#9333ea"
                    exportSourceFooter={wdiFredFooter(
                      [fred.median_home_price_usd ?? "MSPUS", fred.median_household_income_real_usd ?? "MEHOINUSA672N"],
                      "derived ratio"
                    )}
                    exportFileStem="us-living-standards-price-to-income"
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nominal median home price divided by real median household income. Useful as a relative
                    affordability signal; not a formal mortgage-affordability or down-payment metric.
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* 3. Education */}
          <Card className="border-border">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{tuitionChart.sectionTitle}</CardTitle>
                <NominalRealToggle
                  mode={tuitionMode}
                  onChange={setTuitionMode}
                  realLabel={realToggleLabel}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {tuitionChart.data.length > 0 ? (
                <>
                  <TimelineChart
                    data={tuitionChart.data}
                    valueKey="value"
                    label={tuitionChart.label}
                    unit={tuitionChart.unit}
                    seriesColor={SIGNAL_CONCEPT.wage_real}
                    exportSourceFooter={tuitionChart.exportSourceFooter}
                    exportFileStem={tuitionChart.exportFileStem}
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {bundle?.reference_sources?.public_tuition_annual_usd ??
                      "College Board published in-state public four-year tuition and required fees; interpolated between anchor years."}
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">3. Education — tuition relative to household income</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.tuition_to_income_ratio ?? []).length > 0 ? (
                <>
                  <TimelineChart
                    data={s.tuition_to_income_ratio ?? []}
                    valueKey="value"
                    label="Tuition / median income"
                    unit="Ratio"
                    seriesColor="#0d9488"
                    exportSourceFooter="Source: College Board anchors + FRED MEHOINUSA672N; derived ratio"
                    exportFileStem="us-living-standards-tuition-to-income"
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    One year of published in-state public tuition as a share of real median household income.
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* 4. Productivity vs compensation */}
          <Card className="border-border md:col-span-2">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">4. Productivity vs compensation</CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatIndexedToEquals100Subtitle(prodBaseYear)}
                {prodIndexFallbackNote ? ` — ${prodIndexFallbackNote}` : null}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.productivity_reindexed ?? []).length > 0 && (s.compensation_reindexed ?? []).length > 0 ? (
                <>
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label="Productivity vs compensation"
                    multiSeries={[
                      {
                        key: "productivity",
                        label: "Labor productivity (real output per hour)",
                        unit: prodIndexUnit,
                        yAxisIndex: 0 as const,
                        points: s.productivity_reindexed ?? [],
                        color: SIGNAL_COUNTRY.us,
                        linePattern: "solid",
                      },
                      {
                        key: "compensation",
                        label: "Hourly compensation",
                        unit: prodIndexUnit,
                        yAxisIndex: 0 as const,
                        points: s.compensation_reindexed ?? [],
                        color: SIGNAL_CONCEPT.hourly_compensation,
                        linePattern: "dashed",
                      },
                    ]}
                    exportSourceFooter={wdiFredFooter(
                      [fred.productivity_index ?? "OPHNFB", fred.hourly_compensation_index ?? "COMPNFB"],
                      `${formatIndexedToEquals100Subtitle(prodBaseYear)}${prodIndexFallbackNote ? `; ${prodIndexFallbackNote}` : ""}`
                    )}
                    exportFileStem="us-living-standards-productivity-compensation"
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Productivity is real output per hour; compensation is the BLS hourly compensation index. Both are
                    reindexed for visual comparison — the gap between lines is a contextual signal, not a direct
                    dollar measure of &ldquo;lost wages.&rdquo;
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* 5. Affordability in hours of work */}
          <Card className="border-border md:col-span-2">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-base">5. Affordability in hours of work</CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                {hoursOfWorkMethodologyNote} Each chart begins when both its expense and wage data are available.
              </p>
            </CardHeader>
            <CardContent className="space-y-8 pt-0">
              {!hasAnyHoursChart ? (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable for this window.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">{HOURS_CHART_RENT_LABEL}</h3>
                    {hoursRentPoints.length > 0 ? (
                      <>
                        <TimelineChart
                          data={hoursRentPoints}
                          valueKey="value"
                          label={HOURS_CHART_RENT_LABEL}
                          unit={HOURS_Y_AXIS_LABEL}
                          seriesColor={SIGNAL_COUNTRY.us}
                          exportSourceFooter={hoursWorkChartFooter(
                            hoursOfWorkWageSeriesId,
                            refSources.hours_for_month_rent ??
                              refSources.median_gross_rent_monthly_usd ??
                              "U.S. Census Bureau median gross rent (reference anchors)"
                          )}
                          exportFileStem="us-living-standards-hours-rent"
                          timeRange={seriesTimeRange(hoursRentPoints)}
                          {...hoursChartBaseProps}
                        />
                        <p className="text-xs text-muted-foreground">{HOURS_CHART_RENT_METHOD}</p>
                      </>
                    ) : (
                      <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border pt-6">
                    <h3 className="text-sm font-medium text-foreground">{HOURS_CHART_TUITION_LABEL}</h3>
                    {hoursTuitionPoints.length > 0 ? (
                      <>
                        <TimelineChart
                          data={hoursTuitionPoints}
                          valueKey="value"
                          label={HOURS_CHART_TUITION_LABEL}
                          unit={HOURS_Y_AXIS_LABEL}
                          seriesColor="#9333ea"
                          exportSourceFooter={hoursWorkChartFooter(
                            hoursOfWorkWageSeriesId,
                            refSources.hours_for_year_tuition ??
                              refSources.public_tuition_annual_usd ??
                              "College Board public tuition (reference anchors)"
                          )}
                          exportFileStem="us-living-standards-hours-tuition"
                          timeRange={seriesTimeRange(hoursTuitionPoints)}
                          {...hoursChartBaseProps}
                        />
                        <p className="text-xs text-muted-foreground">{HOURS_CHART_TUITION_METHOD}</p>
                      </>
                    ) : (
                      <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border pt-6">
                    <h3 className="text-sm font-medium text-foreground">{HOURS_CHART_HOUSEHOLD_LABEL}</h3>
                    {householdGoodsMultiSeries.some((row) => row.points.length > 0) ? (
                      <>
                        <TimelineChart
                          data={[]}
                          valueKey="value"
                          label={HOURS_CHART_HOUSEHOLD_LABEL}
                          multiSeries={householdGoodsMultiSeries}
                          multiSeriesYAxisNameOverrides={{ 0: HOURS_Y_AXIS_LABEL }}
                          exportSourceFooter={householdGoodsSourceFooter}
                          exportFileStem="us-living-standards-hours-household-goods"
                          timeRange={seriesTimeRange(
                            householdGoodsMultiSeries.flatMap((row) => row.points)
                          )}
                          {...hoursChartBaseProps}
                        />
                        <p className="text-xs text-muted-foreground">
                          {HOURS_CHART_HOUSEHOLD_METHOD}{" "}
                          {householdGoodsMeta?.methodology_note ??
                            refSources.household_goods_methodology ??
                            "Historical prices for some durable goods are estimated using official price indices anchored to benchmark price observations. Comparisons should be interpreted as approximate indicators of changing affordability."}{" "}
                          Wage denominator: FRED {hoursOfWorkWageSeriesId} (1964+). Each good uses its own price
                          index and may start in a different year.
                        </p>
                      </>
                    ) : (
                      <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground border-t border-border pt-4">
                    Wage denominator for all hours charts: FRED {hoursOfWorkWageSeriesId} (production and
                    nonsupervisory employees, 1964+).{" "}
                    {hoursOfWorkMeta?.wage_tradeoffs ??
                      "CES0500000003 (all private employees) begins in 2006; AHETPI is used for longer history."}{" "}
                    Rent and tuition price anchors use published reference years with linear interpolation between
                    anchors (documented in Sources &amp; units).
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {study?.observations?.length ? <DataObservations observations={[...study.observations]} /> : null}

      <LearningNote
        title="How to read these charts"
        sections={[
          {
            heading: "Exploratory comparison",
            bullets: [
              "Each chart is one affordability dimension. Rising real income does not automatically mean housing or tuition became easier to afford.",
              "Relative measures (ratios, hours of work) are often more informative than nominal dollar levels alone.",
              "Mixed nominal/real comparisons are labeled explicitly and should be read as contextual signals.",
            ],
          },
          {
            heading: "Reference anchors and interpolation",
            bullets: [
              "Tuition and rent use published anchor years with linear interpolation between them.",
              "Household goods use official BLS price indices anchored to benchmark retail prices; television also uses retail anchors before 1994.",
              "Hours-of-work affordability charts are split by domain (rent, tuition, household goods) in actual hours at average wages; each chart uses its own y-axis scale.",
            ],
          },
          {
            heading: "What this study does not claim",
            bullets: [
              "It does not measure subjective well-being, health outcomes, or the full distribution of income and wealth.",
              "It does not prove that a specific policy caused a given affordability shift.",
              "Healthcare costs are noted in the study scope but are not yet charted in Phase 1.",
            ],
          },
        ]}
      />

      {study?.concepts?.length ? <ConceptsUsed conceptKeys={[...study.concepts]} groupConceptsCoreFirst /> : null}

      <SourceInfo
        items={sourceItems}
        note="Primary macro series from FRED; tuition and rent anchors from published reference tables with interpolation. Household goods prices are CPI- or PPI-anchored estimates (see Sources & units). Derived ratios and hours-of-work metrics are computed in the API bundle."
      />

      <InSimpleTerms>
        <p>
          This page compares several ways to ask whether everyday economic life became easier or harder to afford over
          time — not with a single verdict, but with separate charts for income, housing, education, productivity, and
          hours of work.
        </p>
        <p>
          When a line rises, that dimension became more costly in relative terms (or required more hours of work). When
          it falls, it became cheaper relative to wages or income. Different lines can move in opposite directions in the
          same decade.
        </p>
        <p>
          Use the Sources &amp; units section for indicator codes and methodology notes before drawing strong conclusions.
        </p>
      </InSimpleTerms>
    </section>
  );
}
