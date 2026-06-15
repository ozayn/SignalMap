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
import { TIMELINE_CHART_MOBILE_HEIGHT_PREFIX } from "@/lib/chart-study-typography";
import {
  ChartDirectionCue,
  ChartInterpretivePrompt,
  exportFooterWithDirection,
  US_LS_CHART_DIRECTION,
  US_LS_CHART_PROMPTS,
} from "@/components/studies/chart-direction-cue";
import {
  StudyChartCell,
  StudyChartFull,
  StudyComparisonGroup,
} from "@/components/studies/study-chart-layout";
import {
  US_LS_SECTION_ANCHOR_CLASS,
  UsLivingStandardsSectionNav,
} from "@/components/studies/us-living-standards-section-nav";

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
  fetch_error?: string;
  wdi_indicators?: Record<string, string>;
  phase2?: {
    health_insurance_note?: string;
    childcare_note?: string;
    new_vehicle?: {
      benchmark_year?: number;
      benchmark_price_usd?: number;
      cpi_fred_series?: string;
      cpi_source?: string;
    };
    health_expenditure_start_year?: number | null;
    health_expenditure_end_year?: number | null;
    vehicle_hours_start_year?: number | null;
    vehicle_hours_end_year?: number | null;
  };
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

/** Standard on-page chart height (~480px desktop). */
const CHART_HEIGHT_STANDARD = `${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-[30rem]`;
/** Taller canvas for multi-series or hours charts (~512px desktop). */
const CHART_HEIGHT_DENSE = `${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-[32rem]`;
const CHART_GRID_LEFT = 72;
const CHART_GRID_LEFT_WIDE = 88;
const CHART_GRID_RIGHT = "4%";
const SECTION_START_GAP_YEARS = 3;

function yearFromDate(date: string): number {
  return parseInt(date.slice(0, 4), 10);
}

function yearSpanToRange(minYear: number, maxYear: number): [string, string] {
  return [`${minYear}-01-01`, `${maxYear}-12-31`];
}

/** Shared x-domain when series start years are close enough to align plot areas. */
function sharedSectionTimeRange(
  seriesList: Point[][],
  maxStartGapYears = SECTION_START_GAP_YEARS
): [string, string] | undefined {
  const nonEmpty = seriesList.filter((pts) => pts.length > 0);
  if (nonEmpty.length < 2) return undefined;
  const starts = nonEmpty.map((pts) => yearFromDate(seriesTimeRange(pts)![0]));
  const ends = nonEmpty.map((pts) => yearFromDate(seriesTimeRange(pts)![1]));
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);
  if (maxStart - minStart > maxStartGapYears) return undefined;
  return yearSpanToRange(minStart, Math.max(...ends));
}

function resolveChartTimeRange(
  points: Point[],
  shared: [string, string] | undefined,
  fallback: [string, string]
): [string, string] {
  const dataRange = seriesTimeRange(points);
  if (!dataRange) return shared ?? fallback;
  if (!shared) return dataRange;
  const dataStart = yearFromDate(dataRange[0]);
  const sharedStart = yearFromDate(shared[0]);
  if (dataStart - sharedStart > SECTION_START_GAP_YEARS) return dataRange;
  return shared;
}

function hoursWorkChartFooter(wageCode: string, expenseSource: string): string {
  return `Source: FRED ${wageCode} (average hourly wage); ${expenseSource}; method: price ÷ average hourly wage`;
}

const HOURS_Y_AXIS_LABEL = "Hours at average hourly wage";

const HOURS_CHART_RENT_LABEL = "Hours of work to afford one month of median rent";
const HOURS_CHART_TUITION_LABEL = "Hours of work to afford one year of public university tuition";

const PUBLIC_UNIVERSITY_TUITION_SOURCE =
  "College Board Trends in College Pricing — average published in-state tuition and required fees at public four-year universities.";

const PUBLIC_UNIVERSITY_METHODOLOGY =
  "Published in-state tuition and required fees at public four-year universities.";

const PUBLIC_UNIVERSITY_K12_NOTE =
  "This measure refers to public universities (state universities) and does not include K–12 schooling, private universities, living expenses, books, or financial aid.";

const HOURS_CHART_HOUSEHOLD_LABEL = "Hours of work to afford household goods";

const HOURS_CHART_RENT_METHOD =
  "Estimated as median monthly rent divided by the average hourly wage.";
const HOURS_CHART_TUITION_METHOD =
  `Estimated as ${PUBLIC_UNIVERSITY_METHODOLOGY.charAt(0).toLowerCase()}${PUBLIC_UNIVERSITY_METHODOLOGY.slice(1)} divided by the average hourly wage.`;
const HOURS_CHART_HOUSEHOLD_METHOD =
  "Estimated as representative prices divided by the average hourly wage.";

const HOURS_OF_WORK_METHODOLOGY_NOTE =
  "Hours-of-work estimates use historical wage proxies to approximate how many hours an average worker would need to work to cover the selected expense. The series are intended as contextual affordability signals rather than precise household budget calculations.";

