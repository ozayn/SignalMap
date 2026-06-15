"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/timeline-chart";
import { DataObservations } from "@/components/data-observations";
import { LearningNote } from "@/components/learning-note";
import { ConceptsUsed } from "@/components/concepts-used";
import { SourceInfo, type SourceInfoItem } from "@/components/source-info";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { trackEvent } from "@/lib/analytics";
import { getStudyById } from "@/lib/studies";
import { SIGNAL_CONCEPT, SIGNAL_COUNTRY } from "@/lib/signalmap-chart-colors";

type Point = { date: string; value: number };

type LivingStandardsBundle = {
  series: Record<string, Point[]>;
  fred_series: Record<string, string>;
  reference_sources: Record<string, string>;
  real_base_year: number;
  productivity_compensation_base_year: number;
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

export function UsLivingStandardsStudy() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<LivingStandardsBundle | null>(null);

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
  const prodBaseYear = bundle?.productivity_compensation_base_year ?? 1979;

  const commonChartProps = {
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    chartHeight: "h-56 md:h-64",
    timeRange: [timeRange.start, timeRange.end] as [string, string],
  };

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
        sourceDetail: `Nonfarm business sector indexes reindexed to ${prodBaseYear}=100`,
        unitLabel: `Index (${prodBaseYear}=100) — ${fred.productivity_index ?? "OPHNFB"} vs ${fred.hourly_compensation_index ?? "COMPNFB"}`,
      },
      {
        label: "Average hourly earnings",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.average_hourly_earnings_usd ?? "CES0500000003"}`,
        sourceDetail: "Total private production and nonsupervisory employees; annual mean",
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
        label: "Hours-of-work affordability",
        sourceName: "SignalMap derived",
        sourceDetail: "Item price ÷ average hourly earnings (CES0500000003 annual mean)",
        unitLabel: "Hours of work at average hourly wage",
        unitNote: "Uses representative prices for appliances and interpolated reference anchors for rent and tuition.",
      },
    ],
    [fred, prodBaseYear, realBaseYear]
  );

  const hoursMultiSeries = useMemo(
    () => [
      {
        key: "rent_month",
        label: "One month of median rent",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_month_rent ?? [],
        color: SIGNAL_COUNTRY.us,
      },
      {
        key: "tuition_year",
        label: "One year of public tuition",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_year_tuition ?? [],
        color: "#9333ea",
      },
      {
        key: "refrigerator",
        label: "Refrigerator",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_refrigerator ?? [],
        color: SIGNAL_CONCEPT.investment,
      },
      {
        key: "washing_machine",
        label: "Washing machine",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_washing_machine ?? [],
        color: "#0d9488",
      },
      {
        key: "television",
        label: "Television",
        unit: "hours",
        yAxisIndex: 0 as const,
        points: s.hours_for_television ?? [],
        color: "#64748b",
      },
    ],
    [s]
  );

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
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">2. Housing — median home price</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.median_home_price_usd ?? []).length > 0 ? (
                <TimelineChart
                  data={s.median_home_price_usd ?? []}
                  valueKey="value"
                  label="Median home price"
                  unit="Nominal US$"
                  seriesColor={SIGNAL_CONCEPT.gdp}
                  exportSourceFooter={wdiFredFooter(fred.median_home_price_usd ?? "MSPUS", "annual mean of quarterly MSPUS")}
                  exportFileStem="us-living-standards-median-home-price"
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
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">3. Education — public university tuition (real)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(s.public_tuition_real_usd ?? []).length > 0 ? (
                <>
                  <TimelineChart
                    data={s.public_tuition_real_usd ?? []}
                    valueKey="value"
                    label={`Public tuition (real, ${realBaseYear} US$)`}
                    unit={`Constant ${realBaseYear} US$`}
                    seriesColor={SIGNAL_CONCEPT.wage_real}
                    exportSourceFooter={wdiFredFooter(
                      fred.cpi_all_items_index ?? "CPIAUCSL",
                      `College Board anchors deflated to ${realBaseYear} dollars`
                    )}
                    exportFileStem="us-living-standards-tuition-real"
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
                Nonfarm business sector indexes reindexed to {prodBaseYear}=100
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
                        unit: `Index (${prodBaseYear}=100)`,
                        yAxisIndex: 0 as const,
                        points: s.productivity_reindexed ?? [],
                        color: SIGNAL_COUNTRY.us,
                      },
                      {
                        key: "compensation",
                        label: "Hourly compensation",
                        unit: `Index (${prodBaseYear}=100)`,
                        yAxisIndex: 0 as const,
                        points: s.compensation_reindexed ?? [],
                        color: SIGNAL_CONCEPT.wage_nominal,
                      },
                    ]}
                    exportSourceFooter={wdiFredFooter(
                      [fred.productivity_index ?? "OPHNFB", fred.hourly_compensation_index ?? "COMPNFB"],
                      `reindexed to ${prodBaseYear}=100`
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

          {/* 5. Hours of work */}
          <Card className="border-border md:col-span-2">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">5. Hours of work required to purchase</CardTitle>
              <p className="text-xs text-muted-foreground">
                Item price ÷ average hourly earnings ({fred.average_hourly_earnings_usd ?? "CES0500000003"})
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {hoursMultiSeries.some((row) => row.points.length > 0) ? (
                <>
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label="Hours of work to afford"
                    multiSeries={hoursMultiSeries}
                    multiSeriesYAxisNameOverrides={{ 0: "Hours at average hourly wage" }}
                    exportSourceFooter={wdiFredFooter(
                      fred.average_hourly_earnings_usd ?? "CES0500000003",
                      "derived hours-of-work affordability"
                    )}
                    exportFileStem="us-living-standards-hours-of-work"
                    {...commonChartProps}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Hours = price ÷ average hourly earnings. Rent uses one month of median gross rent; tuition uses
                    one academic year of published in-state public tuition; appliances use representative retail price
                    anchors. Earnings series begins in 2006, so earlier hours estimates are unavailable.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {bundle?.reference_sources?.median_gross_rent_monthly_usd}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bundle?.reference_sources?.refrigerator_usd}
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable for this window.</p>
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
              "Tuition, rent, and appliance prices use published anchor years with linear interpolation between them.",
              "They approximate broad trends, not a single standardized product basket over time.",
              "FRED average hourly earnings begins in 2006, limiting the hours-of-work panel before that year.",
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
        note="Primary macro series from FRED; tuition, rent, and appliance anchors from published reference tables with interpolation. Derived ratios and hours-of-work metrics are computed in the API bundle."
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