const AFFORDABILITY_BURDEN_METHOD_NOTE =
  "Both series divide a major cost by median household income. Lower values generally indicate greater affordability. The axes differ because housing and tuition have different magnitudes.";

const AFFORDABILITY_BURDEN_CHART_LABEL = "Affordability burden: housing vs public university";

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
  const [gasPriceMode, setGasPriceMode] = useState<MonetaryDisplayMode>("real");

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
  const wdi = bundle?.wdi_indicators ?? {};
  const phase2Meta = bundle?.phase2;
  const realBaseYear = bundle?.real_base_year ?? 2022;
  const prodBaseYear = bundle?.productivity_compensation_base_year ?? DEFAULT_INDEX_PREFERRED_YEAR;
  const prodIndexUnit = formatIndexEquals100Label(prodBaseYear);
  const prodIndexFallbackNote = formatSharedIndexBaseNote(prodBaseYear, DEFAULT_INDEX_PREFERRED_YEAR);

  const studyWindow = useMemo(
    (): [string, string] => [timeRange.start, timeRange.end],
    [timeRange.end, timeRange.start]
  );

  const chartBaseProps = {
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    gridLeft: CHART_GRID_LEFT,
    gridRight: CHART_GRID_RIGHT,
  };

  const standardChartProps = {
    ...chartBaseProps,
    chartHeight: CHART_HEIGHT_STANDARD,
  };

  const denseChartProps = {
    ...chartBaseProps,
    chartHeight: CHART_HEIGHT_DENSE,
    gridLeft: CHART_GRID_LEFT_WIDE,
  };

  const dualAxisChartProps = {
    ...chartBaseProps,
    chartHeight: CHART_HEIGHT_STANDARD,
    gridLeft: CHART_GRID_LEFT_WIDE,
    gridRight: "10%",
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
      label: isReal ? `Public university tuition (real, ${realBaseYear} US$)` : "Public university tuition (nominal)",
      unit: isReal ? `Constant ${realBaseYear} US$` : "Nominal US$ per academic year",
      exportSourceFooter: isReal
        ? wdiFredFooter(cpi, `College Board anchors deflated to ${realBaseYear} dollars`)
        : `Source: ${PUBLIC_UNIVERSITY_TUITION_SOURCE} Reference anchors; interpolated between anchor years.`,
      exportFileStem: isReal ? "us-living-standards-tuition-real" : "us-living-standards-tuition-nominal",
      sectionTitle: isReal
        ? `3. Higher education — public university tuition (real, ${realBaseYear} US$)`
        : "3. Higher education — public university tuition (nominal)",
    };
  }, [fred, realBaseYear, s, tuitionMode]);

  const gasPriceChart = useMemo(() => {
    const isReal = gasPriceMode === "real";
    const gasCode = fred.gasoline_price_usd_per_gallon ?? "GASREGW";
    const cpi = fred.cpi_all_items_index ?? "CPIAUCSL";
    return {
      data: isReal
        ? (s.gasoline_price_real_usd_per_gallon ?? [])
        : (s.gasoline_price_usd_per_gallon ?? []),
      label: isReal ? `Gasoline price (real, ${realBaseYear} US$/gal)` : "Gasoline price",
      unit: isReal ? `Constant ${realBaseYear} US$/gallon` : "Nominal US$/gallon",
      exportSourceFooter: isReal
        ? wdiFredFooter([gasCode, cpi], `GASREGW deflated to ${realBaseYear} dollars with CPI-U`)
        : wdiFredFooter(gasCode, "annual mean of weekly retail price"),
      exportFileStem: isReal
        ? "us-living-standards-gasoline-price-real"
        : "us-living-standards-gasoline-price-nominal",
      sectionTitle: isReal
        ? `7. Transportation — gasoline price (real, ${realBaseYear} US$/gal)`
        : "7. Transportation — gasoline price",
    };
  }, [fred, gasPriceMode, realBaseYear, s]);

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
        label: AFFORDABILITY_BURDEN_CHART_LABEL,
        sourceName: "SignalMap derived",
        sourceDetail: "MSPUS / MEHOINUSA672N and College Board public-university anchors / MEHOINUSA672N",
        unitLabel: "Ratio (left: house price / income; right: tuition / income)",
        unitNote: AFFORDABILITY_BURDEN_METHOD_NOTE,
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
        sourceDetail: `${PUBLIC_UNIVERSITY_TUITION_SOURCE} Sparse annual anchors; interpolated between anchor years.`,
        unitLabel: "Nominal US$ per academic year",
        unitNote: PUBLIC_UNIVERSITY_K12_NOTE,
      },
      {
        label: "Public university tuition (real)",
        sourceName: "SignalMap derived",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.cpi_all_items_index ?? "CPIAUCSL"}`,
        sourceDetail: `College Board public-university anchors deflated with CPI-U to ${realBaseYear} dollars`,
        unitLabel: `Constant ${realBaseYear} US$`,
        unitNote: PUBLIC_UNIVERSITY_K12_NOTE,
      },
      {
        label: "Public university tuition relative to household income",
        sourceName: "SignalMap derived",
        sourceDetail: "Nominal public-university tuition / real median household income",
        unitLabel: "Ratio",
        unitNote: PUBLIC_UNIVERSITY_K12_NOTE,
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
          `College Board public-university tuition anchors ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: `${HOURS_CHART_TUITION_METHOD} ${PUBLIC_UNIVERSITY_K12_NOTE}`,
      },
      {
        label: HOURS_CHART_HOUSEHOLD_LABEL,
        sourceName: "SignalMap derived",
        sourceDetail: `CPI- or PPI-anchored estimated prices ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: `${HOURS_CHART_HOUSEHOLD_METHOD} Refrigerator (CUSR0000SAH3 proxy), washing machine (WPU12410220/WPU1241), television (CUSR0000SERA + retail anchors), vacuum cleaner (CUSR0000SAH3 proxy). Each series starts when its price and wage data overlap.`,
      },
      {
        label: "Health expenditure per capita (real)",
        sourceName: "World Bank WDI + FRED CPI",
        sourceUrl: "https://data.worldbank.org/indicator/SH.XPD.CHEX.PC.CD",
        sourceDetail: `WDI SH.XPD.CHEX.PC.CD deflated with CPI-U to ${realBaseYear} dollars`,
        unitLabel: `Constant ${realBaseYear} US$ per person`,
        unitNote:
          phase2Meta?.health_expenditure_start_year != null
            ? `WDI health spending per capita begins ${phase2Meta.health_expenditure_start_year}; earlier years are not shown.`
            : "World Bank current health expenditure per capita; annual coverage varies.",
      },
      {
        label: "Life expectancy at birth",
        sourceName: "World Bank WDI",
        sourceUrl: "https://data.worldbank.org/indicator/SP.DYN.LE00.IN",
        sourceDetail: "United States — outcome/context series, not an affordability measure",
        unitLabel: "Years",
      },
      {
        label: gasPriceChart.label,
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.gasoline_price_usd_per_gallon ?? "GASREGW"}`,
        sourceDetail: "U.S. regular gasoline; annual mean of weekly retail price",
        unitLabel: gasPriceChart.unit,
      },
      {
        label: "New vehicle price relative to income",
        sourceName: "SignalMap derived",
        sourceDetail:
          refSources.new_vehicle_to_income_ratio ??
          `CPI new vehicles (${fred.cpi_new_vehicles_index ?? "CUUR0000SETA01"}) anchored price ÷ real median household income`,
        unitLabel: "Ratio",
        unitNote: "Estimated retail price from CPI anchor; contextual signal, not a transaction-price index.",
      },
      {
        label: "Hours of work to afford a new vehicle",
        sourceName: "SignalMap derived",
        sourceDetail:
          refSources.hours_for_new_vehicle ??
          `Estimated new-vehicle price ÷ FRED ${fred.average_hourly_earnings_household_goods_usd ?? "AHETPI"}`,
        unitLabel: HOURS_Y_AXIS_LABEL,
        unitNote: HOURS_OF_WORK_METHODOLOGY_NOTE,
      },
      {
        label: "Homeownership rate",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.homeownership_rate_pct ?? "RHORUSQ156N"}`,
        sourceDetail: "Census homeownership rate; annual mean of quarterly observations",
        unitLabel: "Percent of occupied housing units",
      },
      {
        label: "Median age at first marriage",
        sourceName: "U.S. Census Bureau (reference anchors)",
        sourceUrl: "https://www.census.gov",
        sourceDetail: "Historical median age at first marriage, men and women; interpolated between anchor years",
        unitLabel: "Years",
      },
      {
        label: "Total fertility rate",
        sourceName: "FRED",
        sourceUrl: `https://fred.stlouisfed.org/series/${fred.fertility_rate_births_per_woman ?? "SPDYNTFRTINUSA"}`,
        sourceDetail: "Births per woman — demographic context for family formation",
        unitLabel: "Births per woman",
      },
    ],
    [fred, gasPriceChart.label, gasPriceChart.unit, phase2Meta?.health_expenditure_start_year, prodBaseYear, realBaseYear, refSources]
  );

  const householdGoodsSourceFooter = useMemo(
    () => hoursWorkChartFooter(hoursOfWorkWageSeriesId, "CPI/PPI-anchored goods (see Sources & units)"),
    [hoursOfWorkWageSeriesId]
  );

  const hoursChartBaseProps = {
    ...denseChartProps,
  };

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

  const hoursRentTuitionSharedTimeRange = useMemo(
    () => sharedSectionTimeRange([hoursRentPoints, hoursTuitionPoints]),
    [hoursRentPoints, hoursTuitionPoints]
  );

  const healthcareSharedTimeRange = useMemo(
    () =>
      sharedSectionTimeRange([
        s.health_expenditure_per_capita_real_usd ?? [],
        s.life_expectancy_years ?? [],
      ]),
    [s.health_expenditure_per_capita_real_usd, s.life_expectancy_years]
  );

  const transportationGasVehicleSharedTimeRange = useMemo(
    () =>
      sharedSectionTimeRange([
        gasPriceChart.data,
        s.new_vehicle_to_income_ratio ?? [],
      ]),
    [gasPriceChart.data, s.new_vehicle_to_income_ratio]
  );

  const familyHomeFertilitySharedTimeRange = useMemo(
    () =>
      sharedSectionTimeRange([
        s.homeownership_rate_pct ?? [],
        s.fertility_rate_births_per_woman ?? [],
      ]),
    [s.fertility_rate_births_per_woman, s.homeownership_rate_pct]
  );

  const housePriceToIncomePoints = s.house_price_to_income_ratio ?? [];
  const tuitionToIncomePoints = s.tuition_to_income_ratio ?? [];

  const affordabilityBurdenTimeRange = useMemo(() => {
    const shared = sharedSectionTimeRange([housePriceToIncomePoints, tuitionToIncomePoints]);
    const allPoints = [...housePriceToIncomePoints, ...tuitionToIncomePoints];
    return shared ?? seriesTimeRange(allPoints) ?? studyWindow;
  }, [housePriceToIncomePoints, tuitionToIncomePoints, studyWindow]);

  const hasAffordabilityBurdenChart =
    housePriceToIncomePoints.length > 0 || tuitionToIncomePoints.length > 0;

  const hoursSharedTimeRange = useMemo(
    () =>
      sharedSectionTimeRange(
        [s.new_vehicle_to_income_ratio ?? [], s.hours_for_new_vehicle ?? []],
        5
      ),
    [s.hours_for_new_vehicle, s.new_vehicle_to_income_ratio]
  );

  const marriageSharedTimeRange = useMemo(
    () =>
      sharedSectionTimeRange([
        s.median_age_first_marriage_male ?? [],
        s.median_age_first_marriage_female ?? [],
      ]),
    [s.median_age_first_marriage_female, s.median_age_first_marriage_male]
  );

  const transportationVehicleSharedTimeRange = hoursSharedTimeRange;

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
            Wages, housing, higher education, healthcare, and everyday goods can move in different directions at once.
            The charts below are meant for exploratory comparison — not to settle ideological debates about progress
            or decline.
          </p>
        </CardContent>
      </Card>

      <UsLivingStandardsSectionNav sectionsReady={!loading && !loadError} />

      <Card className="border-border bg-muted/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Key patterns to look for</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Real median household income and nominal home prices often diverge, so price-to-income ratios can rise even when incomes grow.</li>
            <li>Public university tuition and rent can outpace hourly earnings in some decades while appliances may take fewer hours of work as manufacturing productivity improves.</li>
            <li>Productivity and hourly compensation indexes can decouple — productivity growth does not automatically translate into proportional wage growth.</li>
            <li>Reference-price series for public-university tuition, rent, and appliances use published anchors and interpolation; treat them as contextual signals, not precise retail transactions.</li>
            <li>Healthcare spending (WDI) and gasoline prices can rise in nominal terms while life expectancy improves — different dimensions can diverge.</li>
            <li>Family-formation indicators (homeownership, marriage age, fertility) describe social context; they are not direct affordability measures.</li>
          </ul>
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading data…</p>
      ) : loadError ? (
        <p className="py-8 text-sm text-destructive">Failed to load study data: {loadError}</p>
      ) : (
        <>
          {(bundle?.partial || bundle?.fetch_error) && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="py-3 text-sm text-muted-foreground">
                {bundle?.fetch_error ? (
                  <p>Some study data could not be loaded ({bundle.fetch_error}). Charts below may be incomplete.</p>
                ) : (
                  <p>Some data sources were temporarily unavailable. Charts below may show gaps or &ldquo;Data unavailable&rdquo; where series failed to load.</p>
                )}
                {bundle?.series_warnings && Object.keys(bundle.series_warnings).length > 0 && (
                  <p className="mt-1 text-xs">
                    Affected indicators: {Object.keys(bundle.series_warnings).join(", ")}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        <div className="flex flex-col gap-4">
          {/* 1. Income */}
          <Card id="income" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
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
                    exportSourceFooter={exportFooterWithDirection(
                      wdiFredFooter(fred.median_household_income_real_usd ?? "MEHOINUSA672N"),
                      US_LS_CHART_DIRECTION.medianIncome
                    )}
                    exportFileStem="us-living-standards-median-income"
                    timeRange={resolveChartTimeRange(
                      s.median_household_income_real_usd ?? [],
                      undefined,
                      studyWindow
                    )}
                    {...standardChartProps}
                  />
                  <ChartDirectionCue
                    meta={US_LS_CHART_DIRECTION.medianIncome}
                    points={s.median_household_income_real_usd ?? []}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
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
          <Card id="housing" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">2. Housing</CardTitle>
                  <p className="text-xs text-muted-foreground">Median home price</p>
                </div>
                <NominalRealToggle
                  mode={homePriceMode}
                  onChange={setHomePriceMode}
                  realLabel={realToggleLabel}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {homePriceChart.data.length > 0 ? (
                <>
                  <TimelineChart
                    data={homePriceChart.data}
                    valueKey="value"
                    label={homePriceChart.label}
                    unit={homePriceChart.unit}
                    seriesColor={SIGNAL_CONCEPT.gdp}
                    exportSourceFooter={homePriceChart.exportSourceFooter}
                    exportFileStem={homePriceChart.exportFileStem}
                    timeRange={resolveChartTimeRange(
                      homePriceChart.data,
                      undefined,
                      studyWindow
                    )}
                    {...standardChartProps}
                  />
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* 3. Higher education */}
          <Card id="higher-education" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">3. Higher education</CardTitle>
                  <p className="text-xs text-muted-foreground">Public university tuition</p>
                </div>
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
                    timeRange={resolveChartTimeRange(
                      tuitionChart.data,
                      undefined,
                      studyWindow
                    )}
                    {...standardChartProps}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PUBLIC_UNIVERSITY_K12_NOTE}
                  </p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">{AFFORDABILITY_BURDEN_CHART_LABEL}</CardTitle>
              <p className="text-xs text-muted-foreground">
                House price / median income (left) and public university tuition / median income (right)
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {hasAffordabilityBurdenChart ? (
                <>
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label={AFFORDABILITY_BURDEN_CHART_LABEL}
                    multiSeries={[
                      {
                        key: "house_price_to_income",
                        label: "House price / median income",
                        unit: "Ratio",
                        yAxisIndex: 0 as const,
                        points: housePriceToIncomePoints,
                        color: "#9333ea",
                        linePattern: "solid",
                        symbol: "circle",
                        showSymbol: false,
                      },
                      {
                        key: "tuition_to_income",
                        label: "Public university tuition / median income",
                        unit: "Ratio",
                        yAxisIndex: 1 as const,
                        points: tuitionToIncomePoints,
                        color: "#0d9488",
                        linePattern: "dashed",
                        symbol: "triangle",
                        showSymbol: false,
                      },
                    ]}
                    multiSeriesYAxisNameOverrides={{
                      0: "House price / median income",
                      1: "Public university tuition / median income",
                    }}
                    exportSourceFooter={`${exportFooterWithDirection(
                      wdiFredFooter(
                        [
                          fred.median_home_price_usd ?? "MSPUS",
                          fred.median_household_income_real_usd ?? "MEHOINUSA672N",
                          "College Board public-university anchors",
                        ],
                        "derived ratios; dual y-axes"
                      ),
                      US_LS_CHART_DIRECTION.priceToIncome
                    )} ${AFFORDABILITY_BURDEN_METHOD_NOTE}`}
                    exportFileStem="us-living-standards-affordability-burden-housing-vs-tuition"
                    timeRange={affordabilityBurdenTimeRange}
                    {...dualAxisChartProps}
                  />
                  <ChartDirectionCue meta={US_LS_CHART_DIRECTION.priceToIncome} className="mt-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{AFFORDABILITY_BURDEN_METHOD_NOTE}</p>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* 4. Productivity vs compensation */}
          <Card className="border-border">
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
                    timeRange={
                      seriesTimeRange([
                        ...(s.productivity_reindexed ?? []),
                        ...(s.compensation_reindexed ?? []),
                      ]) ?? studyWindow
                    }
                    {...denseChartProps}
                  />
                  <ChartInterpretivePrompt
                    question={US_LS_CHART_PROMPTS.productivityCompensation}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
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
          <Card id="hours-of-work" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-base">5. Affordability in hours of work</CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                {hoursOfWorkMethodologyNote} Each chart begins when both its expense and wage data are available.
              </p>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              {!hasAnyHoursChart ? (
                <p className="py-6 text-xs text-muted-foreground">Data unavailable for this window.</p>
              ) : (
                <>
                  <StudyChartFull title={HOURS_CHART_HOUSEHOLD_LABEL}>
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
                          timeRange={resolveChartTimeRange(
                            householdGoodsMultiSeries.flatMap((row) => row.points),
                            undefined,
                            studyWindow
                          )}
                          {...hoursChartBaseProps}
                        />
                        <ChartDirectionCue meta={US_LS_CHART_DIRECTION.hoursOfWork} className="mt-2" />
                        <p className="text-xs text-muted-foreground">
                          {HOURS_CHART_HOUSEHOLD_METHOD} Each good uses its own price index and may start in a
                          different year.
                        </p>
                      </>
                    ) : (
                      <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                    )}
                  </StudyChartFull>

                  <StudyComparisonGroup paired={Boolean(hoursRentTuitionSharedTimeRange)}>
                    <StudyChartCell title={HOURS_CHART_RENT_LABEL}>
                      {hoursRentPoints.length > 0 ? (
                        <>
                          <TimelineChart
                            data={hoursRentPoints}
                            valueKey="value"
                            label={HOURS_CHART_RENT_LABEL}
                            unit={HOURS_Y_AXIS_LABEL}
                            seriesColor={SIGNAL_COUNTRY.us}
                            exportSourceFooter={exportFooterWithDirection(
                              hoursWorkChartFooter(
                                hoursOfWorkWageSeriesId,
                                "Census median gross rent (see Sources & units)"
                              ),
                              US_LS_CHART_DIRECTION.hoursOfWork
                            )}
                            exportFileStem="us-living-standards-hours-rent"
                            timeRange={resolveChartTimeRange(
                              hoursRentPoints,
                              hoursRentTuitionSharedTimeRange,
                              studyWindow
                            )}
                            {...hoursChartBaseProps}
                          />
                          <ChartDirectionCue
                            meta={US_LS_CHART_DIRECTION.hoursOfWork}
                            points={hoursRentPoints}
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground">{HOURS_CHART_RENT_METHOD}</p>
                        </>
                      ) : (
                        <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                      )}
                    </StudyChartCell>
                    <StudyChartCell title={HOURS_CHART_TUITION_LABEL}>
                      {hoursTuitionPoints.length > 0 ? (
                        <>
                          <TimelineChart
                            data={hoursTuitionPoints}
                            valueKey="value"
                            label={HOURS_CHART_TUITION_LABEL}
                            unit={HOURS_Y_AXIS_LABEL}
                            seriesColor="#9333ea"
                            exportSourceFooter={exportFooterWithDirection(
                              hoursWorkChartFooter(
                                hoursOfWorkWageSeriesId,
                                "College Board public-university tuition anchors (see Sources & units)"
                              ),
                              US_LS_CHART_DIRECTION.hoursOfWork
                            )}
                            exportFileStem="us-living-standards-hours-tuition"
                            timeRange={resolveChartTimeRange(
                              hoursTuitionPoints,
                              hoursRentTuitionSharedTimeRange,
                              studyWindow
                            )}
                            {...hoursChartBaseProps}
                          />
                          <ChartDirectionCue
                            meta={US_LS_CHART_DIRECTION.hoursOfWork}
                            points={hoursTuitionPoints}
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground">{HOURS_CHART_TUITION_METHOD}</p>
                        </>
                      ) : (
                        <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                      )}
                    </StudyChartCell>
                  </StudyComparisonGroup>

                  <p className="text-xs text-muted-foreground border-t border-border pt-4">
                    Wage denominator for all hours charts: FRED {hoursOfWorkWageSeriesId} (production and
                    nonsupervisory employees, 1964+).{" "}
                    {hoursOfWorkMeta?.wage_tradeoffs ??
                      "CES0500000003 (all private employees) begins in 2006; AHETPI is used for longer history."}{" "}
                    See Sources &amp; units for methodology detail.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 6. Healthcare */}
          <Card id="healthcare" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">6. Healthcare</CardTitle>
              <p className="text-xs text-muted-foreground">Spending burden and health outcomes (context)</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <StudyComparisonGroup paired={Boolean(healthcareSharedTimeRange)}>
                <StudyChartCell title={`Health expenditure per capita (real, ${realBaseYear} US$)`}>
                  {(s.health_expenditure_per_capita_real_usd ?? []).length > 0 ? (
                    <>
                      <TimelineChart
                        data={s.health_expenditure_per_capita_real_usd ?? []}
                        valueKey="value"
                        label={`Health spending per capita (real, ${realBaseYear} US$)`}
                        unit={`Constant ${realBaseYear} US$`}
                        seriesColor="#dc2626"
                        exportSourceFooter={wdiFredFooter(
                          [wdi.health_expenditure_per_capita_usd ?? "SH.XPD.CHEX.PC.CD", fred.cpi_all_items_index ?? "CPIAUCSL"],
                          `WDI deflated to ${realBaseYear} dollars`
                        )}
                        exportFileStem="us-living-standards-health-spending-per-capita-real"
                        timeRange={resolveChartTimeRange(
                          s.health_expenditure_per_capita_real_usd ?? [],
                          healthcareSharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                      <ChartInterpretivePrompt
                        question={US_LS_CHART_PROMPTS.healthSpending}
                        className="mt-2"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {phase2Meta?.health_expenditure_start_year != null
                          ? `WDI series begins ${phase2Meta.health_expenditure_start_year}.`
                          : "World Bank health expenditure per capita."}
                      </p>
                    </>
                  ) : (
                    <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
                <StudyChartCell title="Life expectancy at birth (context)">
                  {(s.life_expectancy_years ?? []).length > 0 ? (
                    <>
                      <TimelineChart
                        data={s.life_expectancy_years ?? []}
                        valueKey="value"
                        label="Life expectancy at birth"
                        unit="Years"
                        seriesColor="#059669"
                        exportSourceFooter={exportFooterWithDirection(
                          `Source: World Bank WDI — ${wdi.life_expectancy_years ?? "SP.DYN.LE00.IN"}; outcome/context series, not affordability`,
                          US_LS_CHART_DIRECTION.lifeExpectancy
                        )}
                        exportFileStem="us-living-standards-life-expectancy"
                        timeRange={resolveChartTimeRange(
                          s.life_expectancy_years ?? [],
                          healthcareSharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                      <ChartDirectionCue
                        meta={US_LS_CHART_DIRECTION.lifeExpectancy}
                        points={s.life_expectancy_years ?? []}
                        className="mt-2"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Health outcome context — not an affordability measure.
                      </p>
                    </>
                  ) : (
                    <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
              </StudyComparisonGroup>

              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                {phase2Meta?.health_insurance_note ??
                  refSources.health_insurance_premiums ??
                  "Health insurance premiums relative to income are not charted: consistent long-run premium series are not available without large gaps."}
              </p>
            </CardContent>
          </Card>

          {/* 7. Transportation */}
          <Card id="transportation" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">7. Transportation</CardTitle>
                  <p className="text-xs text-muted-foreground">Gasoline prices and new-vehicle affordability</p>
                </div>
                <NominalRealToggle
                  mode={gasPriceMode}
                  onChange={setGasPriceMode}
                  realLabel={`Real (${realBaseYear} US$/gal)`}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <StudyComparisonGroup paired={Boolean(transportationGasVehicleSharedTimeRange)}>
                <StudyChartCell title={gasPriceChart.label}>
                  {gasPriceChart.data.length > 0 ? (
                    <>
                      <TimelineChart
                        data={gasPriceChart.data}
                        valueKey="value"
                        label={gasPriceChart.label}
                        unit={gasPriceChart.unit}
                        seriesColor="#b45309"
                        exportSourceFooter={gasPriceChart.exportSourceFooter}
                        exportFileStem={gasPriceChart.exportFileStem}
                        timeRange={resolveChartTimeRange(
                          gasPriceChart.data,
                          transportationGasVehicleSharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Gasoline series begins 1990 on FRED.</p>
                    </>
                  ) : (
                    <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
                <StudyChartCell title="New vehicle price / median income">
                  {(s.new_vehicle_to_income_ratio ?? []).length > 0 ? (
                    <>
                      <TimelineChart
                        data={s.new_vehicle_to_income_ratio ?? []}
                        valueKey="value"
                        label="New vehicle price / median income"
                        unit="Ratio"
                        seriesColor="#0369a1"
                        exportSourceFooter={wdiFredFooter(
                          fred.cpi_new_vehicles_index ?? "CUUR0000SETA01",
                          "CPI-anchored estimated price ÷ real median household income"
                        )}
                        exportFileStem="us-living-standards-new-vehicle-to-income"
                        timeRange={resolveChartTimeRange(
                          s.new_vehicle_to_income_ratio ?? [],
                          transportationGasVehicleSharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        CPI-anchored estimated new-vehicle price.
                      </p>
                    </>
                  ) : (
                    <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
              </StudyComparisonGroup>

              <StudyChartFull title="Hours of work to afford a new vehicle">
                {(s.hours_for_new_vehicle ?? []).length > 0 ? (
                  <>
                    <TimelineChart
                      data={s.hours_for_new_vehicle ?? []}
                      valueKey="value"
                      label="Hours of work to afford a new vehicle"
                      unit={HOURS_Y_AXIS_LABEL}
                      seriesColor="#0369a1"
                      exportSourceFooter={hoursWorkChartFooter(
                        hoursOfWorkWageSeriesId,
                        "CPI-anchored new-vehicle price (see Sources & units)"
                      )}
                      exportFileStem="us-living-standards-hours-new-vehicle"
                      timeRange={resolveChartTimeRange(
                        s.hours_for_new_vehicle ?? [],
                        transportationVehicleSharedTimeRange,
                        studyWindow
                      )}
                      {...hoursChartBaseProps}
                    />
                  </>
                ) : (
                  <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                )}
              </StudyChartFull>
            </CardContent>
          </Card>

          {/* 8. Family formation */}
          <Card id="family-formation" className={`border-border ${US_LS_SECTION_ANCHOR_CLASS}`}>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">8. Family formation</CardTitle>
              <p className="text-xs text-muted-foreground">Homeownership, fertility, and marriage age (demographic context)</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <StudyComparisonGroup paired={Boolean(familyHomeFertilitySharedTimeRange)}>
                <StudyChartCell title="Homeownership rate">
                  {(s.homeownership_rate_pct ?? []).length > 0 ? (
                    <>
                      <TimelineChart
                        data={s.homeownership_rate_pct ?? []}
                        valueKey="value"
                        label="Homeownership rate"
                        unit="Percent"
                        seriesColor={SIGNAL_CONCEPT.gdp}
                        exportSourceFooter={wdiFredFooter(fred.homeownership_rate_pct ?? "RHORUSQ156N")}
                        exportFileStem="us-living-standards-homeownership"
                        timeRange={resolveChartTimeRange(
                          s.homeownership_rate_pct ?? [],
                          familyHomeFertilitySharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                    </>
                  ) : (
                    <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
                <StudyChartCell title="Total fertility rate">
                  {(s.fertility_rate_births_per_woman ?? []).length > 0 ? (
                    <>
                      <TimelineChart
                        data={s.fertility_rate_births_per_woman ?? []}
                        valueKey="value"
                        label="Total fertility rate"
                        unit="Births per woman"
                        seriesColor="#7c3aed"
                        exportSourceFooter={wdiFredFooter(fred.fertility_rate_births_per_woman ?? "SPDYNTFRTINUSA")}
                        exportFileStem="us-living-standards-fertility-rate"
                        timeRange={resolveChartTimeRange(
                          s.fertility_rate_births_per_woman ?? [],
                          familyHomeFertilitySharedTimeRange,
                          studyWindow
                        )}
                        {...standardChartProps}
                      />
                    </>
                  ) : (
                    <p className="py-6 text-xs text-muted-foreground">Data unavailable.</p>
                  )}
                </StudyChartCell>
              </StudyComparisonGroup>

              <StudyChartFull title="Median age at first marriage">
                {(s.median_age_first_marriage_male ?? []).length > 0 ||
                (s.median_age_first_marriage_female ?? []).length > 0 ? (
                  <>
                    <TimelineChart
                      data={[]}
                      valueKey="value"
                      label="Median age at first marriage"
                      multiSeries={[
                        {
                          key: "male",
                          label: "Men",
                          unit: "Years",
                          yAxisIndex: 0 as const,
                          points: s.median_age_first_marriage_male ?? [],
                          color: "#2563eb",
                          linePattern: "solid",
                        },
                        {
                          key: "female",
                          label: "Women",
                          unit: "Years",
                          yAxisIndex: 0 as const,
                          points: s.median_age_first_marriage_female ?? [],
                          color: "#db2777",
                          linePattern: "dashed",
                        },
                      ]}
                      exportSourceFooter="Source: U.S. Census Bureau — median age at first marriage (see Sources & units)"
                      exportFileStem="us-living-standards-median-age-first-marriage"
                      timeRange={resolveChartTimeRange(
                        [
                          ...(s.median_age_first_marriage_male ?? []),
                          ...(s.median_age_first_marriage_female ?? []),
                        ],
                        marriageSharedTimeRange,
                        studyWindow
                      )}
                      {...denseChartProps}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Census anchor years with linear interpolation.
                    </p>
                  </>
                ) : (
                  <p className="py-4 text-xs text-muted-foreground">Data unavailable.</p>
                )}
              </StudyChartFull>

              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                {phase2Meta?.childcare_note ??
                  refSources.childcare_costs ??
                  "Reliable long-run national childcare-cost series is not yet included."}
              </p>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {study?.observations?.length ? <DataObservations observations={[...study.observations]} /> : null}

      <LearningNote
        title="How to read these charts"
        sections={[
          {
            heading: "Exploratory comparison",
            bullets: [
              "Each chart is one affordability dimension. Rising real income does not automatically mean housing or public university tuition became easier to afford.",
              "Relative measures (ratios, hours of work) are often more informative than nominal dollar levels alone.",
              "Mixed nominal/real comparisons are labeled explicitly and should be read as contextual signals.",
            ],
          },
          {
            heading: "Reference anchors and interpolation",
            bullets: [
              "Public-university tuition and rent use published anchor years with linear interpolation between them.",
              "Household goods use official BLS price indices anchored to benchmark retail prices; television also uses retail anchors before 1994.",
              "Hours-of-work affordability charts are split by domain (rent, public-university tuition, household goods) in actual hours at average wages; each chart uses its own y-axis scale.",
            ],
          },
          {
            heading: "Reading cues",
            bullets: [
              "Direction pills on affordability and outcome charts (e.g. “↓ Lower = more affordable”) are interpretive aids, not causal claims.",
              "Some charts use a guiding question instead when a single direction would be misleading.",
            ],
          },
          {
            heading: "What this study does not claim",
            bullets: [
              "It does not measure subjective well-being or the full distribution of income and wealth.",
              "It does not prove that a specific policy caused a given affordability shift.",
              "Life expectancy, fertility, and marriage age are demographic context — not direct affordability measures.",
              "Health insurance premiums and long-run childcare costs are omitted where reliable national series are unavailable.",
            ],
          },
        ]}
      />

      {study?.concepts?.length ? <ConceptsUsed conceptKeys={[...study.concepts]} groupConceptsCoreFirst /> : null}

      <SourceInfo
        items={sourceItems}
        note="Primary macro series from FRED; health spending and life expectancy from World Bank WDI; public-university tuition, rent, marriage age, and appliances from reference anchors with interpolation. Household goods and new-vehicle prices are CPI-anchored estimates (see Sources & units)."
      />

      <InSimpleTerms>
        <p>
          This page compares several ways to ask whether everyday economic life became easier or harder to afford over
          time — not with a single verdict, but with separate charts for income, housing, higher education, healthcare,
          transportation, family formation, productivity, and hours of work.
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
