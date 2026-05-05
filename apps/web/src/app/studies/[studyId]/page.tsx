"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { StudyLanguageToggle } from "@/components/study-language-toggle";
import {
  mergeIranStudyDisplay,
  supportsIranStudyFa,
  L,
  type StudyLocale,
} from "@/lib/iran-study-fa";
import { IRAN_STUDY_FA_DISPLAY } from "@/lib/iran-study-fa-copy";
import { enEconomic, faEconomic } from "@/lib/signalmap-i18n/economic-terms";
import {
  IPC_OUTER_CHART_YEAR_MIN,
  IPC_PERIOD_COMPARISON_DEFAULT_OUTER_START,
  IPC_PRESET_CHIP,
  IPC_PRESET_UI_ORDER,
  IPC_PRESIDENT_PRESETS,
  type IpcPresidentPreset,
} from "@/lib/iran-economy-period-comparison-presets";
import {
  IRAN_IRAQ_WAR_MARK_AREA_FILL,
  IRAN_IRAQ_WAR_OVERLAY_ID,
  IRAN_IRAQ_WAR_SHADE_END_YEAR,
  IRAN_IRAQ_WAR_SHADE_START_YEAR,
  ipcOuterWarOverlayDefaultOn,
  type ChartPeriodOverlayBandInput,
} from "@/lib/iran-iraq-war-chart-overlay";
import {
  iranFxLevelsHasNonPositiveValuesInRange,
  iranFxLevelsSuggestLogDefaultInRange,
} from "@/lib/iran-fx-chart-log-default";
import { useHydrationSafeGregorianYear } from "@/lib/use-hydration-safe-gregorian-year";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart, type ChartSeries, type TimelineEvent as ChartTimelineEvent } from "@/components/timeline-chart";
import { StudyChartHeaderControlsShell } from "@/components/study-chart-header-controls-shell";
import { StudyChartExportFilenameProvider } from "@/components/study-chart-export-filename-context";
import { COUNTRY_COMPARATOR_STYLES } from "@/lib/chart-country-series-styles";
import { SourceInfo } from "@/components/source-info";
import { RealOilDescription } from "@/components/real-oil-description";
import { OilPppIranDescription } from "@/components/oil-ppp-iran-description";
import { LearningNote } from "@/components/learning-note";
import { DataObservations } from "@/components/data-observations";
import { ConceptsUsed } from "@/components/concepts-used";
import {
  PovertyHeadcountPppInfoTrigger,
  PovertyHeadcountPppMutedNote,
} from "@/components/poverty-chart-ppp-note";
import { ClientOnlyAfterMount } from "@/components/client-only-after-mount";
import { CurrentSnapshot } from "@/components/current-snapshot";
import { IranMoneySupplyMethodology } from "@/components/studies/iran-money-supply-methodology";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { StudyAiInterpretation } from "@/components/study-ai-interpretation";
import { IranEconomyPeriodComparisonPanels } from "@/components/studies/iran-economy-period-comparison-panels";
import { GdpDecompositionChartSkeleton } from "@/components/studies/gdp-decomposition-chart-ui";
import type { GdpDecompositionCoverage } from "@/lib/gdp-decomposition-coverage";
import { EventsTimeline, type TimelineEvent } from "@/components/events-timeline";
import { SignalMapBandTimeline } from "@/components/signalmap-band-timeline";
import {
  COMPARATIVE_HISTORY_BAND,
  COMPARATIVE_HISTORY_LANE_ORDER,
  COMPARATIVE_HISTORY_LAYER_UI,
} from "@/lib/signalmap-band-timeline";
import { SignalMapTimeline } from "@/components/signalmap-timeline";
import { FollowerGrowthChart } from "@/components/follower-growth-chart";
import { NetworkGraph, type NetworkNode, type NetworkEdge } from "@/components/network-graph";
import { OilTradeSankey } from "@/components/oil-trade-sankey";
import LatestValueBanner from "@/components/studies/LatestValueBanner";
import { MultiSeriesStats } from "@/components/studies/MultiSeriesStats";
import { YoutubeDiscourseMaps } from "@/components/studies/youtube-discourse";
import {
  getStudyById,
  getPrevNextStudies,
  isStudyListedForDeployment,
  studyUsesGlobalMacroOilLayer,
  YOUTUBE_DISCOURSE_VIDEOS_LIMIT,
  YOUTUBE_DISCOURSE_COMMENTS_PER_VIDEO,
  type StudyMeta,
} from "@/lib/studies";
import { iranGdpMacroEventsToTimeline } from "@/lib/gdp-composition-macro-events";
import {
  dutchDiseaseDiagnosticsLearningSections,
  gdpGlobalComparisonLearningSections,
  giniLearningSections,
  inflationLearningSections,
  isiDiagnosticsLearningSections,
  moneySupplyM2LearningSections,
  povertyLearningSections,
} from "@/lib/wdi-macro-studies-learning";
import { buildIranMacroDashboardInterpretation } from "@/lib/iran-macro-ai-interpretation";
import {
  buildPovertyHeadcountCoverageExtras,
  buildSparseWdiLineCoverageExtras,
} from "@/lib/poverty-chart-data-coverage";
import {
  ISI_COUNTRY_KEYS,
  type IsiCountryKey,
  type IsiDiagnosticsSeriesBundle,
  buildIsiGdpGrowthMultiSeries,
  buildIsiIndustrialMultiSeries,
  buildIsiOverviewIndexedSeries,
  buildIsiTradeStructureMultiSeries,
  isiCountryLabel,
} from "@/lib/isi-diagnostics-charts";
import {
  baseYearToIsoDate,
  indexGdpComparisonTo100Base2000,
  indexSeriesAtBaseYear,
  resolveIndexedBaseYear,
} from "@/lib/gdp-levels-indexed";
import {
  annualMeanPointsByGregorianYear,
  indexSeriesTo100,
  resolveCommonIndexBaseYear,
} from "@/lib/dutch-disease-overview-index";
import {
  buildOilEconomyIndexedMultiSeries,
  OIL_ECONOMY_COLOR_PRICE,
  OIL_ECONOMY_COLOR_PRODUCTION,
  OIL_ECONOMY_COLOR_REVENUE,
} from "@/lib/oil-economy-overview-charts";
import {
  buildOilEconomyExportSourceBody,
  oilEconomyIndexedExportTitle,
  oilEconomyIndexedPriceSeriesLabel,
  oilEconomyIndexedRevenueSeriesLabel,
  oilEconomyPanel1ChartLabel,
  oilEconomyPanel1ExportTitle,
  oilEconomyPriceSeriesLabel,
  oilEconomyPriceSeriesUnitForTicks,
  oilEconomyPriceYAxisName,
  oilEconomyRevenueLineLegendLabel,
  oilEconomyRevenueSeriesUnitForTicks,
  oilEconomyRevenueTitle,
  oilEconomyRevenueYAxisName,
  resolveOilEconomyCpiBaseYear,
} from "@/lib/oil-economy-labels";
import { SIGNAL_CONCEPT, SIGNAL_COUNTRY } from "@/lib/signalmap-chart-colors";
import { fetchJson } from "@/lib/api";
import { enrichOilPointsWithVolatility } from "@/lib/oil-volatility";
import { filterForNetwork, filterForSankey } from "@/lib/oil-trade-network-filter";
import {
  CANONICAL_EXPORTER_ORDER,
  CANONICAL_IMPORTER_ORDER,
  CANONICAL_NETWORK_ORDER,
  EXPORTER_ALIASES,
  IMPORTER_ALIASES,
  orderForColors,
  orderWithCanonical,
  toDisplayName,
} from "@/lib/oil-trade-regions";
import { joinExportSourceNames } from "@/lib/chart-export";
import { TIMELINE_CHART_MOBILE_HEIGHT_PREFIX } from "@/lib/chart-study-typography";
import { normalizeChartRangeBound, toYearInputMinMax, yearDraftFromBoundIso } from "@/lib/chart-study-range";
import { CHART_LINE_SYMBOL_SIZE, CHART_LINE_SYMBOL_SIZE_MINI } from "@/lib/chart-series-markers";
import {
  isStudyEventLayerVisible,
  studyEventLayersForFetch,
  type StudyEventLayerToggleState,
} from "@/lib/study-event-layer-toggles";
import { withTimeSeriesEventOverlay } from "@/lib/time-series-event-overlay";
import { downsampleFxOpenForDisplay } from "@/lib/time-series-lttb";
import { NominalRealToggle } from "@/components/nominal-real-toggle";
import { deflateNominalUsdPointsWithUsCpi, USD_CPI_REAL_BASE_YEAR } from "@/lib/usd-cpi-deflate";
import { trackEvent } from "@/lib/analytics";
import { formatStatDate, decodeHtmlEntities } from "@/lib/utils";
import {
  formatChartCategoryAxisYearLabel,
  formatChartYearBothInlineCompact,
  type ChartAxisYearMode,
} from "@/lib/chart-axis-year";
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";
import { formatChartAxisNumber } from "@/lib/format-compact-decimal";
import { StudyYearDisplayToggle } from "@/components/study-year-display-toggle";
import { useIranStudyChartYearMode } from "@/hooks/use-iran-study-chart-year-mode";

type OverviewData = {
  study_id: string;
  study_title: string;
  time_range: [string, string];
  kpis: Array<{ label: string; value: string | number; unit?: string | null }>;
  timeline: Array<{ date: string; value: number }>;
  anchor_event_id?: string | null;
  window_days?: number | null;
  window_range?: [string, string];
};

type Event = {
  id: string;
  title: string;
  title_fa?: string;
  date?: string;
  date_start?: string;
  date_end?: string;
  type?: string;
  description?: string;
  description_fa?: string;
  confidence?: string;
  sources?: string[];
  layer?:
    | "iran_core"
    | "world_core"
    | "world_1900"
    | "sanctions"
    | "iran_presidents"
    | "opec_decisions"
    | "global_macro_oil";
  scope?: "iran" | "world" | "sanctions" | "oil_exports";
  category?: string;
  chartLabel?: string;
};

type EventsData = {
  study_id: string;
  events: Event[];
};

type OilSource = {
  name: string;
  series_id: string;
  publisher: string;
  url: string;
};

type OilSignalData = {
  signal: string;
  unit: string;
  source: OilSource;
  points: Array<{ date: string; value: number }>;
  resolution_change?: string;
  source_annual?: OilSource;
  source_daily?: OilSource;
};

type FxUsdTomanSource = {
  name: string;
  publisher: string;
  type: string;
  url: string;
  notes?: string;
};

type FxUsdTomanSignalData = {
  signal: string;
  unit: string;
  source: FxUsdTomanSource;
  points: Array<{ date: string; value: number }>;
  /** WDI FCRF (+ FRED backfill) annual; same chart, dashed. */
  official_annual?: Array<{ date: string; value: number }>;
  official_source?: FxUsdTomanSource;
};

type RealOilSignalData = {
  signal: string;
  unit: string;
  source: { oil: string; cpi: string };
  metadata?: { base_year?: number; base_month?: string; formula?: string };
  points: Array<{ date: string; value: number }>;
};

type OilPppIranSignalData = {
  signal: string;
  unit: string;
  country: string;
  source: { oil: string; ppp: string };
  resolution: string;
  points: Array<{ date: string; value: number }>;
};

type OilEconomyOverviewSource = { name: string; publisher?: string; url?: string; notes?: string };
type OilEconomyInflationBlock = {
  deflator: string;
  deflator_name?: string;
  base_year: number;
  source?: { name: string; url?: string; publisher?: string };
};

type OilEconomyOverviewApi = {
  country: string;
  production: {
    unit: string;
    source: OilEconomyOverviewSource;
    source_historical_fill?: OilEconomyOverviewSource;
    metadata?: { earliest_year_achievable?: number; earliest_year_in_range?: number | null };
    points: Array<{ date: string; value: number }>;
  };
  price: {
    unit: string;
    source: OilEconomyOverviewSource;
    methodology?: { pre_1987?: string; brent_1987_plus?: string };
    points: Array<{ date: string; value: number }>;
  };
  revenue: {
    unit: string;
    source: OilEconomyOverviewSource;
    points: Array<{ date: string; value: number }>;
    methodology?: { formula?: string; note?: string };
  };
  inflation?: OilEconomyInflationBlock;
  price_real?: {
    unit: string;
    base_year: number;
    source: OilEconomyOverviewSource;
    cpi?: { name: string; url?: string };
    points: Array<{ date: string; value: number }>;
  };
  revenue_real?: {
    unit: string;
    base_year: number;
    source: OilEconomyOverviewSource;
    points: Array<{ date: string; value: number }>;
  };
};

const WINDOW_OPTIONS = [
  { value: 1, label: "±1 year" },
  { value: 2, label: "±2 years" },
  { value: 5, label: "±5 years" },
] as const;

const WINDOW_OPTIONS_FX = [
  { value: 7, label: "±1 week" },
  { value: 30, label: "±1 month" },
  { value: 365, label: "±1 year" },
] as const;

const WINDOW_OPTIONS_LONG_RANGE = [
  { value: 2, label: "±2 years" },
  { value: 5, label: "±5 years" },
  { value: 10, label: "±10 years" },
] as const;

const GEOPOLITICAL_WINDOW_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

function computeWindowRange(eventDate: string, windowYears: number): [string, string] {
  const d = new Date(eventDate);
  const start = new Date(d);
  start.setFullYear(start.getFullYear() - windowYears);
  const end = new Date(d);
  end.setFullYear(end.getFullYear() + windowYears);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function computeWindowRangeDays(eventDate: string, windowDays: number): [string, string] {
  const d = new Date(eventDate);
  const start = new Date(d);
  start.setDate(start.getDate() - windowDays);
  const end = new Date(d);
  end.setDate(end.getDate() + windowDays);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function computeOilKpis(points: { date?: string; value: number }[]) {
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const sorted = [...points].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const latest = sorted[sorted.length - 1]?.value ?? null;
  const latestDate = sorted[sorted.length - 1]?.date ?? null;
  const minPoint = points.find((p) => p.value === min);
  const maxPoint = points.find((p) => p.value === max);
  return {
    latest,
    latestDate: latestDate ?? undefined,
    avg: Math.round(avg),
    min: Math.round(min),
    minDate: minPoint?.date ?? undefined,
    max: Math.round(max),
    maxDate: maxPoint?.date ?? undefined,
  };
}

function computeFxKpis(points: { date: string; value: number }[]) {
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]?.value ?? null;
  const latestDate = sorted[sorted.length - 1]?.date ?? null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const minPoint = points.find((p) => p.value === min);
  const maxPoint = points.find((p) => p.value === max);
  return {
    latest,
    latestDate,
    avg,
    min,
    max,
    minDate: minPoint?.date ?? null,
    maxDate: maxPoint?.date ?? null,
  };
}

/** Renders a stat value with the same k/M/B format as chart axes. */
function CompactStatValue({
  value,
  unit,
  prefix = "",
  chartLocale = "en",
}: {
  value: number | null;
  unit: string;
  prefix?: string;
  /** Same as chart: Persian numerals and Farsi unit words when Farsi. */
  chartLocale?: "en" | "fa";
}) {
  if (value === null || value === undefined) return <>—</>;
  const exactStr = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const displayStr = formatChartAxisNumber(value, chartLocale);
  const title = unit ? `${exactStr} ${unit}` : exactStr;
  return (
    <span title={localizeChartNumericDisplayString(title, chartLocale === "fa" ? "fa" : "en")}>
      {prefix}
      {localizeChartNumericDisplayString(displayStr, chartLocale === "fa" ? "fa" : "en")}
    </span>
  );
}

/** Renders stat value with optional date below (for Latest, Min, Max). Single-series always shows dates (1 signal ≤ 3). */
function StatValueWithDate({
  value,
  unit,
  prefix = "",
  date,
  chartLocale = "en",
}: {
  value: number | null;
  unit: string;
  prefix?: string;
  date?: string | null;
  chartLocale?: "en" | "fa";
}) {
  return (
    <div>
      <p className="metric-value text-foreground">
        <CompactStatValue value={value} unit={unit} prefix={prefix} chartLocale={chartLocale} />
      </p>
      {date && (
        <p className="metric-label mt-0.5">{formatStatDate(date)}</p>
      )}
    </div>
  );
}

function getLatestDate(arrays: { date: string }[][]): Date | null {
  const dates = arrays
    .flat()
    .map((p) => new Date(p.date))
    .filter((d) => !isNaN(d.getTime()));

  if (dates.length === 0) return null;

  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Publisher line(s) for PNG export (no prefix); `formatStudyExportSourceLine` always adds English `Source:`. */
function studyChartExportSource(_isFa: boolean, parts: Array<string | null | undefined>): string | undefined {
  return joinExportSourceNames(parts);
}

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.studyId as string;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const studyRaw = getStudyById(studyId);
  const study = studyRaw && isStudyListedForDeployment(studyRaw) ? studyRaw : undefined;
  const faEligible = supportsIranStudyFa(studyId);
  const [studyLocale, setStudyLocale] = useState<StudyLocale>("en");
  const isFa = faEligible && studyLocale === "fa";
  const displayStudy = useMemo((): StudyMeta => {
    if (!study) return {} as StudyMeta;
    return mergeIranStudyDisplay(study, studyId, isFa);
  }, [study, studyId, isFa]);
  const chartLocaleForCharts = faEligible ? (isFa ? ("fa" as const) : ("en" as const)) : undefined;
  const statChartLocale: "en" | "fa" = faEligible && isFa ? "fa" : "en";
  /** Same on SSR and first client paint; avoids `<input max={year}>` hydration drift vs `Date`. */
  const ipcGregorianYear = useHydrationSafeGregorianYear();
  const { yearAxisMode, setYearAxisMode } = useIranStudyChartYearMode();
  /** Year calendar mode from shared toggle whenever study supports Iran FA UI (EN + FA). */
  const chartYearAxisLabel = faEligible ? yearAxisMode : undefined;
  const faRich = IRAN_STUDY_FA_DISPLAY[studyId];
  const [showAllSignalMapImportance, setShowAllSignalMapImportance] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [events, setEvents] = useState<EventsData["events"]>([]);
  const [anchorEventId, setAnchorEventId] = useState<string>("");
  const [windowYears, setWindowYears] = useState<number>(2);
  const [geopoliticalWindowDays, setGeopoliticalWindowDays] = useState<number>(30);
  const [showOil, setShowOil] = useState(false);
  const [showGold, setShowGold] = useState(false);
  const [showIranEvents, setShowIranEvents] = useState(false);
  const [showWorldEvents, setShowWorldEvents] = useState(false);
  const [showSanctionsEvents, setShowSanctionsEvents] = useState(false);
  const [showPresidentialTerms, setShowPresidentialTerms] = useState(false);
  const [showOpecEvents, setShowOpecEvents] = useState(false);
  const [showGeopoliticalWorldCore, setShowGeopoliticalWorldCore] = useState(false);
  const [showGeopoliticalWorld1900, setShowGeopoliticalWorld1900] = useState(false);
  const [showGeopoliticalSanctions, setShowGeopoliticalSanctions] = useState(false);
  const [showGeopoliticalOpec, setShowGeopoliticalOpec] = useState(false);
  /** Curated global oil / macro vertical markers (layer ``global_macro_oil``). */
  const [showGlobalMacroOil, setShowGlobalMacroOil] = useState(false);
  /** Master time-series event overlay: default off; sub-layer checkboxes apply only when on. */
  const [showTimeSeriesEventOverlay, setShowTimeSeriesEventOverlay] = useState(false);
  const [pppYAxisLog, setPppYAxisLog] = useState(true);
  /** USD→Toman: linear by default; optional `?log=1` in URL. */
  const [fxUsdTomanYAxisLog, setFxUsdTomanYAxisLog] = useState(false);
  const [showSanctionsPeriods, setShowSanctionsPeriods] = useState(false);
  const [showShocks, setShowShocks] = useState(true);
  /** Brent / global oil: story = major vertical markers only; data = all toggled point events on the chart. */
  const [oilEventStoryMode, setOilEventStoryMode] = useState(true);
  const [oilPoints, setOilPoints] = useState<OilSignalData["points"]>([]);
  const [oilSource, setOilSource] = useState<OilSource | null>(null);
  const [oilSourceAnnual, setOilSourceAnnual] = useState<OilSource | null>(null);
  const [oilResolutionNote, setOilResolutionNote] = useState<string | null>(null);
  const [goldPoints, setGoldPoints] = useState<OilSignalData["points"]>([]);
  const [goldSource, setGoldSource] = useState<OilSource | null>(null);
  const [fxPoints, setFxPoints] = useState<FxUsdTomanSignalData["points"]>([]);
  const [fxSource, setFxSource] = useState<FxUsdTomanSource | null>(null);
  const [fxOfficialPoints, setFxOfficialPoints] = useState<FxUsdTomanSignalData["points"]>([]);
  const [fxOfficialSource, setFxOfficialSource] = useState<FxUsdTomanSource | null>(null);
  const [realOilPoints, setRealOilPoints] = useState<RealOilSignalData["points"]>([]);
  const [realOilSource, setRealOilSource] = useState<RealOilSignalData["source"] | null>(null);
  const [realOilMetadata, setRealOilMetadata] = useState<RealOilSignalData["metadata"] | null>(null);
  const [pppIranPoints, setPppIranPoints] = useState<OilPppIranSignalData["points"]>([]);
  const [pppIranSource, setPppIranSource] = useState<OilPppIranSignalData["source"] | null>(null);
  const [pppTurkeyPoints, setPppTurkeyPoints] = useState<OilPppIranSignalData["points"]>([]);
  const [pppTurkeySource, setPppTurkeySource] = useState<OilPppIranSignalData["source"] | null>(null);
  const [pppIranLoading, setPppIranLoading] = useState(false);
  const [pppIranError, setPppIranError] = useState<string | null>(null);
  const [exportCapacityOilPoints, setExportCapacityOilPoints] = useState<{ date: string; value: number }[]>([]);
  const [exportCapacityProxyPoints, setExportCapacityProxyPoints] = useState<{ date: string; value: number }[]>([]);
  const [exportCapacityBaseYear, setExportCapacityBaseYear] = useState<number | null>(null);
  const [oilEconomyProdPoints, setOilEconomyProdPoints] = useState<{ date: string; value: number }[]>([]);
  const [oilEconomyPricePoints, setOilEconomyPricePoints] = useState<{ date: string; value: number }[]>([]);
  const [oilEconomyRevenuePoints, setOilEconomyRevenuePoints] = useState<{ date: string; value: number }[]>([]);
  const [oilEconomyProdSource, setOilEconomyProdSource] = useState<OilEconomyOverviewSource | null>(null);
  const [oilEconomyPriceSource, setOilEconomyPriceSource] = useState<OilEconomyOverviewSource | null>(null);
  const [oilEconomyRevenueSource, setOilEconomyRevenueSource] = useState<OilEconomyOverviewSource | null>(null);
  const [oilEconomyProdHistoricalFill, setOilEconomyProdHistoricalFill] = useState<OilEconomyOverviewSource | null>(null);
  /** When set, narrows the three oil-economy charts and indexed view (Export PNG uses the same timeRange). */
  const [oilEconomyViewStart, setOilEconomyViewStart] = useState("");
  const [oilEconomyViewEnd, setOilEconomyViewEnd] = useState("");
  const [oilEconomyStartYearDraft, setOilEconomyStartYearDraft] = useState("");
  const [oilEconomyEndYearDraft, setOilEconomyEndYearDraft] = useState("");
  const oilEconomyStartYearFocusRef = useRef(false);
  const oilEconomyEndYearFocusRef = useRef(false);
  const [oilEconomyPriceRealPoints, setOilEconomyPriceRealPoints] = useState<{ date: string; value: number }[]>([]);
  const [oilEconomyRevenueRealPoints, setOilEconomyRevenueRealPoints] = useState<{ date: string; value: number }[]>([]);
  const [oilEconomyInflation, setOilEconomyInflation] = useState<OilEconomyInflationBlock | null>(null);
  const [oilEconomyUsdMode, setOilEconomyUsdMode] = useState<"nominal" | "real">("real");
  /** Nominal vs US-CPI real USD for eligible monetary charts (default: real). */
  const [monetarySeriesMode, setMonetarySeriesMode] = useState<"nominal" | "real">("real");
  const [usCpiMonthlyPoints, setUsCpiMonthlyPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionUsPoints, setProductionUsPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionSaudiPoints, setProductionSaudiPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionRussiaPoints, setProductionRussiaPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionIranPoints, setProductionIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionTotalPoints, setProductionTotalPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionSource, setProductionSource] = useState<{ name: string; url?: string; publisher?: string } | null>(null);
  const [giniIranPoints, setGiniIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniUsPoints, setGiniUsPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniGermanyPoints, setGiniGermanyPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniTurkeyPoints, setGiniTurkeyPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniChinaPoints, setGiniChinaPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniSaudiArabiaPoints, setGiniSaudiArabiaPoints] = useState<{ date: string; value: number }[]>([]);
  const [giniSource, setGiniSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [giniWdiLoading, setGiniWdiLoading] = useState(false);
  const [giniLoadFailed, setGiniLoadFailed] = useState(false);
  const [giniLoadDetail, setGiniLoadDetail] = useState<string | null>(null);
  const [giniSeriesWarnings, setGiniSeriesWarnings] = useState<Record<string, string> | null>(null);
  const [inflationIranPoints, setInflationIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationUsPoints, setInflationUsPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationGermanyPoints, setInflationGermanyPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationTurkeyPoints, setInflationTurkeyPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationChinaPoints, setInflationChinaPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationSaudiArabiaPoints, setInflationSaudiArabiaPoints] = useState<{ date: string; value: number }[]>([]);
  const [inflationSource, setInflationSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [inflationWdiLoading, setInflationWdiLoading] = useState(false);
  const [inflationLoadFailed, setInflationLoadFailed] = useState(false);
  const [inflationLoadDetail, setInflationLoadDetail] = useState<string | null>(null);
  const [inflationSeriesWarnings, setInflationSeriesWarnings] = useState<Record<string, string> | null>(null);
  const [gdpGlobalUnitedStatesPoints, setGdpGlobalUnitedStatesPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalChinaPoints, setGdpGlobalChinaPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalIranPoints, setGdpGlobalIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalTurkeyPoints, setGdpGlobalTurkeyPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalSaudiArabiaPoints, setGdpGlobalSaudiArabiaPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalWorldPoints, setGdpGlobalWorldPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpGlobalSource, setGdpGlobalSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [gdpGlobalPerCountryBasis, setGdpGlobalPerCountryBasis] = useState<Record<string, string> | null>(null);
  const [gdpGlobalPerCountryIndicatorId, setGdpGlobalPerCountryIndicatorId] = useState<Record<string, string> | null>(
    null
  );
  const [gdpGlobalDisplayMode, setGdpGlobalDisplayMode] = useState<"absolute" | "indexed">("indexed");
  const [gdpGlobalAbsoluteLog, setGdpGlobalAbsoluteLog] = useState(false);
  const [gdpGlobalWdiLoading, setGdpGlobalWdiLoading] = useState(false);
  const [gdpGlobalLoadFailed, setGdpGlobalLoadFailed] = useState(false);
  const [gdpGlobalLoadDetail, setGdpGlobalLoadDetail] = useState<string | null>(null);
  const [gdpGlobalSeriesWarnings, setGdpGlobalSeriesWarnings] = useState<Record<string, string> | null>(null);
  const [isiDiagnosticsData, setIsiDiagnosticsData] = useState<{
    series: IsiDiagnosticsSeriesBundle;
    source?: { name?: string; url?: string; publisher?: string };
    indicator_ids?: Record<string, string>;
  } | null>(null);
  const [isiFocusCountry, setIsiFocusCountry] = useState<IsiCountryKey>("brazil");
  const [isiWdiLoading, setIsiWdiLoading] = useState(false);
  const [isiLoadFailed, setIsiLoadFailed] = useState(false);
  const [isiLoadDetail, setIsiLoadDetail] = useState<string | null>(null);
  const [isiSeriesWarnings, setIsiSeriesWarnings] = useState<Record<string, string> | null>(null);
  const [povertyDdayPoints, setPovertyDdayPoints] = useState<{ date: string; value: number }[]>([]);
  const [povertyLmicPoints, setPovertyLmicPoints] = useState<{ date: string; value: number }[]>([]);
  const [povertyDdayLineLabel, setPovertyDdayLineLabel] = useState("");
  const [povertyLmicLineLabel, setPovertyLmicLineLabel] = useState("");
  const [povertyDdayIndicatorId, setPovertyDdayIndicatorId] = useState("");
  const [povertyLmicIndicatorId, setPovertyLmicIndicatorId] = useState("");
  const [povertySource, setPovertySource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [povertyWdiLoading, setPovertyWdiLoading] = useState(false);
  const [povertyLoadFailed, setPovertyLoadFailed] = useState(false);
  const [povertyLoadDetail, setPovertyLoadDetail] = useState<string | null>(null);
  const [moneySupplyM2Points, setMoneySupplyM2Points] = useState<{ date: string; value: number }[]>([]);
  const [moneySupplyCpiPoints, setMoneySupplyCpiPoints] = useState<{ date: string; value: number }[]>([]);
  const [moneySupplyWdiSource, setMoneySupplyWdiSource] = useState<{
    name?: string;
    url?: string;
    publisher?: string;
  } | null>(null);
  const [moneySupplyCitation, setMoneySupplyCitation] = useState<{ en: string; fa: string } | null>(null);
  const [moneySupplyCoverage, setMoneySupplyCoverage] = useState<{
    broad_money: { first_year: number; last_year: number } | null;
    broad_money_wdi?: { first_year: number; last_year: number } | null;
    broad_money_cbi_liquidity_yoy?: { first_year: number; last_year: number } | null;
    cpi_inflation_iran: { first_year: number; last_year: number } | null;
  } | null>(null);
  const [moneySupplyIndicatorIds, setMoneySupplyIndicatorIds] = useState<{
    broad_money_growth: string;
    cpi_inflation_yoy_iran: string;
  } | null>(null);
  const [moneySupplyWdiLoading, setMoneySupplyWdiLoading] = useState(false);
  const [moneySupplyLoadFailed, setMoneySupplyLoadFailed] = useState(false);
  const [moneySupplyLoadDetail, setMoneySupplyLoadDetail] = useState<string | null>(null);
  const [dutchOilRentsPoints, setDutchOilRentsPoints] = useState<{ date: string; value: number }[]>([]);
  const [dutchNaturalGasRentsPoints, setDutchNaturalGasRentsPoints] = useState<{ date: string; value: number }[]>([]);
  const [dutchManufacturingPoints, setDutchManufacturingPoints] = useState<{ date: string; value: number }[]>([]);
  const [dutchImportsPoints, setDutchImportsPoints] = useState<{ date: string; value: number }[]>([]);
  const [dutchWdiSource, setDutchWdiSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [dutchWdiLoading, setDutchWdiLoading] = useState(false);
  /** Friendly shell message when fetch fails or all series empty; see ``dutchWdiLoadDetail`` for technical text. */
  const [dutchWdiLoadFailed, setDutchWdiLoadFailed] = useState(false);
  const [dutchWdiLoadDetail, setDutchWdiLoadDetail] = useState<string | null>(null);
  const [dutchWdiSeriesWarnings, setDutchWdiSeriesWarnings] = useState<Record<string, string> | null>(null);
  const [dutchFxPoints, setDutchFxPoints] = useState<{ date: string; value: number }[]>([]);
  const [dutchFxSource, setDutchFxSource] = useState<FxUsdTomanSource | null>(null);
  /** Iran reconstruction dashboard (1368–1376 SH): parallel WDI / FX panels. */
  const [recoInflationIranPoints, setRecoInflationIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoInflationSource, setRecoInflationSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(
    null
  );
  const [recoGdpGrowthPoints, setRecoGdpGrowthPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoImportsPoints, setRecoImportsPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoExportsPoints, setRecoExportsPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoManufacturingPoints, setRecoManufacturingPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoIndustryPoints, setRecoIndustryPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoIsiSource, setRecoIsiSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [recoIsiIndicatorIds, setRecoIsiIndicatorIds] = useState<Record<string, string> | null>(null);
  const [recoOilRentsPoints, setRecoOilRentsPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoNaturalGasRentsPoints, setRecoNaturalGasRentsPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoDutchSource, setRecoDutchSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(null);
  const [recoM2Points, setRecoM2Points] = useState<{ date: string; value: number }[]>([]);
  const [recoM2CpiPoints, setRecoM2CpiPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoMoneyWdiSource, setRecoMoneyWdiSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(
    null
  );
  const [recoMoneyCitation, setRecoMoneyCitation] = useState<{ en: string; fa: string } | null>(null);
  const [recoMoneyIndicatorIds, setRecoMoneyIndicatorIds] = useState<{
    broad_money_growth: string;
    cpi_inflation_yoy_iran: string;
  } | null>(null);
  const [recoFxOfficialPoints, setRecoFxOfficialPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoFxOpenPoints, setRecoFxOpenPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoFxOfficialSource, setRecoFxOfficialSource] = useState<FxUsdTomanSource | null>(null);
  const [recoFxOpenSource, setRecoFxOpenSource] = useState<FxUsdTomanSource | null>(null);
  const [recoDemandConsumptionPoints, setRecoDemandConsumptionPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoDemandInvestmentPoints, setRecoDemandInvestmentPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoDemandGdpPoints, setRecoDemandGdpPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoGdpDecompNonOilPoints, setRecoGdpDecompNonOilPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoGdpDecompOilPoints, setRecoGdpDecompOilPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoGdpDecompCoverage, setRecoGdpDecompCoverage] = useState<GdpDecompositionCoverage | null>(null);
  const [recoDemandNominalSource, setRecoDemandNominalSource] = useState<{
    name?: string;
    url?: string;
    publisher?: string;
  } | null>(null);
  const [recoDemandIndicatorIds, setRecoDemandIndicatorIds] = useState<Record<string, string> | null>(null);
  const [recoDemandRealConsumptionPoints, setRecoDemandRealConsumptionPoints] = useState<{ date: string; value: number }[]>(
    []
  );
  const [recoDemandRealInvestmentPoints, setRecoDemandRealInvestmentPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoDemandRealGdpPoints, setRecoDemandRealGdpPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoGdpDecompMode, setRecoGdpDecompMode] = useState<"nominal" | "real">("real");
  const [recoDemandMode, setRecoDemandMode] = useState<"nominal" | "real">("real");
  /** Iran economy macro dashboards: welfare (Gini + poverty), same fetch window as other reco panels. */
  const [recoWelfareGiniIranPoints, setRecoWelfareGiniIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoWelfareGiniSource, setRecoWelfareGiniSource] = useState<{ name?: string; url?: string; publisher?: string } | null>(
    null
  );
  const [recoWelfareGiniIndicatorId, setRecoWelfareGiniIndicatorId] = useState("");
  const [recoWelfarePovertyDdayPoints, setRecoWelfarePovertyDdayPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoWelfarePovertyLmicPoints, setRecoWelfarePovertyLmicPoints] = useState<{ date: string; value: number }[]>([]);
  const [recoWelfarePovertyDdayShort, setRecoWelfarePovertyDdayShort] = useState("");
  const [recoWelfarePovertyLmicShort, setRecoWelfarePovertyLmicShort] = useState("");
  const [recoWelfarePovertyDdayTitle, setRecoWelfarePovertyDdayTitle] = useState("");
  const [recoWelfarePovertyLmicTitle, setRecoWelfarePovertyLmicTitle] = useState("");
  const [recoWelfarePovertySource, setRecoWelfarePovertySource] = useState<{
    name?: string;
    url?: string;
    publisher?: string;
  } | null>(null);
  const [recoWelfarePovertyDdayId, setRecoWelfarePovertyDdayId] = useState("");
  const [recoWelfarePovertyLmicId, setRecoWelfarePovertyLmicId] = useState("");
  /** Iran economy macro dashboards: log y-axis for official vs open FX levels chart only. */
  const [iranEconomyFxLevelsLogScale, setIranEconomyFxLevelsLogScale] = useState(false);
  const iranFxLogDefaultAppliedRef = useRef(false);
  const iranFxLogDataKeyRef = useRef("");
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoLoadFailed, setRecoLoadFailed] = useState(false);
  const [recoLoadDetail, setRecoLoadDetail] = useState<string | null>(null);
  /** Iran economy period-comparison study: outer/focus Gregorian years + band labels (EN/FA for regimeArea). */
  const [ipcOuterStartYear, setIpcOuterStartYear] = useState(IPC_PERIOD_COMPARISON_DEFAULT_OUTER_START);
  const [ipcOuterEndYear, setIpcOuterEndYear] = useState(ipcGregorianYear);
  const [ipcFocusStartYear, setIpcFocusStartYear] = useState(1989);
  const [ipcFocusEndYear, setIpcFocusEndYear] = useState(1997);
  const [ipcBandLabelEn, setIpcBandLabelEn] = useState(IPC_PRESIDENT_PRESETS.rafsanjani.labelEn);
  const [ipcBandLabelFa, setIpcBandLabelFa] = useState(IPC_PRESIDENT_PRESETS.rafsanjani.labelFa);
  const [ipcPresetId, setIpcPresetId] = useState<IpcPresidentPreset | "custom">("rafsanjani");
  const [ipcWageNominalPoints, setIpcWageNominalPoints] = useState<{ date: string; value: number }[]>([]);
  const [ipcWageCpiPoints, setIpcWageCpiPoints] = useState<{ date: string; value: number }[]>([]);
  const [ipcWageBaseYear, setIpcWageBaseYear] = useState<number | null>(null);
  const [ipcWageSource, setIpcWageSource] = useState<{ nominal: string; cpi: string } | null>(null);
  const [ipcWageLoadFailed, setIpcWageLoadFailed] = useState(false);
  const [fxDualOfficialPoints, setFxDualOfficialPoints] = useState<{ date: string; value: number }[]>([]);
  const [fxDualOpenPoints, setFxDualOpenPoints] = useState<{ date: string; value: number }[]>([]);
  const [fxDualOfficialSource, setFxDualOfficialSource] = useState<FxUsdTomanSource | null>(null);
  const [fxDualOpenSource, setFxDualOpenSource] = useState<FxUsdTomanSource | null>(null);
  const [showFxSpread, setShowFxSpread] = useState(false);
  /** Iran FX regime study: overlay official WDI annual rate (default off — open market only). */
  const [fxRegimeShowOfficial, setFxRegimeShowOfficial] = useState(false);
  const [wageNominalPoints, setWageNominalPoints] = useState<{ date: string; value: number }[]>([]);
  const [wageCpiPoints, setWageCpiPoints] = useState<{ date: string; value: number }[]>([]);
  const [wageBaseYear, setWageBaseYear] = useState<number | null>(null);
  const [wageSource, setWageSource] = useState<{ nominal: string; cpi: string } | null>(null);
  const [showWageIndex, setShowWageIndex] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fgPlatform, setFgPlatform] = useState<"twitter" | "instagram" | "youtube">("twitter");
  const [fgUsername, setFgUsername] = useState("");
  const [fgData, setFgData] = useState<{
    snapshots?: { timestamp: string; followers?: number | null }[];
    results?: { timestamp: string; followers?: number | null; subscribers?: number | null }[];
    source?: string;
    meta?: { cache_hit?: boolean; cache_rows?: number; wayback_calls?: number; last_cached_at?: string | null };
  } | null>(null);
  const [fgLoading, setFgLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fgError, setFgError] = useState<string | null>(null);
  const [fgShowLinear, setFgShowLinear] = useState(true);
  const [fgShowExponential, setFgShowExponential] = useState(true);
  const [fgShowLogistic, setFgShowLogistic] = useState(true);
  const [networkYearsData, setNetworkYearsData] = useState<Record<string, NetworkEdge[]>>({});
  const [networkSelectedYear, setNetworkSelectedYear] = useState<string>("");
  const [oilTradeView, setOilTradeView] = useState<"network" | "sankey">("network");
  const [oilTradeSource, setOilTradeSource] = useState<"curated" | "db">("curated");
  const [exporterCuratedData, setExporterCuratedData] = useState<{
    saudi: { date: string; value: number }[];
    russia: { date: string; value: number }[];
    us: { date: string; value: number }[];
    iran: { date: string; value: number }[];
  } | null>(null);
  const [exporterDbData, setExporterDbData] = useState<{
    saudi: { date: string; value: number }[];
    russia: { date: string; value: number }[];
    us: { date: string; value: number }[];
    iran: { date: string; value: number }[];
  } | null>(null);
  const [exporterYMin, setExporterYMin] = useState<number | undefined>(undefined);
  const [exporterYMax, setExporterYMax] = useState<number | undefined>(undefined);
  const [exporterSource, setExporterSource] = useState<"curated" | "db">("db");
  const [gdpConsumptionPoints, setGdpConsumptionPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpInvestmentPoints, setGdpInvestmentPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpNominalPoints, setGdpNominalPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpCompositionSource, setGdpCompositionSource] = useState<{ name?: string; publisher?: string; url?: string } | null>(null);
  const [showGdpIranEvents, setShowGdpIranEvents] = useState(false);
  const [showGdpMacroEvents, setShowGdpMacroEvents] = useState(false);
  /** World curated anchors on GDP charts (off by default to keep Iran + WDI macro as default). */
  const [showGdpGlobalMacroOil, setShowGdpGlobalMacroOil] = useState(false);
  const [gdpDataSpan, setGdpDataSpan] = useState<{
    first_year_any?: number | null;
    last_year_any?: number | null;
    returned_start_year?: number | null;
    returned_end_year?: number | null;
    per_series?: Record<string, { first_year?: number | null; last_year?: number | null }>;
  } | null>(null);
  const [gdpLevelConsumptionPoints, setGdpLevelConsumptionPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpLevelGdpPoints, setGdpLevelGdpPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpLevelInvestmentPoints, setGdpLevelInvestmentPoints] = useState<{ date: string; value: number }[]>([]);
  const [gdpLevelsUnit, setGdpLevelsUnit] = useState<string | null>(null);
  const [gdpStudyView, setGdpStudyView] = useState<"composition" | "levels">("composition");
  /** Optional reference-style dual-axis levels chart (consumption + investment left; GDP right). */
  const [gdpLevelsValueType, setGdpLevelsValueType] = useState<"real" | "usd" | "toman">("real");
  /** Display-only: levels chart as raw units vs indexed to first common year (each series ÷ its value that year). */
  const [gdpLevelsDisplayMode, setGdpLevelsDisplayMode] = useState<"absolute" | "indexed">("absolute");
  const [gdpLevelsDisplayNote, setGdpLevelsDisplayNote] = useState<string | null>(null);
  const [gdpLevelsConversionMeta, setGdpLevelsConversionMeta] = useState<{
    currency?: string;
    basis?: string;
    description?: string;
    display_unit?: string;
  } | null>(null);
  const [fgMetadata, setFgMetadata] = useState<{
    source?: "cache" | "live" | "mixed";
    count?: number;
    last_cached_at?: string | null;
  } | null>(null);
  const [analysisData, setAnalysisData] = useState<{
    channel_id: string;
    channel_name?: string | null;
    channel_owner?: string | null;
    channel_title?: string | null;
    videos_analyzed: number;
    comments_analyzed?: number;
    computed_at?: string | null;
    videos?: Array<{ title: string; published_at: string; video_id: string }>;
    total_comments: number;
    time_range?: { start?: string; end?: string };
    time_period_start?: string | null;
    time_period_end?: string | null;
    language?: string | null;
    avg_sentiment: number;
    top_words: [string, number][];
    keywords?: [string, number][];
    narrative_phrases?: [string, number][];
    topics?: [string, number][];
    discourse_comments?: string[];
    points_pca?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
    points_umap?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
    points_tfidf?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
    points_hdbscan?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
    points_minilm?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
    cluster_labels?: Array<{ x: number; y: number; label: string }>;
    cluster_labels_pca?: Array<{ x: number; y: number; label: string }>;
    cluster_labels_tfidf?: Array<{ x: number; y: number; label: string }>;
    cluster_labels_hdbscan?: Array<{ x: number; y: number; label: string }>;
    cluster_labels_minilm?: Array<{ x: number; y: number; label: string }>;
    cluster_stats_pca?: { clusters: number; noise_count: number; total: number };
      cluster_stats_tfidf?: { clusters: number; noise_count: number; total: number };
      cluster_stats_hdbscan?: { clusters: number; noise_count: number; total: number };
      cluster_stats_minilm?: { clusters: number; noise_count: number; total: number };
      cluster_assignments_pca?: number[];
      cluster_assignments_tfidf?: number[];
      cluster_assignments_hdbscan?: number[];
      cluster_assignments_minilm?: number[];
      clusters_summary_pca?: Array<{ label: string; size: number; percent: number }>;
      clusters_summary_tfidf?: Array<{ label: string; size: number; percent: number }>;
      clusters_summary_hdbscan?: Array<{ label: string; size: number; percent: number }>;
      clusters_summary_minilm?: Array<{ label: string; size: number; percent: number }>;
      comments: Array<Record<string, unknown>>;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  useEffect(() => {
    if (studyId) {
      trackEvent("study_viewed", { study_id: studyId });
    }
  }, [studyId]);

  const isOverviewStub = study?.primarySignal.kind === "overview_stub";
  const isOilBrent = study?.primarySignal.kind === "oil_brent";
  const isOilGlobalLong = study?.primarySignal.kind === "oil_global_long";
  const isGoldAndOil = study?.primarySignal.kind === "gold_and_oil";
  const isFxIranCurrencyRegime = study?.primarySignal.kind === "fx_iran_currency_regime";
  const isOilAndFx = study?.primarySignal.kind === "oil_and_fx";
  const isRealOil = study?.primarySignal.kind === "real_oil";
  const isOilPppIran = study?.primarySignal.kind === "oil_ppp_iran";
  const hasTurkeyComparator = study?.comparatorCountry === "Turkey";
  const isOilExportCapacity = study?.primarySignal.kind === "oil_export_capacity";
  const isOilProductionMajorExporters = study?.primarySignal.kind === "oil_production_major_exporters";
  const isEventsTimeline = study?.primarySignal.kind === "events_timeline";
  const isGlobalEventsTimeline = study?.primarySignal.kind === "global_events_timeline";
  const isBandEventsTimeline = study?.primarySignal.kind === "band_events_timeline";
  const isComparativeHistoryTimeline = study?.primarySignal.kind === "comparative_history_timeline";
  const isFollowerGrowthDynamics = study?.primarySignal.kind === "follower_growth_dynamics";
  const isWageCpiReal = study?.primarySignal.kind === "wage_cpi_real";
  const isOilTradeNetwork = study?.primarySignal.kind === "oil_trade_network";
  const isOilExporterTimeseries = study?.primarySignal.kind === "oil_exporter_timeseries";
  const isOilGeopoliticalReaction = study?.primarySignal.kind === "oil_geopolitical_reaction";
  const isYoutubeCommentAnalysis = study?.primarySignal.kind === "youtube_comment_analysis";
  const isGdpComposition = study?.primarySignal.kind === "gdp_composition";
  const isGdpIranAccountsDual = study?.primarySignal.kind === "iran_gdp_accounts_dual";
  const isGiniInequality = study?.primarySignal.kind === "gini_inequality";
  const isInflationCpiYoy = study?.primarySignal.kind === "inflation_cpi_yoy";
  const isGdpGlobalComparison = study?.primarySignal.kind === "gdp_global_comparison";
  const isIsiDiagnostics = study?.primarySignal.kind === "isi_diagnostics";
  const isPovertyHeadcountIran = study?.primarySignal.kind === "poverty_headcount_iran";
  const isIranMoneySupplyM2 = study?.primarySignal.kind === "iran_money_supply_m2";
  const isDutchDiseaseDiagnostics = study?.primarySignal.kind === "dutch_disease_diagnostics_iran";
  const isOilEconomyOverview = study?.primarySignal.kind === "oil_economy_overview";
  const isIranEconomyReconstruction1368 =
    study?.primarySignal.kind === "iran_economy_reconstruction_1368_1376";
  const isIranEconomyPeriodComparison = study?.primarySignal.kind === "iran_economy_period_comparison";
  const isIranEconomyMacroDashboard = isIranEconomyReconstruction1368 || isIranEconomyPeriodComparison;
  const [showIranIraqWarOverlay, setShowIranIraqWarOverlay] = useState(false);
  const [showIran1979RevolutionMarker, setShowIran1979RevolutionMarker] = useState(true);

  const iranIraqWarChartPeriodOverlayBands = useMemo((): ChartPeriodOverlayBandInput[] | undefined => {
    const bands: ChartPeriodOverlayBandInput[] = [];
    if (isIranEconomyMacroDashboard && showIranIraqWarOverlay) {
      bands.push({
        id: IRAN_IRAQ_WAR_OVERLAY_ID,
        startYear: IRAN_IRAQ_WAR_SHADE_START_YEAR,
        endYear: IRAN_IRAQ_WAR_SHADE_END_YEAR,
        fill: IRAN_IRAQ_WAR_MARK_AREA_FILL,
        markAreaLabel: L(isFa, "Iran–Iraq War", "جنگ ایران و عراق"),
      });
    }
    return bands.length > 0 ? bands : undefined;
  }, [isIranEconomyMacroDashboard, showIranIraqWarOverlay, isFa]);

  useEffect(() => {
    if (studyId === "iran-economy-period-comparison") {
      setShowIranIraqWarOverlay(ipcOuterWarOverlayDefaultOn(ipcOuterStartYear, ipcOuterEndYear));
    } else {
      setShowIranIraqWarOverlay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- default when switching studies only; keep manual toggle while editing outer years
  }, [studyId]);

  /** WDI national-accounts levels bundle (composition study or dual-axis reference study). */
  const isGdpMacroNationalAccounts = isGdpComposition || isGdpIranAccountsDual;
  const isGdpIranLocal = study?.gdpCompositionIranLocalOptions === true;

  const shouldFetchUsCpiMonthly = useMemo(
    () =>
      Boolean(
        study &&
          (isOilBrent ||
            isOilGlobalLong ||
            isGoldAndOil ||
            isOilAndFx ||
            isOilGeopoliticalReaction ||
            isOilExportCapacity ||
            (isGdpGlobalComparison && gdpGlobalDisplayMode === "absolute") ||
            (isGdpMacroNationalAccounts &&
              isGdpIranLocal &&
              gdpStudyView === "levels" &&
              gdpLevelsValueType === "usd"))
      ),
    [
      study,
      isOilBrent,
      isOilGlobalLong,
      isGoldAndOil,
      isOilAndFx,
      isOilGeopoliticalReaction,
      isOilExportCapacity,
      isGdpGlobalComparison,
      gdpGlobalDisplayMode,
      isGdpMacroNationalAccounts,
      isGdpIranLocal,
      gdpStudyView,
      gdpLevelsValueType,
    ]
  );

  useEffect(() => {
    setMonetarySeriesMode("real");
  }, [studyId]);

  useEffect(() => {
    if (studyId === "iran-economy-1368-1376" || studyId === "iran-economy-period-comparison") {
      setShowTimeSeriesEventOverlay(true);
    }
  }, [studyId, setShowTimeSeriesEventOverlay]);

  useEffect(() => {
    if (!shouldFetchUsCpiMonthly) {
      setUsCpiMonthlyPoints([]);
      return;
    }
    let mounted = true;
    const end = new Date().toISOString().slice(0, 10);
    fetchJson<{ points?: { date: string; value: number }[] }>(
      `/api/signals/fred/us-cpi-monthly?start=${encodeURIComponent("1947-01-01")}&end=${encodeURIComponent(end)}`
    )
      .then((res) => {
        if (mounted) setUsCpiMonthlyPoints(res.points ?? []);
      })
      .catch(() => {
        if (mounted) setUsCpiMonthlyPoints([]);
      });
    return () => {
      mounted = false;
    };
  }, [shouldFetchUsCpiMonthly]);

  useEffect(() => {
    if (!isFxIranCurrencyRegime) {
      setFxUsdTomanYAxisLog(false);
      return;
    }
    setFxUsdTomanYAxisLog(searchParams.get("log") === "1");
  }, [isFxIranCurrencyRegime, searchParams]);

  const oilMacroDefaultsApplied = useRef(false);
  useEffect(() => {
    if (isOilBrent || isOilGlobalLong) {
      if (!oilMacroDefaultsApplied.current) {
        oilMacroDefaultsApplied.current = true;
        setShowGlobalMacroOil(true);
      }
    } else {
      oilMacroDefaultsApplied.current = false;
    }
  }, [studyId, isOilBrent, isOilGlobalLong]);

  useEffect(() => {
    if (
      isDutchDiseaseDiagnostics ||
      isOilPppIran ||
      isIsiDiagnostics ||
      isGiniInequality ||
      isInflationCpiYoy ||
      isGdpGlobalComparison ||
      isPovertyHeadcountIran ||
      isIranMoneySupplyM2 ||
      isIranEconomyReconstruction1368 ||
      isIranEconomyPeriodComparison
    )
      setLoading(false);
  }, [
    isDutchDiseaseDiagnostics,
    isOilPppIran,
    isIsiDiagnostics,
    isGiniInequality,
    isInflationCpiYoy,
    isGdpGlobalComparison,
    isPovertyHeadcountIran,
    isIranMoneySupplyM2,
    isIranEconomyReconstruction1368,
    isIranEconomyPeriodComparison,
  ]);

  useEffect(() => {
    setShowTimeSeriesEventOverlay(false);
  }, [studyId]);

  const useShortWindowOptions = isOilBrent || isFxIranCurrencyRegime || isOilAndFx || isRealOil;
  const windowOptions = useShortWindowOptions
    ? WINDOW_OPTIONS_FX
    : isGoldAndOil
      ? WINDOW_OPTIONS_LONG_RANGE
      : WINDOW_OPTIONS;
  const effectiveWindowValue = useMemo(
    () => (windowOptions.some((o) => o.value === windowYears) ? windowYears : windowOptions[0].value),
    [windowOptions, windowYears]
  );
  const effectiveWindowYears = useShortWindowOptions ? 1 : effectiveWindowValue;

  const oilTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity || isOilGeopoliticalReaction)) return null;
    if (isOilGeopoliticalReaction) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    }
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate)
          return useShortWindowOptions
            ? computeWindowRangeDays(anchorDate, effectiveWindowValue)
            : computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    return study.timeRange;
  }, [study, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran, isOilExportCapacity, anchorEventId, events, effectiveWindowYears, useShortWindowOptions, effectiveWindowValue]);

  const exportCapacityTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilExportCapacity) return null;
    return study.timeRange;
  }, [study, isOilExportCapacity]);

  const oilEconomyTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilEconomyOverview) return null;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isOilEconomyOverview]);

  const oilEconomyDisplayPricePoints = useMemo((): { date: string; value: number }[] => {
    if (oilEconomyUsdMode === "real" && oilEconomyPriceRealPoints.length > 0) {
      return oilEconomyPriceRealPoints;
    }
    return oilEconomyPricePoints;
  }, [oilEconomyUsdMode, oilEconomyPriceRealPoints, oilEconomyPricePoints]);

  const oilEconomyDisplayRevenuePoints = useMemo((): { date: string; value: number }[] => {
    if (oilEconomyUsdMode === "real" && oilEconomyRevenueRealPoints.length > 0) {
      return oilEconomyRevenueRealPoints;
    }
    return oilEconomyRevenuePoints;
  }, [oilEconomyUsdMode, oilEconomyRevenueRealPoints, oilEconomyRevenuePoints]);

  const oilEconomyRealUsdActive = oilEconomyUsdMode === "real" && oilEconomyPriceRealPoints.length > 0;

  const oilCpiBaseYear = useMemo(
    () => resolveOilEconomyCpiBaseYear(oilEconomyInflation),
    [oilEconomyInflation]
  );

  const oilEconomyDataBounds = useMemo((): [string, string] | null => {
    if (!isOilEconomyOverview) return null;
    const collected: string[] = [];
    for (const a of [oilEconomyProdPoints, oilEconomyDisplayPricePoints, oilEconomyDisplayRevenuePoints]) {
      for (const p of a) collected.push(p.date.slice(0, 10));
    }
    if (collected.length === 0) return null;
    collected.sort();
    return [collected[0]!, collected[collected.length - 1]!];
  }, [isOilEconomyOverview, oilEconomyProdPoints, oilEconomyDisplayPricePoints, oilEconomyDisplayRevenuePoints]);

  const oilEconomyChartTimeRange = useMemo((): [string, string] | null => {
    if (!oilEconomyTimeRange) return null;
    const [s0, e0] = oilEconomyTimeRange;
    let a = normalizeChartRangeBound(s0, false).slice(0, 10);
    let b = normalizeChartRangeBound(e0, true).slice(0, 10);
    const hasUser = Boolean(
      (oilEconomyViewStart && oilEconomyViewStart.trim() !== "") ||
        (oilEconomyViewEnd && oilEconomyViewEnd.trim() !== "")
    );
    if (oilEconomyViewStart && oilEconomyViewStart.trim() !== "") {
      const t = normalizeChartRangeBound(oilEconomyViewStart, false).slice(0, 10);
      if (t > a) a = t;
    }
    if (oilEconomyViewEnd && oilEconomyViewEnd.trim() !== "") {
      const t = normalizeChartRangeBound(oilEconomyViewEnd, true).slice(0, 10);
      if (t < b) b = t;
    }
    if (a > b) {
      return [b, a] as [string, string];
    }
    if (hasUser && oilEconomyDataBounds) {
      const d0 = oilEconomyDataBounds[0]!.slice(0, 10);
      const d1 = oilEconomyDataBounds[1]!.slice(0, 10);
      if (a < d0) a = d0;
      if (b > d1) b = d1;
      if (a > b) {
        return [b, a] as [string, string];
      }
    }
    return [a, b] as [string, string];
  }, [oilEconomyTimeRange, oilEconomyDataBounds, oilEconomyViewStart, oilEconomyViewEnd]);

  const oilEconomyCategoryYearTickStep = useMemo(() => {
    const tr = oilEconomyChartTimeRange ?? oilEconomyTimeRange;
    if (!tr) return 3;
    const a = parseInt(tr[0].slice(0, 4), 10);
    const b = parseInt(tr[1].slice(0, 4), 10);
    const span = b - a;
    if (span > 50) return 2;
    if (span > 30) return 3;
    return 4;
  }, [oilEconomyChartTimeRange, oilEconomyTimeRange]);

  const oilEconomyYearInputMinMax = useMemo(() => {
    if (!oilEconomyTimeRange) return { min: 1900, max: 2100 };
    return toYearInputMinMax(
      normalizeChartRangeBound(oilEconomyTimeRange[0], false).slice(0, 10),
      normalizeChartRangeBound(oilEconomyTimeRange[1], true).slice(0, 10)
    );
  }, [oilEconomyTimeRange]);

  useEffect(() => {
    if (!oilEconomyStartYearFocusRef.current) {
      setOilEconomyStartYearDraft(yearDraftFromBoundIso(oilEconomyViewStart));
    }
    if (!oilEconomyEndYearFocusRef.current) {
      setOilEconomyEndYearDraft(yearDraftFromBoundIso(oilEconomyViewEnd));
    }
  }, [oilEconomyViewStart, oilEconomyViewEnd]);

  const productionTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilProductionMajorExporters) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isOilProductionMajorExporters, anchorEventId, events, effectiveWindowYears]);

  const giniTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isGiniInequality) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isGiniInequality, anchorEventId, events, effectiveWindowYears]);

  const inflationTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isInflationCpiYoy) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isInflationCpiYoy, anchorEventId, events, effectiveWindowYears]);

  const gdpGlobalTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isGdpGlobalComparison) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isGdpGlobalComparison, anchorEventId, events, effectiveWindowYears]);

  const isiTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isIsiDiagnostics) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isIsiDiagnostics, anchorEventId, events, effectiveWindowYears]);

  const povertyTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isPovertyHeadcountIran) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isPovertyHeadcountIran, anchorEventId, events, effectiveWindowYears]);

  const moneySupplyTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isIranMoneySupplyM2) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isIranMoneySupplyM2, anchorEventId, events, effectiveWindowYears]);

  const dutchTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isDutchDiseaseDiagnostics) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isDutchDiseaseDiagnostics, anchorEventId, events, effectiveWindowYears]);

  const dutchFxTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isDutchDiseaseDiagnostics) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRangeDays(anchorDate, effectiveWindowValue);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isDutchDiseaseDiagnostics, anchorEventId, events, effectiveWindowValue]);

  const reconstructionTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isIranEconomyReconstruction1368) return null;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isIranEconomyReconstruction1368]);

  const ipcOuterResolved = useMemo(() => {
    const cy = ipcGregorianYear;
    let os = Math.min(ipcOuterStartYear, ipcOuterEndYear);
    let oe = Math.max(ipcOuterStartYear, ipcOuterEndYear);
    os = Math.max(IPC_OUTER_CHART_YEAR_MIN, Math.min(os, cy));
    oe = Math.max(os, Math.min(oe, cy));
    return { start: os, end: oe };
  }, [ipcOuterStartYear, ipcOuterEndYear, ipcGregorianYear]);

  const ipcFocusResolved = useMemo(() => {
    const { start: os, end: oe } = ipcOuterResolved;
    let fs = Math.min(ipcFocusStartYear, ipcFocusEndYear);
    let fe = Math.max(ipcFocusStartYear, ipcFocusEndYear);
    fs = Math.max(os, Math.min(fs, oe));
    fe = Math.max(fs, Math.min(fe, oe));
    return { start: fs, end: fe };
  }, [ipcFocusStartYear, ipcFocusEndYear, ipcOuterResolved]);

  /** One line under preset chips: explains the gray focus band for every president (not only Rafsanjani). */
  const ipcFocusBandContextParagraph = useMemo(() => {
    if (!isIranEconomyPeriodComparison) return null;
    if (ipcPresetId === "islamic_republic_outer") return null;
    const start = ipcFocusResolved.start;
    const end = ipcFocusResolved.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const enRange = `${start}–${end}`;
    const faRange = `${localizeChartNumericDisplayString(String(start), "fa")}–${localizeChartNumericDisplayString(String(end), "fa")}`;
    if (ipcPresetId === "custom") {
      return L(
        isFa,
        `Shaded band: ${ipcBandLabelEn} (${enRange} CE).`,
        `نوار سایه‌دار: ${ipcBandLabelFa} (${faRange} میلادی).`
      );
    }
    const cfg = IPC_PRESIDENT_PRESETS[ipcPresetId];
    if (cfg.outerOnly) return null;
    if (ipcPresetId === "mohammad_reza_pahlavi") {
      return L(
        isFa,
        `Shaded band: Mohammad Reza Pahlavi (${enRange} CE; 1320–1357 SH).`,
        `نوار سایه‌دار: محمدرضا پهلوی (${faRange} میلادی؛ ۱۳۲۰–۱۳۵۷ ش).`
      );
    }
    if (ipcPresetId === "rafsanjani") {
      return L(
        isFa,
        `Shaded band: Rafsanjani presidencies (${enRange} CE).`,
        `نوار سایه‌دار: دوره‌های ریاست‌جمهوری رفسنجانی (${faRange} میلادی).`
      );
    }
    return L(
      isFa,
      `Shaded band: ${cfg.labelEn} (${enRange} CE).`,
      `نوار سایه‌دار: ${cfg.labelFa} (${faRange} میلادی).`
    );
  }, [
    isIranEconomyPeriodComparison,
    ipcPresetId,
    ipcFocusResolved.start,
    ipcFocusResolved.end,
    isFa,
    ipcBandLabelEn,
    ipcBandLabelFa,
  ]);

  const ipcTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isIranEconomyPeriodComparison) return null;
    const { start, end } = ipcOuterResolved;
    return [`${start}-01-01`, `${end}-12-31`];
  }, [study, isIranEconomyPeriodComparison, ipcOuterResolved]);

  const exporterTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilExporterTimeseries) return null;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? String(new Date().getFullYear()) : end;
    return [start, resolvedEnd];
  }, [study, isOilExporterTimeseries]);

  const gdpCompositionTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isGdpMacroNationalAccounts) return null;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isGdpMacroNationalAccounts]);

  /** Shared event-layer toggles for API fetch, client-side filters, and `TimelineChart` props. */
  const chartEventToggleState = useMemo(
    (): StudyEventLayerToggleState => ({
      showIranEvents,
      showWorldEvents,
      showSanctionsEvents,
      showOpecEvents,
      showGlobalMacroOil,
      showPresidentialTerms,
    }),
    [showIranEvents, showWorldEvents, showSanctionsEvents, showOpecEvents, showGlobalMacroOil, showPresidentialTerms]
  );

  /** Study 17: x-axis from (min data year - 1) to (max data year + 1), no empty leading/trailing years. */
  const exporterChartTimeRange = useMemo((): [string, string] | null => {
    if (!exporterTimeRange || !isOilExporterTimeseries) return null;
    const allPoints = [
      ...(exporterCuratedData ? [...exporterCuratedData.saudi, ...exporterCuratedData.russia, ...exporterCuratedData.us, ...exporterCuratedData.iran] : []),
      ...(exporterDbData ? [...exporterDbData.saudi, ...exporterDbData.russia, ...exporterDbData.us, ...exporterDbData.iran] : []),
    ];
    if (allPoints.length === 0) return exporterTimeRange;
    const years = allPoints.map((p) => parseInt(p.date.slice(0, 4), 10));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return [String(minYear - 1), String(maxYear + 1)];
  }, [exporterTimeRange, isOilExporterTimeseries, exporterCuratedData, exporterDbData]);

  /** Study 14: filter events client-side by toggles for instant updates (no API round-trip). */
  const study14FilteredEvents = useMemo(() => {
    if (!isOilProductionMajorExporters) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isOilProductionMajorExporters, events, chartEventToggleState]);

  const giniFilteredEvents = useMemo(() => {
    if (!isGiniInequality) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isGiniInequality, events, chartEventToggleState]);

  const inflationFilteredEvents = useMemo(() => {
    if (!isInflationCpiYoy) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isInflationCpiYoy, events, chartEventToggleState]);

  const gdpGlobalFilteredEvents = useMemo(() => {
    if (!isGdpGlobalComparison) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isGdpGlobalComparison, events, chartEventToggleState]);

  const isiFilteredEvents = useMemo(() => {
    if (!isIsiDiagnostics) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isIsiDiagnostics, events, chartEventToggleState]);

  const gdpGlobalDisplayed = useMemo(() => {
    if (!isGdpGlobalComparison) return null;
    const raw = {
      us: gdpGlobalUnitedStatesPoints,
      china: gdpGlobalChinaPoints,
      iran: gdpGlobalIranPoints,
      turkey: gdpGlobalTurkeyPoints,
      saudi_arabia: gdpGlobalSaudiArabiaPoints,
      world: gdpGlobalWorldPoints,
    };
    if (gdpGlobalDisplayMode === "indexed") {
      return {
        us: indexGdpComparisonTo100Base2000(raw.us),
        china: indexGdpComparisonTo100Base2000(raw.china),
        iran: indexGdpComparisonTo100Base2000(raw.iran),
        turkey: indexGdpComparisonTo100Base2000(raw.turkey),
        saudi_arabia: indexGdpComparisonTo100Base2000(raw.saudi_arabia),
        world: indexGdpComparisonTo100Base2000(raw.world),
      };
    }
    if (
      monetarySeriesMode !== "real" ||
      usCpiMonthlyPoints.length === 0 ||
      !gdpGlobalPerCountryBasis ||
      Object.keys(gdpGlobalPerCountryBasis).length === 0
    ) {
      return raw;
    }
    const basis = gdpGlobalPerCountryBasis;
    const deflateIfCurrent = (pts: { date: string; value: number }[], isoKey: string) =>
      basis[isoKey] === "current_usd"
        ? deflateNominalUsdPointsWithUsCpi(pts, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR)
        : pts;
    return {
      us: deflateIfCurrent(raw.us, "united_states"),
      china: deflateIfCurrent(raw.china, "china"),
      iran: deflateIfCurrent(raw.iran, "iran"),
      turkey: deflateIfCurrent(raw.turkey, "turkey"),
      saudi_arabia: deflateIfCurrent(raw.saudi_arabia, "saudi_arabia"),
      world: deflateIfCurrent(raw.world, "world"),
    };
  }, [
    isGdpGlobalComparison,
    gdpGlobalDisplayMode,
    gdpGlobalUnitedStatesPoints,
    gdpGlobalChinaPoints,
    gdpGlobalIranPoints,
    gdpGlobalTurkeyPoints,
    gdpGlobalSaudiArabiaPoints,
    gdpGlobalWorldPoints,
    monetarySeriesMode,
    usCpiMonthlyPoints,
    gdpGlobalPerCountryBasis,
  ]);

  const povertyFilteredEvents = useMemo(() => {
    if (!isPovertyHeadcountIran) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isPovertyHeadcountIran, events, chartEventToggleState]);

  const moneySupplyFilteredEvents = useMemo(() => {
    if (!isIranMoneySupplyM2) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isIranMoneySupplyM2, events, chartEventToggleState]);

  const dutchFilteredEvents = useMemo(() => {
    if (!isDutchDiseaseDiagnostics) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isDutchDiseaseDiagnostics, events, chartEventToggleState]);

  const reconstructionFilteredApiEvents = useMemo(() => {
    if (!isIranEconomyReconstruction1368) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isIranEconomyReconstruction1368, events, chartEventToggleState]);

  const reconstructionPeriodMarkers = useMemo((): Event[] => {
    if (!isIranEconomyReconstruction1368) return [];
    return [
      {
        id: "reco-khamenei-sl-1989",
        layer: "iran_core",
        date: "1989-06-04",
        title: "Khamenei becomes Supreme Leader",
        title_fa: "رهبری آیت‌الله خامنه‌ای",
      },
      {
        id: "reco-rafsanjani-1-1989",
        layer: "iran_core",
        date: "1989-08-03",
        title: "Rafsanjani presidency begins",
        title_fa: "آغاز ریاست‌جمهوری رفسنجانی",
      },
      {
        id: "reco-rafsanjani-2-1993",
        layer: "iran_core",
        date: "1993-08-04",
        title: "Second Rafsanjani term (inauguration)",
        title_fa: "دور دوم ریاست‌جمهوری رفسنجانی (حدود)",
      },
      {
        id: "reco-fx-pressure-1995",
        layer: "iran_core",
        date: "1995-07-01",
        title: "FX / inflation pressure (context marker)",
        title_fa: "فشار ارزی/تورمی (نشانگر زمینه‌ای)",
      },
      {
        id: "reco-khatami-1997",
        layer: "iran_core",
        date: "1997-05-23",
        title: "Khatami elected — end of Rafsanjani era",
        title_fa: "انتخاب خاتمی — پایان دوره رفسنجانی",
      },
    ];
  }, [isIranEconomyReconstruction1368]);

  const reconstructionChartEvents = useMemo((): Event[] => {
    return [...reconstructionPeriodMarkers, ...(showTimeSeriesEventOverlay ? reconstructionFilteredApiEvents : [])];
  }, [reconstructionPeriodMarkers, showTimeSeriesEventOverlay, reconstructionFilteredApiEvents]);

  const ipcFilteredApiEvents = useMemo(() => {
    if (!isIranEconomyPeriodComparison) return events;
    return events.filter((e) => isStudyEventLayerVisible(e.layer, chartEventToggleState));
  }, [isIranEconomyPeriodComparison, events, chartEventToggleState]);

  const ipcChartEvents = useMemo((): ChartTimelineEvent[] => {
    if (!isIranEconomyPeriodComparison) return [];
    return showTimeSeriesEventOverlay ? (ipcFilteredApiEvents as ChartTimelineEvent[]) : [];
  }, [isIranEconomyPeriodComparison, showTimeSeriesEventOverlay, ipcFilteredApiEvents]);

  const ipcRegimeAreaBounds = useMemo(() => {
    if (!isIranEconomyPeriodComparison) return null;
    const { start, end } = ipcFocusResolved;
    return { xStart: `${start}-07-01`, xEnd: `${end}-07-01` };
  }, [isIranEconomyPeriodComparison, ipcFocusResolved]);

  const ipcRegimeAreaWithLabel = useMemo(() => {
    if (ipcPresetId === "islamic_republic_outer") return undefined;
    if (!ipcRegimeAreaBounds) return undefined;
    return { ...ipcRegimeAreaBounds, label: L(isFa, ipcBandLabelEn, ipcBandLabelFa) };
  }, [ipcPresetId, ipcRegimeAreaBounds, isFa, ipcBandLabelEn, ipcBandLabelFa]);

  /** Reconstruction study: shaded band matches the fixed 1368–1376 window (Rafsanjani era on charts/exports). */
  const recoWelfareRegimeArea = useMemo(() => {
    if (!isIranEconomyReconstruction1368 || !reconstructionTimeRange) return undefined;
    return {
      xStart: "1989-07-01",
      xEnd: "1997-07-01",
      label: L(isFa, "Rafsanjani", "رفسنجانی"),
    };
  }, [isIranEconomyReconstruction1368, reconstructionTimeRange, isFa]);

  const reconstructionGregorianYearBounds = useMemo(() => {
    if (!reconstructionTimeRange) return { start: 1989, end: 1997 };
    const a = parseInt(reconstructionTimeRange[0].slice(0, 4), 10);
    const b = parseInt(reconstructionTimeRange[1].slice(0, 4), 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { start: 1989, end: 1997 };
    return { start: Math.min(a, b), end: Math.max(a, b) };
  }, [reconstructionTimeRange]);

  const recoPovertyCoverageExtras = useMemo(() => {
    if (!isIranEconomyReconstruction1368) return null;
    if (!reconstructionTimeRange?.[0] || !reconstructionTimeRange?.[1]) return null;
    return buildPovertyHeadcountCoverageExtras(
      recoWelfarePovertyDdayPoints,
      recoWelfarePovertyLmicPoints,
      reconstructionTimeRange,
      reconstructionGregorianYearBounds.end
    );
  }, [
    isIranEconomyReconstruction1368,
    reconstructionTimeRange,
    recoWelfarePovertyDdayPoints,
    recoWelfarePovertyLmicPoints,
    reconstructionGregorianYearBounds.end,
  ]);

  const recoGiniCoverageExtras = useMemo(() => {
    if (!isIranEconomyReconstruction1368) return null;
    if (!reconstructionTimeRange?.[0] || !reconstructionTimeRange?.[1]) return null;
    return buildSparseWdiLineCoverageExtras(
      recoWelfareGiniIranPoints,
      reconstructionTimeRange,
      reconstructionGregorianYearBounds.end
    );
  }, [
    isIranEconomyReconstruction1368,
    reconstructionTimeRange,
    recoWelfareGiniIranPoints,
    reconstructionGregorianYearBounds.end,
  ]);

  const iranMacroAiInterpretationParagraphs = useMemo(() => {
    if (!isIranEconomyMacroDashboard) return null;
    if (
      recoLoading &&
      !recoLoadFailed &&
      recoInflationIranPoints.length === 0 &&
      recoGdpGrowthPoints.length === 0
    ) {
      return null;
    }
    const outer = isIranEconomyPeriodComparison ? ipcOuterResolved : reconstructionGregorianYearBounds;
    const focus = isIranEconomyPeriodComparison ? ipcFocusResolved : reconstructionGregorianYearBounds;
    const focusLabel = isIranEconomyReconstruction1368
      ? L(isFa, "Rafsanjani", "رفسنجانی")
      : L(isFa, ipcBandLabelEn, ipcBandLabelFa);
    return buildIranMacroDashboardInterpretation({
      locale: isFa ? "fa" : "en",
      loadFailed: recoLoadFailed,
      outer,
      focus,
      focusLabel,
      inflation: recoInflationIranPoints,
      gdp: recoGdpGrowthPoints,
    });
  }, [
    isIranEconomyMacroDashboard,
    isIranEconomyPeriodComparison,
    isIranEconomyReconstruction1368,
    isFa,
    recoLoading,
    recoLoadFailed,
    ipcOuterResolved.start,
    ipcOuterResolved.end,
    ipcFocusResolved.start,
    ipcFocusResolved.end,
    ipcBandLabelEn,
    ipcBandLabelFa,
    reconstructionGregorianYearBounds.start,
    reconstructionGregorianYearBounds.end,
    recoInflationIranPoints,
    recoGdpGrowthPoints,
  ]);

  const applyIpcPreset = useCallback(
    (id: IpcPresidentPreset) => {
      const cfg = IPC_PRESIDENT_PRESETS[id];
      const cy = ipcGregorianYear;
      setIpcPresetId(id);
      if (cfg.outerOnly) {
        if (cfg.outerStart != null) setIpcOuterStartYear(cfg.outerStart);
        if (cfg.outerUseCurrentEnd) setIpcOuterEndYear(cy);
        return;
      }
      if (cfg.focusStart != null) setIpcFocusStartYear(cfg.focusStart);
      if (cfg.focusUseCurrentEnd) setIpcFocusEndYear(cy);
      else if (cfg.focusEnd != null) setIpcFocusEndYear(cfg.focusEnd);
      if (cfg.widenOuterStartToYear != null) {
        setIpcOuterStartYear((prev) => Math.min(prev, cfg.widenOuterStartToYear!));
      }
      setIpcBandLabelEn(cfg.labelEn);
      setIpcBandLabelFa(cfg.labelFa);
    },
    [ipcGregorianYear]
  );

  const markIpcCustomFocusLabel = useCallback(() => {
    setIpcPresetId("custom");
    setIpcBandLabelEn("Focus period");
    setIpcBandLabelFa("دوره انتخابی");
  }, []);

  const recoOpenAnnualMean = useMemo(
    () => (recoFxOpenPoints.length > 0 ? annualMeanPointsByGregorianYear(recoFxOpenPoints) : []),
    [recoFxOpenPoints]
  );

  const recoFxSpreadPctPoints = useMemo(() => {
    const byY = new Map(recoFxOfficialPoints.map((p) => [p.date.slice(0, 4), p.value]));
    const out: { date: string; value: number }[] = [];
    for (const p of recoOpenAnnualMean) {
      const y = p.date.slice(0, 4);
      const off = byY.get(y);
      if (off == null || off <= 0) continue;
      out.push({ date: p.date, value: Math.round((p.value / off - 1) * 1000) / 10 });
    }
    return out;
  }, [recoFxOfficialPoints, recoOpenAnnualMean]);

  const reconstructionFxClipRange = useMemo((): [string, string] | undefined => {
    if (!isIranEconomyReconstruction1368 || !study) return undefined;
    if (reconstructionTimeRange) return reconstructionTimeRange;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [isIranEconomyReconstruction1368, study, reconstructionTimeRange]);

  const iranRecoFxLogDataKey = useMemo(() => {
    const tr = reconstructionFxClipRange;
    return `${tr?.[0] ?? ""}\u0000${tr?.[1] ?? ""}\u0000${recoFxOfficialPoints.length}\u0000${recoOpenAnnualMean.length}`;
  }, [reconstructionFxClipRange, recoFxOfficialPoints.length, recoOpenAnnualMean.length]);

  useEffect(() => {
    iranFxLogDataKeyRef.current = "";
    iranFxLogDefaultAppliedRef.current = false;
    setIranEconomyFxLevelsLogScale(false);
  }, [studyId]);

  useEffect(() => {
    if (iranFxLogDataKeyRef.current !== iranRecoFxLogDataKey) {
      iranFxLogDataKeyRef.current = iranRecoFxLogDataKey;
      iranFxLogDefaultAppliedRef.current = false;
    }
  }, [iranRecoFxLogDataKey]);

  useEffect(() => {
    if (!isIranEconomyReconstruction1368) return;
    if (iranFxLogDefaultAppliedRef.current) return;
    if (recoFxOfficialPoints.length === 0 && recoOpenAnnualMean.length === 0) return;
    setIranEconomyFxLevelsLogScale(
      iranFxLevelsSuggestLogDefaultInRange(
        recoFxOfficialPoints,
        recoOpenAnnualMean,
        reconstructionFxClipRange,
        "short_reconstruction"
      )
    );
    iranFxLogDefaultAppliedRef.current = true;
  }, [
    isIranEconomyReconstruction1368,
    recoFxOfficialPoints,
    recoOpenAnnualMean,
    iranRecoFxLogDataKey,
    reconstructionFxClipRange,
  ]);

  const iranRecoFxLevelsLogNote =
    iranEconomyFxLevelsLogScale &&
    reconstructionFxClipRange &&
    iranFxLevelsHasNonPositiveValuesInRange(recoFxOfficialPoints, recoOpenAnnualMean, reconstructionFxClipRange)
      ? L(
          isFa,
          "Log scale: years with zero or negative rates are omitted from the plot.",
          "مقیاس لگاریتمی: سال‌هایی با نرخ صفر یا منفی از نمودار حذف شده‌اند."
        )
      : undefined;

  /** Indexed overlay (100 = value in base year): WDI shares + optional annual-mean open-market FX. */
  const dutchOverviewIndexed = useMemo(() => {
    if (!isDutchDiseaseDiagnostics) return null;
    const annualFx = annualMeanPointsByGregorianYear(dutchFxPoints);
    const wdiBlocks = [
      { key: "oil", points: dutchOilRentsPoints },
      { key: "mfg", points: dutchManufacturingPoints },
      { key: "imp", points: dutchImportsPoints },
    ].filter((b) => b.points.length > 0);
    if (wdiBlocks.length < 2) return null;
    const forBase = [...wdiBlocks, ...(annualFx.length > 0 ? [{ key: "fx", points: annualFx }] : [])];
    const baseYear = resolveCommonIndexBaseYear(forBase, 2000);
    if (baseYear == null) return null;

    const multi: ChartSeries[] = [];
    const pushIfFinite = (
      key: string,
      label: string,
      points: { date: string; value: number }[],
      color: string,
      symbol: ChartSeries["symbol"]
    ) => {
      if (points.length === 0) return;
      const idxPts = indexSeriesTo100(points, baseYear);
      if (!idxPts.some((p) => Number.isFinite(p.value))) return;
      multi.push({
        key,
        label,
        yAxisIndex: 0,
        unit: "",
        points: idxPts,
        color,
        symbol,
        showSymbol: false,
        lineWidth: 2.25,
      });
    };
    pushIfFinite(
      "dutch_ov_oil",
      L(isFa, "Oil rents (% of GDP), indexed", `${faEconomic.oilRentsPctGdp}، شاخص‌شده`),
      dutchOilRentsPoints,
      SIGNAL_CONCEPT.dutch_oil_rents,
      "circle"
    );
    pushIfFinite(
      "dutch_ov_mfg",
      L(isFa, "Manufacturing (% of GDP), indexed", `${faEconomic.manufacturingPctGdp}، شاخص‌شده`),
      dutchManufacturingPoints,
      SIGNAL_CONCEPT.dutch_manufacturing,
      "rect"
    );
    pushIfFinite(
      "dutch_ov_imp",
      L(isFa, "Imports (% of GDP), indexed", `${faEconomic.imports} — ${faEconomic.gdpPctUnit}، شاخص‌شده`),
      dutchImportsPoints,
      SIGNAL_CONCEPT.dutch_imports,
      "diamond"
    );
    if (annualFx.length > 0) {
      pushIfFinite(
        "dutch_ov_fx",
        L(isFa, "Open-market toman/USD (annual mean), indexed", `${faEconomic.openMarketAnnualMean}، شاخص‌شده`),
        annualFx,
        SIGNAL_CONCEPT.dutch_fx_index,
        "triangle"
      );
    }
    if (multi.length < 2) return null;
    return { baseYear, multiSeries: multi };
  }, [
    isDutchDiseaseDiagnostics,
    isFa,
    dutchOilRentsPoints,
    dutchManufacturingPoints,
    dutchImportsPoints,
    dutchFxPoints,
  ]);

  const oilEconomyIndexed = useMemo(() => {
    if (!isOilEconomyOverview) return null;
    const tr = oilEconomyChartTimeRange;
    const filterToRange = (pts: { date: string; value: number }[]) => {
      if (!tr) return pts;
      const [lo, hi] = tr;
      return pts.filter((p) => p.date >= lo && p.date <= hi);
    };
    const real = oilEconomyUsdMode === "real" && oilEconomyPriceRealPoints.length > 0;
    return buildOilEconomyIndexedMultiSeries(
      filterToRange(oilEconomyProdPoints),
      filterToRange(oilEconomyDisplayPricePoints),
      filterToRange(oilEconomyDisplayRevenuePoints),
      {
        production: L(isFa, "Iran production (mb/d)", "تولید ایران (میلیون بشکه/روز)"),
        price: L(
          isFa,
          oilEconomyIndexedPriceSeriesLabel(false, real, oilCpiBaseYear),
          oilEconomyIndexedPriceSeriesLabel(true, real, oilCpiBaseYear)
        ),
        revenue: L(
          isFa,
          oilEconomyIndexedRevenueSeriesLabel(false, real, oilCpiBaseYear),
          oilEconomyIndexedRevenueSeriesLabel(true, real, oilCpiBaseYear)
        ),
      }
    );
  }, [
    isOilEconomyOverview,
    isFa,
    oilCpiBaseYear,
    oilEconomyProdPoints,
    oilEconomyDisplayPricePoints,
    oilEconomyDisplayRevenuePoints,
    oilEconomyChartTimeRange,
    oilEconomyUsdMode,
    oilEconomyPriceRealPoints.length,
  ]);

  const isiSeriesTyped = isiDiagnosticsData?.series ?? null;
  const isiOverviewIndexed = useMemo(
    () => buildIsiOverviewIndexedSeries(isiSeriesTyped, isiFocusCountry, isFa),
    [isiSeriesTyped, isiFocusCountry, isFa]
  );
  const isiTradeMultiSeries = useMemo(
    () => buildIsiTradeStructureMultiSeries(isiSeriesTyped, isFa),
    [isiSeriesTyped, isFa]
  );
  const isiIndustrialMultiSeries = useMemo(
    () => buildIsiIndustrialMultiSeries(isiSeriesTyped, isFa),
    [isiSeriesTyped, isFa]
  );
  const isiGdpGrowthMultiSeries = useMemo(
    () => buildIsiGdpGrowthMultiSeries(isiSeriesTyped, isFa),
    [isiSeriesTyped, isFa]
  );

  const gdpCompositionChartTimeRange = useMemo((): [string, string] | null => {
    if (!isGdpMacroNationalAccounts) return null;
    const all = [
      ...gdpConsumptionPoints,
      ...gdpInvestmentPoints,
      ...gdpNominalPoints,
      ...gdpLevelConsumptionPoints,
      ...gdpLevelGdpPoints,
      ...gdpLevelInvestmentPoints,
    ];
    if (all.length === 0) return gdpCompositionTimeRange;
    const dates = all.map((p) => p.date).sort();
    return [dates[0]!, dates[dates.length - 1]!];
  }, [
    isGdpMacroNationalAccounts,
    gdpConsumptionPoints,
    gdpInvestmentPoints,
    gdpNominalPoints,
    gdpLevelConsumptionPoints,
    gdpLevelGdpPoints,
    gdpLevelInvestmentPoints,
    gdpCompositionTimeRange,
  ]);

  const gdpCompositionChartEvents = useMemo(() => {
    if (!isGdpMacroNationalAccounts) return [];
    const range = gdpCompositionChartTimeRange ?? gdpCompositionTimeRange;
    const macro =
      showGdpMacroEvents && range
        ? iranGdpMacroEventsToTimeline().filter((e) => e.date && e.date >= range[0] && e.date <= range[1])
        : [];
    const iranFromApi = showGdpIranEvents ? events.filter((e) => e.layer !== "global_macro_oil") : [];
    const globalFromApi = showGdpGlobalMacroOil ? events.filter((e) => e.layer === "global_macro_oil") : [];
    return [...macro, ...iranFromApi, ...globalFromApi];
  }, [
    isGdpMacroNationalAccounts,
    events,
    showGdpIranEvents,
    showGdpGlobalMacroOil,
    showGdpMacroEvents,
    gdpCompositionTimeRange,
    gdpCompositionChartTimeRange,
  ]);

  /** Same Gregorian base year for all three series; each line is ÷ its own level that year (display only). */
  const gdpLevelsIndexedBaseYear = useMemo(
    () =>
      isGdpMacroNationalAccounts
        ? resolveIndexedBaseYear(gdpLevelConsumptionPoints, gdpLevelGdpPoints, gdpLevelInvestmentPoints, {
            /** ~Solar 1355; used when all three series have non-zero data that year (IRN WDI bundle). */
            preferredGregorianYears: [1976],
          })
        : null,
    [isGdpMacroNationalAccounts, gdpLevelConsumptionPoints, gdpLevelGdpPoints, gdpLevelInvestmentPoints],
  );

  const gdpLevelsIndexedBaseIsoDate = useMemo(
    () => (gdpLevelsIndexedBaseYear != null ? baseYearToIsoDate(gdpLevelsIndexedBaseYear) : null),
    [gdpLevelsIndexedBaseYear],
  );

  const gdpLevelsIndexedBaseYearLabel = useMemo(() => {
    if (gdpLevelsIndexedBaseYear == null || !gdpLevelsIndexedBaseIsoDate) return "";
    const useIranYearLabelsOnLevels =
      faEligible &&
      isGdpIranLocal &&
      yearAxisMode !== "gregorian" &&
      (isGdpIranAccountsDual || (isGdpComposition && gdpStudyView === "levels"));
    const numLoc = isFa ? ("fa" as const) : ("en" as const);
    if (useIranYearLabelsOnLevels) {
      return yearAxisMode === "both"
        ? formatChartYearBothInlineCompact(gdpLevelsIndexedBaseIsoDate, numLoc)
        : formatChartCategoryAxisYearLabel(gdpLevelsIndexedBaseIsoDate, yearAxisMode, numLoc);
    }
    return localizeChartNumericDisplayString(String(gdpLevelsIndexedBaseYear), numLoc);
  }, [
    gdpLevelsIndexedBaseYear,
    gdpLevelsIndexedBaseIsoDate,
    isGdpIranLocal,
    gdpStudyView,
    yearAxisMode,
    isGdpIranAccountsDual,
    isGdpComposition,
    isFa,
    faEligible,
  ]);

  const gdpLevelsDisplaySeries = useMemo(() => {
    if (!isGdpMacroNationalAccounts) {
      return {
        consumption: gdpLevelConsumptionPoints,
        gdp: gdpLevelGdpPoints,
        investment: gdpLevelInvestmentPoints,
      };
    }
    const usdCpiReal =
      isGdpIranLocal &&
      gdpStudyView === "levels" &&
      gdpLevelsValueType === "usd" &&
      monetarySeriesMode === "real" &&
      usCpiMonthlyPoints.length > 0;
    const c0 = usdCpiReal
      ? deflateNominalUsdPointsWithUsCpi(gdpLevelConsumptionPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR)
      : gdpLevelConsumptionPoints;
    const g0 = usdCpiReal
      ? deflateNominalUsdPointsWithUsCpi(gdpLevelGdpPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR)
      : gdpLevelGdpPoints;
    const i0 = usdCpiReal
      ? deflateNominalUsdPointsWithUsCpi(gdpLevelInvestmentPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR)
      : gdpLevelInvestmentPoints;
    if (gdpLevelsDisplayMode !== "indexed" || gdpLevelsIndexedBaseYear == null) {
      return { consumption: c0, gdp: g0, investment: i0 };
    }
    return {
      consumption: indexSeriesAtBaseYear(c0, gdpLevelsIndexedBaseYear),
      gdp: indexSeriesAtBaseYear(g0, gdpLevelsIndexedBaseYear),
      investment: indexSeriesAtBaseYear(i0, gdpLevelsIndexedBaseYear),
    };
  }, [
    isGdpMacroNationalAccounts,
    gdpLevelsDisplayMode,
    gdpLevelsIndexedBaseYear,
    gdpLevelConsumptionPoints,
    gdpLevelGdpPoints,
    gdpLevelInvestmentPoints,
    isGdpIranLocal,
    gdpStudyView,
    gdpLevelsValueType,
    monetarySeriesMode,
    usCpiMonthlyPoints,
  ]);

  /** Reference-style dual-axis: left = consumption + investment; right = GDP (same unit basis as levels view). */
  const gdpLevelsDualAxisYAxisNameOverrides = useMemo((): Partial<Record<number, string>> | undefined => {
    if (!isGdpMacroNationalAccounts) return undefined;
    const isFaInner = supportsIranStudyFa(studyId) && studyLocale === "fa";
    if (gdpLevelsDisplayMode === "indexed" && gdpLevelsIndexedBaseYearLabel) {
      return isFaInner
        ? {
            0: `مصرف و سرمایه‌گذاری (× در برابر ${gdpLevelsIndexedBaseYearLabel})`,
            1: `${faEconomic.gdp} (× در برابر ${gdpLevelsIndexedBaseYearLabel})`,
          }
        : {
            0: `Consumption & investment (× vs ${gdpLevelsIndexedBaseYearLabel})`,
            1: `GDP (× vs ${gdpLevelsIndexedBaseYearLabel})`,
          };
    }
    const u = (gdpLevelsUnit ?? "US$").trim() || "US$";
    return isFaInner
      ? {
          0: `مصرف و سرمایه‌گذاری (${u})`,
          1: `${faEconomic.gdp} (${u})`,
        }
      : {
          0: `Consumption & investment (${u})`,
          1: `GDP (${u})`,
        };
  }, [
    isGdpMacroNationalAccounts,
    gdpLevelsUnit,
    gdpLevelsDisplayMode,
    gdpLevelsIndexedBaseYearLabel,
    studyId,
    studyLocale,
  ]);

  useEffect(() => {
    if (gdpLevelsDisplayMode === "indexed" && gdpLevelsIndexedBaseYear == null) {
      setGdpLevelsDisplayMode("absolute");
    }
  }, [gdpLevelsDisplayMode, gdpLevelsIndexedBaseYear]);

  /** Extend annual production series to current year for display; synthetic points flagged for tooltip. */
  const {
    extendedProductionUsPoints,
    extendedProductionSaudiPoints,
    extendedProductionRussiaPoints,
    extendedProductionIranPoints,
    extendedProductionTotalPoints,
    productionExtendedDates,
    productionLastOfficialDate,
  } = useMemo(() => {
    const currentYear = new Date().getUTCFullYear();
    const extend = (points: { date: string; value: number }[]) => {
      if (points.length === 0) return [];
      const last = points[points.length - 1]!;
      const lastYear = parseInt(last.date.slice(0, 4), 10);
      if (currentYear <= lastYear) return points;
      return [
        ...points,
        { date: `${currentYear}-01-01`, value: last.value, isExtended: true },
      ];
    };
    const us = extend(productionUsPoints);
    const saudi = extend(productionSaudiPoints);
    const russia = extend(productionRussiaPoints);
    const iran = extend(productionIranPoints);
    // Use API total when available; otherwise compute from country series (fallback for older API/cache)
    const totalFromApi = extend(productionTotalPoints);
    const totalComputed =
      totalFromApi.length > 0
        ? totalFromApi
        : (() => {
            const byDate = new Map<string, number>();
            for (const p of productionUsPoints) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
            for (const p of productionSaudiPoints) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
            for (const p of productionRussiaPoints) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
            for (const p of productionIranPoints) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
            const computed = [...byDate.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
            return extend(computed);
          })();
    const allLastDates = [
      ...productionUsPoints.map((p) => p.date),
      ...productionSaudiPoints.map((p) => p.date),
      ...productionRussiaPoints.map((p) => p.date),
      ...productionIranPoints.map((p) => p.date),
    ];
    const lastOfficial = allLastDates.length > 0 ? allLastDates.sort().at(-1)! : "";
    const extendedDates =
      currentYear > parseInt(lastOfficial.slice(0, 4), 10)
        ? [`${currentYear}-01-01`]
        : [];
    return {
      extendedProductionUsPoints: us,
      extendedProductionSaudiPoints: saudi,
      extendedProductionRussiaPoints: russia,
      extendedProductionIranPoints: iran,
      extendedProductionTotalPoints: totalComputed,
      productionExtendedDates: extendedDates,
      productionLastOfficialDate: lastOfficial ? lastOfficial.slice(0, 4) : undefined,
    };
  }, [productionUsPoints, productionSaudiPoints, productionRussiaPoints, productionIranPoints, productionTotalPoints]);

  /** Minimum exporters for a year to be shown (hides incomplete Comtrade data, e.g. 2025 with only 2 countries). */
  const MIN_EXPORTERS_FOR_YEAR = 5;

  const networkYears = useMemo(() => {
    const yrs = Object.keys(networkYearsData)
      .filter((y) => {
        const edges = networkYearsData[y] ?? [];
        if (edges.length === 0) return false;
        const exporterCount = new Set(edges.map((e) => e.source)).size;
        return exporterCount >= MIN_EXPORTERS_FOR_YEAR;
      })
      .sort();
    return yrs;
  }, [networkYearsData]);

  const { networkNodesForYear, networkEdgesForYear, networkExporterOrder, networkNodeColorOrder } = useMemo(() => {
    const yrsWithData = Object.keys(networkYearsData)
      .filter((y) => {
        const edges = networkYearsData[y] ?? [];
        if (edges.length === 0) return false;
        return new Set(edges.map((e) => e.source)).size >= MIN_EXPORTERS_FOR_YEAR;
      })
      .sort();
    const selectedEdges = networkYearsData[networkSelectedYear ?? ""] ?? [];
    const selectedHasEnoughExporters =
      selectedEdges.length > 0 &&
      new Set(selectedEdges.map((e) => e.source)).size >= MIN_EXPORTERS_FOR_YEAR;
    const year =
      networkSelectedYear && selectedHasEnoughExporters
        ? networkSelectedYear
        : yrsWithData[yrsWithData.length - 1] || "";
    const edges = year ? (networkYearsData[year] ?? []) : [];
    const ids = new Set<string>();
    for (const e of edges) {
      ids.add(e.source);
      ids.add(e.target);
    }
    const nodes = [...ids].sort().map((id) => ({ id }));

    const totalExports: Record<string, number> = {};
    const totalByCountry: Record<string, number> = {};
    for (const y of yrsWithData) {
      for (const e of networkYearsData[y] ?? []) {
        totalExports[e.source] = (totalExports[e.source] ?? 0) + e.value;
        totalByCountry[e.source] = (totalByCountry[e.source] ?? 0) + e.value;
        totalByCountry[e.target] = (totalByCountry[e.target] ?? 0) + e.value;
      }
    }
    const exporterOrder = Object.keys(totalExports).sort(
      (a, b) => (totalExports[b] ?? 0) - (totalExports[a] ?? 0)
    );
    const networkAliases = { ...EXPORTER_ALIASES, ...IMPORTER_ALIASES };
    const nodeColorOrder = orderForColors(
      Object.keys(totalByCountry),
      CANONICAL_NETWORK_ORDER,
      networkAliases
    );

    return {
      networkNodesForYear: nodes,
      networkEdgesForYear: edges,
      networkExporterOrder: exporterOrder,
      networkNodeColorOrder: nodeColorOrder,
    };
  }, [networkYearsData, networkSelectedYear]);

  const {
    networkDisplayNodes,
    networkDisplayEdges,
    networkNodeOrder,
    sankeyDisplayEdges,
    sankeyExporterOrder,
    sankeyImporterOrder,
    isAllDataMode,
  } = useMemo(() => {
    if (oilTradeSource !== "db") {
      return {
        networkDisplayNodes: networkNodesForYear,
        networkDisplayEdges: networkEdgesForYear,
        networkNodeOrder: undefined as string[] | undefined,
        sankeyDisplayEdges: networkEdgesForYear,
        sankeyExporterOrder: undefined as string[] | undefined,
        sankeyImporterOrder: undefined as string[] | undefined,
        isAllDataMode: false,
      };
    }
    const { nodes, edges: networkEdges } = filterForNetwork(networkEdgesForYear);
    const sankeyEdges = filterForSankey(networkEdgesForYear);
    // Use totals from ALL years so order stays stable when switching years
    const globalExports: Record<string, number> = {};
    const globalImports: Record<string, number> = {};
    for (const year of Object.keys(networkYearsData)) {
      const yearSankey = filterForSankey(networkYearsData[year] ?? []);
      const yearNetwork = filterForNetwork(networkYearsData[year] ?? []);
      for (const e of yearSankey) {
        globalExports[e.source] = (globalExports[e.source] ?? 0) + e.value;
        globalImports[e.target] = (globalImports[e.target] ?? 0) + e.value;
      }
      for (const e of yearNetwork.edges) {
        globalExports[e.source] = (globalExports[e.source] ?? 0) + e.value;
        globalImports[e.target] = (globalImports[e.target] ?? 0) + e.value;
      }
    }
    const globalTrade = (id: string) => (globalExports[id] ?? 0) + (globalImports[id] ?? 0);
    const net = (id: string) => (globalExports[id] ?? 0) - (globalImports[id] ?? 0);
    const exporterIds = [...new Set(sankeyEdges.map((e) => e.source))].filter((id) => net(id) > 0);
    const importerIds = [...new Set(sankeyEdges.map((e) => e.target))].filter((id) => net(id) <= 0);
    const exporterOrder = orderWithCanonical(
      exporterIds,
      CANONICAL_EXPORTER_ORDER,
      globalExports,
      EXPORTER_ALIASES
    );
    const importerOrder = orderWithCanonical(
      importerIds,
      CANONICAL_IMPORTER_ORDER,
      globalImports,
      IMPORTER_ALIASES
    );
    const nodeIds = nodes.map((n) => n.id);
    const networkNodeOrder = orderWithCanonical(
      nodeIds,
      CANONICAL_NETWORK_ORDER,
      Object.fromEntries(nodeIds.map((id) => [id, globalTrade(id)])),
      { ...EXPORTER_ALIASES, ...IMPORTER_ALIASES }
    );
    return {
      networkDisplayNodes: nodes,
      networkDisplayEdges: networkEdges,
      networkNodeOrder,
      sankeyDisplayEdges: sankeyEdges,
      sankeyExporterOrder: exporterOrder,
      sankeyImporterOrder: importerOrder,
      isAllDataMode: true,
    };
  }, [networkNodesForYear, networkEdgesForYear, networkYearsData, oilTradeSource]);

  /** Iran unified FX study: optional anchor window (same controls as former USD→Toman). */
  const fxIranRegimeTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isFxIranCurrencyRegime) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRangeDays(anchorDate, effectiveWindowValue);
      }
    }
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isFxIranCurrencyRegime, anchorEventId, events, effectiveWindowValue]);

  /** Spread (%) vs official *calendar year* date: open = mean of all open-market days in that Gregorian year. */
  const fxDualYearSpreadPoints = useMemo(() => {
    if (fxDualOfficialPoints.length === 0 || fxDualOpenPoints.length === 0) return [];
    const meanOpenForYear = (year: string) => {
      const pts = fxDualOpenPoints.filter((o) => o.date.slice(0, 4) === year);
      if (pts.length === 0) return null;
      return pts.reduce((s, p) => s + p.value, 0) / pts.length;
    };
    return fxDualOfficialPoints
      .map((p) => {
        const y = p.date.slice(0, 4);
        const openAvg = meanOpenForYear(y);
        if (openAvg == null || p.value === 0) return null;
        return { date: p.date, value: ((openAvg - p.value) / p.value) * 100 };
      })
      .filter((q): q is { date: string; value: number } => q != null);
  }, [fxDualOfficialPoints, fxDualOpenPoints]);

  const wageTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isWageCpiReal) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    return study.timeRange;
  }, [study, isWageCpiReal, anchorEventId, events, effectiveWindowYears]);

  const fxTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilAndFx) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRangeDays(anchorDate, effectiveWindowValue);
      }
    }
    return study.timeRange;
  }, [study, isOilAndFx, anchorEventId, events, effectiveWindowValue]);

  const dualTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilAndFx) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRangeDays(anchorDate, effectiveWindowValue);
      }
    }
    return study.timeRange;
  }, [study, isOilAndFx, anchorEventId, events, effectiveWindowValue]);

  const pppEarlierPeriodMedian = useMemo(() => {
    if (!isOilPppIran || pppIranPoints.length === 0) return undefined;
    const earlier = pppIranPoints.filter((p) => p.date < "2016-01-01").map((p) => p.value);
    if (earlier.length === 0) return undefined;
    const sorted = [...earlier].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }, [isOilPppIran, pppIranPoints]);

  const wageRealPoints = useMemo(() => {
    if (wageNominalPoints.length === 0 || wageCpiPoints.length === 0 || wageBaseYear == null) return [];
    const cpiByDate = new Map(wageCpiPoints.map((p) => [p.date, p.value]));
    const baseYearStr = String(wageBaseYear);
    const cpiBasePoint = [...wageCpiPoints]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((p) => p.date.slice(0, 4) === baseYearStr);
    const cpiBase = cpiBasePoint?.value;
    if (cpiBase == null || cpiBase <= 0) return [];
    return wageNominalPoints
      .map((p) => {
        const cpi = cpiByDate.get(p.date);
        if (cpi == null || cpi <= 0) return null;
        return { date: p.date, value: Math.round((p.value * cpiBase) / cpi * 100) / 100 };
      })
      .filter((q): q is { date: string; value: number } => q != null);
  }, [wageNominalPoints, wageCpiPoints, wageBaseYear]);

  const wageIndexPoints = useMemo(() => {
    if (wageRealPoints.length === 0) return [];
    const baseVal = wageRealPoints[0]?.value;
    if (baseVal == null || baseVal <= 0) return [];
    return wageRealPoints.map((p) => ({
      date: p.date,
      value: Math.round((p.value / baseVal) * 1000) / 10,
    }));
  }, [wageRealPoints]);

  // Wage chart: API returns million rials/month. 1 toman = 10 rials → 1 million rials = 100k tomans.
  const MILLION_RIALS_TO_K_TOMANS = 100;
  /** Nominal and real wage in thousand tomans/month (k tomans) for chart. */
  const wageNominalKTomans = useMemo(
    () =>
      wageNominalPoints.map((p) => ({
        date: p.date,
        value: Math.round(p.value * MILLION_RIALS_TO_K_TOMANS * 10) / 10,
      })),
    [wageNominalPoints],
  );
  const wageRealKTomans = useMemo(
    () =>
      wageRealPoints.map((p) => ({
        date: p.date,
        value: Math.round(p.value * MILLION_RIALS_TO_K_TOMANS * 10) / 10,
      })),
    [wageRealPoints],
  );

  const ipcWageRealPoints = useMemo(() => {
    if (ipcWageNominalPoints.length === 0 || ipcWageCpiPoints.length === 0 || ipcWageBaseYear == null) return [];
    const cpiByDate = new Map(ipcWageCpiPoints.map((p) => [p.date, p.value]));
    const baseYearStr = String(ipcWageBaseYear);
    const cpiBasePoint = [...ipcWageCpiPoints]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((p) => p.date.slice(0, 4) === baseYearStr);
    const cpiBase = cpiBasePoint?.value;
    if (cpiBase == null || cpiBase <= 0) return [];
    return ipcWageNominalPoints
      .map((p) => {
        const cpi = cpiByDate.get(p.date);
        if (cpi == null || cpi <= 0) return null;
        return { date: p.date, value: Math.round((p.value * cpiBase) / cpi * 100) / 100 };
      })
      .filter((q): q is { date: string; value: number } => q != null);
  }, [ipcWageNominalPoints, ipcWageCpiPoints, ipcWageBaseYear]);

  const ipcWageRealKTomans = useMemo(
    () =>
      ipcWageRealPoints.map((p) => ({
        date: p.date,
        value: Math.round(p.value * MILLION_RIALS_TO_K_TOMANS * 10) / 10,
      })),
    [ipcWageRealPoints],
  );

  const sanctionsPeriodsFromEvents = useMemo(() => {
    if (!isOilExportCapacity || !showSanctionsPeriods || !showTimeSeriesEventOverlay || !study) return undefined;
    const rangeEnd = exportCapacityTimeRange?.[1] ?? study.timeRange[1];
    return events
      .filter((e): e is Event & { date_start: string } => e.scope === "oil_exports" && !!e.date_start)
      .map((e) => ({
        date_start: e.date_start,
        date_end: e.date_end ?? rangeEnd,
        title: e.title,
        scope: "Oil exports" as const,
      }));
  }, [isOilExportCapacity, showSanctionsPeriods, showTimeSeriesEventOverlay, study, events, exportCapacityTimeRange]);

  const exportCapacityOilDisplayed = useMemo(() => {
    if (!isOilExportCapacity || monetarySeriesMode === "nominal" || usCpiMonthlyPoints.length === 0)
      return exportCapacityOilPoints;
    return deflateNominalUsdPointsWithUsCpi(exportCapacityOilPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR);
  }, [isOilExportCapacity, monetarySeriesMode, usCpiMonthlyPoints, exportCapacityOilPoints]);

  const oilPointsUsdDisplay = useMemo(() => {
    const eligible =
      isOilBrent ||
      isOilGlobalLong ||
      isGoldAndOil ||
      isOilAndFx ||
      isOilGeopoliticalReaction;
    if (!eligible || monetarySeriesMode === "nominal" || usCpiMonthlyPoints.length === 0) return oilPoints;
    return deflateNominalUsdPointsWithUsCpi(oilPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR) as typeof oilPoints;
  }, [
    isOilBrent,
    isOilGlobalLong,
    isGoldAndOil,
    isOilAndFx,
    isOilGeopoliticalReaction,
    monetarySeriesMode,
    usCpiMonthlyPoints,
    oilPoints,
  ]);

  const goldPointsUsdDisplay = useMemo(() => {
    const wantGold =
      (isGoldAndOil || (isOilAndFx && showGold)) &&
      monetarySeriesMode === "real" &&
      usCpiMonthlyPoints.length > 0;
    if (!wantGold) return goldPoints;
    return deflateNominalUsdPointsWithUsCpi(goldPoints, usCpiMonthlyPoints, USD_CPI_REAL_BASE_YEAR);
  }, [isGoldAndOil, isOilAndFx, showGold, monetarySeriesMode, usCpiMonthlyPoints, goldPoints]);

  const usdTooltipBasisNote = useMemo(
    () =>
      monetarySeriesMode === "nominal"
        ? L(isFa, "Nominal USD", "دلار اسمی")
        : L(isFa, `Real USD (${USD_CPI_REAL_BASE_YEAR}-adjusted)`, `دلار واقعی (تعدیل ${USD_CPI_REAL_BASE_YEAR})`),
    [monetarySeriesMode, isFa]
  );

  const cpiDeflationExtraExport = useMemo(
    () =>
      monetarySeriesMode === "real" && usCpiMonthlyPoints.length > 0
        ? "FRED CPIAUCSL (US CPI; 2020 USD)"
        : null,
    [monetarySeriesMode, usCpiMonthlyPoints.length]
  );

  const wageTooltipBasisNote = useMemo(
    () =>
      !isWageCpiReal
        ? ""
        : monetarySeriesMode === "nominal"
          ? L(isFa, "Nominal (k tomans/month)", "اسمی (هزار تومان/ماه)")
          : L(isFa, "Real (CPI-adjusted)", "واقعی (تعدیل‌شده با CPI)"),
    [isWageCpiReal, monetarySeriesMode, isFa]
  );

  const wageChartMultiSeries = useMemo((): ChartSeries[] => {
    if (!isWageCpiReal) return [];
    if (monetarySeriesMode === "nominal") {
      return [
        {
          key: "nominal",
          label: L(isFa, "Nominal minimum wage", "دستمزد اسمی"),
          yAxisIndex: 0,
          unit: "k tomans/month",
          points: wageNominalKTomans,
          color: SIGNAL_CONCEPT.wage_nominal,
          symbol: "circle",
          symbolSize: CHART_LINE_SYMBOL_SIZE,
        },
      ];
    }
    const series: ChartSeries[] = [
      {
        key: "real",
        label: L(isFa, "Real minimum wage", "دستمزد واقعی"),
        yAxisIndex: 0,
        unit: `k tomans/month (${wageBaseYear ?? ""} prices)`,
        points: wageRealKTomans,
        color: SIGNAL_CONCEPT.wage_real,
        symbol: "diamond",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
      },
    ];
    if (showWageIndex) {
      series.push({
        key: "index",
        label: L(isFa, "Real wage index", "شاخص دستمزد واقعی"),
        yAxisIndex: 1,
        unit: "Index (base=100)",
        points: wageIndexPoints,
        color: SIGNAL_CONCEPT.wage_index,
        symbol: "triangle",
        symbolSize: CHART_LINE_SYMBOL_SIZE,
      });
    }
    return series;
  }, [
    isWageCpiReal,
    monetarySeriesMode,
    showWageIndex,
    wageNominalKTomans,
    wageRealKTomans,
    wageIndexPoints,
    wageBaseYear,
    isFa,
  ]);

  const oilPointsWithVolatility = useMemo(
    () => enrichOilPointsWithVolatility(oilPointsUsdDisplay),
    [oilPointsUsdDisplay]
  );
  const latestBrentObservation = useMemo(() => {
    if (!isOilBrent || oilPointsUsdDisplay.length === 0) return null;
    const sorted = [...oilPointsUsdDisplay].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1] ?? null;
  }, [isOilBrent, oilPointsUsdDisplay]);
  const latestFxObservation = useMemo(() => {
    if (!isFxIranCurrencyRegime || fxDualOpenPoints.length === 0) return null;
    const sorted = [...fxDualOpenPoints].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1] ?? null;
  }, [isFxIranCurrencyRegime, fxDualOpenPoints]);
  const oilShockDates = useMemo(
    () => oilPointsWithVolatility.filter((p) => p.is_shock).map((p) => p.date),
    [oilPointsWithVolatility]
  );

  const geopoliticalStats = useMemo(() => {
    if (!isOilGeopoliticalReaction || oilPointsWithVolatility.length === 0) return null;
    const sorted = [...oilPointsWithVolatility].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    if (!latest) return null;
    const byDate = new Map(sorted.map((p) => [p.date, p]));
    const change1d = latest.daily_return ?? null;
    const sevenDaysAgo = (() => {
      const d = new Date(latest.date);
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    })();
    const price7dAgo = byDate.get(sevenDaysAgo)?.value ?? null;
    const current = latest.value;
    const change7d = price7dAgo != null ? ((current - price7dAgo) / price7dAgo) * 100 : null;
    const last30 = sorted.slice(-31);
    const returns = last30
      .map((p, i) => (i > 0 ? (p.value - last30[i - 1]!.value) / last30[i - 1]!.value : null))
      .filter((r): r is number => r != null);
    const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance =
      returns.length >= 2
        ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
        : 0;
    const vol30 = variance > 0 ? Math.sqrt(variance) * 100 : null;
    return {
      current,
      change1d,
      change7d,
      vol30,
      latestDate: latest.date,
    };
  }, [isOilGeopoliticalReaction, oilPointsWithVolatility]);

  const geopoliticalChartData = useMemo(() => {
    if (!isOilGeopoliticalReaction || oilPointsUsdDisplay.length === 0)
      return { timeRange: null as [string, string] | null, points: [] as Array<{ date: string; value: number }> };
    const sorted = [...oilPointsUsdDisplay].sort((a, b) => a.date.localeCompare(b.date));
    const endDate = sorted[sorted.length - 1]?.date;
    if (!endDate) return { timeRange: null, points: [] };
    const start = new Date(endDate);
    start.setDate(start.getDate() - geopoliticalWindowDays);
    const startStr = start.toISOString().slice(0, 10);
    const filtered = sorted.filter((p) => p.date >= startStr && p.date <= endDate);
    return {
      timeRange: [startStr, endDate] as [string, string],
      points: filtered,
    };
  }, [isOilGeopoliticalReaction, oilPointsUsdDisplay, geopoliticalWindowDays]);
  const dailyReturnPoints = useMemo(() => {
    const byDate = new Map(oilPointsWithVolatility.map((p) => [p.date, p.daily_return]));
    const dates = [...new Set(oilPointsWithVolatility.map((p) => p.date))].sort();
    return dates.map((date) => ({
      date,
      value: byDate.get(date) as number | null,
    }));
  }, [oilPointsWithVolatility]);

  useEffect(() => {
    if (!study || isGlobalEventsTimeline || isBandEventsTimeline || isComparativeHistoryTimeline) return;
    let mounted = true;
    const params = new URLSearchParams({
      study_id: isOilGeopoliticalReaction
        ? "oil_major_exporters"
        : isFxIranCurrencyRegime || isOilAndFx
          ? "iran"
          : studyId,
    });
    const hasEventLayers =
      isOverviewStub ||
      isOilBrent ||
      isOilGlobalLong ||
      isGoldAndOil ||
      isFxIranCurrencyRegime ||
      isOilAndFx ||
      isRealOil ||
      isOilPppIran ||
      isOilExportCapacity ||
      isOilProductionMajorExporters ||
      isWageCpiReal ||
      isEventsTimeline ||
      isOilGeopoliticalReaction ||
      isGdpComposition ||
      isGdpIranAccountsDual ||
      isGiniInequality ||
      isInflationCpiYoy ||
      isGdpGlobalComparison ||
      isIsiDiagnostics ||
      isPovertyHeadcountIran ||
      isIranMoneySupplyM2 ||
      isDutchDiseaseDiagnostics ||
      isOilEconomyOverview ||
      isIranEconomyReconstruction1368 ||
      isIranEconomyPeriodComparison ||
      isOilExporterTimeseries ||
      isFxIranCurrencyRegime;
    if (hasEventLayers && !isEventsTimeline) {
      let layers: string[];
      if (!showTimeSeriesEventOverlay) {
        layers = [];
      } else if (isOilExporterTimeseries) {
        layers = ["global_macro_oil", "world_core", "opec_decisions"];
      } else if (isOilEconomyOverview) {
        layers = ["iran_core", "global_macro_oil", "opec_decisions", "sanctions", "world_core"];
      } else if (isFxIranCurrencyRegime) {
        layers = ["iran_core", "global_macro_oil", "world_core", "sanctions"];
      } else {
        const studyLayersLen = study.eventLayers?.length ?? 0;
        if (
          ((isOilGlobalLong ||
            isGoldAndOil ||
            isRealOil ||
            isOilExportCapacity ||
            isOilProductionMajorExporters ||
            isOilGeopoliticalReaction ||
            isGdpComposition ||
            isGdpIranAccountsDual ||
            isGiniInequality ||
            isInflationCpiYoy ||
            isGdpGlobalComparison ||
            isIsiDiagnostics ||
            isPovertyHeadcountIran ||
            isIranMoneySupplyM2 ||
            isDutchDiseaseDiagnostics ||
            isIranEconomyReconstruction1368 ||
            isIranEconomyPeriodComparison) &&
            studyLayersLen > 0) ||
          (hasTurkeyComparator && studyLayersLen > 0)
        ) {
          if (isOilGeopoliticalReaction) {
            layers = [
              ...(showGeopoliticalWorldCore ? ["world_core"] : []),
              ...(showGeopoliticalWorld1900 ? ["world_1900"] : []),
              ...(showGeopoliticalSanctions ? ["sanctions"] : []),
              ...(showGeopoliticalOpec ? ["opec_decisions"] : []),
              ...(showGlobalMacroOil ? ["global_macro_oil"] : []),
            ];
          } else if (isOilExportCapacity) {
            layers = showSanctionsPeriods ? ["sanctions"] : [];
          } else if (isOilProductionMajorExporters) {
            // Study 14: fetch all toggled layers; filter client-side for instant toggle updates
            layers = [
              "iran_core",
              "sanctions",
              "opec_decisions",
              ...(showGlobalMacroOil ? ["global_macro_oil"] : []),
            ];
          } else if (isGdpComposition || isGdpIranAccountsDual) {
            layers = [
              ...(showGdpIranEvents ? ["iran_core"] : []),
              ...(showGdpGlobalMacroOil ? ["global_macro_oil"] : []),
            ];
          } else if (
            isGiniInequality ||
            isInflationCpiYoy ||
            isGdpGlobalComparison ||
            isIsiDiagnostics ||
            isPovertyHeadcountIran ||
            isIranMoneySupplyM2 ||
            isDutchDiseaseDiagnostics ||
            isIranEconomyReconstruction1368 ||
            isIranEconomyPeriodComparison
          ) {
            layers = [
              ...(showIranEvents ? ["iran_core"] : []),
              ...(showWorldEvents ? ["world_core"] : []),
              ...(showSanctionsEvents ? ["sanctions"] : []),
            ];
          } else {
            layers = studyEventLayersForFetch(study.eventLayers, chartEventToggleState, {
              allowPresidentialLayer: isFxIranCurrencyRegime || isOilPppIran,
              appendGlobalMacroOilIfMissing: true,
              studyUsesGlobalMacroOilLayer: studyUsesGlobalMacroOilLayer(study),
            });
          }
        } else {
          layers = [
            ...(showIranEvents ? ["iran_core"] : []),
            ...(showWorldEvents ? ["world_core", "world_1900"] : []),
            ...(showSanctionsEvents ? ["sanctions"] : []),
            ...(showPresidentialTerms && (isFxIranCurrencyRegime || isOilPppIran) ? ["iran_presidents"] : []),
            ...(showGlobalMacroOil && studyUsesGlobalMacroOilLayer(study) ? ["global_macro_oil"] : []),
          ];
        }
      }
      params.set("layers", layers.length ? layers.join(",") : "none");
    }
    if (isEventsTimeline) {
      params.set("study_id", "events_timeline");
    }
    fetchJson<EventsData>(`/api/events?${params}`)
      .then((res) => {
        if (mounted) {
          setEvents(res.events ?? []);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [
    studyId,
    study,
    isOverviewStub,
    isOilBrent,
    isOilGlobalLong,
    isGoldAndOil,
    isFxIranCurrencyRegime,
    isOilAndFx,
    isRealOil,
    isOilPppIran,
    isOilExportCapacity,
    isOilProductionMajorExporters,
    isOilGeopoliticalReaction,
    isWageCpiReal,
    isGdpComposition,
    isGdpIranAccountsDual,
    isGiniInequality,
    isInflationCpiYoy,
    isGdpGlobalComparison,
    isIsiDiagnostics,
    isPovertyHeadcountIran,
    isIranMoneySupplyM2,
    isDutchDiseaseDiagnostics,
    isOilEconomyOverview,
    isIranEconomyReconstruction1368,
    isIranEconomyPeriodComparison,
    isOilExporterTimeseries,
    hasTurkeyComparator,
    isEventsTimeline,
    isGlobalEventsTimeline,
    isBandEventsTimeline,
    isComparativeHistoryTimeline,
    chartEventToggleState,
    showSanctionsPeriods,
    showTimeSeriesEventOverlay,
    showGeopoliticalWorldCore,
    showGeopoliticalWorld1900,
    showGeopoliticalSanctions,
    showGeopoliticalOpec,
    showGdpIranEvents,
    showGdpGlobalMacroOil,
  ]);

  useEffect(() => {
    if (
      study &&
      (isEventsTimeline ||
        isGlobalEventsTimeline ||
        isBandEventsTimeline ||
        isComparativeHistoryTimeline ||
        isFollowerGrowthDynamics ||
        isYoutubeCommentAnalysis)
    ) {
      setLoading(false);
    }
  }, [
    study,
    isEventsTimeline,
    isGlobalEventsTimeline,
    isBandEventsTimeline,
    isComparativeHistoryTimeline,
    isFollowerGrowthDynamics,
    isYoutubeCommentAnalysis,
  ]);

  const fetchYoutubeAnalysis = useCallback(
    async (forceRefresh: boolean, forceRecompute: boolean = false, adminCode?: string) => {
      if (!study) return;
      setAnalysisLoading(true);
      setAnalysisError(null);
      if (!forceRefresh) setAnalysisData(null);
      const channelId = study.youtubeChannelId ?? "UChWB95_-n9rUc3H9srsn9bQ";
      const videosLimit = YOUTUBE_DISCOURSE_VIDEOS_LIMIT;
      const commentsPerVideo = YOUTUBE_DISCOURSE_COMMENTS_PER_VIDEO;
      const params = new URLSearchParams({
        channel_id: channelId,
        videos_limit: String(videosLimit),
        comments_per_video: String(commentsPerVideo),
        _: String(Date.now()),
      });
      if (forceRefresh) params.set("refresh", "1");
      if (forceRecompute) params.set("recompute", "1");
      if (forceRefresh && adminCode?.trim()) params.set("admin_code", adminCode.trim());
      const url = `/api/youtube/channel/comment-analysis?${params.toString()}`;
      try {
        const res = await fetchJson<{
          channel_id: string;
          channel_name?: string | null;
          channel_owner?: string | null;
          channel_title?: string | null;
          videos_analyzed: number;
          videos?: Array<{ title: string; published_at: string; video_id: string }>;
          comments_analyzed?: number;
          total_comments: number;
          time_range?: { start?: string; end?: string };
          time_period_start?: string | null;
          time_period_end?: string | null;
          language?: string | null;
          avg_sentiment: number;
          top_words: [string, number][];
          discourse_comments?: string[];
          points_pca?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
          points_umap?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
          points_tfidf?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
          points_hdbscan?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
          points_minilm?: Array<{ x: number; y: number; text: string } | [number, number, number]>;
          cluster_labels?: Array<{ x: number; y: number; label: string }>;
          cluster_labels_pca?: Array<{ x: number; y: number; label: string }>;
          cluster_labels_tfidf?: Array<{ x: number; y: number; label: string }>;
          cluster_labels_hdbscan?: Array<{ x: number; y: number; label: string }>;
          cluster_labels_minilm?: Array<{ x: number; y: number; label: string }>;
          cluster_stats_pca?: { clusters: number; noise_count: number; total: number };
          cluster_stats_tfidf?: { clusters: number; noise_count: number; total: number };
          cluster_stats_hdbscan?: { clusters: number; noise_count: number; total: number };
          cluster_stats_minilm?: { clusters: number; noise_count: number; total: number };
          cluster_assignments_pca?: number[];
          cluster_assignments_tfidf?: number[];
          cluster_assignments_hdbscan?: number[];
          cluster_assignments_minilm?: number[];
          clusters_summary_pca?: Array<{ label: string; size: number; percent: number }>;
          clusters_summary_tfidf?: Array<{ label: string; size: number; percent: number }>;
          clusters_summary_hdbscan?: Array<{ label: string; size: number; percent: number }>;
          clusters_summary_minilm?: Array<{ label: string; size: number; percent: number }>;
          comments: Array<Record<string, unknown>>;
        }>(url);
        if (res.channel_id === channelId) setAnalysisData(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fetch failed";
        if (forceRefresh && (msg.includes("403") || msg.includes("Admin code"))) {
          // Wrong admin code: silently return, keep existing data
        } else {
          setAnalysisError(msg);
        }
      } finally {
        setAnalysisLoading(false);
      }
    },
    [study]
  );

  useEffect(() => {
    if (!study || !isYoutubeCommentAnalysis) return;
    let mounted = true;
    fetchYoutubeAnalysis(false).finally(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [study, isYoutubeCommentAnalysis, fetchYoutubeAnalysis]);

  useEffect(() => {
    if (!study || !isOilTradeNetwork) return;
    let mounted = true;
    setLoading(true);
    fetchJson<{ years: Record<string, NetworkEdge[]> }>(
      `/api/networks/oil-trade?start_year=2010&end_year=${study?.timeRange?.[1] ?? new Date().getFullYear()}&source=${oilTradeSource}`
    )
      .then((res) => {
        if (mounted && res.years) {
          const normalized: Record<string, NetworkEdge[]> = {};
          for (const [year, edges] of Object.entries(res.years)) {
            const agg: Record<string, Record<string, number>> = {};
            for (const e of edges ?? []) {
              const src = toDisplayName(e.source);
              const tgt = toDisplayName(e.target);
              if (!agg[src]) agg[src] = {};
              agg[src][tgt] = (agg[src][tgt] ?? 0) + e.value;
            }
            normalized[year] = [];
            for (const src of Object.keys(agg)) {
              for (const tgt of Object.keys(agg[src]!)) {
                normalized[year].push({ source: src, target: tgt, value: agg[src]![tgt]! });
              }
            }
          }
          setNetworkYearsData(normalized);
          const yrsWithData = Object.keys(normalized)
            .filter((y) => {
              const edges = normalized[y] ?? [];
              if (edges.length === 0) return false;
              return new Set(edges.map((e) => e.source)).size >= 5;
            })
            .sort();
          if (yrsWithData.length > 0) setNetworkSelectedYear(yrsWithData[yrsWithData.length - 1]!);
        }
      })
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Network fetch failed"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [study, isOilTradeNetwork, oilTradeSource]);

  useEffect(() => {
    if (!exporterTimeRange || !isOilExporterTimeseries) {
      if (isOilExporterTimeseries) {
        setExporterCuratedData(null);
        setExporterDbData(null);
        setExporterYMin(undefined);
        setExporterYMax(undefined);
      }
      return;
    }
    const [startYear, endYear] = exporterTimeRange;
    const start = startYear.slice(0, 4);
    const end = endYear.length >= 4 ? endYear.slice(0, 4) : String(new Date().getFullYear());
    const parseEdgesToPoints = (years: Record<string, { source: string; target: string; value: number }[]>) => {
      const saudi: { date: string; value: number }[] = [];
      const russia: { date: string; value: number }[] = [];
      const us: { date: string; value: number }[] = [];
      const iran: { date: string; value: number }[] = [];
      for (const [year, edges] of Object.entries(years)) {
        const bySource: Record<string, number> = {};
        for (const e of edges ?? []) {
          const src = toDisplayName(e.source);
          bySource[src] = (bySource[src] ?? 0) + e.value;
        }
        const date = `${year}-01-01`;
        if (bySource["Saudi Arabia"] != null) saudi.push({ date, value: bySource["Saudi Arabia"] });
        if (bySource["Russia"] != null) russia.push({ date, value: bySource["Russia"] });
        if (bySource["United States"] != null) us.push({ date, value: bySource["United States"] });
        if (bySource["Iran"] != null) iran.push({ date, value: bySource["Iran"] });
      }
      for (const arr of [saudi, russia, us, iran]) arr.sort((a, b) => a.date.localeCompare(b.date));
      return { saudi, russia, us, iran };
    };
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ years: Record<string, { source: string; target: string; value: number }[]> }>(
        `/api/networks/oil-trade?start_year=${start}&end_year=${end}&source=curated`
      ),
      fetchJson<{ years: Record<string, { source: string; target: string; value: number }[]> }>(
        `/api/networks/oil-trade?start_year=${start}&end_year=${end}&source=db`
      ).catch(() => ({ years: {} as Record<string, { source: string; target: string; value: number }[]> })),
    ])
      .then(([curatedRes, dbRes]) => {
        if (!mounted) return;
        const curated = curatedRes.years ? parseEdgesToPoints(curatedRes.years) : null;
        const db = dbRes.years && Object.keys(dbRes.years).length > 0 ? parseEdgesToPoints(dbRes.years) : null;
        setExporterCuratedData(curated);
        setExporterDbData(db);
        const allPoints = [
          ...(curated ? [...curated.saudi, ...curated.russia, ...curated.us, ...curated.iran] : []),
          ...(db ? [...db.saudi, ...db.russia, ...db.us, ...db.iran] : []),
        ];
        if (allPoints.length > 0) {
          const vals = allPoints.map((p) => p.value);
          setExporterYMin(0);
          setExporterYMax(Math.ceil(Math.max(...vals) * 1.05));
        } else {
          setExporterYMin(undefined);
          setExporterYMax(undefined);
        }
      })
      .catch((e) => {
        if (mounted) {
          setExporterCuratedData(null);
          setExporterDbData(null);
          setExporterYMin(undefined);
          setExporterYMax(undefined);
          setError(e instanceof Error ? e.message : "Export data fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [exporterTimeRange, isOilExporterTimeseries]);

  useEffect(() => {
    if (!gdpCompositionTimeRange || !isGdpMacroNationalAccounts) {
      if (isGdpMacroNationalAccounts) {
        setGdpConsumptionPoints([]);
        setGdpInvestmentPoints([]);
        setGdpNominalPoints([]);
        setGdpCompositionSource(null);
        setGdpDataSpan(null);
        setGdpLevelConsumptionPoints([]);
        setGdpLevelGdpPoints([]);
        setGdpLevelInvestmentPoints([]);
        setGdpLevelsUnit(null);
        setGdpLevelsConversionMeta(null);
        setGdpLevelsDisplayNote(null);
      }
      return;
    }
    const [start, end] = gdpCompositionTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<{
      source?: { name?: string; publisher?: string; url?: string };
      data_span?: {
        first_year_any?: number | null;
        last_year_any?: number | null;
        returned_start_year?: number | null;
        returned_end_year?: number | null;
        per_series?: Record<string, { first_year?: number | null; last_year?: number | null }>;
      };
      indicators: {
        final_consumption_pct_gdp: { points: { date: string; value: number }[] };
        gross_capital_formation_pct_gdp: { points: { date: string; value: number }[] };
        gdp_current_usd: { points: { date: string; value: number }[] };
      };
      levels?: {
        price_basis?: string | null;
        unit?: string | null;
        indicators?: {
          consumption: { points: { date: string; value: number }[]; unit?: string };
          gdp: { points: { date: string; value: number }[]; unit?: string };
          investment: { points: { date: string; value: number }[]; unit?: string };
        };
      };
      levels_conversion?: {
        currency?: string;
        basis?: string;
        description?: string;
        display_unit?: string;
      } | null;
      levels_value_type?: string;
      levels_value_type_requested?: string;
      levels_display_note?: string | null;
    }>(
      `/api/signals/macro/gdp-composition?start=${encodeURIComponent(start)}&end=${encodeURIComponent(
        end
      )}&country=IRN&levels_value_type=${isGdpIranLocal ? gdpLevelsValueType : "real"}`
    )
      .then((res) => {
        if (!mounted) return;
        setGdpConsumptionPoints(res.indicators?.final_consumption_pct_gdp?.points ?? []);
        setGdpInvestmentPoints(res.indicators?.gross_capital_formation_pct_gdp?.points ?? []);
        setGdpNominalPoints(res.indicators?.gdp_current_usd?.points ?? []);
        setGdpCompositionSource(res.source ?? null);
        setGdpDataSpan(res.data_span ?? null);
        const lvl = res.levels?.indicators;
        setGdpLevelConsumptionPoints(lvl?.consumption?.points ?? []);
        setGdpLevelGdpPoints(lvl?.gdp?.points ?? []);
        setGdpLevelInvestmentPoints(lvl?.investment?.points ?? []);
        setGdpLevelsUnit(
          res.levels?.indicators?.consumption?.unit ?? res.levels?.indicators?.gdp?.unit ?? res.levels?.unit ?? null
        );
        setGdpLevelsConversionMeta(res.levels_conversion ?? null);
        setGdpLevelsDisplayNote(
          typeof res.levels_display_note === "string" && res.levels_display_note.length > 0
            ? res.levels_display_note
            : null
        );
      })
      .catch((e) => {
        if (mounted) {
          setGdpConsumptionPoints([]);
          setGdpInvestmentPoints([]);
          setGdpNominalPoints([]);
          setGdpCompositionSource(null);
          setGdpDataSpan(null);
          setGdpLevelConsumptionPoints([]);
          setGdpLevelGdpPoints([]);
          setGdpLevelInvestmentPoints([]);
          setGdpLevelsUnit(null);
          setGdpLevelsConversionMeta(null);
          setGdpLevelsDisplayNote(null);
          setError(e instanceof Error ? e.message : "GDP composition fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [gdpCompositionTimeRange, isGdpMacroNationalAccounts, isGdpIranLocal, gdpLevelsValueType]);

  const { exporterSaudiPoints, exporterRussiaPoints, exporterUsPoints, exporterIranPoints } = useMemo(() => {
    const empty = { exporterSaudiPoints: [], exporterRussiaPoints: [], exporterUsPoints: [], exporterIranPoints: [] };
    const data = exporterSource === "db" && exporterDbData ? exporterDbData : exporterCuratedData;
    if (!data) return empty;
    return {
      exporterSaudiPoints: data.saudi,
      exporterRussiaPoints: data.russia,
      exporterUsPoints: data.us,
      exporterIranPoints: data.iran,
    };
  }, [exporterSource, exporterCuratedData, exporterDbData]);

  useEffect(() => {
    let mounted = true;
    fetchJson<{ last_updated: string | null }>("/api/meta/last-update")
      .then((res) => mounted && res.last_updated && setLastUpdated(res.last_updated))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!study || !isOverviewStub) return;
    let mounted = true;
    if (!data) setLoading(true);
    const qs = new URLSearchParams({ study_id: studyId });
    if (anchorEventId) {
      qs.set("anchor_event_id", anchorEventId);
      qs.set("window_days", String(effectiveWindowYears * 365));
    }
    fetchJson<OverviewData>(`/api/overview?${qs}`)
      .then((res) => mounted && setData(res))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, anchorEventId, effectiveWindowYears, data]);

  useEffect(() => {
    if (!oilTimeRange || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran || isOilGeopoliticalReaction)) {
      if (isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran || isOilGeopoliticalReaction) {
        setOilPoints([]);
        setOilSource(null);
        setOilSourceAnnual(null);
        setOilResolutionNote(null);
        if (isGoldAndOil) {
          setGoldPoints([]);
          setGoldSource(null);
        }
        if (isRealOil) {
          setRealOilPoints([]);
          setRealOilSource(null);
          setRealOilMetadata(null);
        }
        if (isOilPppIran) {
          setPppIranPoints([]);
          setPppIranSource(null);
          setPppIranError(null);
        }
      }
      return;
    }
    if (isOilAndFx) return;
    if (isOilPppIran) {
      const [start, end] = oilTimeRange;
      let mounted = true;
      setPppIranLoading(true);
      setPppIranError(null);
      fetchJson<OilPppIranSignalData>(`/api/signals/oil/ppp-iran?start=${start}&end=${end}`)
        .then((res) => {
          if (mounted) {
            setPppIranPoints(res.points ?? []);
            setPppIranSource(res.source ?? null);
            setPppIranError(null);
          }
        })
        .catch((e) => {
          if (mounted) {
            setPppIranPoints([]);
            setPppIranSource(null);
            setPppIranError(e instanceof Error ? e.message : "PPP oil signal fetch failed");
          }
        })
        .finally(() => mounted && setPppIranLoading(false));
      return () => { mounted = false; };
    }
    if (isRealOil) {
      const [start, end] = oilTimeRange;
      let mounted = true;
      setLoading(true);
      setError(null);
      fetchJson<RealOilSignalData>(`/api/signals/oil/real?start=${start}&end=${end}`)
        .then((res) => {
          if (mounted) {
            setRealOilPoints(res.points ?? []);
            setRealOilSource(res.source ?? null);
            setRealOilMetadata(res.metadata ?? null);
          }
        })
        .catch((e) => {
          if (mounted) {
            setRealOilPoints([]);
            setRealOilSource(null);
            setRealOilMetadata(null);
            setError(e instanceof Error ? e.message : "Signal fetch failed");
          }
        })
        .finally(() => mounted && setLoading(false));
      return () => { mounted = false; };
    }
    if (isGoldAndOil) {
      const [start, end] = oilTimeRange;
      let mounted = true;
      setLoading(true);
      setError(null);
      Promise.all([
        fetchJson<OilSignalData>(`/api/signals/gold/global?start=${start}&end=${end}`),
        fetchJson<OilSignalData>(`/api/signals/oil/global-long?start=${start}&end=${end}`),
      ])
        .then(([goldRes, oilRes]) => {
          if (mounted) {
            setGoldPoints(goldRes.points ?? []);
            setGoldSource(goldRes.source ?? null);
            setOilPoints(oilRes.points ?? []);
            setOilSource(oilRes.source ?? null);
            setOilSourceAnnual(oilRes.source_annual ?? null);
            setOilResolutionNote(oilRes.resolution_change ?? null);
          }
        })
        .catch((e) => {
          if (mounted) {
            setGoldPoints([]);
            setGoldSource(null);
            setOilPoints([]);
            setOilSource(null);
            setOilSourceAnnual(null);
            setOilResolutionNote(null);
            setError(e instanceof Error ? e.message : "Signal fetch failed");
          }
        })
        .finally(() => mounted && setLoading(false));
      return () => { mounted = false; };
    }
    const [start, end] = oilTimeRange;
    const url = isOilGlobalLong && !isOilGeopoliticalReaction
      ? `/api/signals/oil/global-long?start=${start}&end=${end}`
      : `/api/signals/oil/brent?start=${start}&end=${end}`;
    let mounted = true;
    setLoading(true);
    setError(null);
    setOilResolutionNote(null);
    fetchJson<OilSignalData>(url)
      .then((res) => {
        if (mounted) {
          setOilPoints(res.points ?? []);
          setOilSource(res.source ?? null);
          setOilResolutionNote(res.resolution_change ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setOilPoints([]);
          setOilSource(null);
          setOilResolutionNote(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [oilTimeRange, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran, isOilGeopoliticalReaction]);

  useEffect(() => {
    if (!oilTimeRange || !isOilPppIran || !hasTurkeyComparator) {
      if (!hasTurkeyComparator) {
        setPppTurkeyPoints([]);
        setPppTurkeySource(null);
      }
      return;
    }
    const [start, end] = oilTimeRange;
    let mounted = true;
    fetchJson<OilPppIranSignalData>(`/api/signals/oil/ppp-turkey?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setPppTurkeyPoints(res.points ?? []);
          setPppTurkeySource(res.source ?? null);
        }
      })
      .catch(() => mounted && (setPppTurkeyPoints([]), setPppTurkeySource(null)));
    return () => { mounted = false; };
  }, [oilTimeRange, isOilPppIran, hasTurkeyComparator]);

  useEffect(() => {
    if (!exportCapacityTimeRange || !isOilExportCapacity) {
      if (!isOilExportCapacity) {
        setExportCapacityOilPoints([]);
        setExportCapacityProxyPoints([]);
      }
      return;
    }
    const [start, end] = exportCapacityTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<{
      oil_price: { points: { date: string; value: number }[] };
      export_volume: { points: { date: string; value: number }[] };
      export_revenue_proxy: { points: { date: string; value: number }[]; base_year?: number };
    }>(`/api/signals/oil/export-capacity?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setExportCapacityOilPoints(res.oil_price?.points ?? []);
          setExportCapacityProxyPoints(res.export_revenue_proxy?.points ?? []);
          setExportCapacityBaseYear(res.export_revenue_proxy?.base_year ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setExportCapacityOilPoints([]);
          setExportCapacityProxyPoints([]);
          setExportCapacityBaseYear(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [exportCapacityTimeRange, isOilExportCapacity]);

  useEffect(() => {
    if (!oilEconomyTimeRange || !isOilEconomyOverview) {
      if (!isOilEconomyOverview) {
        setOilEconomyProdPoints([]);
        setOilEconomyPricePoints([]);
        setOilEconomyRevenuePoints([]);
        setOilEconomyPriceRealPoints([]);
        setOilEconomyRevenueRealPoints([]);
        setOilEconomyInflation(null);
        setOilEconomyProdSource(null);
        setOilEconomyPriceSource(null);
        setOilEconomyRevenueSource(null);
        setOilEconomyProdHistoricalFill(null);
      }
      return;
    }
    const [start, end] = oilEconomyTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<OilEconomyOverviewApi>(
      `/api/signals/oil/economy-overview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    )
      .then((res) => {
        if (mounted) {
          setOilEconomyProdPoints(res.production?.points ?? []);
          setOilEconomyPricePoints(res.price?.points ?? []);
          setOilEconomyRevenuePoints(res.revenue?.points ?? []);
          setOilEconomyPriceRealPoints(res.price_real?.points ?? []);
          setOilEconomyRevenueRealPoints(res.revenue_real?.points ?? []);
          setOilEconomyInflation(
            res.inflation?.base_year != null
              ? { deflator: res.inflation.deflator, deflator_name: res.inflation.deflator_name, base_year: res.inflation.base_year, source: res.inflation.source }
              : null
          );
          setOilEconomyProdSource(res.production?.source ?? null);
          setOilEconomyPriceSource(res.price?.source ?? null);
          setOilEconomyRevenueSource(res.revenue?.source ?? null);
          setOilEconomyProdHistoricalFill(res.production?.source_historical_fill ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setOilEconomyProdPoints([]);
          setOilEconomyPricePoints([]);
          setOilEconomyRevenuePoints([]);
          setOilEconomyPriceRealPoints([]);
          setOilEconomyRevenueRealPoints([]);
          setOilEconomyInflation(null);
          setOilEconomyProdSource(null);
          setOilEconomyPriceSource(null);
          setOilEconomyRevenueSource(null);
          setOilEconomyProdHistoricalFill(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [oilEconomyTimeRange, isOilEconomyOverview]);

  useEffect(() => {
    if (isOilEconomyOverview) {
      setOilEconomyViewStart("");
      setOilEconomyViewEnd("");
      setOilEconomyUsdMode("nominal");
    }
  }, [study?.id, isOilEconomyOverview]);

  useEffect(() => {
    if (!productionTimeRange || !isOilProductionMajorExporters) {
      if (isOilProductionMajorExporters) {
        setProductionUsPoints([]);
        setProductionSaudiPoints([]);
        setProductionRussiaPoints([]);
        setProductionIranPoints([]);
        setProductionTotalPoints([]);
        setProductionSource(null);
      }
      return;
    }
    const [start, end] = productionTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<{
      data: Array<{ date: string; us?: number | null; saudi_arabia?: number | null; russia?: number | null; iran?: number | null; total_production?: number | null }>;
      source?: { name: string; url?: string; publisher?: string };
    }>(`/api/signals/oil/production-exporters?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted && res.data) {
          const us: { date: string; value: number }[] = [];
          const saudi: { date: string; value: number }[] = [];
          const russia: { date: string; value: number }[] = [];
          const iran: { date: string; value: number }[] = [];
          const total: { date: string; value: number }[] = [];
          for (const r of res.data) {
            if (r.us != null) us.push({ date: r.date, value: r.us });
            if (r.saudi_arabia != null) saudi.push({ date: r.date, value: r.saudi_arabia });
            if (r.russia != null) russia.push({ date: r.date, value: r.russia });
            if (r.iran != null) iran.push({ date: r.date, value: r.iran });
            if (r.total_production != null) total.push({ date: r.date, value: r.total_production });
          }
          setProductionUsPoints(us);
          setProductionSaudiPoints(saudi);
          setProductionRussiaPoints(russia);
          setProductionIranPoints(iran);
          setProductionTotalPoints(total);
          setProductionSource(res.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setProductionUsPoints([]);
          setProductionSaudiPoints([]);
          setProductionRussiaPoints([]);
          setProductionIranPoints([]);
          setProductionTotalPoints([]);
          setProductionSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [productionTimeRange, isOilProductionMajorExporters]);

  useEffect(() => {
    if (!giniTimeRange || !isGiniInequality) {
      if (isGiniInequality) {
        setGiniIranPoints([]);
        setGiniUsPoints([]);
        setGiniGermanyPoints([]);
        setGiniTurkeyPoints([]);
        setGiniChinaPoints([]);
        setGiniSaudiArabiaPoints([]);
        setGiniSource(null);
        setGiniLoadFailed(false);
        setGiniLoadDetail(null);
        setGiniSeriesWarnings(null);
      }
      return;
    }
    const [start, end] = giniTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setGiniWdiLoading(true);
    setGiniLoadFailed(false);
    setGiniLoadDetail(null);
    setGiniSeriesWarnings(null);
    fetchJson<{
      series?: {
        iran: { date: string; value: number }[];
        united_states: { date: string; value: number }[];
        germany: { date: string; value: number }[];
        turkey: { date: string; value: number }[];
        china: { date: string; value: number }[];
        saudi_arabia: { date: string; value: number }[];
      };
      series_warnings?: Record<string, string>;
      partial?: boolean;
      source?: { name: string; url?: string; publisher?: string };
    }>(`/api/signals/wdi/gini-comparison?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, ac.signal)
      .then((res) => {
        if (!mounted) return;
        const s = res.series;
        setGiniIranPoints(s?.iran ?? []);
        setGiniUsPoints(s?.united_states ?? []);
        setGiniGermanyPoints(s?.germany ?? []);
        setGiniTurkeyPoints(s?.turkey ?? []);
        setGiniChinaPoints(s?.china ?? []);
        setGiniSaudiArabiaPoints(s?.saudi_arabia ?? []);
        setGiniSource(res.source ?? null);
        const warn = res.series_warnings;
        setGiniSeriesWarnings(warn && typeof warn === "object" ? warn : null);
        const nPts =
          (s?.iran?.length ?? 0) +
          (s?.united_states?.length ?? 0) +
          (s?.germany?.length ?? 0) +
          (s?.turkey?.length ?? 0) +
          (s?.china?.length ?? 0) +
          (s?.saudi_arabia?.length ?? 0);
        if (nPts === 0) {
          const tech =
            warn && Object.keys(warn).length > 0
              ? Object.entries(warn)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : null;
          setGiniLoadFailed(true);
          setGiniLoadDetail(tech);
        } else {
          setGiniLoadFailed(false);
          setGiniLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setGiniIranPoints([]);
        setGiniUsPoints([]);
        setGiniGermanyPoints([]);
        setGiniTurkeyPoints([]);
        setGiniChinaPoints([]);
        setGiniSaudiArabiaPoints([]);
        setGiniSource(null);
        setGiniSeriesWarnings(null);
        setGiniLoadFailed(true);
        setGiniLoadDetail(e instanceof Error ? e.message : "Gini comparison fetch failed");
      })
      .finally(() => {
        if (mounted) setGiniWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [giniTimeRange, isGiniInequality]);

  useEffect(() => {
    if (!inflationTimeRange || !isInflationCpiYoy) {
      if (isInflationCpiYoy) {
        setInflationIranPoints([]);
        setInflationUsPoints([]);
        setInflationGermanyPoints([]);
        setInflationTurkeyPoints([]);
        setInflationChinaPoints([]);
        setInflationSaudiArabiaPoints([]);
        setInflationSource(null);
        setInflationLoadFailed(false);
        setInflationLoadDetail(null);
        setInflationSeriesWarnings(null);
      }
      return;
    }
    const [start, end] = inflationTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setInflationWdiLoading(true);
    setInflationLoadFailed(false);
    setInflationLoadDetail(null);
    setInflationSeriesWarnings(null);
    fetchJson<{
      series?: {
        iran: { date: string; value: number }[];
        united_states: { date: string; value: number }[];
        germany: { date: string; value: number }[];
        turkey: { date: string; value: number }[];
        china: { date: string; value: number }[];
        saudi_arabia: { date: string; value: number }[];
      };
      series_warnings?: Record<string, string>;
      partial?: boolean;
      source?: { name: string; url?: string; publisher?: string };
    }>(
      `/api/signals/wdi/cpi-inflation-yoy?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ac.signal
    )
      .then((res) => {
        if (!mounted) return;
        const s = res.series;
        setInflationIranPoints(s?.iran ?? []);
        setInflationUsPoints(s?.united_states ?? []);
        setInflationGermanyPoints(s?.germany ?? []);
        setInflationTurkeyPoints(s?.turkey ?? []);
        setInflationChinaPoints(s?.china ?? []);
        setInflationSaudiArabiaPoints(s?.saudi_arabia ?? []);
        setInflationSource(res.source ?? null);
        const warn = res.series_warnings;
        setInflationSeriesWarnings(warn && typeof warn === "object" ? warn : null);
        const nPts =
          (s?.iran?.length ?? 0) +
          (s?.united_states?.length ?? 0) +
          (s?.germany?.length ?? 0) +
          (s?.turkey?.length ?? 0) +
          (s?.china?.length ?? 0) +
          (s?.saudi_arabia?.length ?? 0);
        if (nPts === 0) {
          const tech =
            warn && Object.keys(warn).length > 0
              ? Object.entries(warn)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : null;
          setInflationLoadFailed(true);
          setInflationLoadDetail(tech);
        } else {
          setInflationLoadFailed(false);
          setInflationLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setInflationIranPoints([]);
        setInflationUsPoints([]);
        setInflationGermanyPoints([]);
        setInflationTurkeyPoints([]);
        setInflationChinaPoints([]);
        setInflationSaudiArabiaPoints([]);
        setInflationSource(null);
        setInflationSeriesWarnings(null);
        setInflationLoadFailed(true);
        setInflationLoadDetail(e instanceof Error ? e.message : "Inflation comparison fetch failed");
      })
      .finally(() => {
        if (mounted) setInflationWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [inflationTimeRange, isInflationCpiYoy]);

  useEffect(() => {
    if (!gdpGlobalTimeRange || !isGdpGlobalComparison) {
      if (isGdpGlobalComparison) {
        setGdpGlobalUnitedStatesPoints([]);
        setGdpGlobalChinaPoints([]);
        setGdpGlobalIranPoints([]);
        setGdpGlobalTurkeyPoints([]);
        setGdpGlobalSaudiArabiaPoints([]);
        setGdpGlobalWorldPoints([]);
        setGdpGlobalSource(null);
        setGdpGlobalPerCountryBasis(null);
        setGdpGlobalPerCountryIndicatorId(null);
        setGdpGlobalLoadFailed(false);
        setGdpGlobalLoadDetail(null);
        setGdpGlobalSeriesWarnings(null);
      }
      return;
    }
    const [start, end] = gdpGlobalTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setGdpGlobalWdiLoading(true);
    setGdpGlobalLoadFailed(false);
    setGdpGlobalLoadDetail(null);
    setGdpGlobalSeriesWarnings(null);
    fetchJson<{
      series?: {
        united_states: { date: string; value: number }[];
        china: { date: string; value: number }[];
        iran: { date: string; value: number }[];
        turkey: { date: string; value: number }[];
        saudi_arabia: { date: string; value: number }[];
        world: { date: string; value: number }[];
      };
      series_warnings?: Record<string, string>;
      partial?: boolean;
      per_country_price_basis?: Record<string, string>;
      per_country_indicator_id?: Record<string, string>;
      source?: { name: string; url?: string; publisher?: string };
    }>(
      `/api/signals/wdi/gdp-global-comparison?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ac.signal
    )
      .then((res) => {
        if (!mounted) return;
        const s = res.series;
        setGdpGlobalUnitedStatesPoints(s?.united_states ?? []);
        setGdpGlobalChinaPoints(s?.china ?? []);
        setGdpGlobalIranPoints(s?.iran ?? []);
        setGdpGlobalTurkeyPoints(s?.turkey ?? []);
        setGdpGlobalSaudiArabiaPoints(s?.saudi_arabia ?? []);
        setGdpGlobalWorldPoints(s?.world ?? []);
        setGdpGlobalSource(res.source ?? null);
        setGdpGlobalPerCountryBasis(res.per_country_price_basis ?? null);
        setGdpGlobalPerCountryIndicatorId(res.per_country_indicator_id ?? null);
        const warn = res.series_warnings;
        setGdpGlobalSeriesWarnings(warn && typeof warn === "object" ? warn : null);
        const nPts =
          (s?.united_states?.length ?? 0) +
          (s?.china?.length ?? 0) +
          (s?.iran?.length ?? 0) +
          (s?.turkey?.length ?? 0) +
          (s?.saudi_arabia?.length ?? 0) +
          (s?.world?.length ?? 0);
        if (nPts === 0) {
          const tech =
            warn && Object.keys(warn).length > 0
              ? Object.entries(warn)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : null;
          setGdpGlobalLoadFailed(true);
          setGdpGlobalLoadDetail(tech);
        } else {
          setGdpGlobalLoadFailed(false);
          setGdpGlobalLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setGdpGlobalUnitedStatesPoints([]);
        setGdpGlobalChinaPoints([]);
        setGdpGlobalIranPoints([]);
        setGdpGlobalTurkeyPoints([]);
        setGdpGlobalSaudiArabiaPoints([]);
        setGdpGlobalWorldPoints([]);
        setGdpGlobalSource(null);
        setGdpGlobalPerCountryBasis(null);
        setGdpGlobalPerCountryIndicatorId(null);
        setGdpGlobalSeriesWarnings(null);
        setGdpGlobalLoadFailed(true);
        setGdpGlobalLoadDetail(e instanceof Error ? e.message : "GDP comparison fetch failed");
      })
      .finally(() => {
        if (mounted) setGdpGlobalWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [gdpGlobalTimeRange, isGdpGlobalComparison]);

  useEffect(() => {
    if (!isIsiDiagnostics) {
      setIsiDiagnosticsData(null);
      setIsiLoadFailed(false);
      setIsiLoadDetail(null);
      setIsiSeriesWarnings(null);
      return;
    }
    if (!isiTimeRange) return;
    const [start, end] = isiTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setIsiWdiLoading(true);
    setIsiLoadFailed(false);
    setIsiLoadDetail(null);
    setIsiSeriesWarnings(null);
    fetchJson<{
      series?: IsiDiagnosticsSeriesBundle;
      series_warnings?: Record<string, string>;
      partial?: boolean;
      source?: { name?: string; url?: string; publisher?: string };
      indicator_ids?: Record<string, string>;
    }>(`/api/signals/wdi/isi-diagnostics?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, ac.signal)
      .then((res) => {
        if (!mounted) return;
        const s = res.series;
        setIsiDiagnosticsData(
          s
            ? {
                series: s,
                source: res.source,
                indicator_ids: res.indicator_ids,
              }
            : null
        );
        const warn = res.series_warnings;
        setIsiSeriesWarnings(warn && typeof warn === "object" ? warn : null);
        let nPts = 0;
        if (s) {
          for (const block of [
            s.imports_pct_gdp,
            s.exports_pct_gdp,
            s.manufacturing_pct_gdp,
            s.industry_pct_gdp,
            s.gdp_growth_pct,
          ]) {
            for (const pts of Object.values(block)) {
              if (Array.isArray(pts)) nPts += pts.length;
            }
          }
        }
        if (nPts === 0) {
          const tech =
            warn && Object.keys(warn).length > 0
              ? Object.entries(warn)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : null;
          setIsiLoadFailed(true);
          setIsiLoadDetail(tech);
        } else {
          setIsiLoadFailed(false);
          setIsiLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setIsiDiagnosticsData(null);
        setIsiSeriesWarnings(null);
        setIsiLoadFailed(true);
        setIsiLoadDetail(e instanceof Error ? e.message : "ISI diagnostics fetch failed");
      })
      .finally(() => {
        if (mounted) setIsiWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [isiTimeRange, isIsiDiagnostics]);

  useEffect(() => {
    if (!povertyTimeRange || !isPovertyHeadcountIran) {
      if (isPovertyHeadcountIran) {
        setPovertyDdayPoints([]);
        setPovertyLmicPoints([]);
        setPovertyDdayLineLabel("");
        setPovertyLmicLineLabel("");
        setPovertyDdayIndicatorId("");
        setPovertyLmicIndicatorId("");
        setPovertySource(null);
        setPovertyLoadFailed(false);
        setPovertyLoadDetail(null);
      }
      return;
    }
    const [start, end] = povertyTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setPovertyWdiLoading(true);
    setPovertyLoadFailed(false);
    setPovertyLoadDetail(null);
    fetchJson<{
      lines?: Array<{
        key: string;
        indicator_id?: string;
        label_short?: string;
        points?: { date: string; value: number }[];
      }>;
      source?: { name: string; url?: string; publisher?: string };
    }>(
      `/api/signals/wdi/poverty-headcount-iran?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ac.signal
    )
      .then((res) => {
        if (!mounted) return;
        const lines = res.lines ?? [];
        const dday = lines.find((l) => l.key === "pov_dday");
        const lmic = lines.find((l) => l.key === "pov_lmic");
        setPovertyDdayPoints(dday?.points ?? []);
        setPovertyLmicPoints(lmic?.points ?? []);
        setPovertyDdayLineLabel(dday?.label_short ?? "SI.POV.DDAY");
        setPovertyLmicLineLabel(lmic?.label_short ?? "SI.POV.LMIC");
        setPovertyDdayIndicatorId(dday?.indicator_id ?? "");
        setPovertyLmicIndicatorId(lmic?.indicator_id ?? "");
        setPovertySource(res.source ?? null);
        const nPts = (dday?.points?.length ?? 0) + (lmic?.points?.length ?? 0);
        if (nPts === 0) {
          setPovertyLoadFailed(true);
          setPovertyLoadDetail(null);
        } else {
          setPovertyLoadFailed(false);
          setPovertyLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setPovertyDdayPoints([]);
        setPovertyLmicPoints([]);
        setPovertyDdayLineLabel("");
        setPovertyLmicLineLabel("");
        setPovertyDdayIndicatorId("");
        setPovertyLmicIndicatorId("");
        setPovertySource(null);
        setPovertyLoadFailed(true);
        setPovertyLoadDetail(e instanceof Error ? e.message : "Poverty headcount fetch failed");
      })
      .finally(() => {
        if (mounted) setPovertyWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [povertyTimeRange, isPovertyHeadcountIran]);

  useEffect(() => {
    if (!moneySupplyTimeRange || !isIranMoneySupplyM2) {
      if (isIranMoneySupplyM2) {
        setMoneySupplyM2Points([]);
        setMoneySupplyCpiPoints([]);
        setMoneySupplyWdiSource(null);
        setMoneySupplyCitation(null);
        setMoneySupplyCoverage(null);
        setMoneySupplyIndicatorIds(null);
        setMoneySupplyLoadFailed(false);
        setMoneySupplyLoadDetail(null);
      }
      return;
    }
    const [start, end] = moneySupplyTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setMoneySupplyWdiLoading(true);
    setMoneySupplyLoadFailed(false);
    setMoneySupplyLoadDetail(null);
    fetchJson<{
      series?: {
        broad_money_growth_pct?: { date: string; value: number }[];
        cpi_inflation_yoy_iran_pct?: { date: string; value: number }[];
      };
      source?: { name?: string; url?: string; publisher?: string };
      citation?: { en: string; fa: string };
      coverage?: {
        broad_money: { first_year: number; last_year: number } | null;
        broad_money_wdi?: { first_year: number; last_year: number } | null;
        broad_money_cbi_liquidity_yoy?: { first_year: number; last_year: number } | null;
        cpi_inflation_iran: { first_year: number; last_year: number } | null;
      };
      indicator_ids?: { broad_money_growth: string; cpi_inflation_yoy_iran: string };
    }>(
      `/api/signals/wdi/iran-money-supply-m2?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ac.signal
    )
      .then((res) => {
        if (!mounted) return;
        const m2 = res.series?.broad_money_growth_pct ?? [];
        const cpi = res.series?.cpi_inflation_yoy_iran_pct ?? [];
        setMoneySupplyM2Points(m2);
        setMoneySupplyCpiPoints(cpi);
        setMoneySupplyWdiSource(res.source ?? null);
        setMoneySupplyCitation(res.citation ?? null);
        setMoneySupplyCoverage(res.coverage ?? null);
        setMoneySupplyIndicatorIds(res.indicator_ids ?? null);
        if (m2.length === 0 && cpi.length === 0) {
          setMoneySupplyLoadFailed(true);
          setMoneySupplyLoadDetail(null);
        } else {
          setMoneySupplyLoadFailed(false);
          setMoneySupplyLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setMoneySupplyM2Points([]);
        setMoneySupplyCpiPoints([]);
        setMoneySupplyWdiSource(null);
        setMoneySupplyCitation(null);
        setMoneySupplyCoverage(null);
        setMoneySupplyIndicatorIds(null);
        setMoneySupplyLoadFailed(true);
        setMoneySupplyLoadDetail(e instanceof Error ? e.message : "Money supply bundle fetch failed");
      })
      .finally(() => {
        if (mounted) setMoneySupplyWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [moneySupplyTimeRange, isIranMoneySupplyM2]);

  const iranEconomyMacroFetchRange = useMemo((): [string, string] | null => {
    if (isIranEconomyReconstruction1368) {
      if (reconstructionTimeRange) return reconstructionTimeRange;
      if (study?.timeRange) {
        const [a, b] = study.timeRange;
        const resolvedEnd = b === "today" ? new Date().toISOString().slice(0, 10) : b;
        return [a, resolvedEnd];
      }
      return null;
    }
    if (isIranEconomyPeriodComparison) return ipcTimeRange;
    return null;
  }, [
    isIranEconomyReconstruction1368,
    reconstructionTimeRange,
    study?.timeRange,
    isIranEconomyPeriodComparison,
    ipcTimeRange,
  ]);

  useEffect(() => {
    if (!iranEconomyMacroFetchRange || !isIranEconomyMacroDashboard) {
      if (isIranEconomyMacroDashboard) {
        setRecoInflationIranPoints([]);
        setRecoInflationSource(null);
        setRecoGdpGrowthPoints([]);
        setRecoImportsPoints([]);
        setRecoExportsPoints([]);
        setRecoManufacturingPoints([]);
        setRecoIndustryPoints([]);
        setRecoIsiSource(null);
        setRecoIsiIndicatorIds(null);
        setRecoOilRentsPoints([]);
        setRecoNaturalGasRentsPoints([]);
        setRecoDutchSource(null);
        setRecoM2Points([]);
        setRecoM2CpiPoints([]);
        setRecoMoneyWdiSource(null);
        setRecoMoneyCitation(null);
        setRecoMoneyIndicatorIds(null);
        setRecoFxOfficialPoints([]);
        setRecoFxOpenPoints([]);
        setRecoFxOfficialSource(null);
        setRecoFxOpenSource(null);
        setRecoDemandConsumptionPoints([]);
        setRecoDemandInvestmentPoints([]);
        setRecoDemandGdpPoints([]);
        setRecoGdpDecompNonOilPoints([]);
        setRecoGdpDecompOilPoints([]);
        setRecoGdpDecompCoverage(null);
        setRecoDemandNominalSource(null);
        setRecoDemandIndicatorIds(null);
        setRecoDemandRealConsumptionPoints([]);
        setRecoDemandRealInvestmentPoints([]);
        setRecoDemandRealGdpPoints([]);
        setRecoWelfareGiniIranPoints([]);
        setRecoWelfareGiniSource(null);
        setRecoWelfareGiniIndicatorId("");
        setRecoWelfarePovertyDdayPoints([]);
        setRecoWelfarePovertyLmicPoints([]);
        setRecoWelfarePovertyDdayShort("");
        setRecoWelfarePovertyLmicShort("");
        setRecoWelfarePovertyDdayTitle("");
        setRecoWelfarePovertyLmicTitle("");
        setRecoWelfarePovertySource(null);
        setRecoWelfarePovertyDdayId("");
        setRecoWelfarePovertyLmicId("");
        setRecoLoadFailed(false);
        setRecoLoadDetail(null);
      }
      return;
    }
    const [start, end] = iranEconomyMacroFetchRange;
    const ac = new AbortController();
    let mounted = true;
    setRecoLoading(true);
    setRecoLoadFailed(false);
    setRecoLoadDetail(null);
    const enc = (s: string) => encodeURIComponent(s);
    Promise.all([
      fetchJson<{
        series?: { iran?: { date: string; value: number }[] };
        source?: { name?: string; url?: string; publisher?: string };
      }>(`/api/signals/wdi/cpi-inflation-yoy?start=${enc(start)}&end=${enc(end)}`, ac.signal),
      fetchJson<{
        series?: IsiDiagnosticsSeriesBundle;
        source?: { name?: string; url?: string; publisher?: string };
        indicator_ids?: Record<string, string>;
      }>(`/api/signals/wdi/isi-diagnostics?start=${enc(start)}&end=${enc(end)}`, ac.signal),
      fetchJson<{
        series?: {
          oil_rents_pct_gdp?: { date: string; value: number }[];
          natural_gas_rents_pct_gdp?: { date: string; value: number }[];
          total_natural_resource_rents_pct_gdp?: { date: string; value: number }[];
        };
        source?: { name?: string; url?: string; publisher?: string };
      }>(`/api/signals/wdi/dutch-disease-diagnostics-iran?start=${enc(start)}&end=${enc(end)}`, ac.signal),
      fetchJson<{
        series?: {
          broad_money_growth_pct?: { date: string; value: number }[];
          cpi_inflation_yoy_iran_pct?: { date: string; value: number }[];
        };
        source?: { name?: string; url?: string; publisher?: string };
        citation?: { en: string; fa: string };
        indicator_ids?: { broad_money_growth: string; cpi_inflation_yoy_iran: string };
      }>(`/api/signals/wdi/iran-money-supply-m2?start=${enc(start)}&end=${enc(end)}`, ac.signal),
      fetchJson<{
        official: { points: { date: string; value: number }[]; source?: FxUsdTomanSource };
        open_market: { points: { date: string; value: number }[]; source?: FxUsdTomanSource };
      }>(`/api/signals/fx/usd-irr-dual?start=${start}&end=${end}`, ac.signal),
      fetchJson<{
        series?: {
          consumption_usd?: { date: string; value: number }[];
          investment_usd?: { date: string; value: number }[];
          gdp_usd?: { date: string; value: number }[];
          gdp_non_oil_proxy_usd?: { date: string; value: number }[];
          gdp_oil_proxy_usd?: { date: string; value: number }[];
          consumption_kd?: { date: string; value: number }[];
          investment_kd?: { date: string; value: number }[];
          gdp_kd?: { date: string; value: number }[];
        };
        source?: { name?: string; url?: string; publisher?: string };
        indicator_ids?: Record<string, string>;
        gdp_decomposition_coverage?: GdpDecompositionCoverage;
      }>(
        `/api/signals/wdi/iran-demand-nominal-usd?start=${enc(start)}&end=${enc(end)}&_sm_bd=3`,
        ac.signal
      ),
    ])
      .then(([inf, isi, dutch, money, fx, demand]) => {
        if (!mounted) return;
        setRecoInflationIranPoints(inf.series?.iran ?? []);
        setRecoInflationSource(inf.source ?? null);
        const s = isi.series;
        setRecoGdpGrowthPoints(s?.gdp_growth_pct?.iran ?? []);
        setRecoImportsPoints(s?.imports_pct_gdp?.iran ?? []);
        setRecoExportsPoints(s?.exports_pct_gdp?.iran ?? []);
        setRecoManufacturingPoints(s?.manufacturing_pct_gdp?.iran ?? []);
        setRecoIndustryPoints(s?.industry_pct_gdp?.iran ?? []);
        setRecoIsiSource(isi.source ?? null);
        setRecoIsiIndicatorIds(isi.indicator_ids ?? null);
        setRecoOilRentsPoints(dutch.series?.oil_rents_pct_gdp ?? []);
        setRecoNaturalGasRentsPoints(dutch.series?.natural_gas_rents_pct_gdp ?? []);
        setRecoDutchSource(dutch.source ?? null);
        setRecoM2Points(money.series?.broad_money_growth_pct ?? []);
        setRecoM2CpiPoints(money.series?.cpi_inflation_yoy_iran_pct ?? []);
        setRecoMoneyWdiSource(money.source ?? null);
        setRecoMoneyCitation(money.citation ?? null);
        setRecoMoneyIndicatorIds(money.indicator_ids ?? null);
        setRecoFxOfficialPoints(fx.official?.points ?? []);
        setRecoFxOpenPoints(fx.open_market?.points ?? []);
        setRecoFxOfficialSource(fx.official?.source ?? null);
        setRecoFxOpenSource(fx.open_market?.source ?? null);
        setRecoDemandConsumptionPoints(demand.series?.consumption_usd ?? []);
        setRecoDemandInvestmentPoints(demand.series?.investment_usd ?? []);
        setRecoDemandGdpPoints(demand.series?.gdp_usd ?? []);
        setRecoGdpDecompNonOilPoints(demand.series?.gdp_non_oil_proxy_usd ?? []);
        setRecoGdpDecompOilPoints(demand.series?.gdp_oil_proxy_usd ?? []);
        setRecoGdpDecompCoverage(demand.gdp_decomposition_coverage ?? null);
        setRecoDemandNominalSource(demand.source ?? null);
        setRecoDemandIndicatorIds(demand.indicator_ids ?? null);
        setRecoDemandRealConsumptionPoints(demand.series?.consumption_kd ?? []);
        setRecoDemandRealInvestmentPoints(demand.series?.investment_kd ?? []);
        setRecoDemandRealGdpPoints(demand.series?.gdp_kd ?? []);
        const n =
          (inf.series?.iran?.length ?? 0) +
          (s?.gdp_growth_pct?.iran?.length ?? 0) +
          (dutch.series?.oil_rents_pct_gdp?.length ?? 0) +
          (dutch.series?.natural_gas_rents_pct_gdp?.length ?? 0) +
          (money.series?.broad_money_growth_pct?.length ?? 0) +
          (fx.open_market?.points?.length ?? 0) +
          (demand.series?.consumption_usd?.length ?? 0) +
          (demand.series?.investment_usd?.length ?? 0) +
          (demand.series?.gdp_usd?.length ?? 0) +
          (demand.series?.gdp_non_oil_proxy_usd?.length ?? 0) +
          (demand.series?.gdp_oil_proxy_usd?.length ?? 0) +
          (demand.series?.consumption_kd?.length ?? 0) +
          (demand.series?.investment_kd?.length ?? 0) +
          (demand.series?.gdp_kd?.length ?? 0);
        if (n === 0) {
          setRecoLoadFailed(true);
          setRecoLoadDetail("All reconstruction bundles returned empty in this window.");
        } else {
          setRecoLoadFailed(false);
          setRecoLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setRecoInflationIranPoints([]);
        setRecoInflationSource(null);
        setRecoGdpGrowthPoints([]);
        setRecoImportsPoints([]);
        setRecoExportsPoints([]);
        setRecoManufacturingPoints([]);
        setRecoIndustryPoints([]);
        setRecoIsiSource(null);
        setRecoIsiIndicatorIds(null);
        setRecoOilRentsPoints([]);
        setRecoNaturalGasRentsPoints([]);
        setRecoDutchSource(null);
        setRecoM2Points([]);
        setRecoM2CpiPoints([]);
        setRecoMoneyWdiSource(null);
        setRecoMoneyCitation(null);
        setRecoMoneyIndicatorIds(null);
        setRecoFxOfficialPoints([]);
        setRecoFxOpenPoints([]);
        setRecoFxOfficialSource(null);
        setRecoFxOpenSource(null);
        setRecoDemandConsumptionPoints([]);
        setRecoDemandInvestmentPoints([]);
        setRecoDemandGdpPoints([]);
        setRecoGdpDecompNonOilPoints([]);
        setRecoGdpDecompOilPoints([]);
        setRecoGdpDecompCoverage(null);
        setRecoDemandNominalSource(null);
        setRecoDemandIndicatorIds(null);
        setRecoDemandRealConsumptionPoints([]);
        setRecoDemandRealInvestmentPoints([]);
        setRecoDemandRealGdpPoints([]);
        setRecoWelfareGiniIranPoints([]);
        setRecoWelfareGiniSource(null);
        setRecoWelfareGiniIndicatorId("");
        setRecoWelfarePovertyDdayPoints([]);
        setRecoWelfarePovertyLmicPoints([]);
        setRecoWelfarePovertyDdayShort("");
        setRecoWelfarePovertyLmicShort("");
        setRecoWelfarePovertyDdayTitle("");
        setRecoWelfarePovertyLmicTitle("");
        setRecoWelfarePovertySource(null);
        setRecoWelfarePovertyDdayId("");
        setRecoWelfarePovertyLmicId("");
        setRecoLoadFailed(true);
        setRecoLoadDetail(e instanceof Error ? e.message : "Reconstruction dashboard fetch failed");
      })
      .finally(() => {
        if (mounted) setRecoLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [iranEconomyMacroFetchRange, isIranEconomyMacroDashboard]);

  const reconstructionGdpDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
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
        points: recoDemandGdpPoints,
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [recoGdpDecompNonOilPoints, recoGdpDecompOilPoints, recoDemandGdpPoints, isFa]);

  const reconstructionRealGdpDecomposition = useMemo(() => {
    if (recoDemandRealGdpPoints.length === 0 || recoOilRentsPoints.length === 0) return null;
    const oilRentsPctByDate = new Map<string, number>();
    for (const p of recoOilRentsPoints) {
      if (!Number.isFinite(p.value)) continue;
      oilRentsPctByDate.set(p.date, p.value);
    }
    const oilProxy: { date: string; value: number }[] = [];
    const nonOilProxy: { date: string; value: number }[] = [];
    const totalGdp: { date: string; value: number }[] = [];
    for (const gdp of recoDemandRealGdpPoints) {
      if (!Number.isFinite(gdp.value)) continue;
      const oilRentsPct = oilRentsPctByDate.get(gdp.date);
      if (!Number.isFinite(oilRentsPct)) continue;
      const oilValue = (gdp.value * (oilRentsPct as number)) / 100;
      oilProxy.push({ date: gdp.date, value: oilValue });
      nonOilProxy.push({ date: gdp.date, value: gdp.value - oilValue });
      totalGdp.push(gdp);
    }
    return {
      oilProxy,
      nonOilProxy,
      totalGdp,
      overlapYears: totalGdp.length,
      realGdpYearsInWindow: recoDemandRealGdpPoints.length,
    };
  }, [recoDemandRealGdpPoints, recoOilRentsPoints]);

  const reconstructionRealGdpDecompositionMultiSeries = useMemo((): ChartSeries[] | null => {
    if (!reconstructionRealGdpDecomposition) return null;
    if (
      reconstructionRealGdpDecomposition.nonOilProxy.length === 0 ||
      reconstructionRealGdpDecomposition.oilProxy.length === 0 ||
      reconstructionRealGdpDecomposition.totalGdp.length === 0
    ) {
      return null;
    }
    return [
      {
        key: "real_gdp_non_oil_proxy",
        label: L(isFa, "Non-oil GDP proxy", "GDP غیرنفتی (تقریبی)"),
        yAxisIndex: 0,
        unit: L(isFa, "constant 2015 US$", "دلار ثابت ۲۰۱۵"),
        points: reconstructionRealGdpDecomposition.nonOilProxy,
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
        points: reconstructionRealGdpDecomposition.oilProxy,
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
        points: reconstructionRealGdpDecomposition.totalGdp,
        smooth: true,
        linePattern: "dashed",
        lineWidth: 2,
        showSymbol: true,
      },
    ];
  }, [reconstructionRealGdpDecomposition, isFa, L]);

  const reconstructionSelectedGdpDecompositionMultiSeries =
    recoGdpDecompMode === "real" ? reconstructionRealGdpDecompositionMultiSeries : reconstructionGdpDecompositionMultiSeries;

  const reconstructionGdpDecompPartialNote = useMemo(() => {
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

  const reconstructionSelectedGdpDecompPartialNote = useMemo(() => {
    if (recoGdpDecompMode === "nominal") return reconstructionGdpDecompPartialNote;
    if (!reconstructionRealGdpDecomposition || recoLoading || recoLoadFailed) return null;
    const g = reconstructionRealGdpDecomposition.realGdpYearsInWindow;
    const o = reconstructionRealGdpDecomposition.overlapYears;
    if (o > 0 && o < g) {
      return L(
        isFa,
        "Only years with both real GDP (NY.GDP.MKTP.KD) and oil rents (% of GDP, NY.GDP.PETR.RT.ZS) are included in the stacked view. Years are joined on Gregorian calendar years, independent of the axis label mode.",
        "فقط سال‌هایی که هم GDP واقعی (NY.GDP.MKTP.KD) و هم رانت نفتی٪ GDP (NY.GDP.PETR.RT.ZS) موجود است در نمای ستونی آمده‌اند. تطبیق بر اساس سال میلادی است و به حالت نمایش محور (شمسی/میلادی) وابسته نیست."
      );
    }
    return null;
  }, [
    recoGdpDecompMode,
    reconstructionGdpDecompPartialNote,
    reconstructionRealGdpDecomposition,
    recoLoading,
    recoLoadFailed,
    isFa,
    L,
  ]);

  const reconstructionDemandNominalMultiSeries = useMemo(
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
  const reconstructionDemandRealMultiSeries = useMemo(
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
  const reconstructionSelectedDemandMultiSeries =
    recoDemandMode === "real" ? reconstructionDemandRealMultiSeries : reconstructionDemandNominalMultiSeries;
  const reconstructionHasNominalDemandData =
    recoDemandConsumptionPoints.length > 0 || recoDemandInvestmentPoints.length > 0 || recoDemandGdpPoints.length > 0;
  const reconstructionHasRealDemandData =
    recoDemandRealConsumptionPoints.length > 0 || recoDemandRealInvestmentPoints.length > 0 || recoDemandRealGdpPoints.length > 0;

  useEffect(() => {
    if (!iranEconomyMacroFetchRange || !isIranEconomyMacroDashboard) {
      if (isIranEconomyMacroDashboard) {
        setRecoWelfareGiniIranPoints([]);
        setRecoWelfareGiniSource(null);
        setRecoWelfareGiniIndicatorId("");
        setRecoWelfarePovertyDdayPoints([]);
        setRecoWelfarePovertyLmicPoints([]);
        setRecoWelfarePovertyDdayShort("");
        setRecoWelfarePovertyLmicShort("");
        setRecoWelfarePovertyDdayTitle("");
        setRecoWelfarePovertyLmicTitle("");
        setRecoWelfarePovertySource(null);
        setRecoWelfarePovertyDdayId("");
        setRecoWelfarePovertyLmicId("");
      }
      return;
    }
    const [start, end] = iranEconomyMacroFetchRange;
    const ac = new AbortController();
    let mounted = true;
    Promise.all([
      fetchJson<{
        series?: { iran?: { date: string; value: number }[] };
        source?: { name?: string; url?: string; publisher?: string };
        indicator_id?: string;
      }>(
        `/api/signals/wdi/gini-comparison?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        ac.signal
      ),
      fetchJson<{
        lines?: Array<{
          key: string;
          indicator_id?: string;
          indicator_title?: string;
          label_short?: string;
          points?: { date: string; value: number }[];
        }>;
        source?: { name?: string; url?: string; publisher?: string };
      }>(`/api/signals/wdi/poverty-headcount-iran?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, ac.signal),
    ])
      .then(([gini, pov]) => {
        if (!mounted) return;
        setRecoWelfareGiniIranPoints(gini.series?.iran ?? []);
        setRecoWelfareGiniSource(gini.source ?? null);
        setRecoWelfareGiniIndicatorId(typeof gini.indicator_id === "string" ? gini.indicator_id : "SI.POV.GINI");
        const lines = pov.lines ?? [];
        const dday = lines.find((l) => l.key === "pov_dday");
        const lmic = lines.find((l) => l.key === "pov_lmic");
        setRecoWelfarePovertyDdayPoints(dday?.points ?? []);
        setRecoWelfarePovertyLmicPoints(lmic?.points ?? []);
        setRecoWelfarePovertyDdayShort(dday?.label_short ?? "SI.POV.DDAY");
        setRecoWelfarePovertyLmicShort(lmic?.label_short ?? "SI.POV.LMIC");
        setRecoWelfarePovertyDdayTitle(dday?.indicator_title ?? "");
        setRecoWelfarePovertyLmicTitle(lmic?.indicator_title ?? "");
        setRecoWelfarePovertySource(pov.source ?? null);
        setRecoWelfarePovertyDdayId(dday?.indicator_id ?? "");
        setRecoWelfarePovertyLmicId(lmic?.indicator_id ?? "");
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setRecoWelfareGiniIranPoints([]);
        setRecoWelfareGiniSource(null);
        setRecoWelfareGiniIndicatorId("");
        setRecoWelfarePovertyDdayPoints([]);
        setRecoWelfarePovertyLmicPoints([]);
        setRecoWelfarePovertyDdayShort("");
        setRecoWelfarePovertyLmicShort("");
        setRecoWelfarePovertyDdayTitle("");
        setRecoWelfarePovertyLmicTitle("");
        setRecoWelfarePovertySource(null);
        setRecoWelfarePovertyDdayId("");
        setRecoWelfarePovertyLmicId("");
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [iranEconomyMacroFetchRange, isIranEconomyMacroDashboard]);

  useEffect(() => {
    if (!isIranEconomyPeriodComparison) {
      setIpcWageNominalPoints([]);
      setIpcWageCpiPoints([]);
      setIpcWageBaseYear(null);
      setIpcWageSource(null);
      setIpcWageLoadFailed(false);
      return;
    }
    if (!ipcTimeRange) return;
    const [start, end] = ipcTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setIpcWageLoadFailed(false);
    fetchJson<{
      nominal: { date: string; value: number }[];
      cpi: { date: string; value: number }[];
      base_year: number;
      source: { nominal: string; cpi: string };
    }>(`/api/signals/wage/iran-minimum-cpi?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, ac.signal)
      .then((res) => {
        if (!mounted) return;
        setIpcWageNominalPoints(res.nominal ?? []);
        setIpcWageCpiPoints(res.cpi ?? []);
        setIpcWageBaseYear(res.base_year ?? null);
        setIpcWageSource(res.source ?? null);
        setIpcWageLoadFailed(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIpcWageNominalPoints([]);
        setIpcWageCpiPoints([]);
        setIpcWageBaseYear(null);
        setIpcWageSource(null);
        setIpcWageLoadFailed(true);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [ipcTimeRange, isIranEconomyPeriodComparison]);

  useEffect(() => {
    if (!dutchTimeRange || !isDutchDiseaseDiagnostics) {
      if (isDutchDiseaseDiagnostics) {
        setDutchOilRentsPoints([]);
        setDutchNaturalGasRentsPoints([]);
        setDutchManufacturingPoints([]);
        setDutchImportsPoints([]);
        setDutchWdiSource(null);
        setDutchWdiLoadFailed(false);
        setDutchWdiLoadDetail(null);
        setDutchWdiSeriesWarnings(null);
      }
      return;
    }
    const [start, end] = dutchTimeRange;
    const ac = new AbortController();
    let mounted = true;
    setDutchWdiLoading(true);
    setDutchWdiLoadFailed(false);
    setDutchWdiLoadDetail(null);
    setDutchWdiSeriesWarnings(null);
    fetchJson<{
      series?: {
        oil_rents_pct_gdp?: { date: string; value: number }[];
        natural_gas_rents_pct_gdp?: { date: string; value: number }[];
        manufacturing_pct_gdp?: { date: string; value: number }[];
        imports_pct_gdp?: { date: string; value: number }[];
      };
      series_warnings?: Record<string, string>;
      partial?: boolean;
      source?: { name: string; url?: string; publisher?: string };
    }>(
      `/api/signals/wdi/dutch-disease-diagnostics-iran?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ac.signal
    )
      .then((res) => {
        if (!mounted) return;
        const oil = res.series?.oil_rents_pct_gdp ?? [];
        const gas = res.series?.natural_gas_rents_pct_gdp ?? [];
        const mfg = res.series?.manufacturing_pct_gdp ?? [];
        const imp = res.series?.imports_pct_gdp ?? [];
        setDutchOilRentsPoints(oil);
        setDutchNaturalGasRentsPoints(gas);
        setDutchManufacturingPoints(mfg);
        setDutchImportsPoints(imp);
        setDutchWdiSource(res.source ?? null);
        const warn = res.series_warnings;
        setDutchWdiSeriesWarnings(warn && typeof warn === "object" ? warn : null);
        const nPts = oil.length + gas.length + mfg.length + imp.length;
        if (nPts === 0) {
          const tech =
            warn && Object.keys(warn).length > 0
              ? Object.entries(warn)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : null;
          setDutchWdiLoadFailed(true);
          setDutchWdiLoadDetail(tech);
        } else {
          setDutchWdiLoadFailed(false);
          setDutchWdiLoadDetail(null);
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const aborted =
          e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        if (aborted) return;
        setDutchOilRentsPoints([]);
        setDutchNaturalGasRentsPoints([]);
        setDutchManufacturingPoints([]);
        setDutchImportsPoints([]);
        setDutchWdiSource(null);
        setDutchWdiSeriesWarnings(null);
        setDutchWdiLoadFailed(true);
        setDutchWdiLoadDetail(e instanceof Error ? e.message : "World Bank bundle failed");
      })
      .finally(() => {
        if (mounted) setDutchWdiLoading(false);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [dutchTimeRange, isDutchDiseaseDiagnostics]);

  useEffect(() => {
    if (!dutchFxTimeRange || !isDutchDiseaseDiagnostics) {
      if (isDutchDiseaseDiagnostics) {
        setDutchFxPoints([]);
        setDutchFxSource(null);
      }
      return;
    }
    const [start, end] = dutchFxTimeRange;
    let mounted = true;
    fetchJson<FxUsdTomanSignalData>(`/api/signals/fx/usd-toman?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setDutchFxPoints(res.points ?? []);
          setDutchFxSource(res.source ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setDutchFxPoints([]);
          setDutchFxSource(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [dutchFxTimeRange, isDutchDiseaseDiagnostics]);

  useEffect(() => {
    if (!fxIranRegimeTimeRange || !isFxIranCurrencyRegime) {
      if (isFxIranCurrencyRegime) {
        setFxDualOfficialPoints([]);
        setFxDualOpenPoints([]);
        setFxDualOfficialSource(null);
        setFxDualOpenSource(null);
      }
      return;
    }
    const [start, end] = fxIranRegimeTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<{
      official: { points: { date: string; value: number }[]; source?: FxUsdTomanSource };
      open_market: { points: { date: string; value: number }[]; source?: FxUsdTomanSource };
    }>(`/api/signals/fx/usd-irr-dual?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setFxDualOfficialPoints(res.official?.points ?? []);
          setFxDualOpenPoints(res.open_market?.points ?? []);
          setFxDualOfficialSource(res.official?.source ?? null);
          setFxDualOpenSource(res.open_market?.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setFxDualOfficialPoints([]);
          setFxDualOpenPoints([]);
          setFxDualOfficialSource(null);
          setFxDualOpenSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [fxIranRegimeTimeRange, isFxIranCurrencyRegime]);

  useEffect(() => {
    if (!wageTimeRange || !isWageCpiReal) return;
    const [start, end] = wageTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<{
      nominal: { date: string; value: number }[];
      cpi: { date: string; value: number }[];
      base_year: number;
      source: { nominal: string; cpi: string };
    }>(`/api/signals/wage/iran-minimum-cpi?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setWageNominalPoints(res.nominal ?? []);
          setWageCpiPoints(res.cpi ?? []);
          setWageBaseYear(res.base_year ?? null);
          setWageSource(res.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setWageNominalPoints([]);
          setWageCpiPoints([]);
          setWageBaseYear(null);
          setWageSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [wageTimeRange, isWageCpiReal]);

  useEffect(() => {
    if (!dualTimeRange || !isOilAndFx) return;
    const [start, end] = dualTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    const fetches = [
      fetchJson<OilSignalData>(`/api/signals/oil/brent?start=${start}&end=${end}`),
      fetchJson<FxUsdTomanSignalData>(`/api/signals/fx/usd-toman?start=${start}&end=${end}`),
    ] as Promise<{ points?: { date: string; value: number }[] }>[];
    if (showGold) {
      fetches.push(fetchJson<OilSignalData>(`/api/signals/gold/global?start=${start}&end=${end}`));
    }
    Promise.all(fetches)
      .then((results) => {
        if (mounted) {
          setOilPoints(results[0].points ?? []);
          setOilSource((results[0] as OilSignalData).source ?? null);
          const fx = results[1] as FxUsdTomanSignalData;
          setFxPoints(fx.points ?? []);
          setFxSource(fx.source ?? null);
          setFxOfficialPoints(fx.official_annual ?? []);
          setFxOfficialSource(fx.official_source ?? null);
          if (showGold && results[2]) {
            setGoldPoints(results[2].points ?? []);
          } else {
            setGoldPoints([]);
          }
        }
      })
      .catch((e) => {
        if (mounted) {
          setOilPoints([]);
          setOilSource(null);
          setFxPoints([]);
          setFxSource(null);
          setFxOfficialPoints([]);
          setFxOfficialSource(null);
          setGoldPoints([]);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [dualTimeRange, isOilAndFx, showGold]);

  useEffect(() => {
    if (!fxTimeRange || !isOilAndFx) {
      if (isOilAndFx) {
        setFxPoints([]);
        setFxSource(null);
        setFxOfficialPoints([]);
        setFxOfficialSource(null);
      }
      return;
    }
    const [start, end] = fxTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<FxUsdTomanSignalData>(`/api/signals/fx/usd-toman?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setFxPoints(res.points ?? []);
          setFxSource(res.source ?? null);
          setFxOfficialPoints(res.official_annual ?? []);
          setFxOfficialSource(res.official_source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setFxPoints([]);
          setFxSource(null);
          setFxOfficialPoints([]);
          setFxOfficialSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fxTimeRange, isOilAndFx]);

  useEffect(() => {
    if (!study || !isOverviewStub) return;
    if (!data || (!showOil && isOverviewStub)) {
      setOilPoints([]);
      return;
    }
    const [start, end] = data.window_range ?? data.time_range;
    let mounted = true;
    fetchJson<OilSignalData>(`/api/signals/oil/brent?start=${start}&end=${end}`)
      .then((res) => mounted && setOilPoints(res.points ?? []))
      .catch(() => mounted && setOilPoints([]));
    return () => {
      mounted = false;
    };
  }, [study, isOverviewStub, data, showOil]);

  const isiDataReady = useMemo(() => {
    if (!isiDiagnosticsData?.series) return false;
    const s = isiDiagnosticsData.series;
    return [s.imports_pct_gdp, s.exports_pct_gdp, s.manufacturing_pct_gdp, s.industry_pct_gdp, s.gdp_growth_pct].some(
      (rec) => Object.values(rec).some((pts) => Array.isArray(pts) && pts.length > 0)
    );
  }, [isiDiagnosticsData]);

  const giniDataReady = useMemo(
    () =>
      giniIranPoints.length +
        giniUsPoints.length +
        giniGermanyPoints.length +
        giniTurkeyPoints.length +
        giniChinaPoints.length +
        giniSaudiArabiaPoints.length >
      0,
    [
      giniIranPoints,
      giniUsPoints,
      giniGermanyPoints,
      giniTurkeyPoints,
      giniChinaPoints,
      giniSaudiArabiaPoints,
    ]
  );

  const inflationDataReady = useMemo(
    () =>
      inflationIranPoints.length +
        inflationUsPoints.length +
        inflationGermanyPoints.length +
        inflationTurkeyPoints.length +
        inflationChinaPoints.length +
        inflationSaudiArabiaPoints.length >
      0,
    [
      inflationIranPoints,
      inflationUsPoints,
      inflationGermanyPoints,
      inflationTurkeyPoints,
      inflationChinaPoints,
      inflationSaudiArabiaPoints,
    ]
  );

  const gdpGlobalDataReady = useMemo(
    () =>
      gdpGlobalUnitedStatesPoints.length +
        gdpGlobalChinaPoints.length +
        gdpGlobalIranPoints.length +
        gdpGlobalTurkeyPoints.length +
        gdpGlobalSaudiArabiaPoints.length +
        gdpGlobalWorldPoints.length >
      0,
    [
      gdpGlobalUnitedStatesPoints,
      gdpGlobalChinaPoints,
      gdpGlobalIranPoints,
      gdpGlobalTurkeyPoints,
      gdpGlobalSaudiArabiaPoints,
      gdpGlobalWorldPoints,
    ]
  );

  const povertyDataReady = useMemo(
    () => povertyDdayPoints.length > 0 || povertyLmicPoints.length > 0,
    [povertyDdayPoints, povertyLmicPoints]
  );

  const povertyPageCoverageExtras = useMemo(() => {
    if (!isPovertyHeadcountIran || !povertyTimeRange) return null;
    const [a, b] = povertyTimeRange;
    if (!a || !b) return null;
    const focusEnd = parseInt(b.slice(0, 4), 10);
    return buildPovertyHeadcountCoverageExtras(povertyDdayPoints, povertyLmicPoints, [a, b], focusEnd);
  }, [isPovertyHeadcountIran, povertyTimeRange, povertyDdayPoints, povertyLmicPoints]);

  const moneySupplyDataReady = useMemo(
    () => moneySupplyM2Points.length > 0 || moneySupplyCpiPoints.length > 0,
    [moneySupplyM2Points, moneySupplyCpiPoints]
  );

  /** Oil + FX study only: downsample open FX for chart (usd-toman API). */
  const fxOpenPointsForChart = useMemo(
    () => (isOilAndFx ? downsampleFxOpenForDisplay(fxPoints, fxTimeRange) : []),
    [isOilAndFx, fxPoints, fxTimeRange]
  );

  if (!study) {
    return (
      <div className="study-page-container py-12 space-y-4">
        <p className="text-muted-foreground">Study not found.</p>
        <Link
          href="/studies"
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 inline-block"
        >
          Back to studies
        </Link>
      </div>
    );
  }

  const showError = error || (isOverviewStub && !data) || (isYoutubeCommentAnalysis && analysisError);

  const isSingleSignalStudy =
    isOilBrent ||
    isOilGlobalLong ||
    isGoldAndOil ||
    isFxIranCurrencyRegime ||
    isOilAndFx ||
    isRealOil ||
    isOilPppIran ||
    isOilExportCapacity ||
    isOilProductionMajorExporters ||
    isWageCpiReal ||
    isOilTradeNetwork ||
    isOilExporterTimeseries ||
    isOilGeopoliticalReaction ||
    isGdpComposition ||
    isGdpIranAccountsDual ||
    isGiniInequality ||
    isInflationCpiYoy ||
    isGdpGlobalComparison ||
    isIsiDiagnostics ||
    isPovertyHeadcountIran ||
    isIranMoneySupplyM2 ||
    isDutchDiseaseDiagnostics ||
    isOilEconomyOverview ||
    isIranEconomyReconstruction1368 ||
    isIranEconomyPeriodComparison ||
    isGlobalEventsTimeline ||
    isBandEventsTimeline ||
    isComparativeHistoryTimeline;

  const hasTimeSeriesEventOverlayControl =
    isSingleSignalStudy &&
    !isOilTradeNetwork &&
    !isFollowerGrowthDynamics &&
    !isYoutubeCommentAnalysis &&
    !isEventsTimeline &&
    !isGlobalEventsTimeline &&
    !isBandEventsTimeline &&
    !isComparativeHistoryTimeline;

  /** Macro-style studies: master overlay plus Iran / world / sanctions layer toggles in the chart header. */
  const macroPanelEventLayerToggles =
    isGiniInequality ||
    isInflationCpiYoy ||
    isGdpGlobalComparison ||
    isIsiDiagnostics ||
    isPovertyHeadcountIran ||
    isIranMoneySupplyM2 ||
    isDutchDiseaseDiagnostics ||
    isIranEconomyReconstruction1368 ||
    isIranEconomyPeriodComparison;

  const singleSignalReady = isGlobalEventsTimeline || isBandEventsTimeline || isComparativeHistoryTimeline
    ? true
    : isGoldAndOil
      ? goldPoints.length > 0 && oilPoints.length > 0
      : isOilBrent || isOilGlobalLong
      ? oilPoints.length > 0
      : isFxIranCurrencyRegime
        ? fxDualOpenPoints.length > 0
        : isOilAndFx
          ? oilPoints.length > 0 && fxPoints.length > 0
          : isRealOil
            ? realOilPoints.length > 0
            : isOilPppIran
              ? pppIranPoints.length > 0
              : isOilExportCapacity
                ? exportCapacityOilPoints.length > 0 && exportCapacityProxyPoints.length > 0
                : isOilEconomyOverview
                  ? oilEconomyProdPoints.length > 0 &&
                    oilEconomyPricePoints.length > 0 &&
                    oilEconomyRevenuePoints.length > 0
                : isOilProductionMajorExporters
                  ? productionUsPoints.length > 0 || productionSaudiPoints.length > 0 || productionRussiaPoints.length > 0 || productionIranPoints.length > 0
                  : isGiniInequality
                    ? giniIranPoints.length > 0 ||
                      giniUsPoints.length > 0 ||
                      giniGermanyPoints.length > 0 ||
                      giniTurkeyPoints.length > 0 ||
                      giniChinaPoints.length > 0 ||
                      giniSaudiArabiaPoints.length > 0
                    : isInflationCpiYoy
                      ? inflationIranPoints.length > 0 ||
                        inflationUsPoints.length > 0 ||
                        inflationGermanyPoints.length > 0 ||
                        inflationTurkeyPoints.length > 0 ||
                        inflationChinaPoints.length > 0 ||
                        inflationSaudiArabiaPoints.length > 0
                      : isGdpGlobalComparison
                        ? gdpGlobalUnitedStatesPoints.length > 0 ||
                          gdpGlobalChinaPoints.length > 0 ||
                          gdpGlobalIranPoints.length > 0 ||
                          gdpGlobalTurkeyPoints.length > 0 ||
                          gdpGlobalSaudiArabiaPoints.length > 0 ||
                          gdpGlobalWorldPoints.length > 0
                      : isIsiDiagnostics
                        ? isiDataReady
                        : isPovertyHeadcountIran
                        ? povertyDdayPoints.length > 0 || povertyLmicPoints.length > 0
                        : isIranMoneySupplyM2
                          ? moneySupplyM2Points.length > 0
                        : isDutchDiseaseDiagnostics
                          ? dutchOilRentsPoints.length > 0 ||
                            dutchManufacturingPoints.length > 0 ||
                            dutchImportsPoints.length > 0 ||
                            dutchFxPoints.length > 0
                      : isWageCpiReal
                          ? wageNominalPoints.length > 0 && wageCpiPoints.length > 0
                          : isOilTradeNetwork
                            ? networkNodesForYear.length > 0
                            : isOilExporterTimeseries
                              ? exporterSaudiPoints.length > 0 ||
                                exporterRussiaPoints.length > 0 ||
                                exporterUsPoints.length > 0 ||
                                exporterIranPoints.length > 0
                              : isOilGeopoliticalReaction
                                ? oilPoints.length > 0
                                : isGdpIranAccountsDual
                                  ? gdpLevelConsumptionPoints.length > 0 &&
                                    gdpLevelGdpPoints.length > 0 &&
                                    gdpLevelInvestmentPoints.length > 0
                                  : isGdpComposition
                                    ? gdpConsumptionPoints.length > 0 &&
                                      gdpInvestmentPoints.length > 0 &&
                                      gdpNominalPoints.length > 0 &&
                                      gdpLevelConsumptionPoints.length > 0 &&
                                      gdpLevelGdpPoints.length > 0 &&
                                      gdpLevelInvestmentPoints.length > 0
                                    : isIranEconomyReconstruction1368 || isIranEconomyPeriodComparison
                                      ? !recoLoading
                                      : false;
  if (loading && (isOverviewStub ? !data : isSingleSignalStudy && !singleSignalReady) || (isYoutubeCommentAnalysis && analysisLoading)) {
    return (
      <div className="study-page-container py-12 animate-pulse space-y-8">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-muted" />
          ))}
        </div>
        <div className="h-80 rounded-xl border bg-muted" />
      </div>
    );
  }

  if (showError) {
    return (
      <div className="study-page-container py-12 space-y-4">
        <p className="text-muted-foreground">{(isYoutubeCommentAnalysis && analysisError) || error || "No data available"}</p>
        <Link
          href="/studies"
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 inline-block"
        >
          Back to studies
        </Link>
      </div>
    );
  }

  const oilKpis = (isOilBrent || isOilGlobalLong) ? computeOilKpis(oilPoints) : null;
  const realOilKpis = isRealOil ? computeOilKpis(realOilPoints) : null;
  const pppIranKpis = isOilPppIran ? computeOilKpis(pppIranPoints) : null;
  const fxKpis = isFxIranCurrencyRegime ? computeFxKpis(fxDualOpenPoints) : null;

  /** Header date range: min/max from all data arrays. Expand to requested range when chart axis extends beyond data. */
  const displayTimeRange = (() => {
    const collect = (arr: { date: string }[]) => arr.map((p) => p.date);

    const allDates: string[] = [];
    if (isIranEconomyPeriodComparison && ipcTimeRange) return ipcTimeRange;
    if (isFxIranCurrencyRegime && fxDualOpenPoints.length > 0) allDates.push(...collect(fxDualOpenPoints));
    if (isOilAndFx && fxPoints.length > 0) allDates.push(...collect(fxPoints));
    if ((isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isOilGeopoliticalReaction) && oilPoints.length > 0) allDates.push(...collect(oilPoints));
    if (isGoldAndOil && goldPoints.length > 0) allDates.push(...collect(goldPoints));
    if (isRealOil && realOilPoints.length > 0) allDates.push(...collect(realOilPoints));
    if (isOilPppIran && pppIranPoints.length > 0) allDates.push(...collect(pppIranPoints));
    if (hasTurkeyComparator && pppTurkeyPoints.length > 0) allDates.push(...collect(pppTurkeyPoints));
    if (isOilExportCapacity) {
      if (exportCapacityOilPoints.length > 0) allDates.push(...collect(exportCapacityOilPoints));
      if (exportCapacityProxyPoints.length > 0) allDates.push(...collect(exportCapacityProxyPoints));
    }
    if (isOilEconomyOverview) {
      if (oilEconomyProdPoints.length > 0) allDates.push(...collect(oilEconomyProdPoints));
      if (oilEconomyDisplayPricePoints.length > 0) allDates.push(...collect(oilEconomyDisplayPricePoints));
      if (oilEconomyDisplayRevenuePoints.length > 0) allDates.push(...collect(oilEconomyDisplayRevenuePoints));
    }
    if (isOilProductionMajorExporters) {
      if (productionUsPoints.length > 0) allDates.push(...collect(productionUsPoints));
      if (productionSaudiPoints.length > 0) allDates.push(...collect(productionSaudiPoints));
      if (productionRussiaPoints.length > 0) allDates.push(...collect(productionRussiaPoints));
      if (productionIranPoints.length > 0) allDates.push(...collect(productionIranPoints));
    }
    if (isGiniInequality) {
      if (giniIranPoints.length > 0) allDates.push(...collect(giniIranPoints));
      if (giniUsPoints.length > 0) allDates.push(...collect(giniUsPoints));
      if (giniGermanyPoints.length > 0) allDates.push(...collect(giniGermanyPoints));
      if (giniTurkeyPoints.length > 0) allDates.push(...collect(giniTurkeyPoints));
      if (giniChinaPoints.length > 0) allDates.push(...collect(giniChinaPoints));
      if (giniSaudiArabiaPoints.length > 0) allDates.push(...collect(giniSaudiArabiaPoints));
    }
    if (isInflationCpiYoy) {
      if (inflationIranPoints.length > 0) allDates.push(...collect(inflationIranPoints));
      if (inflationUsPoints.length > 0) allDates.push(...collect(inflationUsPoints));
      if (inflationGermanyPoints.length > 0) allDates.push(...collect(inflationGermanyPoints));
      if (inflationTurkeyPoints.length > 0) allDates.push(...collect(inflationTurkeyPoints));
      if (inflationChinaPoints.length > 0) allDates.push(...collect(inflationChinaPoints));
      if (inflationSaudiArabiaPoints.length > 0) allDates.push(...collect(inflationSaudiArabiaPoints));
    }
    if (isGdpGlobalComparison) {
      if (gdpGlobalUnitedStatesPoints.length > 0) allDates.push(...collect(gdpGlobalUnitedStatesPoints));
      if (gdpGlobalChinaPoints.length > 0) allDates.push(...collect(gdpGlobalChinaPoints));
      if (gdpGlobalIranPoints.length > 0) allDates.push(...collect(gdpGlobalIranPoints));
      if (gdpGlobalTurkeyPoints.length > 0) allDates.push(...collect(gdpGlobalTurkeyPoints));
      if (gdpGlobalSaudiArabiaPoints.length > 0) allDates.push(...collect(gdpGlobalSaudiArabiaPoints));
      if (gdpGlobalWorldPoints.length > 0) allDates.push(...collect(gdpGlobalWorldPoints));
    }
    if (isIsiDiagnostics && isiSeriesTyped) {
      for (const rec of Object.values(isiSeriesTyped)) {
        for (const pts of Object.values(rec)) {
          if (pts.length > 0) allDates.push(...collect(pts));
        }
      }
    }
    if (isPovertyHeadcountIran) {
      if (povertyDdayPoints.length > 0) allDates.push(...collect(povertyDdayPoints));
      if (povertyLmicPoints.length > 0) allDates.push(...collect(povertyLmicPoints));
    }
    if (isIranMoneySupplyM2) {
      if (moneySupplyM2Points.length > 0) allDates.push(...collect(moneySupplyM2Points));
      if (moneySupplyCpiPoints.length > 0) allDates.push(...collect(moneySupplyCpiPoints));
    }
    if (isDutchDiseaseDiagnostics) {
      if (dutchOilRentsPoints.length > 0) allDates.push(...collect(dutchOilRentsPoints));
      if (dutchManufacturingPoints.length > 0) allDates.push(...collect(dutchManufacturingPoints));
      if (dutchImportsPoints.length > 0) allDates.push(...collect(dutchImportsPoints));
      if (dutchFxPoints.length > 0) allDates.push(...collect(dutchFxPoints));
    }
    if (isOilEconomyOverview) {
      if (oilEconomyProdPoints.length > 0) allDates.push(...collect(oilEconomyProdPoints));
      if (oilEconomyDisplayPricePoints.length > 0) allDates.push(...collect(oilEconomyDisplayPricePoints));
      if (oilEconomyDisplayRevenuePoints.length > 0) allDates.push(...collect(oilEconomyDisplayRevenuePoints));
    }
    if (isOilExporterTimeseries) {
      if (exporterSaudiPoints.length > 0) allDates.push(...collect(exporterSaudiPoints));
      if (exporterRussiaPoints.length > 0) allDates.push(...collect(exporterRussiaPoints));
      if (exporterUsPoints.length > 0) allDates.push(...collect(exporterUsPoints));
      if (exporterIranPoints.length > 0) allDates.push(...collect(exporterIranPoints));
    }
    if (isGdpMacroNationalAccounts) {
      if (gdpConsumptionPoints.length > 0) allDates.push(...collect(gdpConsumptionPoints));
      if (gdpInvestmentPoints.length > 0) allDates.push(...collect(gdpInvestmentPoints));
      if (gdpNominalPoints.length > 0) allDates.push(...collect(gdpNominalPoints));
      if (gdpLevelConsumptionPoints.length > 0) allDates.push(...collect(gdpLevelConsumptionPoints));
      if (gdpLevelGdpPoints.length > 0) allDates.push(...collect(gdpLevelGdpPoints));
      if (gdpLevelInvestmentPoints.length > 0) allDates.push(...collect(gdpLevelInvestmentPoints));
    }
    if (isFollowerGrowthDynamics && fgData) {
      const list = fgData.snapshots ?? fgData.results ?? [];
      const dates = list
        .filter((r) => (r.followers ?? (r as { subscribers?: number }).subscribers ?? null) != null)
        .map((r) => {
          const ts = r.timestamp;
          return ts.includes("-") ? ts.slice(0, 10) : ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts;
        })
        .filter(Boolean);
      allDates.push(...dates);
    }
    if (isEventsTimeline && events.length > 0) {
      const eventDates: string[] = [];
      for (const e of events) {
        if (e.date) eventDates.push(e.date);
        if (e.date_start) eventDates.push(e.date_start);
        if (e.date_end) eventDates.push(e.date_end);
      }
      allDates.push(...eventDates);
    }
    if (isWageCpiReal) {
      if (wageNominalPoints.length > 0) allDates.push(...collect(wageNominalPoints));
      if (wageCpiPoints.length > 0) allDates.push(...collect(wageCpiPoints));
    }
    if (isOilTradeNetwork && networkYears.length > 0) {
      return [networkYears[0]!, networkYears[networkYears.length - 1]!] as [string, string];
    }
    const requestedRange =
      oilTimeRange ??
      fxTimeRange ??
      dualTimeRange ??
      exportCapacityTimeRange ??
      oilEconomyTimeRange ??
      productionTimeRange ??
      giniTimeRange ??
      inflationTimeRange ??
      gdpGlobalTimeRange ??
      isiTimeRange ??
      povertyTimeRange ??
      moneySupplyTimeRange ??
      exporterTimeRange ??
      gdpCompositionTimeRange ??
      fxIranRegimeTimeRange ??
      wageTimeRange ??
      study.timeRange;
    if (allDates.length === 0) return null;
    const sorted = [...allDates].sort();
    const dataMin = sorted[0]!;
    const dataMax = sorted[sorted.length - 1]!;
    const reqMin = requestedRange[0];
    const reqMax = requestedRange[1];
    const min = reqMin && reqMin < dataMin ? reqMin : dataMin;
    const max = reqMax && reqMax > dataMax ? reqMax : dataMax;
    return [min, max] as [string, string];
  })();

  /** Latest data date from arrays used by this study. */
  const latestDataDate = getLatestDate(
    (() => {
      const arrays: { date: string }[][] = [];
      if (isOverviewStub) {
        if (data?.timeline?.length) arrays.push(data.timeline);
        if (oilPoints.length > 0) arrays.push(oilPoints);
      }
      if (isFxIranCurrencyRegime && fxDualOpenPoints.length > 0) arrays.push(fxDualOpenPoints);
      if (isOilAndFx && fxPoints.length > 0) arrays.push(fxPoints);
      if ((isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isOilGeopoliticalReaction) && oilPoints.length > 0) arrays.push(oilPoints);
      if (isGoldAndOil && goldPoints.length > 0) arrays.push(goldPoints);
      if (isRealOil && realOilPoints.length > 0) arrays.push(realOilPoints);
      if (isOilPppIran && pppIranPoints.length > 0) arrays.push(pppIranPoints);
      if (hasTurkeyComparator && pppTurkeyPoints.length > 0) arrays.push(pppTurkeyPoints);
      if (isOilExportCapacity) {
        if (exportCapacityOilPoints.length > 0) arrays.push(exportCapacityOilPoints);
        if (exportCapacityProxyPoints.length > 0) arrays.push(exportCapacityProxyPoints);
      }
      if (isOilEconomyOverview) {
        if (oilEconomyProdPoints.length > 0) arrays.push(oilEconomyProdPoints);
        if (oilEconomyDisplayPricePoints.length > 0) arrays.push(oilEconomyDisplayPricePoints);
        if (oilEconomyDisplayRevenuePoints.length > 0) arrays.push(oilEconomyDisplayRevenuePoints);
      }
      if (isOilProductionMajorExporters) {
        // Label = last date with actual data; exclude current year (projected) and synthetic extensions
        const currentYear = new Date().getUTCFullYear();
        const excludeProjectedAndSynthetic = (pts: { date: string }[]) => {
          let f = pts;
          if (productionExtendedDates.length > 0) {
            f = f.filter((p) => !productionExtendedDates.includes(p.date));
          }
          return f.filter((p) => parseInt(p.date.slice(0, 4), 10) < currentYear);
        };
        if (productionUsPoints.length > 0) arrays.push(excludeProjectedAndSynthetic(productionUsPoints));
        if (productionSaudiPoints.length > 0) arrays.push(excludeProjectedAndSynthetic(productionSaudiPoints));
        if (productionRussiaPoints.length > 0) arrays.push(excludeProjectedAndSynthetic(productionRussiaPoints));
        if (productionIranPoints.length > 0) arrays.push(excludeProjectedAndSynthetic(productionIranPoints));
      }
      if (isFollowerGrowthDynamics && fgData) {
        const list = fgData.snapshots ?? fgData.results ?? [];
        const points = list
          .filter((r) => (r.followers ?? (r as { subscribers?: number }).subscribers ?? null) != null)
          .map((r) => {
            const ts = r.timestamp;
            const date = ts.includes("-") ? ts.slice(0, 10) : ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts;
            return { date };
          })
          .filter((p) => p.date);
        if (points.length > 0) arrays.push(points);
      }
      if (isEventsTimeline && events.length > 0) {
        const eventPoints: { date: string }[] = [];
        for (const e of events) {
          if (e.date) eventPoints.push({ date: e.date });
          if (e.date_start) eventPoints.push({ date: e.date_start });
          if (e.date_end) eventPoints.push({ date: e.date_end });
        }
        if (eventPoints.length > 0) arrays.push(eventPoints);
      }
      // Iran FX regime: "Data through" follows the open‑market series only (same as Latest KPI), not official WDI end dates.
      if (isWageCpiReal) {
        if (wageNominalPoints.length > 0) arrays.push(wageNominalPoints);
        if (wageCpiPoints.length > 0) arrays.push(wageCpiPoints);
      }
      if (isOilTradeNetwork && networkYears.length > 0) {
        arrays.push(networkYears.map((y) => ({ date: `${y}-01-01` })));
      }
      if (isOilExporterTimeseries) {
        if (exporterSaudiPoints.length > 0) arrays.push(exporterSaudiPoints);
        if (exporterRussiaPoints.length > 0) arrays.push(exporterRussiaPoints);
        if (exporterUsPoints.length > 0) arrays.push(exporterUsPoints);
        if (exporterIranPoints.length > 0) arrays.push(exporterIranPoints);
      }
      if (isGdpMacroNationalAccounts) {
        if (gdpConsumptionPoints.length > 0) arrays.push(gdpConsumptionPoints);
        if (gdpInvestmentPoints.length > 0) arrays.push(gdpInvestmentPoints);
        if (gdpNominalPoints.length > 0) arrays.push(gdpNominalPoints);
        if (gdpLevelConsumptionPoints.length > 0) arrays.push(gdpLevelConsumptionPoints);
        if (gdpLevelGdpPoints.length > 0) arrays.push(gdpLevelGdpPoints);
        if (gdpLevelInvestmentPoints.length > 0) arrays.push(gdpLevelInvestmentPoints);
      }
      if (isGiniInequality) {
        if (giniIranPoints.length > 0) arrays.push(giniIranPoints);
        if (giniUsPoints.length > 0) arrays.push(giniUsPoints);
        if (giniGermanyPoints.length > 0) arrays.push(giniGermanyPoints);
        if (giniTurkeyPoints.length > 0) arrays.push(giniTurkeyPoints);
        if (giniChinaPoints.length > 0) arrays.push(giniChinaPoints);
        if (giniSaudiArabiaPoints.length > 0) arrays.push(giniSaudiArabiaPoints);
      }
      if (isInflationCpiYoy) {
        if (inflationIranPoints.length > 0) arrays.push(inflationIranPoints);
        if (inflationUsPoints.length > 0) arrays.push(inflationUsPoints);
        if (inflationGermanyPoints.length > 0) arrays.push(inflationGermanyPoints);
        if (inflationTurkeyPoints.length > 0) arrays.push(inflationTurkeyPoints);
        if (inflationChinaPoints.length > 0) arrays.push(inflationChinaPoints);
        if (inflationSaudiArabiaPoints.length > 0) arrays.push(inflationSaudiArabiaPoints);
      }
      if (isGdpGlobalComparison) {
        if (gdpGlobalUnitedStatesPoints.length > 0) arrays.push(gdpGlobalUnitedStatesPoints);
        if (gdpGlobalChinaPoints.length > 0) arrays.push(gdpGlobalChinaPoints);
        if (gdpGlobalIranPoints.length > 0) arrays.push(gdpGlobalIranPoints);
        if (gdpGlobalTurkeyPoints.length > 0) arrays.push(gdpGlobalTurkeyPoints);
        if (gdpGlobalSaudiArabiaPoints.length > 0) arrays.push(gdpGlobalSaudiArabiaPoints);
        if (gdpGlobalWorldPoints.length > 0) arrays.push(gdpGlobalWorldPoints);
      }
      if (isIsiDiagnostics && isiSeriesTyped) {
        for (const rec of Object.values(isiSeriesTyped)) {
          for (const pts of Object.values(rec)) {
            if (pts.length > 0) arrays.push(pts);
          }
        }
      }
      if (isPovertyHeadcountIran) {
        if (povertyDdayPoints.length > 0) arrays.push(povertyDdayPoints);
        if (povertyLmicPoints.length > 0) arrays.push(povertyLmicPoints);
      }
      if (isIranMoneySupplyM2) {
        if (moneySupplyM2Points.length > 0) arrays.push(moneySupplyM2Points);
        if (moneySupplyCpiPoints.length > 0) arrays.push(moneySupplyCpiPoints);
      }
      return arrays;
    })()
  );

  const { prev: prevStudy, next: nextStudy } = getPrevNextStudies(study?.id ?? studyId);

  const gdpLevelsXAxisYearLabel: ChartAxisYearMode | undefined =
    faEligible &&
    isGdpIranLocal &&
    (isGdpIranAccountsDual || (isGdpComposition && gdpStudyView === "levels"))
      ? yearAxisMode
      : undefined;

  return (
    <StudyChartExportFilenameProvider value={{ studySlug: study.id, locale: isFa ? "fa" : "en" }}>
      <div
        className={`study-page-container study-page-minimal py-8 md:py-10 min-w-0${isFa ? " study-page-fa" : ""}`}
        dir={isFa ? "rtl" : "ltr"}
        lang={isFa ? "fa" : "en"}
        suppressHydrationWarning
      >
      <header className="study-header">
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/studies"
            className="text-xs text-muted-foreground hover:text-foreground inline-block"
          >
            {L(isFa, "← Studies", "← مطالعات")}
          </Link>
          {faEligible ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StudyLanguageToggle locale={studyLocale} onLocaleChange={setStudyLocale} />
              <span className="inline-flex flex-wrap items-center gap-1.5 border-s border-border/60 ps-3 text-xs text-muted-foreground">
                <span className="whitespace-nowrap shrink-0">{L(isFa, "Year axis:", "محور سال:")}</span>
                <StudyYearDisplayToggle size="compact" isFa={isFa} value={yearAxisMode} onChange={setYearAxisMode} />
              </span>
            </div>
          ) : null}
        </div>
        <p className="study-header-number">
          {L(isFa, `Study ${study.number}`, `مطالعه ${study.number}`)}
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="study-header-title text-foreground">{displayStudy.title}</h1>
          <div className="flex items-center gap-3 text-sm">
            {prevStudy ? (
              <Link
                href={`/studies/${prevStudy.id}`}
                className="study-header-meta hover:text-foreground inline-flex items-center gap-1"
                title={`Study ${prevStudy.number}: ${prevStudy.title}`}
              >
                <span aria-hidden>←</span>
                <span>{L(isFa, "Previous", "قبلی")}</span>
              </Link>
            ) : null}
            {prevStudy && nextStudy ? (
              <span className="study-header-meta opacity-50">|</span>
            ) : null}
            {nextStudy ? (
              <Link
                href={`/studies/${nextStudy.id}`}
                className="study-header-meta hover:text-foreground inline-flex items-center gap-1"
                title={`Study ${nextStudy.number}: ${nextStudy.title}`}
              >
                <span>{L(isFa, "Next", "بعدی")}</span>
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        </div>
        {displayStudy.subtitle ? (
          <p className="study-header-meta mb-1 max-w-3xl">{displayStudy.subtitle}</p>
        ) : null}
        <div className="study-header-meta-stripe flex flex-wrap items-baseline gap-x-2 gap-y-1 max-w-3xl">
          <span>
            {displayTimeRange
              ? `${displayTimeRange[0]} — ${displayTimeRange[1]}`
              : L(isFa, "No data loaded", "داده‌ای بارگذاری نشده")}
          </span>
          {latestDataDate ? (
            <>
              <span className="text-muted-foreground/35 hidden sm:inline" aria-hidden>
                ·
              </span>
              <span
                title={
                  isFxIranCurrencyRegime
                    ? L(
                        isFa,
                        "Most recent date in the merged open‑market USD→toman series (not cache refresh time).",
                        "آخرین تاریخ در سری ادغام‌شدهٔ بازار آزاد (دلار→تومان)، نه زمان به‌روزرسانی کش.",
                      )
                    : undefined
                }
              >
                {L(isFa, "Data through", "داده تا")}
                {": "}
                {(isOilTradeNetwork || isOilExporterTimeseries || isGdpMacroNationalAccounts)
                  ? latestDataDate.getFullYear()
                  : formatDate(latestDataDate)}
              </span>
            </>
          ) : null}
          {lastUpdated ? (
            <>
              <span className="text-muted-foreground/35 hidden sm:inline" aria-hidden>
                ·
              </span>
              <span
                title={L(
                  isFa,
                  "When SignalMap last checked or refreshed its processed/cached copy of this study’s data—not necessarily a new observation from the source.",
                  "زمانی که SignalMap آخرین بار دادهٔ پردازش‌شده یا کش این مطالعه را بررسی یا بازسازی کرده؛ لزوماً به معنای مشاهدهٔ جدید از منبع نیست.",
                )}
              >
                {L(isFa, "Refreshed", "تازه‌سازی")}
                {": "}
                {new Date(lastUpdated).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </>
          ) : null}
        </div>
      </header>

      {isGlobalEventsTimeline ? (
        <>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              {L(isFa, "Interactive context timeline", "تایم‌لاین زمینه (تعاملی)")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{displayStudy.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {L(
                isFa,
                "Drag to pan, use the scroll wheel to zoom, and toggle layers. Hover events for details.",
                "کشیدن برای جابه‌جایی، اسکرول برای بزرگ‌نمایی، و لایه‌ها را تغییر دهید. برای جزئیات نگه دارید.",
              )}
            </p>
            <div className="mt-2 flex max-w-2xl items-start gap-2">
              <input
                id="signalmap-dot-all-importance"
                name="signalmap_dot_all_importance"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border border-border"
                checked={showAllSignalMapImportance}
                onChange={(e) => setShowAllSignalMapImportance(e.target.checked)}
              />
              <label
                htmlFor="signalmap-dot-all-importance"
                className="text-xs text-muted-foreground cursor-pointer select-none leading-snug"
              >
                {L(
                  isFa,
                  "Show more events (incl. minor and context at the current zoom).",
                  "نمایش رویدادهای بیشتر (شامل جزئی و زمینه در همین زوم)."
                )}
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {study ? (
              <SignalMapTimeline
                timeRange={study.timeRange}
                locale={isFa ? "fa" : "en"}
                xAxisYearLabel={chartYearAxisLabel}
                importanceDetail={showAllSignalMapImportance ? "all" : "default"}
                initialZoom={1}
              />
            ) : null}
          </CardContent>
        </Card>
        {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
        <InSimpleTerms locale={isFa ? "fa" : "en"}>
          {isFa && faRich?.simpleTermsParagraphs?.length ? (
            faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>
              This view arranges global, Iran, oil, currency, and war-relevant events on a shared time axis. Use it as a
              navigational reference, not a causal model.
            </p>
          )}
        </InSimpleTerms>
        </>
      ) : isComparativeHistoryTimeline ? (
        <>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              {L(isFa, "Comparative history (swimlanes)", "تاریخ تطبیقی (لایه‌های شناور)")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{displayStudy.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {L(
                isFa,
                "Five rows: Iran, France, the UK, the U.S., and world-scale eras. Schematic periodisation—use Fit all, then zoom in.",
                "پنج ردیف: ایران، فرانسه، بریتانیا، ایالات متحده و دوره‌های جهانی. بخش‌بندی نمادین—ابتدا «نمایش همه»، سپس بزرگ‌نمایی."
              )}
            </p>
            <div className="mt-2 flex max-w-2xl items-start gap-2">
              <input
                id="signalmap-comparative-band-all-importance"
                name="signalmap_comparative_band_all_importance"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border border-border"
                checked={showAllSignalMapImportance}
                onChange={(e) => setShowAllSignalMapImportance(e.target.checked)}
              />
              <label
                htmlFor="signalmap-comparative-band-all-importance"
                className="text-xs text-muted-foreground cursor-pointer select-none leading-snug"
              >
                {L(
                  isFa,
                  "Show more events (incl. minor and context at the current zoom).",
                  "نمایش رویدادهای بیشتر (شامل جزئی و زمینه در همین زوم)."
                )}
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {study ? (
              <SignalMapBandTimeline
                events={COMPARATIVE_HISTORY_BAND}
                laneOrder={COMPARATIVE_HISTORY_LANE_ORDER}
                layerUi={COMPARATIVE_HISTORY_LAYER_UI}
                timeRange={study.timeRange}
                locale={isFa ? "fa" : "en"}
                xAxisYearLabel={chartYearAxisLabel}
                importanceDetail={showAllSignalMapImportance ? "all" : "default"}
                initialZoom={1}
                onEventClick={(e) =>
                  trackEvent("band_timeline_event_click", { study_id: studyId, event_id: e.id, kind: e.kind })
                }
              />
            ) : null}
          </CardContent>
        </Card>
        {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
        <InSimpleTerms locale={isFa ? "fa" : "en"}>
          {isFa && faRich?.simpleTermsParagraphs?.length ? (
            faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>
              Date boundaries are chosen for a readable side-by-side comparison, not a definitive single chronology. Use
              lane toggles to hide regions, and zoom in to read band labels and see overlaps.
            </p>
          )}
        </InSimpleTerms>
        </>
      ) : isBandEventsTimeline ? (
        <>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              {L(isFa, "Band / swimlane context timeline", "تایم‌لاین باندی (زمینه)")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{displayStudy.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {L(
                isFa,
                "Periods are shown as horizontal bands; point events are shown as markers. Drag to pan, scroll to zoom, and toggle layers on or off.",
                "دوره‌ها باند افقی و نقاط رویداد مارکر. کشیدن، اسکرول برای بزرگ‌نمایی، لایه‌ها را فعال/غیرفعال کنید.",
              )}
            </p>
            <div className="mt-2 flex max-w-2xl items-start gap-2">
              <input
                id="signalmap-band-all-importance"
                name="signalmap_band_all_importance"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border border-border"
                checked={showAllSignalMapImportance}
                onChange={(e) => setShowAllSignalMapImportance(e.target.checked)}
              />
              <label
                htmlFor="signalmap-band-all-importance"
                className="text-xs text-muted-foreground cursor-pointer select-none leading-snug"
              >
                {L(
                  isFa,
                  "Show more events (incl. minor and context at the current zoom).",
                  "نمایش رویدادهای بیشتر (شامل جزئی و زمینه در همین زوم)."
                )}
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {study ? (
              <SignalMapBandTimeline
                timeRange={study.timeRange}
                locale={isFa ? "fa" : "en"}
                xAxisYearLabel={chartYearAxisLabel}
                importanceDetail={showAllSignalMapImportance ? "all" : "default"}
                initialZoom={1}
                onEventClick={(e) =>
                  trackEvent("band_timeline_event_click", { study_id: studyId, event_id: e.id, kind: e.kind })
                }
              />
            ) : null}
          </CardContent>
        </Card>
        {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
        <InSimpleTerms locale={isFa ? "fa" : "en"}>
          {isFa && faRich?.simpleTermsParagraphs?.length ? (
            faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>
              This swimlane view shows long periods as soft bands and anchor dates as markers. Use it as navigational
              context only—co-occurrence is not causation.
            </p>
          )}
        </InSimpleTerms>
        </>
      ) : isEventsTimeline ? (
        <>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Reference timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {displayStudy.description}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Hover over events for details. Toggle categories to focus.
            </p>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mr-2" htmlFor="events-timeline-focus-event">
                Focus on event:
              </label>
              <select
                id="events-timeline-focus-event"
                name="events_timeline_focus_event"
                value={anchorEventId}
                onChange={(e) => setAnchorEventId(e.target.value)}
                className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Full timeline</option>
                {events
                  .filter((e): e is Event & { category: string } => !!e.category)
                  .sort((a, b) => (b.date_start ?? b.date ?? "").localeCompare(a.date_start ?? a.date ?? ""))
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date_start ?? ev.date ?? ""})
                    </option>
                  ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <EventsTimeline
              events={events.filter((e): e is Event & { category: string } => !!e.category) as TimelineEvent[]}
              timeRange={
                anchorEventId
                  ? (() => {
                      const ev = events.find((e) => e.id === anchorEventId);
                      const anchorDate = ev?.date ?? ev?.date_start ?? ev?.date_end;
                      if (!anchorDate) return study.timeRange;
                      const [rangeStart, rangeEnd] = study.timeRange;
                      const d = new Date(anchorDate);
                      const start = new Date(d);
                      start.setFullYear(start.getFullYear() - 5);
                      const end = new Date(d);
                      end.setFullYear(end.getFullYear() + 5);
                      return [
                        start.toISOString().slice(0, 10) < rangeStart ? rangeStart : start.toISOString().slice(0, 10),
                        end.toISOString().slice(0, 10) > rangeEnd ? rangeEnd : end.toISOString().slice(0, 10),
                      ] as [string, string];
                    })()
                  : study.timeRange
              }
            />
          </CardContent>
        </Card>
        {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
        <InSimpleTerms locale={isFa ? "fa" : "en"}>
          <p>
            This timeline provides chronological context for political, economic, and geopolitical events.
            Use it as a reference when interpreting charts—events are anchors for understanding, not explanations of cause and effect.
          </p>
        </InSimpleTerms>
        </>
      ) : isYoutubeCommentAnalysis && analysisData ? (
        <>
        <div className="study-panel">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="study-panel-title m-0">Dataset</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchYoutubeAnalysis(false, true)}
                disabled={analysisLoading}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
                title="Recompute cluster labels from cached comments (no API quota, may take a minute)"
              >
                {analysisLoading ? "Recomputing…" : "Recompute labels"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const code = window.prompt("Enter admin code to refresh from YouTube (uses API quota):");
                  if (code !== null) fetchYoutubeAnalysis(true, false, code);
                }}
                disabled={analysisLoading}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
                title="Fetch fresh comments from YouTube (uses API quota)"
              >
                Refresh from YouTube
              </button>
            </div>
          </div>
          <dl className="grid gap-1.5 text-sm text-muted-foreground [&_dt]:font-medium [&_dt]:text-foreground/90 [&_dt]:inline [&_dt]:after:content-[':'] [&_dt]:after:mr-1 [&_dd]:inline">
            <div>
              <dt>Channel</dt>
              <dd>
                {analysisData.channel_owner
                  ? `${analysisData.channel_name ?? "BPlus Podcast"} (${analysisData.channel_owner})`
                  : (analysisData.channel_name ?? analysisData.channel_title ?? "BPlus Podcast (Ali Bandari)")}
              </dd>
            </div>
            <div><dt>Videos analyzed</dt><dd>{analysisData.videos_analyzed ?? 0}</dd></div>
            <div><dt>Comments analyzed</dt><dd>{analysisData.comments_analyzed ?? analysisData.total_comments ?? 0}</dd></div>
            {analysisData.computed_at && (
              <div>
                <dt>Computed at</dt>
                <dd>
                  {(() => {
                    try {
                      const d = new Date(analysisData.computed_at.replace("Z", "+00:00"));
                      return d.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short",
                      });
                    } catch {
                      return analysisData.computed_at;
                    }
                  })()}
                </dd>
              </div>
            )}
            <div>
              <dt>Time period</dt>
              <dd>
                {analysisData.time_range?.start && analysisData.time_range?.end
                  ? `${analysisData.time_range.start} – ${analysisData.time_range.end}`
                  : analysisData.time_period_start && analysisData.time_period_end
                    ? `${analysisData.time_period_start} – ${analysisData.time_period_end}`
                    : "—"}
              </dd>
            </div>
            <div><dt>Language</dt><dd>{study?.youtubeLanguage ?? analysisData.language ?? "Persian"}</dd></div>
          </dl>
        </div>
        {analysisData.videos && analysisData.videos.length > 0 && (
          <div className="study-panel">
            <p className="study-panel-title">Videos analyzed</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {(analysisData.videos.slice(0, 10)).map((v, i) => {
                const dateStr = v.published_at
                  ? (() => {
                      try {
                        const d = new Date(v.published_at.replace("Z", "+00:00"));
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      } catch {
                        return "";
                      }
                    })()
                  : "";
                const lang = study?.youtubeLanguage ?? analysisData.language ?? "";
                const textDir = lang.toLowerCase().startsWith("english") ? "ltr" : "rtl";
                return (
                  <li key={v.video_id || i} className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
                    <span dir={textDir} className="min-w-0 flex-1">{decodeHtmlEntities(v.title || "") || "(no title)"}</span>
                    {dateStr && <span className="text-xs shrink-0">— {dateStr}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Channel analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-medium">
              {analysisData.channel_owner
                ? `${analysisData.channel_name ?? "BPlus Podcast"} (${analysisData.channel_owner})`
                : (analysisData.channel_name ?? analysisData.channel_title ?? "BPlus Podcast (Ali Bandari)")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Persian-language educational podcast covering history, culture, and political topics. The comments analyzed below reflect discussion among viewers of this channel.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{study.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{displayStudy.description}</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <h3 className="text-sm font-medium mb-2">Average sentiment</h3>
              <p className="text-muted-foreground">
                Sentiment score: {(analysisData.avg_sentiment ?? 0).toFixed(2)}
              </p>
            </section>
            {(() => {
              const textDir = ((study?.youtubeLanguage ?? analysisData.language) ?? "").toLowerCase().startsWith("english") ? "ltr" : "rtl";
              const toItems = (raw: [string, number][] | undefined) =>
                (raw ?? [])
                  .filter((w): w is [string, number] =>
                    w != null && Array.isArray(w) && w.length >= 2 && typeof w[0] === "string" && typeof w[1] === "number"
                  )
                  .map(([word, value]) => ({ word: String(word), value: Number(value) }));
              const keywords = toItems(analysisData?.keywords ?? analysisData?.top_words);
              const narrativePhrases = toItems(analysisData?.narrative_phrases).filter((i) => i.value >= 3);
              const allCounts = [...keywords.map((i) => i.value), ...narrativePhrases.map((i) => i.value)];
              const scaleMin = allCounts.length ? Math.min(...allCounts) : 0;
              const scaleMax = allCounts.length ? Math.max(...allCounts) : 1;
              const logMin = Math.log(scaleMin + 1);
              const logMax = Math.log(scaleMax + 1);
              const logRange = logMax - logMin || 1;
              const ChipBlock = ({ items }: { items: { word: string; value: number }[] }) => {
                const minSize = 8;
                const maxSize = 20;
                return (
                  <div
                    className="flex flex-wrap gap-1.5 p-2 min-w-0"
                    dir={textDir}
                    style={{ direction: textDir }}
                  >
                    {items.map(({ word, value }) => {
                      const logVal = Math.log(Math.max(value, scaleMin) + 1);
                      const t = Math.min(1, Math.max(0, (logVal - logMin) / logRange));
                      const size = minSize + t * (maxSize - minSize);
                      return (
                        <span
                          key={`${word}-${value}`}
                          className="inline-flex items-baseline gap-1 px-2 py-0.5 rounded-md bg-muted font-medium break-words"
                          style={{ fontSize: `${Math.round(size)}px` }}
                        >
                          {word}
                          <span className="text-[9px] tabular-nums text-muted-foreground/70 font-normal">
                            {value}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                );
              };
              return (
                <>
                  <section>
                    <h3 className="text-sm font-medium mb-2">Keywords</h3>
                    <p className="text-xs text-muted-foreground mb-1">General discourse topics (single words)</p>
                    <ChipBlock items={keywords} />
                  </section>
                  <section className="mt-6 pt-6 border-t border-border">
                    <h3 className="text-sm font-medium mb-2">Narrative phrases</h3>
                    <p className="text-xs text-muted-foreground mb-1">Frames and slogans (multi-word phrases)</p>
                    {narrativePhrases.length > 0 ? (
                      <ChipBlock items={narrativePhrases} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No phrases with count ≥ 3</p>
                    )}
                  </section>
                </>
              );
            })()}
            <section>
              <h3 className="text-sm font-medium mb-2">Comments analyzed</h3>
              <p className="text-muted-foreground">
                {analysisData.comments_analyzed ?? analysisData.total_comments ?? 0} comments
              </p>
            </section>
            {((analysisData.points_pca?.length ?? 0) > 0 ||
              (analysisData.points_umap?.length ?? 0) > 0 ||
              (analysisData.points_tfidf?.length ?? 0) > 0 ||
              (analysisData.points_minilm?.length ?? 0) > 0) && (
              <section>
                <h3 className="text-sm font-medium mb-2">Discourse structure</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Each point represents a comment. Proximity indicates similar language. Compare model variants below.
                </p>
                <YoutubeDiscourseMaps
                  textDir={((study?.youtubeLanguage ?? analysisData.language) ?? "").toLowerCase().startsWith("english") ? "ltr" : "rtl"}
                  pointsPca={analysisData.points_pca ?? []}
                  pointsUmap={analysisData.points_umap ?? []}
                  pointsTfidf={analysisData.points_tfidf ?? analysisData.points_umap ?? []}
                  pointsHdbscan={analysisData.points_hdbscan ?? analysisData.points_umap ?? []}
                  pointsMinilm={analysisData.points_minilm ?? []}
                  discourseComments={analysisData.discourse_comments}
                  clusterLabels={analysisData.cluster_labels}
                  clusterLabelsPca={analysisData.cluster_labels_pca}
                  clusterLabelsTfidf={analysisData.cluster_labels_tfidf ?? analysisData.cluster_labels}
                  clusterLabelsHdbscan={analysisData.cluster_labels_hdbscan}
                  clusterLabelsMinilm={analysisData.cluster_labels_minilm}
                  clusterStatsPca={analysisData.cluster_stats_pca}
                  clusterStatsTfidf={analysisData.cluster_stats_tfidf}
                  clusterStatsHdbscan={analysisData.cluster_stats_hdbscan}
                  clusterStatsMinilm={analysisData.cluster_stats_minilm}
                  clusterAssignmentsPca={analysisData.cluster_assignments_pca}
                  clusterAssignmentsTfidf={analysisData.cluster_assignments_tfidf}
                  clusterAssignmentsHdbscan={analysisData.cluster_assignments_hdbscan}
                  clusterAssignmentsMinilm={analysisData.cluster_assignments_minilm}
                  clustersSummaryPca={analysisData.clusters_summary_pca}
                  clustersSummaryHdbscan={analysisData.clusters_summary_hdbscan}
                  clustersSummaryTfidf={analysisData.clusters_summary_tfidf}
                  clustersSummaryMinilm={analysisData.clusters_summary_minilm}
                />
              </section>
            )}
            {analysisData.topics && analysisData.topics.length > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-2">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisData.topics.map(([topic, count]) => (
                    <span
                      key={topic}
                      className="text-xs"
                      style={{
                        background: "#f5f5f5",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 12,
                      }}
                      title={`${count} comments`}
                    >
                      {topic.replace(/_/g, " ")} {count}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
        <LearningNote locale={isFa ? "fa" : "en"}
          title="How to read this study"
          sections={[
            {
              heading: "Visual elements",
              bullets: [
                "Keywords: Single-word topics from the discourse. Narrative phrases: Multi-word frames and slogans.",
                "Topics: Counts of comments containing keywords associated with thematic groups such as geopolitics, history, or religion.",
                "Discourse maps: Each point represents one comment. Points close together use similar vocabulary. Two projection methods are shown: PCA (linear) and UMAP (nonlinear clustering).",
              ],
            },
            {
              heading: "What this measures",
              bullets: [
                "Comments collected via YouTube Data API.",
                "Persian text normalization.",
                "Stopword filtering.",
                "TF-IDF vectorization.",
                "Dimensionality reduction (PCA and UMAP).",
              ],
            },
          ]}
        />
        {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
        <SourceInfo
          items={[
            {
              label: "Comments",
              sourceName: "YouTube Data API",
              sourceUrl: "https://developers.google.com/youtube/v3",
              sourceDetail: "commentThreads endpoint",
            },
          ]}
          note="Comments from recent videos of the channel. Persian text normalized; TF-IDF and dimensionality reduction applied for discourse maps."
        />
        <InSimpleTerms locale={isFa ? "fa" : "en"}>
          <p>
            This study analyzes what viewers say in YouTube comments. Keywords and narrative phrases show topics and frames; the discourse maps group comments by similar vocabulary. PCA and UMAP are two ways to project high-dimensional text into 2D for visualization.
          </p>
        </InSimpleTerms>
        </>
      ) : isFollowerGrowthDynamics ? (
        <>
          <Card className="border-border min-w-0 overflow-visible">
            <CardHeader>
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                Follower growth dynamics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {displayStudy.description}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Data source: Wayback Machine follower count snapshots. Irregular time resolution.
              </p>
              <form
                suppressHydrationWarning
                onSubmit={async (e) => {
                  e.preventDefault();
                  const handle = fgUsername.trim();
                  if (!handle) return;
                  setFgLoading(true);
                  setFgError(null);
                  setFgData(null);
                  setFgMetadata(null);
                  try {
                    const url = `/api/wayback/${fgPlatform}/cache-first?handle=${encodeURIComponent(handle)}&limit=40`;
                    const res = await fetchJson<{
                      platform: string;
                      handle: string;
                      source: "cache" | "live" | "mixed";
                      snapshots: { timestamp: string; followers?: number | null }[];
                      meta?: { cache_hit?: boolean; cache_rows?: number; wayback_calls?: number; last_cached_at?: string | null };
                    }>(url);
                    setFgData(res);
                    setFgMetadata({
                      source: res.source,
                      count: res.meta?.cache_rows ?? res.snapshots?.length,
                      last_cached_at: res.meta?.last_cached_at ?? undefined,
                    });
                  } catch (err) {
                    setFgError(err instanceof Error ? err.message : "Fetch failed");
                  } finally {
                    setFgLoading(false);
                  }
                }}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <label className="flex flex-col gap-1" htmlFor="follower-growth-platform" suppressHydrationWarning>
                  <span className="text-xs text-muted-foreground">Platform</span>
                  <select
                    id="follower-growth-platform"
                    name="follower_growth_platform"
                    value={fgPlatform}
                    suppressHydrationWarning
                    onChange={(e) => setFgPlatform(e.target.value as "twitter" | "instagram" | "youtube")}
                    className="text-sm border border-border rounded px-2.5 py-1.5 bg-background"
                  >
                    <option value="twitter">Twitter / X</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1" htmlFor="follower-growth-handle" suppressHydrationWarning>
                  <span className="text-xs text-muted-foreground">Handle</span>
                  <input
                    id="follower-growth-handle"
                    name="follower_growth_handle"
                    type="text"
                    suppressHydrationWarning
                    value={fgUsername}
                    onChange={(e) => setFgUsername(e.target.value)}
                    placeholder={fgPlatform === "youtube" ? "@channel" : "username or @handle"}
                    className="text-sm border border-border rounded px-2.5 py-1.5 bg-background min-w-[140px]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={fgLoading}
                  className="text-sm border border-border rounded px-4 py-1.5 hover:bg-muted/50 disabled:opacity-50"
                  suppressHydrationWarning
                >
                  {fgLoading ? "Fetching…" : "Fetch data"}
                </button>
              </form>
              {fgError && (
                <p className="mt-2 text-sm text-muted-foreground">{fgError}</p>
              )}
              {fgData && (fgData.snapshots?.length ?? fgData.results?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="follower-growth-show-linear">
                    <input
                      id="follower-growth-show-linear"
                      name="follower_growth_show_linear"
                      type="checkbox"
                      checked={fgShowLinear}
                      onChange={(e) => setFgShowLinear(e.target.checked)}
                      className="rounded border-border"
                    />
                    Linear model
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="follower-growth-show-exponential">
                    <input
                      id="follower-growth-show-exponential"
                      name="follower_growth_show_exponential"
                      type="checkbox"
                      checked={fgShowExponential}
                      onChange={(e) => setFgShowExponential(e.target.checked)}
                      className="rounded border-border"
                    />
                    Exponential model
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="follower-growth-show-logistic">
                    <input
                      id="follower-growth-show-logistic"
                      name="follower_growth_show_logistic"
                      type="checkbox"
                      checked={fgShowLogistic}
                      onChange={(e) => setFgShowLogistic(e.target.checked)}
                      className="rounded border-border"
                    />
                    Logistic (S-curve) model
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {fgData && (() => {
                const list = fgData.snapshots ?? fgData.results ?? [];
                const points = list
                  .filter((r) => (r.followers ?? (r as { subscribers?: number }).subscribers ?? null) != null)
                  .map((r) => {
                    const ts = r.timestamp;
                    const date = ts.includes("-") ? ts.slice(0, 10) : (ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts);
                    const val = r.followers ?? (r as { subscribers?: number }).subscribers ?? 0;
                    return { date, value: val };
                  })
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (points.length < 2) {
                  return (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Need at least 2 data points for model fitting. Found {points.length}.
                      </p>
                      {fgMetadata && (
                        <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                          Data source: {fgMetadata.source === "cache" ? "cache" : fgMetadata.source === "mixed" ? "mixed (live refresh)" : "Wayback (live)"}
                          {fgMetadata.count != null && ` · ${fgMetadata.count} snapshot${fgMetadata.count !== 1 ? "s" : ""}`}
                          {(fgMetadata.source === "cache" || fgMetadata.source === "mixed") && fgMetadata.last_cached_at != null && (
                            <> · Last cached: {new Date(fgMetadata.last_cached_at).toLocaleDateString()}</>
                          )}
                        </p>
                      )}
                    </>
                  );
                }
                return (
                  <>
                    <FollowerGrowthChart
                      data={points}
                      metricLabel={fgPlatform === "youtube" ? "Subscribers" : "Followers"}
                      showLinear={fgShowLinear}
                      showExponential={fgShowExponential}
                      showLogistic={fgShowLogistic}
                      chartLocale={chartLocaleForCharts}
                      exportFileStem="social-follower-growth"
                      exportPresentationStudyHeading={displayStudy.title}
                      exportSourceFooter={studyChartExportSource(isFa, ["Internet Archive Wayback Machine"])}
                    />
                    {fgMetadata && (
                      <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                        Data source: {fgMetadata.source === "cache" ? "cache" : fgMetadata.source === "mixed" ? "mixed (live refresh)" : "Wayback (live)"}
                        {fgMetadata.count != null && ` · ${fgMetadata.count} snapshot${fgMetadata.count !== 1 ? "s" : ""}`}
                        {(fgMetadata.source === "cache" || fgMetadata.source === "mixed") && fgMetadata.last_cached_at != null && (
                          <> · Last cached: {new Date(fgMetadata.last_cached_at).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </>
                );
              })()}
              {!fgData && !fgLoading && (
                <p className="text-sm text-muted-foreground">
                  Enter a handle and click Fetch data to load Wayback snapshots.
                </p>
              )}
            </CardContent>
          </Card>
          <LearningNote locale={isFa ? "fa" : "en"}
            title="How to read this chart"
            sections={[
              {
                heading: "Raw data",
                bullets: [
                  "Points show follower counts; the line connects them in time order.",
                  "Linear: constant growth per day. Exponential: percentage growth. Logistic: S-curve with saturation.",
                  "Models are descriptive aids, not predictions or causal explanations.",
                ],
              },
              {
                heading: "Measurement choices & limitations",
                bullets: [
                  "Points are follower counts at the snapshot dates returned by the archive for the entered handle. Spacing between points is irregular and depends on archive coverage.",
                  "Models are fit to the loaded points only; they are not extrapolated beyond the last date.",
                  "Wayback coverage is sparse; gaps and missing values are expected.",
                ],
              },
              {
                heading: "Pitfalls",
                bullets: [
                  "Do not infer causality. Different models may fit similarly; overfitting is a risk.",
                ],
              },
            ]}
          />
          {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
          {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
          <InSimpleTerms locale={isFa ? "fa" : "en"}>
            <p>
              Growth often slows over time—early phases can look exponential, then level off as limits are approached.
              We test different models to see which shape best describes the observed pattern, not to predict the future.
            </p>
            <p>
              This study does not claim that any model is “correct,” that growth will continue, or that any factor caused the observed pattern.
              It is exploratory and descriptive only.
            </p>
          </InSimpleTerms>
        </>
      ) : isOilGeopoliticalReaction && geopoliticalStats ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="metric-cards-grid grid sm:grid-cols-2 lg:grid-cols-4">
            <Card className="metric-card border-border">
              <CardHeader className="pb-1">
                <CardTitle className="metric-label font-normal">
                  Current Brent price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={geopoliticalStats.current}
                  unit="USD/barrel"
                  prefix="$"
                  date={geopoliticalStats.latestDate}
                />
              </CardContent>
            </Card>
            <Card className="metric-card border-border">
              <CardHeader className="pb-1">
                <CardTitle className="metric-label font-normal">
                  1-day change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="metric-value text-foreground">
                  {geopoliticalStats.change1d != null ? (
                    <span className={geopoliticalStats.change1d >= 0 ? "text-green-600" : "text-red-600"}>
                      {geopoliticalStats.change1d >= 0 ? "+" : ""}
                      {geopoliticalStats.change1d.toFixed(2)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="metric-label mt-0.5">as of {formatStatDate(geopoliticalStats.latestDate)}</p>
              </CardContent>
            </Card>
            <Card className="metric-card border-border">
              <CardHeader className="pb-1">
                <CardTitle className="metric-label font-normal">
                  7-day change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="metric-value text-foreground">
                  {geopoliticalStats.change7d != null ? (
                    <span className={geopoliticalStats.change7d >= 0 ? "text-green-600" : "text-red-600"}>
                      {geopoliticalStats.change7d >= 0 ? "+" : ""}
                      {geopoliticalStats.change7d.toFixed(2)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="metric-label mt-0.5">as of {formatStatDate(geopoliticalStats.latestDate)}</p>
              </CardContent>
            </Card>
            <Card className="metric-card border-border">
              <CardHeader className="pb-1">
                <CardTitle className="metric-label font-normal">
                  30-day volatility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="metric-value text-foreground">
                  {geopoliticalStats.vol30 != null ? `${geopoliticalStats.vol30.toFixed(2)}%` : "—"}
                </p>
                <p className="metric-label mt-0.5">as of {formatStatDate(geopoliticalStats.latestDate)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/90 cursor-pointer" htmlFor="geopolitical-event-overlay">
              <input
                id="geopolitical-event-overlay"
                name="geopolitical_event_overlay"
                type="checkbox"
                checked={showTimeSeriesEventOverlay}
                onChange={(e) => setShowTimeSeriesEventOverlay(e.target.checked)}
                className="rounded border-border"
              />
              {L(isFa, "Event overlay", "نمایش رویدادها")}
            </label>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">Chart window:</span>
            {GEOPOLITICAL_WINDOW_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer" htmlFor={`geopolitical-window-${opt.value}`}>
                <input
                  id={`geopolitical-window-${opt.value}`}
                  type="radio"
                  name="geopolitical-window"
                  checked={geopoliticalWindowDays === opt.value}
                  onChange={() => setGeopoliticalWindowDays(opt.value)}
                  className="rounded border-border"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {geopoliticalChartData.timeRange && geopoliticalChartData.points.length > 0 && (
            <div className="chart-container">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
              </div>
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [oilSource?.name, cpiDeflationExtraExport])}
                tooltipValueBasisNote={usdTooltipBasisNote}
                data={geopoliticalChartData.points}
                valueKey="value"
                label="Brent oil"
                unit="USD/barrel"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                timeRange={geopoliticalChartData.timeRange}
                oilShockDates={oilShockDates}
                showOilShocks
                chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-80`}
                forceTimeAxis
                chartRangeGranularity="day"
              />
            </div>
          )}
          <LearningNote locale={isFa ? "fa" : "en"}
            title="How to read this chart"
            sections={[
              {
                heading: "What this shows",
                bullets: [
                  "Brent crude oil price (USD/barrel) over recent windows: 1, 7, 30, or 90 days.",
                  "Event markers: military escalation, sanctions announcements, OPEC decisions, and major geopolitical shocks.",
                  "Stat cards: current price, 1-day and 7-day percentage change, and 30-day volatility.",
                ],
              },
              {
                heading: "Volatility",
                bullets: [
                  "Volatility measures how much and how quickly prices move. Higher volatility means larger, less predictable swings.",
                  "30-day volatility here is the standard deviation of daily percentage returns over the last 30 trading days. It tells you how much the price typically fluctuates from one day to the next.",
                  "Volatile periods often coincide with geopolitical shocks or uncertainty. Red dots on the chart mark days when the move exceeded twice the recent average volatility.",
                ],
              },
              {
                heading: "Purpose",
                bullets: [
                  "Monitor short-term oil market reactions during periods of geopolitical stress.",
                  "Unlike the long-term Brent study, this focuses on high-resolution recent data.",
                ],
              },
            ]}
            links={[
              { label: "Volatility (Investopedia)", href: "https://www.investopedia.com/terms/v/volatility.asp" },
            ]}
          />
          {oilSource && (
            <SourceInfo
              items={[
                {
                  label: "Brent oil",
                  sourceName: oilSource.name,
                  sourceUrl: oilSource.url,
                  sourceDetail: oilSource.publisher,
                  unitLabel: "USD/barrel",
                  unitNote: "Daily Brent spot (FRED DCOILBRENTEU)",
                },
              ]}
              note="Brent crude is a benchmark oil type traded on world markets."
            />
          )}
        </div>
      ) : (isOilBrent || isOilGlobalLong) && oilKpis ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Latest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={oilKpis.latest}
                  unit="USD/barrel"
                  prefix="$"
                  date={oilKpis.latestDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Avg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  <CompactStatValue chartLocale={statChartLocale} value={oilKpis.avg} unit="USD/barrel" prefix="$" />
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Min
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={oilKpis.min}
                  unit="USD/barrel"
                  prefix="$"
                  date={oilKpis.minDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Max
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={oilKpis.max}
                  unit="USD/barrel"
                  prefix="$"
                  date={oilKpis.maxDate}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : isRealOil && realOilKpis ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                Latest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatValueWithDate chartLocale={statChartLocale}
                value={realOilKpis.latest}
                unit="USD/bbl (2015)"
                prefix="$"
                date={realOilKpis.latestDate}
              />
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                Avg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                <CompactStatValue chartLocale={statChartLocale} value={realOilKpis.avg} unit="USD/bbl (2015)" prefix="$" />
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                Min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatValueWithDate chartLocale={statChartLocale}
                value={realOilKpis.min}
                unit="USD/bbl (2015)"
                prefix="$"
                date={realOilKpis.minDate}
              />
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatValueWithDate chartLocale={statChartLocale}
                value={realOilKpis.max}
                unit="USD/bbl (2015)"
                prefix="$"
                date={realOilKpis.maxDate}
              />
            </CardContent>
          </Card>
          </div>
        </div>
      ) : isOilPppIran && pppIranKpis && !hasTurkeyComparator ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Latest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={pppIranKpis.latest}
                  unit="toman/bbl (PPP)"
                  date={pppIranKpis.latestDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Avg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  <CompactStatValue chartLocale={statChartLocale} value={pppIranKpis.avg} unit="toman/bbl (PPP)" />
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Min
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={pppIranKpis.min}
                  unit="toman/bbl (PPP)"
                  date={pppIranKpis.minDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Max
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={pppIranKpis.max}
                  unit="toman/bbl (PPP)"
                  date={pppIranKpis.maxDate}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : isOilPppIran && pppIranKpis && hasTurkeyComparator ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Avg (Iran)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  <CompactStatValue chartLocale={statChartLocale} value={pppIranKpis.avg} unit="toman/bbl (PPP)" />
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Min
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={pppIranKpis.min}
                  unit="toman/bbl (PPP)"
                  date={pppIranKpis.minDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Max
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={pppIranKpis.max}
                  unit="toman/bbl (PPP)"
                  date={pppIranKpis.maxDate}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : isFxIranCurrencyRegime && fxKpis ? (
        <div>
          {displayStudy?.unitLabel && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="snapshot-style-title">{L(isFa, "Unit", "واحد")}</span>: {displayStudy.unitLabel}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardHeader className="space-y-0.5 pb-1">
                <CardTitle
                  className="text-sm font-normal text-muted-foreground"
                  title={L(
                    isFa,
                    "Date and value from the last point in the merged open‑market series (Bonbast / rial archive / FRED pre‑2012)—not system clock.",
                    "تاریخ و مقدار از آخرین نقطهٔ سری ادغام‌شدهٔ بازار آزاد (بان‌بست / آرشیو نرخ ریال / FRED پیش از ۲۰۱۲)—نه زمان سامانه.",
                  )}
                >
                  {L(isFa, "Latest", "آخرین")}
                </CardTitle>
                <p className="text-[11px] font-normal leading-snug text-muted-foreground/90">
                  {L(isFa, "Open market", "بازار آزاد")}
                </p>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={fxKpis.latest}
                  unit="toman/USD"
                  date={fxKpis.latestDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Avg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  <CompactStatValue chartLocale={statChartLocale} value={fxKpis.avg} unit="toman/USD" />
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Min
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={fxKpis.min}
                  unit="toman/USD"
                  date={fxKpis.minDate}
                />
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Max
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatValueWithDate chartLocale={statChartLocale}
                  value={fxKpis.max}
                  unit="toman/USD"
                  date={fxKpis.maxDate}
                />
              </CardContent>
            </Card>
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {L(
              isFa,
              "Refreshed (in the page header) is when SignalMap last processed this study’s cached data. Data through and Latest use the most recent open‑market (USD→toman) observation in the merged series.",
              "تازه‌سازی (در بالای صفحه) یعنی آخرین باری که SignalMap دادهٔ کش‌شدهٔ این مطالعه را پردازش کرده است. «داده تا» و «آخرین»، جدیدترین مشاهدهٔ بازار آزاد (دلار→تومان) در سری ادغام‌شده را نشان می‌دهند.",
            )}
          </p>
        </div>
      ) : data?.kpis && data.kpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-medium">
                  {typeof kpi.value === "number" && Number.isFinite(kpi.value) ? (
                    formatChartAxisNumber(kpi.value, statChartLocale)
                  ) : (
                    kpi.value
                  )}
                  {kpi.unit && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">{kpi.unit}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isGlobalEventsTimeline &&
        !isBandEventsTimeline &&
        !isComparativeHistoryTimeline &&
        !isEventsTimeline &&
        !isFollowerGrowthDynamics &&
        !isYoutubeCommentAnalysis && (
      <Card className="chart-card border-border overflow-hidden">
        <CardHeader className="space-y-1.5 pb-2 md:space-y-3 md:pb-6">
          <div className="flex items-center justify-between gap-4 mb-1 md:mb-2">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground shrink-0">
              {isOilTradeNetwork
                ? "Network"
                : isGdpGlobalComparison
                  ? L(isFa, "GDP comparison (World Bank WDI)", `مقایسهٔ ${faEconomic.gdp} (WDI بانک جهانی)`)
                  : isIsiDiagnostics
                    ? L(
                        isFa,
                        "Import substitution — trade & industry (WDI)",
                        "جایگزینی واردات — تجارت و صنعت (WDI)"
                      )
                  : isInflationCpiYoy
                  ? "Annual inflation rate (CPI)"
                  : isDutchDiseaseDiagnostics
                    ? "Dutch disease diagnostics (Iran)"
                  : isIranMoneySupplyM2
                    ? L(
                        isFa,
                        "Broad money growth (M2) and CPI (Iran, annual %)",
                        `${faEconomic.m2Growth} و ${faEconomic.cpiInflation} (ایران، ٪ سالانه)`
                      )
                  : isPovertyHeadcountIran ? (
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="min-w-0">Poverty headcount ratio (Iran)</span>
                      <PovertyHeadcountPppInfoTrigger isFa={isFa} />
                    </span>
                  )
                    : isGiniInequality
                  ? "Gini coefficient (income inequality)"
                  : isGdpIranAccountsDual
                  ? "National accounts (dual-axis reference)"
                  : isGdpComposition
                    ? "Composition, levels, and nominal GDP"
                    : isOilExporterTimeseries
                    ? "Crude oil exports"
                    : isOilGeopoliticalReaction
                      ? "Brent oil (short-term)"
                      : isWageCpiReal
                        ? "Real minimum wage (CPI-adjusted)"
                        : isGoldAndOil
                          ? "Gold and oil prices"
                          : isOilGlobalLong
                            ? "Oil price"
                            : isOilBrent
                              ? "Brent oil price"
                              : isRealOil
                                ? "Real oil price (constant 2015 USD per barrel)"
                                : hasTurkeyComparator
                                  ? "Iran and Turkey: PPP oil burden"
                                  : isOilPppIran
                                    ? "Oil price burden (PPP)"
                                    : isOilEconomyOverview
                                      ? L(
                                          isFa,
                                          "Production, benchmark price, revenue (annual)",
                                          "تولید، قیمت معیار، درآمد (سالانه)"
                                        )
                                    : isOilExportCapacity
                                      ? "Oil price and export capacity proxy"
                                      : isFxIranCurrencyRegime
                                        ? "Open market USD→toman"
                                        : isOilAndFx
                                          ? "Oil and USD/Toman"
                                          : data?.timeline?.length
                                            ? "Sentiment over time"
                                            : "Timeline"}
            </CardTitle>
            {(isOilGeopoliticalReaction && geopoliticalStats && (
              <LatestValueBanner
                label="Brent price"
                value={geopoliticalStats.current}
                unit="USD/barrel"
                date={geopoliticalStats.latestDate}
                valuePrefix="$"
                inline
              />
            )) ||
            (isOilAndFx && latestBrentObservation && (
              <LatestValueBanner
                label="Brent price"
                value={latestBrentObservation.value}
                unit="USD/barrel"
                date={latestBrentObservation.date}
                valuePrefix="$"
                inline
              />
            )) ||
            (isGoldAndOil && latestBrentObservation && (
              <LatestValueBanner
                label="Brent price"
                value={latestBrentObservation.value}
                unit="USD/barrel"
                date={latestBrentObservation.date}
                valuePrefix="$"
                inline
              />
            ))}
          </div>
          {isPovertyHeadcountIran ? <PovertyHeadcountPppMutedNote isFa={isFa} className="mb-2" /> : null}
          <p className="mb-1 text-sm text-muted-foreground md:mb-3">
            {isOilTradeNetwork
              ? "Oil trade flows between major exporters and importers. Nodes are countries/regions; edge width reflects trade volume (thousand barrels/day). Drag nodes, zoom, pan."
              : isGdpGlobalComparison
                ? L(
                    isFa,
                    "World Bank WDI total GDP (NY.GDP.MKTP.KD preferred; NY.GDP.MKTP.CD per economy when KD is missing). Default: indexed to 100 in 2000 (or earliest usable base year). Toggle absolute for dollar levels; optional log scale in absolute view. Toggle event layers below.",
                    "GDP کل WDI بانک جهانی (ترجیح NY.GDP.MKTP.KD؛ در صورت نبود KD برای هر اقتصار NY.GDP.MKTP.CD). پیش‌فرض: شاخص ۱۰۰ در ۲۰۰۰ میلادی (یا نزدیک‌ترین سال پایهٔ معتبر). برای سطح دلاری «مطلق» را بزنید؛ در نمای مطلق می‌توان مقیاس لگاریتمی را روشن کرد. لایه‌های رویداد را پایین تنظیم کنید."
                  )
                : isIsiDiagnostics
                  ? L(
                      isFa,
                      "Import substitution industrialization (ISI) uses trade openness and industrial shares of GDP as structural signals. The top chart indexes four shares to 100 in a common base year (preferring 2000) so you can compare co-movement; lower charts show raw % of GDP and annual GDP growth. Event markers are optional. Iranian calendar year labels are available when Persian UI is on.",
                      "صنعتی‌سازی جایگزین واردات (ISI) با سیگنال‌های ساختاری سهم تجارت و صنعت از GDP بررسی می‌شود. نمودار بالا چهار سهم را در سال مبنای مشترک به ۱۰۰ شاخص می‌کند (ترجیح ۲۰۰۰ میلادی) تا هم‌حرکتی دیده شود؛ نمودارهای پایین٪ خام از GDP و رشد سالانهٔ GDP را نشان می‌دهند. رویدادها اختیاری‌اند؛ با رابط فارسی می‌توان محور سال را شمسی کرد."
                    )
                : isInflationCpiYoy
                ? "World Bank WDI FP.CPI.TOTL.ZG: annual consumer price inflation (% change from a year earlier). Toggle event layers below."
                : isDutchDiseaseDiagnostics
                  ? "Five panels: WDI oil rents, natural gas rents, manufacturing value added, and imports (each as % of GDP), plus open-market USD→toman. Annual WDI vs higher-frequency FX; exploratory only. Toggle event layers below."
                : isIranMoneySupplyM2
                  ? L(
                      isFa,
                      "M2: WDI/IFS through 2016; 2017+ = YoY from CBI-style year-end broad liquidity (continuity estimate). Optional Iran CPI (FP.CPI.TOTL.ZG). Event layers; PNG source matches methodology note.",
                      "M2: WDI/IFS تا ۲۰۱۶؛ ۲۰۱۷+ = ٪نقدینگی به‌سبک بانک مرکزی (تخمین تداوم). تورم CPI (FP.CPI.TOTL.ZG) اختیاری. لایه‌های رویداد؛ منبع PNG همان بخش روش است."
                    )
                : isPovertyHeadcountIran
                  ? "World Bank WDI SI.POV.DDAY and SI.POV.LMIC: share of Iran’s population below two international poverty lines (annual %). Toggle event layers below."
                  : isGiniInequality
                ? "World Bank WDI indicator SI.POV.GINI: annual estimates on a 0–100 scale (0 = perfect equality, 100 = maximum inequality). Toggle event layers below."
                : isGdpIranAccountsDual
                ? "Iran WDI levels: consumption and investment (left axis), GDP (right axis). Value type Real / USD / Toman; Iranian (Solar Hijri) year labels optional. Toggle Iran events when shown."
                : isGdpComposition
                  ? "Iran: Composition vs Levels; levels value type Real / USD / Toman; Iranian (Solar Hijri) year labels on Levels charts. Others: all panels without those toggles. Toggle Iran events when shown."
                  : isOilExporterTimeseries
                    ? "Annual crude oil exports for Saudi Arabia, Russia, United States, and Iran. Derived from bilateral trade flows (UN Comtrade HS 2709)."
                    : isOilGeopoliticalReaction
                      ? "Recent Brent price with event markers for military escalation, sanctions, OPEC decisions, and major geopolitical shocks."
                      : isGoldAndOil
                        ? "Gold (left axis) and oil (right axis) on shared timeline. World event range overlays."
                        : isOilGlobalLong
                          ? "Oil price (USD/barrel) with event markers. Annual data pre-1987; daily Brent from 1987."
                          : isOilBrent
                            ? "Daily Brent crude oil price (USD/barrel) with event markers. Brent is a benchmark oil type traded on world markets."
                            : isRealOil
                              ? "Inflation-adjusted oil price (constant 2015 USD/bbl) with world event overlays"
                              : hasTurkeyComparator
                                ? "Iran and Turkey indexed to first common year (= 100). Identical methodology and resolution."
                                : isOilPppIran
                                  ? "PPP-adjusted oil burden in Iran (annual) with event overlays"
                                  : isOilEconomyOverview
                                    ? L(
                                        isFa,
                                        "Annual: Iran crude production (left), global Brent average (right), stylized revenue (separate panel), and an indexed view (100 = base year). Event layers off by default.",
                                        "سالانه: تولید نفت خام ایران (چپ)، میانگین برنت جهانی (راست)، درآمد تخمینی (پنل جدا)، و نمای شاخصی (۱۰۰ = سال مبنا). لایهٔ رویدادها پیش‌فرض خاموش."
                                      )
                                  : isOilExportCapacity
                                    ? "Oil price (left) and export capacity proxy (right, indexed). Sanctions markers."
                                    : isFxIranCurrencyRegime
                                      ? "Default: open-market USD/toman. Optional official rate and yearly spread (distortion) when toggled."
                                      : isOilAndFx
                                        ? "Brent oil (left axis) and USD→toman (right axis) with event markers. Brent is a benchmark oil type traded on world markets."
                                        : data?.timeline?.length
                                          ? "Average sentiment score (sampled over time)"
                                          : "Event markers and optional external signals"}
          </p>
          {isGdpGlobalComparison ? (
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground shrink-0">{L(isFa, "View", "نما")}</span>
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setGdpGlobalDisplayMode("indexed");
                    setGdpGlobalAbsoluteLog(false);
                  }}
                  className={`px-2 py-1.5 font-medium transition-colors ${
                    gdpGlobalDisplayMode === "indexed"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {L(isFa, "Indexed (2000 = 100)", "شاخص‌شده (۲۰۰۰ = ۱۰۰)")}
                </button>
                <button
                  type="button"
                  onClick={() => setGdpGlobalDisplayMode("absolute")}
                  className={`px-2 py-1.5 font-medium transition-colors ${
                    gdpGlobalDisplayMode === "absolute"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {L(isFa, "Absolute", "مطلق")}
                </button>
              </div>
              {gdpGlobalDisplayMode === "absolute" ? (
                <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer" htmlFor="gdp-global-absolute-log-scale">
                  <input
                    id="gdp-global-absolute-log-scale"
                    name="gdp_global_absolute_log_scale"
                    type="checkbox"
                    checked={gdpGlobalAbsoluteLog}
                    onChange={(e) => setGdpGlobalAbsoluteLog(e.target.checked)}
                    className="rounded border-border"
                  />
                  {L(isFa, "Log scale (left axis)", "مقیاس لگاریتمی (محور چپ)")}
                </label>
              ) : null}
              {gdpGlobalDisplayMode === "absolute" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    {L(isFa, "Dollar basis", "مبنای دلاری")}
                  </span>
                  <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
                </div>
              ) : null}
            </div>
          ) : null}
          {gdpGlobalPerCountryBasis &&
          isGdpGlobalComparison &&
          Object.values(gdpGlobalPerCountryBasis).some((v) => v === "current_usd") ? (
            <p className="text-xs text-muted-foreground mb-2">
              {L(
                isFa,
                "Note: at least one economy uses current US$ (NY.GDP.MKTP.CD) because the constant 2015 US$ series (NY.GDP.MKTP.KD) is empty in WDI for that country in this window.",
                "توجه: حداقل یک اقتصاد به‌دلیل خالی بودن سری دلار ثابت ۲۰۱۵ (NY.GDP.MKTP.KD) در این بازه، از دلار جاری (NY.GDP.MKTP.CD) استفاده می‌کند."
              )}
            </p>
          ) : null}
          <StudyChartHeaderControlsShell>
            {hasTimeSeriesEventOverlayControl && macroPanelEventLayerToggles ? (
              <div className="flex w-full min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  <span className="shrink-0 font-medium text-foreground/90">
                    {L(isFa, "Overlays:", "پوشش‌ها:")}
                  </span>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-foreground/90"
                    htmlFor="study-hdr-all-events"
                    title={L(
                      isFa,
                      "Show or hide all vertical event markers on time-series charts.",
                      "نمایش یا پنهان کردن همهٔ علامت‌های رویداد روی نمودارهای سری زمانی."
                    )}
                  >
                    <input
                      id="study-hdr-all-events"
                      name="study_hdr_event_overlay"
                      type="checkbox"
                      checked={showTimeSeriesEventOverlay}
                      onChange={(e) => setShowTimeSeriesEventOverlay(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "All events", "رویدادها")}
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5"
                    htmlFor="study-hdr-macro-panels-show-iran"
                  >
                    <input
                      id="study-hdr-macro-panels-show-iran"
                      name="study_hdr_macro_panels_show_iran_events"
                      type="checkbox"
                      checked={showIranEvents}
                      onChange={(e) => setShowIranEvents(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "Iran events", "رویدادهای ایران")}
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5"
                    htmlFor="study-hdr-macro-panels-show-world"
                  >
                    <input
                      id="study-hdr-macro-panels-show-world"
                      name="study_hdr_macro_panels_show_world_events"
                      type="checkbox"
                      checked={showWorldEvents}
                      onChange={(e) => setShowWorldEvents(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "World events", "رویدادهای جهان")}
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5"
                    htmlFor="study-hdr-macro-panels-show-sanctions"
                  >
                    <input
                      id="study-hdr-macro-panels-show-sanctions"
                      name="study_hdr_macro_panels_show_sanctions_events"
                      type="checkbox"
                      checked={showSanctionsEvents}
                      onChange={(e) => setShowSanctionsEvents(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "Sanctions", "تحریم‌ها")}
                  </label>
                  {isIranEconomyMacroDashboard ? (
                    <label
                      className="inline-flex cursor-pointer items-center gap-1.5"
                      htmlFor="study-hdr-iran-iraq-war"
                      title={L(
                        isFa,
                        "Shade calendar years 1980–1988 (Gregorian) on macro charts when enabled.",
                        "در صورت فعال بودن، سال‌های ۱۹۸۰–۱۹۸۸ (میلادی) روی نمودارهای کلان سایه می‌شود."
                      )}
                    >
                      <input
                        id="study-hdr-iran-iraq-war"
                        name="study_hdr_iran_iraq_war_overlay"
                        type="checkbox"
                        checked={showIranIraqWarOverlay}
                        onChange={(e) => setShowIranIraqWarOverlay(e.target.checked)}
                        className="rounded border-border"
                      />
                      {L(isFa, "Iran–Iraq War", "جنگ ایران و عراق")}
                    </label>
                  ) : null}
                  {isIranEconomyPeriodComparison ? (
                    <label
                      className="inline-flex cursor-pointer items-center gap-1.5"
                      htmlFor="study-hdr-iran-1979-revolution-marker"
                      title={L(
                        isFa,
                        "Draw a vertical line at Gregorian 1979 when that year is within the chart window.",
                        "در صورت فعال بودن، وقتی سال ۱۹۷۹ میلادی در پنجرهٔ نمودار باشد خط عمودی رسم می‌شود."
                      )}
                    >
                      <input
                        id="study-hdr-iran-1979-revolution-marker"
                        name="study_hdr_iran_1979_revolution_marker"
                        type="checkbox"
                        checked={showIran1979RevolutionMarker}
                        onChange={(e) => setShowIran1979RevolutionMarker(e.target.checked)}
                        className="rounded border-border"
                      />
                      {L(isFa, "Show revolution marker", "نمایش نشانگر انقلاب")}
                    </label>
                  ) : null}
                </div>
                {isIranEconomyPeriodComparison ? (
                  <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">
                    {L(
                      isFa,
                      "Vertical line marks the 1979 Revolution (structural break).",
                      "«خط عمودی نشان‌دهنده انقلاب ۱۳۵۷ (نقطه گسست ساختاری) است.»"
                    )}
                  </p>
                ) : null}
                <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">
                  {L(
                    isFa,
                    "Overlays are historical context only; they do not imply causality.",
                    "«پوشش‌ها صرفاً برای زمینهٔ تاریخی‌اند و به معنی رابطهٔ علّی نیستند.»"
                  )}
                </p>
              </div>
            ) : hasTimeSeriesEventOverlayControl ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground/90">
                  {L(isFa, "Overlays:", "پوشش‌ها:")}
                </span>
                <label
                  className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-foreground/90"
                  htmlFor="study-hdr-event-overlay"
                  title={L(isFa, "Show vertical event markers on time-series charts", "نمایش علامت‌های رویداد روی نمودارهای سری زمانی")}
                >
                  <input
                    id="study-hdr-event-overlay"
                    name="study_hdr_event_overlay"
                    type="checkbox"
                    checked={showTimeSeriesEventOverlay}
                    onChange={(e) => setShowTimeSeriesEventOverlay(e.target.checked)}
                    className="rounded border-border"
                  />
                  {L(isFa, "All events", "رویدادها")}
                </label>
              </div>
            ) : null}
            {!hasTurkeyComparator &&
              !isOilExportCapacity &&
              !isOilEconomyOverview &&
              !isOilTradeNetwork &&
              !isOilExporterTimeseries &&
              !isOilGeopoliticalReaction &&
              !isGdpComposition &&
              !isGdpIranAccountsDual &&
              !isGiniInequality &&
              !isInflationCpiYoy &&
              !isGdpGlobalComparison &&
              !isIsiDiagnostics &&
              !isPovertyHeadcountIran &&
              !isIranMoneySupplyM2 &&
              !isDutchDiseaseDiagnostics &&
              !isIranEconomyReconstruction1368 &&
              !isIranEconomyPeriodComparison && (
              <>
                <select
                  id="study-chart-anchor-event"
                  name="study_chart_anchor_event"
                  value={anchorEventId}
                  onChange={(e) => setAnchorEventId(e.target.value)}
                  className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (full timeline)</option>
                  {[...events]
                    .sort((a, b) => (b.date ?? b.date_start ?? b.date_end ?? "").localeCompare(a.date ?? a.date_start ?? a.date_end ?? ""))
                    .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}{" "}
                      ({ev.date ?? (ev.date_start && ev.date_end ? `${ev.date_start}–${ev.date_end}` : ev.date_start ?? ev.date_end ?? "")})
                    </option>
                  ))}
                </select>
                <select
                  id="study-chart-anchor-window-years"
                  name="study_chart_anchor_window_years"
                  value={effectiveWindowValue}
                  onChange={(e) => setWindowYears(Number(e.target.value))}
                  disabled={!anchorEventId}
                  className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {windowOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {isOverviewStub && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-show-oil">
                <input
                  id="study-hdr-show-oil"
                  name="study_hdr_show_oil"
                  type="checkbox"
                  checked={showOil}
                  onChange={(e) => setShowOil(e.target.checked)}
                  className="rounded border-border"
                />
                Show Brent oil price (benchmark oil type traded on world markets)
              </label>
            )}
            {isOilAndFx && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-show-gold">
                <input
                  id="study-hdr-show-gold"
                  name="study_hdr_show_gold"
                  type="checkbox"
                  checked={showGold}
                  onChange={(e) => setShowGold(e.target.checked)}
                  className="rounded border-border"
                />
                Show gold price
              </label>
            )}
            {(isGoldAndOil || isOilGlobalLong || isRealOil || (isOilPppIran && hasTurkeyComparator)) && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-show-global-macro-oil-a">
                <input
                  id="study-hdr-show-global-macro-oil-a"
                  name="study_hdr_show_global_macro_oil"
                  type="checkbox"
                  checked={showGlobalMacroOil}
                  onChange={(e) => setShowGlobalMacroOil(e.target.checked)}
                  className="rounded border-border"
                />
                Global oil/macro (curated)
              </label>
            )}
            {isOilPppIran && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-ppp-y-log">
                <input
                  id="study-hdr-ppp-y-log"
                  name="study_hdr_ppp_y_log"
                  type="checkbox"
                  checked={pppYAxisLog}
                  onChange={(e) => setPppYAxisLog(e.target.checked)}
                  className="rounded border-border"
                />
                Log scale
              </label>
            )}
            {isOilExportCapacity && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-show-sanctions-periods">
                <input
                  id="study-hdr-show-sanctions-periods"
                  name="study_hdr_show_sanctions_periods"
                  type="checkbox"
                  checked={showSanctionsPeriods}
                  onChange={(e) => setShowSanctionsPeriods(e.target.checked)}
                  className="rounded border-border"
                />
                Show sanctions periods
              </label>
            )}
            {isOilProductionMajorExporters && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-oil-prod-show-iran">
                  <input
                    id="study-hdr-oil-prod-show-iran"
                    name="study_hdr_oil_prod_show_iran_events"
                    type="checkbox"
                    checked={showIranEvents}
                    onChange={(e) => setShowIranEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show Iran events
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-oil-prod-show-sanctions">
                  <input
                    id="study-hdr-oil-prod-show-sanctions"
                    name="study_hdr_oil_prod_show_sanctions_events"
                    type="checkbox"
                    checked={showSanctionsEvents}
                    onChange={(e) => setShowSanctionsEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show sanctions
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-oil-prod-show-opec">
                  <input
                    id="study-hdr-oil-prod-show-opec"
                    name="study_hdr_oil_prod_show_opec_events"
                    type="checkbox"
                    checked={showOpecEvents}
                    onChange={(e) => setShowOpecEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show OPEC decisions
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-show-global-macro-oil-b">
                  <input
                    id="study-hdr-show-global-macro-oil-b"
                    name="study_hdr_oil_prod_show_global_macro_oil"
                    type="checkbox"
                    checked={showGlobalMacroOil}
                    onChange={(e) => setShowGlobalMacroOil(e.target.checked)}
                    className="rounded border-border"
                  />
                  Global oil/macro (curated)
                </label>
              </>
            )}
            {(isGdpComposition || isGdpIranAccountsDual) && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-gdp-show-macro-events">
                  <input
                    id="study-hdr-gdp-show-macro-events"
                    name="study_hdr_gdp_show_macro_events"
                    type="checkbox"
                    checked={showGdpMacroEvents}
                    onChange={(e) => setShowGdpMacroEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show events
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-gdp-show-iran-layers">
                  <input
                    id="study-hdr-gdp-show-iran-layers"
                    name="study_hdr_gdp_show_iran_event_layers"
                    type="checkbox"
                    checked={showGdpIranEvents}
                    onChange={(e) => setShowGdpIranEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show Iran event layers
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-gdp-show-global-macro-oil">
                  <input
                    id="study-hdr-gdp-show-global-macro-oil"
                    name="study_hdr_gdp_show_global_macro_oil"
                    type="checkbox"
                    checked={showGdpGlobalMacroOil}
                    onChange={(e) => setShowGdpGlobalMacroOil(e.target.checked)}
                    className="rounded border-border"
                  />
                  Global oil/macro (curated)
                </label>
              </>
            )}
            {isOilGeopoliticalReaction && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-geo-show-world-core">
                  <input
                    id="study-hdr-geo-show-world-core"
                    name="study_hdr_geo_show_world_core"
                    type="checkbox"
                    checked={showGeopoliticalWorldCore}
                    onChange={(e) => setShowGeopoliticalWorldCore(e.target.checked)}
                    className="rounded border-border"
                  />
                  World (core)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-geo-show-world-1900">
                  <input
                    id="study-hdr-geo-show-world-1900"
                    name="study_hdr_geo_show_world_1900"
                    type="checkbox"
                    checked={showGeopoliticalWorld1900}
                    onChange={(e) => setShowGeopoliticalWorld1900(e.target.checked)}
                    className="rounded border-border"
                  />
                  World (1900+)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-geo-show-sanctions">
                  <input
                    id="study-hdr-geo-show-sanctions"
                    name="study_hdr_geo_show_sanctions"
                    type="checkbox"
                    checked={showGeopoliticalSanctions}
                    onChange={(e) => setShowGeopoliticalSanctions(e.target.checked)}
                    className="rounded border-border"
                  />
                  Sanctions
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-geo-show-opec">
                  <input
                    id="study-hdr-geo-show-opec"
                    name="study_hdr_geo_show_opec"
                    type="checkbox"
                    checked={showGeopoliticalOpec}
                    onChange={(e) => setShowGeopoliticalOpec(e.target.checked)}
                    className="rounded border-border"
                  />
                  OPEC decisions
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-hdr-geo-show-global-macro-oil">
                  <input
                    id="study-hdr-geo-show-global-macro-oil"
                    name="study_hdr_geo_show_global_macro_oil"
                    type="checkbox"
                    checked={showGlobalMacroOil}
                    onChange={(e) => setShowGlobalMacroOil(e.target.checked)}
                    className="rounded border-border"
                  />
                  Global oil/macro (curated)
                </label>
              </>
            )}
          </StudyChartHeaderControlsShell>
        </CardHeader>
        <CardContent>
          {isOilTradeNetwork ? (
            <>
              {networkYears.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOilTradeView("network")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        oilTradeView === "network"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Network
                    </button>
                    <button
                      type="button"
                      onClick={() => setOilTradeView("sankey")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        oilTradeView === "sankey"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Sankey
                    </button>
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOilTradeSource("curated")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        oilTradeSource === "curated"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Curated
                    </button>
                    <button
                      type="button"
                      onClick={() => setOilTradeSource("db")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        oilTradeSource === "db"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      All data
                    </button>
                  </div>
                </div>
              )}
              {oilTradeView === "sankey" ? (
                sankeyDisplayEdges.length > 0 ? (
                  <OilTradeSankey
                    key={`${networkSelectedYear || networkYears[networkYears.length - 1]}-${oilTradeSource}`}
                    edges={sankeyDisplayEdges}
                    year={networkSelectedYear}
                    exporterOrder={isAllDataMode ? sankeyExporterOrder : networkExporterOrder}
                    importerOrder={isAllDataMode ? sankeyImporterOrder : undefined}
                    nodeColorOrder={networkNodeColorOrder}
                    isAllDataMode={isAllDataMode}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — Sankey (${String((networkSelectedYear || networkYears[networkYears.length - 1]) ?? "…")})${isAllDataMode ? " · all data" : " · curated"}`,
                      `${displayStudy.title} — Sankey (${String((networkSelectedYear || networkYears[networkYears.length - 1]) ?? "…")})${isAllDataMode ? " · همهٔ داده" : " · دادهٔ گزیده"}`
                    )}
                    chartLocale={chartLocaleForCharts}
                    exportSourceFooter={studyChartExportSource(isFa, ["UN Comtrade HS 2709 (via SignalMap)"])}
                    exportFileStem="oil-trade-sankey"
                  />
                ) : (
                  <div className="flex h-[70vh] min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">
                      No data for {networkSelectedYear || "this year"}. Run{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">update_oil_trade_network.py --force</code>{" "}
                      and sync to production if deployed.
                    </p>
                  </div>
                )
              ) : (
                networkDisplayEdges.length > 0 ? (
                <NetworkGraph
                  key={`${networkSelectedYear || networkYears[networkYears.length - 1]}-${isAllDataMode}`}
                  nodes={networkDisplayNodes}
                  edges={networkDisplayEdges}
                  year={networkSelectedYear}
                  onNodeClick={(country) => trackEvent("network_node_clicked", { country })}
                  nodeColorOrder={networkNodeColorOrder}
                  nodeOrder={isAllDataMode ? networkNodeOrder : networkNodeColorOrder}
                  isAllDataMode={isAllDataMode}
                  exportPresentationStudyHeading={displayStudy.title}
                  exportPresentationTitle={L(
                    isFa,
                    `${displayStudy.title} — Network (${String((networkSelectedYear || networkYears[networkYears.length - 1]) ?? "…")})${isAllDataMode ? " · all data" : " · curated"}`,
                    `${displayStudy.title} — Network (${String((networkSelectedYear || networkYears[networkYears.length - 1]) ?? "…")})${isAllDataMode ? " · همهٔ داده" : " · دادهٔ گزیده"}`
                  )}
                  chartLocale={chartLocaleForCharts}
                  exportSourceFooter={studyChartExportSource(isFa, ["UN Comtrade HS 2709 (via SignalMap)"])}
                  exportFileStem="oil-trade-network"
                />
                ) : (
                  <div className="flex h-[70vh] min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">
                      No data for {networkSelectedYear || "this year"}. Run{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">update_oil_trade_network.py --force</code>{" "}
                      and sync to production if deployed.
                    </p>
                  </div>
                )
              )}
              {isAllDataMode && (
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#1e40af]" />
                    Node size = total trade (exports + imports)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-6 bg-current opacity-60" />
                    Edge width = crude oil flow
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-[#dc2626]" />
                    Edge color = exporter
                  </span>
                  {networkDisplayEdges.length > 0 && (() => {
                    const maxEdge = networkDisplayEdges.reduce((a, b) => (a.value > b.value ? a : b));
                    const looksLikeUsd = maxEdge.value > 1_000_000;
                    return (
                      <span className={looksLikeUsd ? "text-amber-600 dark:text-amber-500" : ""} title={looksLikeUsd ? "Values >1M suggest old TradeValue (USD) data. Re-run ingestion with --force." : "Values in thousand bbl/day (physical barrels)"}>
                        Max flow: {formatChartAxisNumber(maxEdge.value, "en")} {maxEdge.source}→{maxEdge.target}
                      </span>
                    );
                  })()}
                </div>
              )}
              {networkYears.length > 0 && (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center py-2">
                    <label className="text-sm font-medium text-foreground shrink-0" htmlFor="oil-trade-network-year">
                      Year:
                    </label>
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      {networkYears[0]} – {networkYears[networkYears.length - 1]}
                    </span>
                    <input
                      id="oil-trade-network-year"
                      name="oil_trade_network_year"
                      type="range"
                      min={networkYears[0]}
                      max={networkYears[networkYears.length - 1]}
                      step={1}
                      value={networkSelectedYear || networkYears[networkYears.length - 1]!}
                      onChange={(e) => {
                        const year = e.target.value;
                        setNetworkSelectedYear(year);
                        trackEvent("year_changed", { study: "oil_trade_network", year });
                      }}
                      className="oil-trade-year-slider accent-primary min-h-[44px] w-full min-w-0 sm:w-40 flex-1 sm:flex-none touch-manipulation"
                    />
                    <span className="text-base font-medium tabular-nums min-w-[4ch] shrink-0">
                      {networkSelectedYear || networkYears[networkYears.length - 1]}
                    </span>
                  </div>
                </div>
              )}
              <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <h4 className="mb-3 snapshot-style-title">
                  {oilTradeView === "sankey" ? "How to read this Sankey diagram" : "How to read this network"}
                </h4>
                {oilTradeView === "sankey" ? (
                  <p className="text-muted-foreground">
                    Flows show crude oil trade from exporters (left) to importers (right). Width is proportional to trade volume (thousand barrels/day). Hover over a flow for details.
                  </p>
                ) : (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 font-medium text-muted-foreground">Node size</p>
                    <p className="text-muted-foreground">
                      Larger nodes represent countries with higher total crude oil trade (imports + exports).
                    </p>
                    <div className="mt-1.5 flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#1e40af]" />
                        Small
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-6 w-6 rounded-full bg-[#1e40af]" />
                        Large
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-medium text-muted-foreground">Node color</p>
                    <p className="text-muted-foreground">
                      Each country has a distinct color (consistent across years and with the Sankey view). Bordered nodes are net exporters; faded nodes without a border are net importers.
                    </p>
                    <div className="mt-1.5 flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#1e40af] border-2 border-foreground/80" />
                        Exporter
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#dc2626] opacity-50" />
                        Importer
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-medium text-muted-foreground">Edges</p>
                    <p className="text-muted-foreground">
                      Arrows show the direction of crude oil trade (exporter → importer). Thicker edges represent larger trade volumes.
                    </p>
                    <div className="mt-1.5 flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-0.5 w-8 bg-current opacity-60" />
                        <span className="text-[10px]">→</span>
                        Small flow
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-1.5 w-8 bg-current opacity-80" />
                        <span className="text-[10px]">→</span>
                        Large flow
                      </span>
                    </div>
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    Trade volume is measured in <strong>thousand barrels per day</strong>.
                  </p>
                  {isAllDataMode && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      All data view: top 120 flows shown. Minor countries aggregated into Other exporters/importers.
                    </p>
                  )}
                </div>
                )}
              </div>
              <LearningNote locale={isFa ? "fa" : "en"}
                title="How to read this chart"
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Nodes represent countries or regions involved in crude oil trade.",
                      "Node size reflects total trade activity (imports + exports).",
                      "Node color indicates trade balance. Darker nodes represent net exporters, while lighter nodes represent net importers.",
                      "Edges represent crude oil trade flows between countries.",
                      "Arrows indicate the direction of trade (exporter → importer).",
                      "Edge thickness reflects approximate trade volume.",
                      "The network layout positions highly connected countries closer together.",
                      "Drag nodes to explore relationships more clearly.",
                    ],
                  },
                  {
                    heading: "What this measures",
                    bullets: [
                      "Bilateral crude oil trade flows between major exporting and importing countries.",
                      "Total trade activity for each country (imports + exports).",
                      "Trade volumes are expressed in thousand barrels per day.",
                    ],
                  },
                  {
                    heading: "Purpose",
                    bullets: [
                      "Explore how global oil trade connects major exporters and importers.",
                      "Identify key hubs in the global oil market.",
                      "Observe shifts in trade relationships over time using the year slider.",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Values represent approximate trade volumes and are intended for visualization purposes.",
                      "The network focuses on major flows rather than every bilateral trade relationship.",
                      "Changes in the layout reflect trade relationships but do not imply causality.",
                    ],
                  },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "Oil trade flows",
                    sourceName: "UN Comtrade",
                    sourceUrl: "https://comtrade.un.org/",
                    sourceDetail: "HS 2709 crude petroleum. Curated fallback when Comtrade unavailable.",
                    unitLabel: "Thousand barrels per day",
                  },
                ]}
                note="Unit: thousand barrels per day. Values converted from net weight (kg) using 1 tonne ≈ 7.33 barrels. Note: Trade data is derived from UN Comtrade (HS 2709). Reporting coverage varies across countries and years. Missing values reflect unavailable reporting rather than zero exports."
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Countries that produce oil sell it to countries that need it. This network shows those relationships.
                </p>
                <p>
                  Large nodes represent countries with major oil trade activity. Arrows show where oil flows, and thicker lines represent larger trade volumes.
                </p>
                <p>
                  Moving the year slider reveals how these trade routes change over time.
                </p>
              </InSimpleTerms>
            </>
          ) : isGdpIranAccountsDual ? (
            <>
              {isGdpIranLocal ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">Value type</span>
                  <div className="inline-flex rounded-md border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGdpLevelsValueType("real")}
                      className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                        gdpLevelsValueType === "real"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      Real
                    </button>
                    <button
                      type="button"
                      onClick={() => setGdpLevelsValueType("usd")}
                      className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                        gdpLevelsValueType === "usd"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setGdpLevelsValueType("toman")}
                      className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                        gdpLevelsValueType === "toman"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      Toman
                    </button>
                  </div>
                  {gdpLevelsValueType === "usd" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {L(isFa, "Current US$ basis", "مبنای دلار جاری")}
                      </span>
                      <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="mb-3 text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">
                <span className="font-medium text-foreground">Dual-axis reference.</span> This reference-style chart
                uses separate y-axes: consumption and investment on the left, GDP on the right. The two vertical scales
                are independent—do not read vertical gaps between left-axis lines and GDP as a single cross-axis
                magnitude.
              </p>
              {gdpLevelsDisplayNote ? (
                <p className="text-xs text-amber-700 dark:text-amber-500/90 mb-2">{gdpLevelsDisplayNote}</p>
              ) : null}
              <p className="text-xs text-muted-foreground mb-2">
                Same WDI level bundle as Study 27 levels. Units:{" "}
                <span className="text-foreground font-medium">
                  {gdpLevelsValueType === "real"
                    ? "constant 2015 US$ (NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD)"
                    : gdpLevelsValueType === "toman"
                      ? "billion tomans (approx.; current US$ × annual mean open-market toman/USD—not official)"
                      : "current US$ (NE.CON.TOTL.CD, NE.GDI.TOTL.CD, NY.GDP.MKTP.CD)"}
                </span>
                . Left axis: consumption (blue) and investment (green). Right axis: GDP (red). Linear scales.
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">Scale</span>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGdpLevelsDisplayMode("absolute")}
                    className={`px-2 py-1.5 font-medium transition-colors ${
                      gdpLevelsDisplayMode === "absolute"
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    Absolute
                  </button>
                  <button
                    type="button"
                    onClick={() => setGdpLevelsDisplayMode("indexed")}
                    disabled={gdpLevelsIndexedBaseYear == null}
                    title={
                      gdpLevelsIndexedBaseYear == null
                        ? "Indexed scale needs at least one calendar year where consumption, GDP, and investment are all non-zero."
                        : undefined
                    }
                    className={`px-2 py-1.5 font-medium transition-colors ${
                      gdpLevelsDisplayMode === "indexed"
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted/60"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    Indexed
                  </button>
                </div>
              </div>
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportSourceFooter={studyChartExportSource(isFa, [
                  gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                  isGdpIranLocal && gdpLevelsValueType === "usd" ? cpiDeflationExtraExport : null,
                ])}
                tooltipValueBasisNote={
                  isGdpIranLocal && gdpLevelsValueType === "usd" ? usdTooltipBasisNote : undefined
                }
                data={[]}
                valueKey="value"
                label={L(
                  isFa,
                  "National accounts (dual-axis reference)",
                  "حساب‌های ملی (مرجع دو محوره)"
                )}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, gdpCompositionChartEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "dual_level_consumption",
                    label: L(isFa, "Consumption", "مصرف"),
                    yAxisIndex: 0,
                    unit: gdpLevelsUnit ?? "US$",
                    points: gdpLevelsDisplaySeries.consumption,
                    color: SIGNAL_CONCEPT.consumption,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "dual_level_investment",
                    label: L(isFa, "Investment", "سرمایه‌گذاری"),
                    yAxisIndex: 0,
                    unit: gdpLevelsUnit ?? "US$",
                    points: gdpLevelsDisplaySeries.investment,
                    color: SIGNAL_CONCEPT.investment,
                    symbol: "rect",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "dual_level_gdp",
                    label: L(isFa, "GDP", faEconomic.gdp),
                    yAxisIndex: 1,
                    unit: gdpLevelsUnit ?? "US$",
                    points: gdpLevelsDisplaySeries.gdp,
                    color: SIGNAL_CONCEPT.gdp,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                multiSeriesYAxisNameOverrides={gdpLevelsDualAxisYAxisNameOverrides}
                timeRange={gdpCompositionChartTimeRange ?? gdpCompositionTimeRange ?? study.timeRange}
                forceTimeRangeAxis
                chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-[26rem]`}
                mutedEventLines
                xAxisYearLabel={gdpLevelsXAxisYearLabel ?? chartYearAxisLabel}
                categoryYearTickStep={5}
                multiSeriesValueFormat={gdpLevelsDisplayMode === "indexed" ? "gdp_indexed" : "gdp_absolute"}
                indexedTooltipBaseLabel={
                  gdpLevelsDisplayMode === "indexed" && gdpLevelsIndexedBaseYearLabel
                    ? gdpLevelsIndexedBaseYearLabel
                    : undefined
                }
                yAxisMin={gdpLevelsDisplayMode === "indexed" ? 0 : undefined}
                gridRight="14%"
                chartRangeGranularity="year"
              />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Left y-axis: consumption and investment (two level series).",
                      "Right y-axis: GDP (same WDI price basis as the levels bundle, separate scale).",
                      "This reference-style chart uses separate y-axes: consumption and investment on the left, GDP on the right.",
                      "Absolute vs Indexed matches Study 27 levels (indexed divides each series by its own value in a common base year; display-only).",
                      "Iranian x-axis year labels are display-only (Solar Hijri from each point’s Gregorian date).",
                      "Event lines: optional Iran macro markers and API event layers (see toggles above the chart).",
                    ],
                  },
                  {
                    heading: "Limitations",
                    bullets: [
                      "Dual-axis layouts do not make left- and right-axis values directly comparable unless you normalize explicitly.",
                      "Annual WDI national accounts; informal activity and revisions are not fully reflected.",
                      "Toman view uses illustrative open-market FX, not official national-accounts tomans.",
                    ],
                  },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "National accounts levels (Iran)",
                    sourceName: gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                    sourceUrl: gdpCompositionSource?.url ?? "https://data.worldbank.org/",
                    sourceDetail: gdpCompositionSource?.publisher ?? "World Bank",
                    unitLabel:
                      "Dual-axis levels by value type (Real / USD / Toman); left: consumption & investment; right: GDP",
                    unitNote:
                      gdpLevelsValueType === "real"
                        ? "Levels (Real): NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD (constant 2015 US$). ISO3 IRN."
                        : gdpLevelsValueType === "toman"
                          ? "Levels (Toman): NE.CON.TOTL.CD, NE.GDI.TOTL.CD, NY.GDP.MKTP.CD × annual mean open-market toman/USD. ISO3 IRN."
                          : "Levels (USD): NE.CON.TOTL.CD, NE.GDI.TOTL.CD, NY.GDP.MKTP.CD (current US$). ISO3 IRN.",
                  },
                ]}
                note={
                  (gdpDataSpan?.first_year_any != null && gdpDataSpan?.last_year_any != null
                    ? `Data window returned: ${gdpDataSpan.returned_start_year ?? gdpDataSpan.first_year_any}–${gdpDataSpan.returned_end_year ?? gdpDataSpan.last_year_any} (WDI coverage from ${gdpDataSpan.first_year_any} as the earliest year any indicator in this bundle has values). `
                    : "") +
                  (gdpLevelsConversionMeta?.description ? `${gdpLevelsConversionMeta.description} ` : "") +
                  "Educational visualization only; not a forecast."
                }
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Consumption, investment, and GDP are shown in the same WDI units you choose (Real, USD, or Toman),
                  but consumption and investment share the left vertical axis while GDP uses the right—like many
                  reference charts. That helps you scan shapes; it does not put every line on one ruler.
                </p>
                <p>
                  For one shared vertical scale across all three aggregates, open the GDP composition study and use the
                  three-line levels chart.
                </p>
              </InSimpleTerms>
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
            </>
          ) : isGdpComposition ? (
            <>
              {isGdpIranLocal ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">View</span>
                  <div className="inline-flex rounded-md border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGdpStudyView("composition")}
                      className={`px-2.5 py-1.5 font-medium transition-colors ${
                        gdpStudyView === "composition"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      Composition
                    </button>
                    <button
                      type="button"
                      onClick={() => setGdpStudyView("levels")}
                      className={`px-2.5 py-1.5 font-medium transition-colors ${
                        gdpStudyView === "levels"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      Levels
                    </button>
                  </div>
                  {gdpStudyView === "levels" ? (
                    <>
                      <span className="text-muted-foreground shrink-0 ml-1">Value type</span>
                      <div className="inline-flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setGdpLevelsValueType("real")}
                          className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                            gdpLevelsValueType === "real"
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          Real
                        </button>
                        <button
                          type="button"
                          onClick={() => setGdpLevelsValueType("usd")}
                          className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                            gdpLevelsValueType === "usd"
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          USD
                        </button>
                        <button
                          type="button"
                          onClick={() => setGdpLevelsValueType("toman")}
                          className={`px-2 py-1.5 text-sm font-medium transition-colors ${
                            gdpLevelsValueType === "toman"
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          Toman
                        </button>
                      </div>
                      {gdpLevelsValueType === "usd" ? (
                        <div className="flex flex-wrap items-center gap-2 ml-1">
                          <span className="text-muted-foreground shrink-0">
                            {L(isFa, "Current US$ basis", "مبنای دلار جاری")}
                          </span>
                          <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
              {(!isGdpIranLocal || gdpStudyView === "composition") ? (
                <>
                  <MultiSeriesStats
                    series={[
                      {
                        label: L(isFa, "Final consumption expenditure", "مصرف نهایی"),
                        unit: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                        points: gdpConsumptionPoints,
                      },
                      {
                        label: L(isFa, "Gross capital formation", "تشکیل سرمایهٔ ناخالص"),
                        unit: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                        points: gdpInvestmentPoints,
                      },
                    ]}
                    timeRange={gdpCompositionChartTimeRange ?? gdpCompositionTimeRange ?? undefined}
                  />
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 mt-1">
                    {L(isFa, "Shares of GDP", faEconomic.sharesOfGdp)}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    xAxisYearLabel={chartYearAxisLabel}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "GDP composition (shares of GDP)", faEconomic.gdpCompositionTitle)}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, gdpCompositionChartEvents)}
                    anchorEventId={anchorEventId || undefined}
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-[26rem]`}
                    multiSeries={[
                      {
                        key: "pct_consumption",
                        label: L(isFa, "Final consumption expenditure", "مصرف نهایی"),
                        yAxisIndex: 0,
                        unit: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                        points: gdpConsumptionPoints,
                        color: SIGNAL_CONCEPT.consumption,
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "pct_investment",
                        label: L(isFa, "Gross capital formation", "تشکیل سرمایهٔ ناخالص"),
                        yAxisIndex: 0,
                        unit: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                        points: gdpInvestmentPoints,
                        color: SIGNAL_CONCEPT.investment,
                        symbol: "diamond",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                    ]}
                    timeRange={gdpCompositionChartTimeRange ?? gdpCompositionTimeRange ?? study.timeRange}
                    forceTimeRangeAxis
                    mutedEventLines
                    categoryYearTickStep={5}
                    chartRangeGranularity="year"
                  />
                </>
              ) : null}
              {(!isGdpIranLocal || gdpStudyView === "levels") ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 mt-1">
                    {L(isFa, "Nominal GDP (companion)", faEconomic.nominalGdpCompanion)}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Current US$, log scale—same period as the levels chart. Always US dollars. Use the header year-axis
                    control to show Gregorian, Solar Hijri, or both on the x-axis and in tooltips.
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "GDP (nominal)", faEconomic.nominalGdpLevel)}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, gdpCompositionChartEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={[
                      {
                        key: "gdp_nominal",
                        label: L(isFa, "GDP (nominal)", faEconomic.nominalGdpLevel),
                        yAxisIndex: 0,
                        unit: L(isFa, "current US$", "دلار جاری آمریکا"),
                        points: gdpNominalPoints,
                        color: SIGNAL_CONCEPT.gdp,
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                    ]}
                    timeRange={gdpCompositionChartTimeRange ?? gdpCompositionTimeRange ?? study.timeRange}
                    forceTimeRangeAxis
                    yAxisLog
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-80`}
                    mutedEventLines
                    xAxisYearLabel={gdpLevelsXAxisYearLabel ?? chartYearAxisLabel}
                    categoryYearTickStep={5}
                    multiSeriesValueFormat="gdp_absolute"
                    chartRangeGranularity="year"
                  />
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 mt-6">
                    {gdpLevelsDisplayMode === "indexed"
                      ? L(isFa, "Levels (indexed to base year)", "سطوح (شاخص‌شده به سال پایه)")
                      : L(isFa, "Levels (absolute size)", "سطوح (مطلق)")}
                  </p>
                  {gdpLevelsDisplayNote ? (
                    <p className="text-xs text-amber-700 dark:text-amber-500/90 mb-2">{gdpLevelsDisplayNote}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mb-2">
                    Three lines—Consumption (blue), GDP (red), Investment (green)—in{" "}
                    <span className="text-foreground font-medium">
                      {gdpLevelsValueType === "real"
                        ? "constant 2015 US dollars (WDI NE.CON.TOTL.KD, NY.GDP.MKTP.KD, NE.GDI.TOTL.KD): real domestic scale without applying market FX"
                        : gdpLevelsValueType === "toman"
                          ? "billion tomans (approx.): current-US$ WDI levels (NE.CON.TOTL.CD, NY.GDP.MKTP.CD, NE.GDI.TOTL.CD) × that Gregorian year’s mean daily open-market toman/USD (merged Bonbast + rial archive + FRED pre-2012—not official)"
                          : "current US dollars (NE.CON.TOTL.CD, NY.GDP.MKTP.CD, NE.GDI.TOTL.CD): headline international dollars, including inflation and exchange-rate moves in the WDI construction"}
                    </span>
                    . Value type applies to this chart only (not the % composition chart). Linear scale.
                    {gdpLevelsDisplayMode === "indexed" && gdpLevelsIndexedBaseYearLabel ? (
                      <>
                        {" "}
                        Indexed view divides each series by its own level in the base year{" "}
                        <span className="text-foreground font-medium">{gdpLevelsIndexedBaseYearLabel}</span>{" "}
                        (1976 Gregorian when all three are non-zero there—about Solar 1355—otherwise the earliest
                        such year); axis shows ratios (1 = base).
                      </>
                    ) : null}
                  </p>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">Scale</span>
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setGdpLevelsDisplayMode("absolute")}
                        className={`px-2 py-1.5 font-medium transition-colors ${
                          gdpLevelsDisplayMode === "absolute"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        Absolute
                      </button>
                      <button
                        type="button"
                        onClick={() => setGdpLevelsDisplayMode("indexed")}
                        disabled={gdpLevelsIndexedBaseYear == null}
                        title={
                          gdpLevelsIndexedBaseYear == null
                            ? "Indexed scale needs at least one calendar year where consumption, GDP, and investment are all non-zero."
                            : undefined
                        }
                        className={`px-2 py-1.5 font-medium transition-colors ${
                          gdpLevelsDisplayMode === "indexed"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground hover:bg-muted/60"
                        } disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        Indexed
                      </button>
                    </div>
                  </div>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                      gdpLevelsValueType === "usd" ? cpiDeflationExtraExport : null,
                    ])}
                    tooltipValueBasisNote={
                      isGdpIranLocal && gdpLevelsValueType === "usd" ? usdTooltipBasisNote : undefined
                    }
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "National accounts (levels)", "حساب‌های ملی (سطوح)")}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, gdpCompositionChartEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={[
                      {
                        key: "level_consumption",
                        label: L(isFa, "Consumption", "مصرف"),
                        yAxisIndex: 0,
                        unit: gdpLevelsUnit ?? "US$",
                        points: gdpLevelsDisplaySeries.consumption,
                        color: SIGNAL_CONCEPT.consumption,
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "level_gdp",
                        label: L(isFa, "GDP", faEconomic.gdp),
                        yAxisIndex: 0,
                        unit: gdpLevelsUnit ?? "US$",
                        points: gdpLevelsDisplaySeries.gdp,
                        color: SIGNAL_CONCEPT.gdp,
                        symbol: "triangle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "level_investment",
                        label: L(isFa, "Investment", "سرمایه‌گذاری"),
                        yAxisIndex: 0,
                        unit: gdpLevelsUnit ?? "US$",
                        points: gdpLevelsDisplaySeries.investment,
                        color: SIGNAL_CONCEPT.investment,
                        symbol: "rect",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                    ]}
                    timeRange={gdpCompositionChartTimeRange ?? gdpCompositionTimeRange ?? study.timeRange}
                    forceTimeRangeAxis
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-[26rem]`}
                    mutedEventLines
                    xAxisYearLabel={gdpLevelsXAxisYearLabel ?? chartYearAxisLabel}
                    categoryYearTickStep={5}
                    multiSeriesValueFormat={gdpLevelsDisplayMode === "indexed" ? "gdp_indexed" : "gdp_absolute"}
                    indexedTooltipBaseLabel={
                      gdpLevelsDisplayMode === "indexed" && gdpLevelsIndexedBaseYearLabel
                        ? gdpLevelsIndexedBaseYearLabel
                        : undefined
                    }
                    yAxisMin={gdpLevelsDisplayMode === "indexed" ? 0 : undefined}
                    chartRangeGranularity="year"
                  />
                </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Composition: each line is a share of GDP—how large consumption or investment is relative to GDP that year, not its dollar size. (Iran: open the Composition view.)",
                      "Nominal GDP: current US$ with a log scale—headline dollar size including inflation and exchange-rate moves.",
                      "Levels value type (Iran): Real = constant 2015 US$ (*KD) aggregates—domestic real scale without market FX. USD = current US$ (*CD)—headline international dollars. Toman = current US$ × per-year mean open-market toman/USD (merged Bonbast + archive + FRED pre-2012; not official)—mixes economics with depreciation.",
                      "Dual-axis reference chart: use the separate study \"Iran national accounts — dual-axis reference\" (same WDI bundle).",
                      "Scale toggle (Absolute / Indexed): indexed mode rescales each levels line by its own value in a common base calendar year—1976 when all three are non-zero there, else the earliest such year (display-only); tooltips show multipliers (e.g. 2.4× vs that year).",
                      "Shares can move even when dollar levels all rise; use Composition vs Levels to separate structure from scale.",
                      "Iran: Iranian year relabels x-axis tick years to Solar Hijri (UTC date mapping via Intl); underlying points stay Gregorian.",
                      "Show events: subtle vertical markers for a fixed Iran macro timeline (hover for notes). Show Iran event layers: separate timeline data from the study’s event feed. Global oil/macro (curated): optional small set of world oil-market anchors from the API (off by default).",
                    ],
                  },
                  {
                    heading: "Limitations",
                    bullets: [
                      "Annual national accounts; they do not capture informal activity fully and can be revised.",
                      "WDI series can begin in different years; early years may show only the series that already exists.",
                      "Constant-price series follow the World Bank’s 2015 base; switching to another constant-price basis later is a data configuration change, not a code rewrite.",
                      "Toman levels convert current-US$ WDI lines only (not the constant-price Real bundle), so they are not a substitute for official national-accounts tomans.",
                      "Event markers do not imply cause or forecast.",
                    ],
                  },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "National accounts (Iran)",
                    sourceName: gdpCompositionSource?.name ?? "World Bank World Development Indicators",
                    sourceUrl: gdpCompositionSource?.url ?? "https://data.worldbank.org/",
                    sourceDetail: gdpCompositionSource?.publisher ?? "World Bank",
                    unitLabel:
                      "% of GDP (composition); current US$ log (nominal GDP); levels by value type (Real / USD / Toman)",
                    unitNote:
                      gdpLevelsValueType === "real"
                        ? "Shares: NE.CON.TOTL.ZS, NE.GDI.TOTL.ZS. Nominal GDP: NY.GDP.MKTP.CD. Levels (Real): NE.CON.TOTL.KD, NY.GDP.MKTP.KD, NE.GDI.TOTL.KD (constant 2015 US$). ISO3 IRN."
                        : gdpLevelsValueType === "toman"
                          ? "Shares: NE.CON.TOTL.ZS, NE.GDI.TOTL.ZS. Nominal GDP: NY.GDP.MKTP.CD. Levels (Toman): NE.CON.TOTL.CD, NY.GDP.MKTP.CD, NE.GDI.TOTL.CD × annual mean open-market toman/USD. ISO3 IRN."
                          : "Shares: NE.CON.TOTL.ZS, NE.GDI.TOTL.ZS. Nominal GDP: NY.GDP.MKTP.CD. Levels (USD): NE.CON.TOTL.CD, NY.GDP.MKTP.CD, NE.GDI.TOTL.CD (current US$). ISO3 IRN.",
                  },
                ]}
                note={
                  (gdpDataSpan?.first_year_any != null && gdpDataSpan?.last_year_any != null
                    ? `Data window returned: ${gdpDataSpan.returned_start_year ?? gdpDataSpan.first_year_any}–${gdpDataSpan.returned_end_year ?? gdpDataSpan.last_year_any} (WDI coverage from ${gdpDataSpan.first_year_any} as the earliest year any indicator in this bundle has values). `
                    : "") +
                  (gdpLevelsConversionMeta?.description
                    ? `${gdpLevelsConversionMeta.description} `
                    : "") +
                  "Educational visualization only; not a forecast."
                }
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Composition shows shares: of GDP counted in a year, how much is consumption and how much is
                  investment—each as a percent of that GDP number. The levels chart can show the same three aggregates
                  as Real (constant 2015 US$ from WDI, a domestic real-economy lens without applying market FX), as USD
                  (current US$ for international comparison), or as Toman (current US$ converted with the project’s
                  per-year open-market FX—illustrative; mixes real change with exchange-rate depreciation).
                </p>
                <p>
                  Nominal GDP is always in current US dollars on a log scale. The % chart does not use the levels value
                  type; only the three-line levels chart does.
                </p>
                <p>
                  Iranian year labels on the axis are display-only (Solar Hijri year from each point’s Gregorian date,
                  UTC). They do not change the underlying annual observations.
                </p>
              </InSimpleTerms>
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
            </>
          ) : isOilExporterTimeseries ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExporterSource("curated")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      exporterSource === "curated"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Curated
                  </button>
                  <button
                    type="button"
                    onClick={() => setExporterSource("db")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      exporterSource === "db"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    All data
                  </button>
                </div>
              </div>
              <MultiSeriesStats
                series={[
                  { label: "Saudi Arabia", unit: "thousand bbl/day", points: exporterSaudiPoints },
                  { label: "Russia", unit: "thousand bbl/day", points: exporterRussiaPoints },
                  { label: "United States", unit: "thousand bbl/day", points: exporterUsPoints },
                  { label: "Iran", unit: "thousand bbl/day", points: exporterIranPoints },
                ]}
                timeRange={exporterTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, ["UN Comtrade"])}
                data={[]}
                valueKey="value"
                label="Crude oil exports"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                multiSeries={[
                  {
                    key: "saudi",
                    label: "Saudi Arabia",
                    yAxisIndex: 0,
                    unit: "thousand bbl/day",
                    points: exporterSaudiPoints,
                    color: SIGNAL_COUNTRY.saudi,
                    symbol: "diamond",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "russia",
                    label: "Russia",
                    yAxisIndex: 0,
                    unit: "thousand bbl/day",
                    points: exporterRussiaPoints,
                    color: SIGNAL_COUNTRY.russia,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "us",
                    label: "United States",
                    yAxisIndex: 0,
                    unit: "thousand bbl/day",
                    points: exporterUsPoints,
                    color: SIGNAL_COUNTRY.us,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "iran",
                    label: "Iran",
                    yAxisIndex: 0,
                    unit: "thousand bbl/day",
                    points: exporterIranPoints,
                    color: SIGNAL_COUNTRY.iran,
                    symbol: "roundRect",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                timeRange={exporterChartTimeRange ?? exporterTimeRange ?? study.timeRange}
                forceTimeRangeAxis
                yAxisMin={exporterYMin}
                yAxisMax={exporterYMax}
                chartRangeGranularity="year"
              />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Source: UN Comtrade (HS 2709 crude oil trade)</span>
                <span>Unit: thousand barrels/day</span>
              </div>
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Four lines show annual crude oil export volumes for Saudi Arabia, Russia, United States, and Iran.",
                      "Exports are derived by summing bilateral trade flows (exporter → importer) from UN Comtrade.",
                      "Y-axis: thousand barrels per day. All series share the same scale.",
                      "Annual data: one point per year.",
                    ],
                  },
                  {
                    heading: "What this measures",
                    bullets: [
                      "Crude oil trade flows (HS 2709) reported to UN Comtrade.",
                      "Export totals = sum of all outbound flows from each country.",
                    ],
                  },
                  {
                    heading: "Purpose",
                    bullets: [
                      "Compare export levels across major crude oil exporters over time.",
                      "Observe shifts from sanctions (e.g. Iran), market reorientation (e.g. Russia post-2022), and shale-driven US export growth.",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Annual data; does not show within-year volatility.",
                      "Curated fallback used when backend unavailable; coverage may differ from live Comtrade.",
                    ],
                  },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "Crude oil trade",
                    sourceName: "UN Comtrade",
                    sourceUrl: "https://comtrade.un.org/",
                    sourceDetail: "HS 2709 crude petroleum. Curated fallback when Comtrade unavailable.",
                    unitLabel: "thousand barrels/day",
                    unitNote: "Bilateral trade flows summed by exporter.",
                  },
                ]}
                note="Note: Trade data is derived from UN Comtrade (HS 2709). Reporting coverage varies across countries and years. Missing values reflect unavailable reporting rather than zero exports."
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  This chart shows how much crude oil each of four major exporters sells abroad each year.
                  Exports are computed from reported bilateral trade flows, so they reflect what countries actually ship, not production.
                </p>
                <p>
                  Sanctions, conflicts, and market shifts can change where oil flows. Russia&apos;s pivot away from Europe after 2022 and US shale-driven export growth are visible in the data.
                </p>
              </InSimpleTerms>
            </>
          ) : (
            <>
          {(isOverviewStub || isOilBrent || isFxIranCurrencyRegime || isOilAndFx || (isOilPppIran && !hasTurkeyComparator)) && !isOilGlobalLong && !isGoldAndOil && !isRealOil && (
            <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border pb-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-chart-show-iran">
                <input
                  id="study-body-chart-show-iran"
                  name="study_body_chart_show_iran_events"
                  type="checkbox"
                  checked={showIranEvents}
                  onChange={(e) => setShowIranEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show Iran events
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-chart-show-world">
                <input
                  id="study-body-chart-show-world"
                  name="study_body_chart_show_world_events"
                  type="checkbox"
                  checked={showWorldEvents}
                  onChange={(e) => setShowWorldEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show world events
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-chart-show-sanctions">
                <input
                  id="study-body-chart-show-sanctions"
                  name="study_body_chart_show_sanctions_events"
                  type="checkbox"
                  checked={showSanctionsEvents}
                  onChange={(e) => setShowSanctionsEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show sanctions
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-chart-show-global-macro-oil">
                <input
                  id="study-body-chart-show-global-macro-oil"
                  name="study_body_chart_show_global_macro_oil"
                  type="checkbox"
                  checked={showGlobalMacroOil}
                  onChange={(e) => setShowGlobalMacroOil(e.target.checked)}
                  className="rounded border-border"
                />
                Global oil/macro (curated)
              </label>
              {(isFxIranCurrencyRegime || isOilPppIran) && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-chart-show-presidential-terms">
                  <input
                    id="study-body-chart-show-presidential-terms"
                    name="study_body_chart_show_presidential_terms"
                    type="checkbox"
                    checked={showPresidentialTerms}
                    onChange={(e) => setShowPresidentialTerms(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show presidential terms
                </label>
              )}
              {isFxIranCurrencyRegime && (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-fx-show-official">
                    <input
                      id="study-body-fx-show-official"
                      name="study_body_fx_show_official"
                      type="checkbox"
                      checked={fxRegimeShowOfficial}
                      onChange={(e) => setFxRegimeShowOfficial(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "Show official rate", "نمایش نرخ رسمی")}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-fx-show-spread">
                    <input
                      id="study-body-fx-show-spread"
                      name="study_body_fx_show_spread"
                      type="checkbox"
                      checked={showFxSpread}
                      onChange={(e) => setShowFxSpread(e.target.checked)}
                      className="rounded border-border"
                    />
                    {L(isFa, "Show spread", "نمایش شکاف")}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="study-body-fx-usd-toman-log">
                    <input
                      id="study-body-fx-usd-toman-log"
                      name="study_body_fx_usd_toman_log"
                      type="checkbox"
                      checked={fxUsdTomanYAxisLog}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setFxUsdTomanYAxisLog(next);
                        const p = new URLSearchParams(searchParams.toString());
                        if (next) p.set("log", "1");
                        else p.delete("log");
                        const qs = p.toString();
                        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                      }}
                      className="rounded border-border"
                    />
                    {L(isFa, "Log scale", "مقیاس لگاریتمی")}
                  </label>
                </>
              )}
            </div>
          )}
          {isOilPppIran ? (
            <>
              {pppIranError ? (
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 max-w-3xl">
                  {L(
                    isFa,
                    `Could not load PPP oil series: ${pppIranError}. Turkey comparator (if shown) loads separately.`,
                    `بارگذاری سری نفت به قیمت بر اساس برابری قدرت خرید ناموفق بود: ${pppIranError}. مقایسه با ترکیه (در صورت نمایش) جدا بارگذاری می‌شود.`
                  )}
                </p>
              ) : null}
              {pppIranLoading && pppIranPoints.length === 0 && !pppIranError ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading PPP oil burden series…", "در حال بارگذاری سری بار نفت به قیمت بر اساس برابری قدرت خرید…")}
                </p>
              ) : null}
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [
                  pppIranSource?.oil,
                  pppIranSource?.ppp,
                  hasTurkeyComparator ? pppTurkeySource?.oil : undefined,
                  hasTurkeyComparator ? pppTurkeySource?.ppp : undefined,
                ])}
                data={[]}
                valueKey="value"
                label="Oil price burden"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: hasTurkeyComparator ? "Iran (PPP)" : "Oil price burden",
                  unit: "toman/bbl (PPP)",
                  points: pppIranPoints,
                  yAxisIndex: 1,
                  symbol: "circle",
                  symbolSize: CHART_LINE_SYMBOL_SIZE,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={false}
                yAxisLog={pppYAxisLog}
                yAxisNameSuffix={pppYAxisLog ? (hasTurkeyComparator ? "log" : "(log scale)") : undefined}
                mutedEventLines
                referenceLine={
                  !hasTurkeyComparator && pppYAxisLog && pppEarlierPeriodMedian != null
                    ? { value: pppEarlierPeriodMedian, label: "Earlier-period median" }
                    : undefined
                }
                comparatorSeries={
                  hasTurkeyComparator && pppTurkeyPoints.length > 0
                    ? {
                        label: "Turkey (PPP)",
                        points: pppTurkeyPoints,
                        symbol: COUNTRY_COMPARATOR_STYLES.turkey.symbol,
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      }
                    : undefined
                }
                indexComparator={hasTurkeyComparator}
                chartRangeGranularity="year"
              />
              {hasTurkeyComparator && (
                <p className="mt-3 text-xs text-muted-foreground max-w-2xl break-words">
                  Both series are indexed to the first common year (= 100). Values above 100 indicate a higher estimated burden relative to that baseline; below 100, a lower burden. Example: 200 = twice the baseline.
                </p>
              )}
              <OilPppIranDescription locale={isFa ? "fa" : "en"} />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={
                  hasTurkeyComparator
                    ? [
                        {
                          heading: "Methodology",
                          bullets: [
                            "Iran: nominal oil price × Iran PPP conversion factor (toman per barrel).",
                            "Turkey: nominal oil price × Turkey PPP conversion factor (lira per barrel).",
                            "Both series estimate the domestic purchasing-power equivalent of one barrel of oil.",
                          ],
                        },
                        {
                          heading: "Methodological symmetry",
                          bullets: [
                            "Identical construction: annual average oil × country-specific PPP factor.",
                            "Same oil series (Brent crude oil, a benchmark oil type traded on world markets) and same PPP source (World Bank / ICP).",
                            "Identical resolution: annual.",
                          ],
                        },
                        {
                          heading: "How to read this chart",
                          bullets: [
                            "Y-axis: Index (base year = first common year). Both series are scaled so the first year with data for both countries equals 100.",
                            "The base year is not chosen—it is the first year when both Iran and Turkey have PPP data in the World Bank dataset. That year is determined by data availability.",
                            "Values above 100 indicate a higher estimated burden relative to that baseline; values below 100 indicate a lower burden.",
                            "Example: 200 = twice the baseline burden; 50 = half.",
                            "Because the chart is indexed, relative evolution is emphasized rather than absolute levels.",
                          ],
                        },
                        {
                          heading: "Pitfalls",
                          bullets: [
                            "This is a burden proxy, not a market price.",
                            "PPP data are annual; short-term volatility is not captured.",
                            "Indexing removes information about absolute affordability; it shows relative change over time only.",
                            "Do not infer causality from divergence.",
                          ],
                        },
                      ]
                    : [
                        {
                          heading: "What this measures",
                          bullets: [
                            "PPP-adjusted oil burden in Iran: nominal oil price × Iran PPP conversion factor.",
                            "Expresses the domestic purchasing power equivalent of a barrel of oil.",
                          ],
                        },
                        {
                          heading: "Purpose",
                          bullets: [
                            "PPP is used instead of market exchange rates to approximate domestic burden.",
                            "Useful when comparing affordability across countries or over time.",
                          ],
                        },
                        {
                          heading: "Reading guidance",
                          bullets: [
                            "Y-axis: PPP-adjusted toman per barrel. Use the Log scale toggle in the card header.",
                            "Resolution: annual. One point per year.",
                          ],
                        },
                        {
                          heading: "Pitfalls",
                          bullets: [
                            "This is a burden proxy, not a market price. Do not infer causality.",
                            "PPP data are annual; intra-year volatility is not captured.",
                          ],
                        },
                      ]
                }
              />
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026" locale={isFa ? "fa" : "en"}>
                {hasTurkeyComparator ? (
                  <>
                    <p>
                      As of March 2026, Iran and Turkey show divergent evolution in PPP-adjusted oil burden over the observation period.
                      Both series rise with nominal oil, but the pace and pattern differ. Turkey exhibits notable volatility in recent years;
                      Iran shows a step-up in levels from the late 2010s onward.
                    </p>
                    <p>
                      This divergence is descriptive. No causal claims are implied. Differences in PPP conversion factors, domestic
                      inflation, and structural factors may contribute; the chart does not disentangle them.
                    </p>
                    <p>
                      Limitation: World Bank PPP data lag by one year or more; the most recent point may reflect prior-year
                      conversion factors.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      As of March 2026, PPP-adjusted oil burden in Iran remains elevated relative to the previous decade.
                      The series appears to show a step-up in levels from the late 2010s onward. Volatility is moderate, with annual
                      data absorbing intra-year swings.
                    </p>
                    <p>
                      Limitation: World Bank PPP data lag by one year or more; the most recent point may reflect prior-year
                      conversion factors.
                    </p>
                  </>
                )}
              </CurrentSnapshot>
              {(pppIranSource || (hasTurkeyComparator && pppTurkeySource)) && (
                <SourceInfo
                  items={[
                    ...(pppIranSource
                      ? [
                          {
                            label: "Iran (PPP)",
                            sourceName: `${pppIranSource.oil}; ${pppIranSource.ppp}`,
                            sourceUrl: "https://data.worldbank.org/indicator/PA.NUS.PRVT.PP?locations=IR",
                            sourceDetail: "Annual average oil × Iran PPP conversion factor",
                            unitLabel: "PPP-adjusted toman per barrel",
                            unitNote: "PPP values reflect domestic purchasing power.",
                          },
                        ]
                      : []),
                    ...(hasTurkeyComparator && pppTurkeySource
                      ? [
                          {
                            label: "Turkey (PPP)",
                            sourceName: `${pppTurkeySource.oil}; ${pppTurkeySource.ppp}`,
                            sourceUrl: "https://data.worldbank.org/indicator/PA.NUS.PRVT.PP?locations=TR",
                            sourceDetail: "Annual average oil × Turkey PPP conversion factor",
                            unitLabel: "PPP-adjusted lira per barrel",
                            unitNote: "PPP values reflect domestic purchasing power.",
                          },
                        ]
                      : []),
                  ]}
                  note={hasTurkeyComparator ? "Identical methodology: nominal oil × country PPP factor. Annual resolution. Same oil and PPP sources." : "PPP values reflect domestic purchasing power; values are not market exchange rates. Annual resolution."}
                />
              )}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.
                  The chart tries to show how “heavy” or “burdensome” oil feels in domestic terms—what one barrel of oil means in terms of local purchasing power.
                  It uses a method (PPP) to translate world oil prices (Brent) into something comparable across countries or over time.
                </p>
                <p>
                  When two countries are shown, the chart illustrates how their relative burden has evolved from a common starting point.
                  The chart focuses on that comparison and meaning, not on actual spending or policy outcomes.
                </p>
              </InSimpleTerms>
            </>
          ) : isOilExportCapacity ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
              </div>
              <MultiSeriesStats
                series={[
                  {
                    label: L(isFa, "Oil price", "قیمت نفت"),
                    unit: L(isFa, "USD/bbl", "دلار/بشکه"),
                    points: exportCapacityOilDisplayed,
                  },
                  {
                    label: L(isFa, "Export capacity proxy", "نمایندهٔ ظرفیت صادرات"),
                    unit: exportCapacityBaseYear
                      ? L(isFa, `Index (base=${exportCapacityBaseYear})`, `شاخص (پایه=${exportCapacityBaseYear})`)
                      : L(isFa, "Index", "شاخص"),
                    points: exportCapacityProxyPoints,
                  },
                ]}
                timeRange={exportCapacityTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [
                  "FRED DCOILBRENTEU",
                  "EIA / tanker tracking estimates",
                  "Derived (price × volume, indexed)",
                  cpiDeflationExtraExport,
                ])}
                tooltipValueBasisNote={usdTooltipBasisNote}
                data={[]}
                valueKey="value"
                label={L(isFa, "Oil price", "قیمت نفت")}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                multiSeries={[
                  {
                    key: "oil",
                    label: L(isFa, "Oil price", "قیمت نفت"),
                    yAxisIndex: 0,
                    unit: L(isFa, "USD/bbl", "دلار/بشکه"),
                    points: exportCapacityOilDisplayed,
                    color: SIGNAL_CONCEPT.oil_price,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "proxy",
                    label: L(isFa, "Export capacity proxy", "نمایندهٔ ظرفیت صادرات"),
                    yAxisIndex: 1,
                    unit: exportCapacityBaseYear
                      ? L(isFa, `Index (base=${exportCapacityBaseYear})`, `شاخص (پایه=${exportCapacityBaseYear})`)
                      : L(isFa, "Index", "شاخص"),
                    points: exportCapacityProxyPoints,
                    color: SIGNAL_CONCEPT.export_capacity,
                    symbol: "rect",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                timeRange={exportCapacityTimeRange ?? study.timeRange}
                mutedBands={false}
                sanctionsPeriods={sanctionsPeriodsFromEvents}
                chartRangeGranularity="year"
                exportFileStem="iran-oil-export-capacity"
              />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Sanctions periods can be optionally displayed to provide context for changes in export capacity; their presence does not imply causality.",
                    ],
                  },
                  {
                    heading: "Why volume matters",
                    bullets: [
                      "Oil price alone does not capture export capacity. Revenue-like capacity depends on both price and volume.",
                      "Iran's export volumes have varied significantly under sanctions. Combining price and volume gives a fuller picture.",
                    ],
                  },
                  {
                    heading: "Why indexing is used",
                    bullets: [
                      "The proxy (price × volume) has no natural unit for comparison over time. Indexing to the first year (= 100) emphasizes relative evolution.",
                      "Values above 100 indicate higher estimated capacity relative to the baseline; below 100, lower.",
                    ],
                  },
                  {
                    heading: "What the proxy represents",
                    bullets: [
                      "A proxy for export earning capacity: oil price × estimated crude export volume.",
                      "Not realized revenue. Does not account for discounts, informal trade, or non-crude exports.",
                    ],
                  },
                  {
                    heading: "Measurement choices & limitations",
                    bullets: [
                      "Oil price: Brent crude, USD per barrel, annual average. Export volume: estimated crude and condensate exports, annual.",
                      "Proxy = oil price × estimated export volume; indexed to the first year in the chart (= 100). Values above 100 indicate higher estimated capacity relative to that baseline.",
                      "Export volumes are estimates. Volumes under sanctions are uncertain. Does not equal government revenue; pricing, discounts, and payment terms vary.",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Does not capture discounts or informal trade.",
                      "Do not infer causality from co-movement with sanctions events.",
                    ],
                  },
                ]}
                links={[
                  { label: "EIA Iran Country Analysis", href: "https://www.eia.gov/international/analysis/country/IRN" },
                ]}
              />
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "Oil price",
                    sourceName: "FRED DCOILBRENTEU",
                    sourceUrl: "https://fred.stlouisfed.org/series/DCOILBRENTEU",
                    sourceDetail: "Brent crude, annual average",
                    unitLabel: "USD/barrel",
                  },
                  {
                    label: "Export volume",
                    sourceName: "EIA / tanker tracking estimates",
                    sourceUrl: "https://www.eia.gov/international/analysis/country/IRN",
                    sourceDetail: "Estimated crude oil and condensate exports",
                    unitLabel: "million barrels/year",
                    unitNote: "Estimates; uncertain under sanctions.",
                  },
                  {
                    label: "Export capacity proxy",
                    sourceName: "Derived",
                    sourceDetail: "Oil price × export volume, indexed",
                    unitLabel: "Index (base=first year)",
                    unitNote: "Proxy for earning capacity, not realized revenue.",
                  },
                ]}
                note="Annual resolution. Export volumes are estimates. Do not equate proxy with government revenue."
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.
                  The chart combines Brent oil price and estimated export volume to suggest how much earning capacity Iran might have from oil exports.
                </p>
                <p>
                  It is not actual revenue—it is a rough proxy. Price and volume together give a sense of capacity, not what was actually earned.
                  The chart aims to show that combination and how it has evolved over time. It does not prove any causal link or represent actual government receipts.
                </p>
                <p>
                  When exports are constrained, volume often matters more than price. World oil prices can rise or fall, but if you cannot sell as much, the price alone says little about earning capacity. Volume reflects how much can actually be exported—the bottleneck is often how much you can sell, not the price at which you could sell it.
                </p>
              </InSimpleTerms>
            </>
          ) : isOilEconomyOverview ? (
            <>
              <div
                className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border/40 pb-3"
                dir={isFa ? "rtl" : "ltr"}
              >
                <span className="shrink-0 text-xs text-muted-foreground max-w-xs">
                  {L(
                    isFa,
                    "Narrow the year range for all three panels and for PNG export (empty = study window).",
                    "محدوده سال را برای هر سه نمودار و خروجی PNG ببندید؛ خالی = پنجره مطالعه."
                  )}
                </span>
                <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr" htmlFor="oil-economy-view-start-year">
                  <span className="mb-0.5 block min-h-[0.875rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {L(isFa, "Start year", "سال شروع")}
                  </span>
                  <input
                    id="oil-economy-view-start-year"
                    name="oil_economy_view_start_year"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    value={oilEconomyStartYearDraft}
                    onChange={(e) => setOilEconomyStartYearDraft(e.target.value)}
                    onFocus={() => {
                      oilEconomyStartYearFocusRef.current = true;
                    }}
                    onBlur={() => {
                      oilEconomyStartYearFocusRef.current = false;
                      const { min: yMin, max: yMax } = oilEconomyYearInputMinMax;
                      const raw = oilEconomyStartYearDraft.trim();
                      if (raw === "") {
                        setOilEconomyViewStart("");
                        return;
                      }
                      const y = parseInt(raw, 10);
                      if (!Number.isFinite(y)) {
                        setOilEconomyStartYearDraft(yearDraftFromBoundIso(oilEconomyViewStart));
                        return;
                      }
                      let c = Math.min(yMax, Math.max(yMin, y));
                      const endY = oilEconomyViewEnd && oilEconomyViewEnd.trim() !== ""
                        ? parseInt(oilEconomyViewEnd.slice(0, 4), 10)
                        : null;
                      if (endY != null && Number.isFinite(endY) && c > endY) c = endY;
                      setOilEconomyViewStart(normalizeChartRangeBound(String(c), false));
                      setOilEconomyStartYearDraft(String(c));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                </label>
                <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr" htmlFor="oil-economy-view-end-year">
                  <span className="mb-0.5 block min-h-[0.875rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {L(isFa, "End year", "سال پایان")}
                  </span>
                  <input
                    id="oil-economy-view-end-year"
                    name="oil_economy_view_end_year"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    value={oilEconomyEndYearDraft}
                    onChange={(e) => setOilEconomyEndYearDraft(e.target.value)}
                    onFocus={() => {
                      oilEconomyEndYearFocusRef.current = true;
                    }}
                    onBlur={() => {
                      oilEconomyEndYearFocusRef.current = false;
                      const { min: yMin, max: yMax } = oilEconomyYearInputMinMax;
                      const raw = oilEconomyEndYearDraft.trim();
                      if (raw === "") {
                        setOilEconomyViewEnd("");
                        return;
                      }
                      const y = parseInt(raw, 10);
                      if (!Number.isFinite(y)) {
                        setOilEconomyEndYearDraft(yearDraftFromBoundIso(oilEconomyViewEnd));
                        return;
                      }
                      let c = Math.min(yMax, Math.max(yMin, y));
                      const startY = oilEconomyViewStart && oilEconomyViewStart.trim() !== ""
                        ? parseInt(oilEconomyViewStart.slice(0, 4), 10)
                        : null;
                      if (startY != null && Number.isFinite(startY) && c < startY) c = startY;
                      setOilEconomyViewEnd(normalizeChartRangeBound(String(c), true));
                      setOilEconomyEndYearDraft(String(c));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                </label>
              </div>
              {oilEconomyPriceRealPoints.length > 0 ? (
                <div
                  className="mb-3 flex flex-wrap items-center gap-2"
                  dir={isFa ? "rtl" : "ltr"}
                >
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {L(isFa, "Dollar values:", "ارقام دلاری:")}
                  </span>
                  <div className="inline-flex overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setOilEconomyUsdMode("nominal")}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        oilEconomyUsdMode === "nominal"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {L(isFa, "Nominal USD", "دلار اسمی")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOilEconomyUsdMode("real")}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        oilEconomyUsdMode === "real"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {L(
                        isFa,
                        `Constant ${oilCpiBaseYear} USD`,
                        `دلار ثابت ${localizeChartNumericDisplayString(String(oilCpiBaseYear), "fa")}`
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
              {oilEconomyRealUsdActive && oilEconomyInflation ? (
                <p className="mb-3 max-w-3xl text-xs text-muted-foreground" dir={isFa ? "rtl" : "ltr"}>
                  {L(
                    isFa,
                    `FRED CPIAUCSL. Price and revenue are deflated to ${oilCpiBaseYear} USD. ` +
                      "Real value = nominal × (CPI at the base year ÷ CPI in that year). " +
                      "Stylized revenue = production × real annual price.",
                    `CPIAUCSL (FRED)؛ سطح ثابت ${localizeChartNumericDisplayString(
                      String(oilCpiBaseYear),
                      "fa"
                    )} دلار. مقدار واقعی = اسمی × (CPI در سال مبنا ÷ CPI همان سال). درآمد تقریبی = تولید × قیمت واقعی.`
                  )}
                </p>
              ) : null}
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label: L(isFa, "Iran production", "تولید ایران"),
                    unit: L(isFa, "million bbl/day", "میلیون بشکه/روز"),
                    points: oilEconomyProdPoints,
                  },
                  {
                    label: L(
                      isFa,
                      "Oil price (ann. average)",
                      "قیمت نفت (میانگین سالانه)"
                    ),
                    unit: L(
                      isFa,
                      oilEconomyPriceSeriesUnitForTicks(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                      oilEconomyPriceSeriesUnitForTicks(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                    ),
                    points: oilEconomyDisplayPricePoints,
                  },
                  {
                    label: L(isFa, "Est. oil revenue", "درآمد تخمینی"),
                    unit: L(
                      isFa,
                      oilEconomyRevenueSeriesUnitForTicks(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                      oilEconomyRevenueSeriesUnitForTicks(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                    ),
                    points: oilEconomyDisplayRevenuePoints,
                  },
                ]}
                timeRange={oilEconomyChartTimeRange ?? undefined}
              />
              <div className="space-y-2 mb-6 pb-6 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  {L(isFa, "1. Production and benchmark price (dual axis)", "۱. تولید و قیمت معیار (دو محور)")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-3xl">
                  {L(
                    isFa,
                    oilEconomyRealUsdActive
                      ? "Left: Iran oil production. Right: global oil price in constant dollars (US CPI deflator; same Brent/EIA path as nominal). Two scales; vertical distance is not a ratio."
                      : "Left: Iran oil production (EIA/IMF when available; Energy Institute 1965–79 + EIA/BP 1980–99 embedded annuals to fill gaps). Right: global oil price (EIA 1980–86; FRED DCOILBRENTEU 1987+). Two scales; vertical distance is not a ratio.",
                    oilEconomyRealUsdActive
                      ? "چپ: تولید نفت ایران. راست: قیمت نفت به دلار ثابت (تعدیل با CPI ایالات متحده؛ همان مسیر برنت/دادهٔ اسمی). دو مقیاس جدا."
                      : "چپ: تولید نفت ایران (EIA/IMF در صورت وجود؛ مؤسسه انرژی ۱۹۶۵–۷۹ و سالانه‌های EIA/BP ۱۹۸۰–۹۹ برای پر کردن شکاف). راست: قیمت نفت جهانی (EIA ۱۹۸۰–۸۶؛ FRED ۱۹۸۷+). دو مقیاس جداست؛ فاصلهٔ بصری نسبت مستقیم نمی‌دهد."
                  )}
                </p>
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={displayStudy.title}
                  exportPresentationTitle={L(
                    isFa,
                    oilEconomyPanel1ExportTitle(
                      displayStudy.title,
                      false,
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    ),
                    oilEconomyPanel1ExportTitle(
                      displayStudy.title,
                      true,
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    )
                  )}
                  xAxisYearLabel={chartYearAxisLabel}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    buildOilEconomyExportSourceBody(
                      isFa,
                      "productionBrent",
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    ),
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(
                    isFa,
                    oilEconomyPanel1ChartLabel(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                    oilEconomyPanel1ChartLabel(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                  )}
                  events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                  timeRange={oilEconomyChartTimeRange ?? study.timeRange}
                  chartRangeGranularity="year"
                  categoryYearTickStep={oilEconomyCategoryYearTickStep}
                  showChartControls={false}
                  mutedEventLines
                  exportFileStem="oil-economy-production-brent"
                  multiSeriesYAxisNameOverrides={{
                    1: L(
                      isFa,
                      oilEconomyPriceYAxisName(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                      oilEconomyPriceYAxisName(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                    ),
                  }}
                  multiSeries={[
                    {
                      key: "oe_prod",
                      label: L(isFa, "Iran production", "تولید نفت ایران"),
                      yAxisIndex: 0,
                      unit: L(isFa, "million bbl/day", "میلیون بشکه/روز"),
                      points: oilEconomyProdPoints,
                      color: OIL_ECONOMY_COLOR_PRODUCTION,
                      symbol: "circle",
                      showSymbol: false,
                      lineWidth: 2.25,
                    },
                    {
                      key: "oe_price",
                      label: oilEconomyPriceSeriesLabel(isFa),
                      yAxisIndex: 1,
                      unit: L(
                        isFa,
                        oilEconomyPriceSeriesUnitForTicks(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                        oilEconomyPriceSeriesUnitForTicks(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                      ),
                      points: oilEconomyDisplayPricePoints,
                      color: OIL_ECONOMY_COLOR_PRICE,
                      symbol: "triangle",
                      showSymbol: false,
                      lineWidth: 2.25,
                    },
                  ]}
                />
              </div>
              <div className="space-y-2 mb-6 pb-6 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  {L(
                    isFa,
                    `2. ${oilEconomyRevenueTitle(false, oilEconomyRealUsdActive, oilCpiBaseYear)}`,
                    `۲. ${oilEconomyRevenueTitle(true, oilEconomyRealUsdActive, oilCpiBaseYear)}`
                  )}
                </h3>
                <p className="text-xs text-muted-foreground max-w-3xl">
                  {L(
                    isFa,
                    oilEconomyRealUsdActive
                      ? "Rough annual scale: production (barrels/year) × real annual price (CPI-deflated to base year). Not government receipts or net export value."
                      : "Rough annual scale: production (barrels/year) × annual price. Not government receipts or net export value.",
                    oilEconomyRealUsdActive
                      ? "مقیاس سالانه تقریبی: تولید (بشکه/سال) × قیمت واقعی سالانه (تعدیل با CPI نسبت به سال مبنا). نه دریافت دولت و نه ارزش خالص صادرات."
                      : "مقیاس سالانه تقریبی: تولید (بشکه/سال) × قیمت سالانه. نه دریافت دولت و نه ارزش خالص صادرات."
                  )}
                </p>
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={displayStudy.title}
                  exportPresentationTitle={L(
                    isFa,
                    `${displayStudy.title} — ${oilEconomyRevenueTitle(
                      false,
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    )}`,
                    `${displayStudy.title} — ${oilEconomyRevenueTitle(
                      true,
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    )}`
                  )}
                  xAxisYearLabel={chartYearAxisLabel}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    buildOilEconomyExportSourceBody(
                      isFa,
                      "revenue",
                      oilEconomyRealUsdActive,
                      oilCpiBaseYear
                    ),
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(
                    isFa,
                    oilEconomyRevenueTitle(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                    oilEconomyRevenueTitle(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                  )}
                  events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                  timeRange={oilEconomyChartTimeRange ?? study.timeRange}
                  chartRangeGranularity="year"
                  categoryYearTickStep={oilEconomyCategoryYearTickStep}
                  showChartControls={false}
                  mutedEventLines
                  exportFileStem="oil-economy-revenue"
                  multiSeriesValueFormat="gdp_levels"
                  multiSeriesYAxisNameOverrides={{
                    0: L(
                      isFa,
                      oilEconomyRevenueYAxisName(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                      oilEconomyRevenueYAxisName(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                    ),
                  }}
                  multiSeries={[
                    {
                      key: "oe_rev",
                      label: L(
                        isFa,
                        oilEconomyRevenueLineLegendLabel(false, oilEconomyRealUsdActive),
                        oilEconomyRevenueLineLegendLabel(true, oilEconomyRealUsdActive)
                      ),
                      yAxisIndex: 0,
                      unit: L(
                        isFa,
                        oilEconomyRevenueSeriesUnitForTicks(false, oilEconomyRealUsdActive, oilCpiBaseYear),
                        oilEconomyRevenueSeriesUnitForTicks(true, oilEconomyRealUsdActive, oilCpiBaseYear)
                      ),
                      points: oilEconomyDisplayRevenuePoints,
                      color: OIL_ECONOMY_COLOR_REVENUE,
                      symbol: "diamond",
                      showSymbol: false,
                      lineWidth: 2.25,
                    },
                  ]}
                />
              </div>
              {oilEconomyIndexed ? (
                <div className="space-y-2 mb-8">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "3. All three — indexed (100 = base year)", "۳. هر سه — شاخص‌شده (۱۰۰ = سال مبنا)")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                    {L(
                      isFa,
                      (() => {
                        const b = String(oilEconomyIndexed.baseYear);
                        if (oilEconomyRealUsdActive) {
                          return `Each series is set to 100 in ${b}. Price and revenue are in constant ${oilCpiBaseYear} USD (US CPI, FRED CPIAUCSL). Compares relative change, not levels.`;
                        }
                        return `Each series is set to 100 in ${b} (or the earliest year where all three have values). Compares relative change, not levels.`;
                      })(),
                      (() => {
                        const b = String(oilEconomyIndexed.baseYear);
                        if (oilEconomyRealUsdActive) {
                          return `هر سری در ${localizeChartNumericDisplayString(
                            b,
                            "fa"
                          )} بر شاخص ۱۰۰ نرمال می‌شود؛ قیمت و درآمد به دلار ثابت ${localizeChartNumericDisplayString(
                            String(oilCpiBaseYear),
                            "fa"
                          )} (CPIAUCSL، FRED) می‌باشد؛ تغییر نسبی را می‌سنجد نه سطح مطلق.`;
                        }
                        return `هر سری به شاخص ۱۰۰ در سال ${localizeChartNumericDisplayString(b, "fa")} (یا نزدیک‌ترین سالی که هر سه مقدار دارند) نرمال شده است؛ تغییر نسبی را می‌سنجد نه سطح مطلق.`;
                      })()
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      oilEconomyIndexedExportTitle(
                        displayStudy.title,
                        false,
                        oilEconomyRealUsdActive,
                        oilEconomyIndexed.baseYear,
                        oilCpiBaseYear
                      ),
                      oilEconomyIndexedExportTitle(
                        displayStudy.title,
                        true,
                        oilEconomyRealUsdActive,
                        oilEconomyIndexed.baseYear,
                        oilCpiBaseYear
                      )
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      buildOilEconomyExportSourceBody(
                        isFa,
                        "indexed",
                        oilEconomyRealUsdActive,
                        oilCpiBaseYear
                      ),
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Indexed (100 = base year)", "شاخص‌شده (۱۰۰ = سال مبنا)")}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                    multiSeries={oilEconomyIndexed.multiSeries}
                    timeRange={oilEconomyChartTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    categoryYearTickStep={oilEconomyCategoryYearTickStep}
                    xAxisYearLabel={chartYearAxisLabel}
                    multiSeriesYAxisNameOverrides={{
                      0: isFa
                        ? `شاخص (${localizeChartNumericDisplayString(String(oilEconomyIndexed.baseYear), "fa")} = ۱۰۰)`
                        : `Index (${oilEconomyIndexed.baseYear} = 100)`,
                    }}
                    multiSeriesValueFormat="gdp_indexed"
                    indexedTooltipBaseLabel={
                      isFa
                        ? localizeChartNumericDisplayString(String(oilEconomyIndexed.baseYear), "fa")
                        : String(oilEconomyIndexed.baseYear)
                    }
                    yAxisMin={0}
                    exportFileStem="oil-economy-indexed"
                    showChartControls={false}
                    mutedEventLines
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
              ) : null}
              <LearningNote
                locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: L(isFa, "How price and production drive revenue", "قیمت و تولید چگونه درآمد را می‌سازند"),
                    bullets: [
                      L(
                        isFa,
                        "Stylized annual revenue is proportional to (barrels/day × days) × (price per barrel). If either production or price moves, the product moves.",
                        "درآمد سالانهٔ تصویری متناسب است با (بشکه/روز × روزها) × (قیمت هر بشکه). اگر تولید یا قیمت جابه‌جا شود، حاصل‌ضرب هم تغییر می‌کند."
                      ),
                      L(
                        isFa,
                        "A price rally with flat production still raises the revenue line; production can fall even when price is high—then revenue may still drop.",
                        "اگر قیمت بالا برود و تولید ثابت بماند، اغلب خط درآمد بالا می‌رود؛ اگر تولید کم شود حتی با قیمت بالا ممکن است درآمد بیفتد."
                      ),
                    ],
                  },
                  {
                    heading: L(isFa, "Why this matters for oil economies", "چرا برای اقتصادهای نفتی مهم است"),
                    bullets: [
                      L(
                        isFa,
                        "Many oil-dependent budgets and trade balances are sensitive to the product of volume and price—not price alone.",
                        "بودجه و ترازهای بسیاری از اقتصادهای وابسته به نفت به حاصل‌ضرب حجم و قیمت حساس‌اند—نه فقط قیمت."
                      ),
                      L(
                        isFa,
                        "This view is descriptive context: it is not a fiscal account, export contract table, or estimate of what accrues to the public sector.",
                        "این نما زمینهٔ توصیفی است: حساب مالی دولت، جدول قرارداد صادرات، یا برآورد دریافت بخش عمومی نیست."
                      ),
                    ],
                  },
                  {
                    heading: L(isFa, "Refreshing underlying data (ops)", "به‌روزرسانی دادهٔ پایه (عملیات)"),
                    bullets: [
                      L(
                        isFa,
                        "Brent: daily/append updates via the API’s FRED pipeline; cache for this signal is invalidated when oil price series are refreshed.",
                        "برنت: به‌روزرسانی روزانه/الحاقی از مسیر FRED در API؛ با به‌روز شدن سری قیمت نفت، کش این سیگنال باطل می‌شود."
                      ),
                      L(
                        isFa,
                        "Production: EIA/IMF when the pipeline has a year; older gaps use embedded Energy Institute (1965–79) and EIA/BP (1980–99) annuals. Scheduled jobs update production tables; cache key prefix oil_economy_overview is invalidated on refresh.",
                        "تولید: EIA/IMF اگر سال در خط لوله باشد؛ سال‌های قدیمی‌تر از جداول مؤسسه انرژی (۱۹۶۵–۷۹) و EIA/BP (۱۹۸۰–۹۹) جاسازی‌شده پر می‌شود. jobها جداول را به‌روز می‌کنند و کش oil_economy_overview باطل می‌شود."
                      ),
                    ],
                  },
                ]}
                links={[
                  { label: "FRED DCOILBRENTEU", href: "https://fred.stlouisfed.org/series/DCOILBRENTEU" },
                  { label: "FRED CPIAUCSL (US CPI)", href: "https://fred.stlouisfed.org/series/CPIAUCSL" },
                  { label: "EIA World / Iran context", href: "https://www.eia.gov/international/data/world" },
                  { label: "Energy Institute — Statistical Review", href: "https://www.energyinst.org/statistical-review" },
                ]}
              />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: L(isFa, "Production", "تولید"),
                    sourceName: oilEconomyProdSource?.name ?? "EIA / IMF (via SignalMap oil production bundle)",
                    sourceUrl: oilEconomyProdSource?.url,
                    sourceDetail: oilEconomyProdSource?.publisher,
                    unitLabel: L(isFa, "million barrels per day", "میلیون بشکه در روز"),
                    unitNote: L(
                      isFa,
                        `2000+ from EIA/IMF when present. 1965–1999: ${oilEconomyProdHistoricalFill?.name ?? "Energy Institute 1965–79 + EIA/BP 1980–99"} to fill any year the live series lacks.`,
                        `۲۰۰۰+ از EIA/IMF. ۱۹۶۵–۱۹۹۹: ${oilEconomyProdHistoricalFill?.name ?? "مؤسسه انرژی ۱۹۶۵–۷۹ + EIA/BP ۱۹۸۰–۹۹"} برای سال‌هایی که سری زنده ندارد.`
                    ),
                  },
                  {
                    label: L(isFa, "Price (benchmark)", "قیمت (معیار)"),
                    sourceName: oilEconomyPriceSource?.name
                      ? `${oilEconomyPriceSource.name} (DCOILBRENTEU)`
                      : "FRED DCOILBRENTEU",
                    sourceUrl: oilEconomyPriceSource?.url ?? "https://fred.stlouisfed.org/series/DCOILBRENTEU",
                    sourceDetail: oilEconomyPriceSource?.publisher,
                    unitLabel: L(isFa, "USD per barrel (annual average)", "دلار به بشکه (میانگین سالانه)"),
                    unitNote: L(
                      isFa,
                      "1980–86: EIA annual U.S. first-purchase (global proxy). 1987+: FRED DCOILBRENTEU (mean of daily).",
                      "۱۹۸۰–۸۶: EIA سالانه (پراکسی جهانی). ۱۹۸۷+: FRED DCOILBRENTEU (میانگین روزانه)."
                    ),
                  },
                  {
                    label: L(isFa, "Revenue (derived)", "درآمد (مشتق)"),
                    sourceName: oilEconomyRevenueSource?.name ?? "Derived in API",
                    sourceUrl: oilEconomyRevenueSource?.url,
                    sourceDetail: oilEconomyRevenueSource?.publisher,
                    unitLabel: L(
                      isFa,
                      oilEconomyPriceRealPoints.length > 0
                        ? `USD per year, constant ${oilCpiBaseYear} (stylized)`
                        : "USD per year (stylized)",
                      oilEconomyPriceRealPoints.length > 0
                        ? `دلار در سال (ثابت ${localizeChartNumericDisplayString(String(oilCpiBaseYear), "fa")}، تصویری)`
                        : "دلار در سال (تصویری)"
                    ),
                    unitNote: L(
                      isFa,
                      "revenue ≈ (mb/d × 1e6 × 365.25) × annual price. Not government revenue.",
                      "درآمد ≈ (میلیون بشکه/روز × ۱e۶ × ۳۶۵٫۲۵) × قیمت سالانه. نه درآمد دولت."
                    ),
                  },
                  ...(oilEconomyPriceRealPoints.length > 0
                    ? [
                        {
                          label: L(
                            isFa,
                            `US CPI (deflator, ${oilCpiBaseYear} USD)`,
                            `CPI ایالات متحده (تعدیل‌گر، دلار ثابت ${localizeChartNumericDisplayString(String(oilCpiBaseYear), "fa")})`
                          ),
                          sourceName: "FRED CPIAUCSL",
                          sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
                          sourceDetail: "BLS (via FRED); annual average of monthly CPI; used to deflate to base year",
                          unitLabel: L(
                            isFa,
                            "Index (1982–84 = 100)",
                            "شاخص (۱۹۸۲–۸۴ = ۱۰۰)"
                          ),
                          unitNote: L(
                            isFa,
                            `Constant‑dollar base year: ${oilCpiBaseYear}.`,
                            `سال پایهٔ دلار ثابت: ${localizeChartNumericDisplayString(String(oilCpiBaseYear), "fa")}.`
                          ),
                        },
                      ]
                    : []),
                ]}
                note={L(
                  isFa,
                  "Chart export uses the English “Source:” line. Semicolon‑separated list; FRED CPIAUCSL (inflation adjustment) with the shown base year. Descriptive only.",
                  "«Source:» در خروجی همیشه به انگلیسی است؛ بخش‌ها با ؛ . FRED CPIAUCSL (تعدیل تورم) و سال پایهٔ نمایش‌داده‌شده. صرفاً توصیفی."
                )}
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      This page puts three ideas on one timeline: how much oil Iran produced, what the global benchmark
                      price averaged over each year, and a very simple “barrels times price” style revenue line.
                    </p>
                    <p>
                      When people talk about oil income, they are usually gesturing at that kind of product: volume and
                      price both matter. A high price does not help if production or sales fall sharply, and more barrels
                      can offset softer prices. The green revenue line is a back-of-the-envelope scale for reading those
                      forces together—not a budget line.
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isOilProductionMajorExporters ? (
            <>
              <MultiSeriesStats
                series={[
                  { label: "United States", unit: "million bbl/day", points: extendedProductionUsPoints },
                  { label: "Saudi Arabia", unit: "million bbl/day", points: extendedProductionSaudiPoints },
                  { label: "Russia", unit: "million bbl/day", points: extendedProductionRussiaPoints },
                  { label: "Iran", unit: "million bbl/day", points: extendedProductionIranPoints },
                  ...(extendedProductionTotalPoints.length > 0
                    ? [
                        {
                          label: "Total (US + Saudi + Russia + Iran)",
                          unit: "million bbl/day",
                          points: extendedProductionTotalPoints,
                        },
                      ]
                    : []),
                ]}
                timeRange={productionTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [productionSource?.name])}
                data={[]}
                valueKey="value"
                label="Oil production"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, study14FilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "us",
                    label: "United States",
                    yAxisIndex: 0,
                    unit: "million bbl/day",
                    points: extendedProductionUsPoints,
                    color: SIGNAL_COUNTRY.us,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "saudi",
                    label: "Saudi Arabia",
                    yAxisIndex: 0,
                    unit: "million bbl/day",
                    points: extendedProductionSaudiPoints,
                    color: SIGNAL_COUNTRY.saudi,
                    symbol: "diamond",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "russia",
                    label: "Russia",
                    yAxisIndex: 0,
                    unit: "million bbl/day",
                    points: extendedProductionRussiaPoints,
                    color: SIGNAL_COUNTRY.russia,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "iran",
                    label: "Iran",
                    yAxisIndex: 0,
                    unit: "million bbl/day",
                    points: extendedProductionIranPoints,
                    color: SIGNAL_COUNTRY.iran,
                    symbol: "roundRect",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  ...(extendedProductionTotalPoints.length > 0
                    ? [
                        {
                          key: "total",
                          label: "Total (US + Saudi + Russia + Iran)",
                          yAxisIndex: 0 as const,
                          unit: "million bbl/day",
                          points: extendedProductionTotalPoints,
                          color: SIGNAL_COUNTRY.total,
                          symbol: "rect" as const,
                          symbolSize: CHART_LINE_SYMBOL_SIZE,
                        },
                      ]
                    : []),
                ]}
                timeRange={productionTimeRange ?? study.timeRange}
                extendedDates={productionExtendedDates}
                lastOfficialDateForExtension={productionLastOfficialDate}
                chartRangeGranularity="year"
              />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Four lines show crude oil production for the United States, Saudi Arabia, Russia, and Iran, measured in million barrels per day.",
                      "Production is not the same as exports. Some oil is consumed domestically, so countries with large internal demand may export a smaller share of their production.",
                      "Y-axis: million barrels per day. All series share the same scale.",
                      "Annual data: one point per year.",
                      "The United States is currently the world's largest oil producer, followed by Saudi Arabia and Russia, while Iran's production is affected by sanctions and export constraints.",
                    ],
                  },
                  {
                    heading: "What this measures",
                    bullets: [
                      "Crude oil production—the volume of oil extracted per day.",
                      "US and Russia: EIA. Saudi Arabia and Iran: IMF Regional Economic Outlook (FRED).",
                    ],
                  },
                  {
                    heading: "Purpose",
                    bullets: [
                      "Compare production levels across major exporters over time.",
                      "Supply changes (OPEC+ cuts, sanctions, conflicts) can move global oil prices.",
                      "U.S. oil production increased sharply after 2010 due to the expansion of shale oil extraction technologies such as hydraulic fracturing and horizontal drilling.",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Annual data; does not show within-year volatility.",
                      "Do not infer causality from co-movement with events.",
                    ],
                  },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {productionSource && (
                <SourceInfo
                  items={[
                    {
                      label: "Oil production",
                      sourceName: productionSource.name,
                      sourceUrl: productionSource.url,
                      sourceDetail: productionSource.publisher,
                      unitLabel: "million barrels/day",
                      unitNote: "Annual crude oil production.",
                    },
                  ]}
                />
              )}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Oil production is how much crude oil a country pumps out of the ground each day.
                  The United States, Saudi Arabia, Russia, and Iran are among the world&apos;s largest producers.
                </p>
                <p>
                  When production changes—because of OPEC+ cuts, sanctions, or conflicts—global supply shifts and prices can move.
                  This chart shows how production levels have evolved over time for these four major producers.
                </p>
              </InSimpleTerms>
            </>
          ) : isGiniInequality ? (
            <>
              {giniLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {giniLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{giniLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {giniWdiLoading && !giniLoadFailed && !giniDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading World Bank Gini series…", "در حال بارگذاری سری جینی بانک جهانی…")}
                </p>
              ) : null}
              {giniSeriesWarnings && Object.keys(giniSeriesWarnings).length > 0 && giniDataReady ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-4 max-w-3xl">
                  {L(isFa, "Some country series failed to load:", "بارگذاری برخی سری‌های کشور ناموفق بود:")}{" "}
                  {Object.entries(giniSeriesWarnings)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </p>
              ) : null}
              {giniDataReady ? (
              <>
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label: L(isFa, "Iran", "ایران"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniIranPoints,
                  },
                  {
                    label: L(isFa, "United States", "ایالات متحده"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniUsPoints,
                  },
                  {
                    label: L(isFa, "Germany", "آلمان"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniGermanyPoints,
                  },
                  {
                    label: L(isFa, "Turkey", "ترکیه"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniTurkeyPoints,
                  },
                  {
                    label: L(isFa, "China", "چین"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniChinaPoints,
                  },
                  {
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    unit: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniSaudiArabiaPoints,
                  },
                ]}
                timeRange={giniTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportSourceFooter={studyChartExportSource(isFa, [
                  giniSource?.name ?? "World Bank World Development Indicators",
                ])}
                data={[]}
                valueKey="value"
                label={L(isFa, "Gini coefficient", "ضریب جینی")}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, giniFilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "iran",
                    label: L(isFa, "Iran", "ایران"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniIranPoints,
                    color: COUNTRY_COMPARATOR_STYLES.iran.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.iran.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "us",
                    label: L(isFa, "United States", "ایالات متحده"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniUsPoints,
                    color: COUNTRY_COMPARATOR_STYLES.us.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.us.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "germany",
                    label: L(isFa, "Germany", "آلمان"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniGermanyPoints,
                    color: COUNTRY_COMPARATOR_STYLES.germany.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.germany.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "turkey",
                    label: L(isFa, "Turkey", "ترکیه"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniTurkeyPoints,
                    color: COUNTRY_COMPARATOR_STYLES.turkey.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.turkey.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "china",
                    label: L(isFa, "China", "چین"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniChinaPoints,
                    color: COUNTRY_COMPARATOR_STYLES.china.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.china.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "saudi_arabia",
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    yAxisIndex: 0,
                    unit: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                    points: giniSaudiArabiaPoints,
                    color: COUNTRY_COMPARATOR_STYLES.saudi_arabia.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.saudi_arabia.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                timeRange={giniTimeRange ?? study.timeRange}
                yAxisMin={0}
                yAxisMax={100}
                chartRangeGranularity="year"
                xAxisYearLabel={chartYearAxisLabel}
                exportFileStem="gini-inequality"
                multiSeriesYAxisNameOverrides={{
                  0: L(isFa, "Gini coefficient (0–100)", "ضریب جینی (۰–۱۰۰)"),
                }}
                yAxisDetailNote={L(
                  isFa,
                  "This indicator is based on survey data and is only available for selected years.",
                  "«این شاخص مبتنی بر داده‌های پیمایشی است و فقط برای برخی سال‌ها در دسترس است.»"
                )}
              />
              </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"} sections={giniLearningSections(isFa)} />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {giniSource ? (
                <SourceInfo
                  items={[
                    {
                      label: L(isFa, "Gini coefficient", "ضریب جینی"),
                      sourceName: giniSource.name ?? "World Bank World Development Indicators",
                      sourceUrl: giniSource.url ?? "https://data.worldbank.org/indicator/SI.POV.GINI",
                      sourceDetail: giniSource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                      unitNote: L(
                        isFa,
                        "Indicator SI.POV.GINI; annual where available.",
                        "شاخص SI.POV.GINI؛ سالانه در صورت وجود داده."
                      ),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      The Gini coefficient is a single number that summarizes how spread out incomes are. When it rises,
                      incomes are more concentrated among fewer people or households; when it falls, the distribution is more
                      equal.
                    </p>
                    <p>
                      This page compares six economies using the same statistical definition from the World Bank so you can see
                      long-run changes side by side. Event markers are optional context only—they do not explain changes by
                      themselves.
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isInflationCpiYoy ? (
            <>
              {inflationLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {inflationLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{inflationLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {inflationWdiLoading && !inflationLoadFailed && !inflationDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(
                    isFa,
                    "Loading World Bank CPI inflation series…",
                    `در حال بارگذاری سری ${faEconomic.cpiInflation} بانک جهانی…`
                  )}
                </p>
              ) : null}
              {inflationSeriesWarnings && Object.keys(inflationSeriesWarnings).length > 0 && inflationDataReady ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-4 max-w-3xl">
                  {L(isFa, "Some country series failed to load:", "بارگذاری برخی سری‌های کشور ناموفق بود:")}{" "}
                  {Object.entries(inflationSeriesWarnings)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </p>
              ) : null}
              {inflationDataReady ? (
              <>
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label: L(isFa, "Iran", "ایران"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationIranPoints,
                  },
                  {
                    label: L(isFa, "United States", "ایالات متحده"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationUsPoints,
                  },
                  {
                    label: L(isFa, "Germany", "آلمان"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationGermanyPoints,
                  },
                  {
                    label: L(isFa, "Turkey", "ترکیه"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationTurkeyPoints,
                  },
                  {
                    label: L(isFa, "China", "چین"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationChinaPoints,
                  },
                  {
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationSaudiArabiaPoints,
                  },
                ]}
                timeRange={inflationTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportSourceFooter={studyChartExportSource(isFa, [
                  inflationSource?.name ?? "World Bank World Development Indicators",
                ])}
                data={[]}
                valueKey="value"
                label={L(isFa, "Inflation rate", faEconomic.inflation)}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, inflationFilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "iran",
                    label: L(isFa, "Iran", "ایران"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationIranPoints,
                    color: COUNTRY_COMPARATOR_STYLES.iran.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.iran.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "us",
                    label: L(isFa, "United States", "ایالات متحده"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationUsPoints,
                    color: COUNTRY_COMPARATOR_STYLES.us.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.us.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "germany",
                    label: L(isFa, "Germany", "آلمان"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationGermanyPoints,
                    color: COUNTRY_COMPARATOR_STYLES.germany.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.germany.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "turkey",
                    label: L(isFa, "Turkey", "ترکیه"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationTurkeyPoints,
                    color: COUNTRY_COMPARATOR_STYLES.turkey.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.turkey.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "china",
                    label: L(isFa, "China", "چین"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationChinaPoints,
                    color: COUNTRY_COMPARATOR_STYLES.china.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.china.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "saudi_arabia",
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: inflationSaudiArabiaPoints,
                    color: COUNTRY_COMPARATOR_STYLES.saudi_arabia.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.saudi_arabia.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                timeRange={inflationTimeRange ?? study.timeRange}
                chartRangeGranularity="year"
                xAxisYearLabel={chartYearAxisLabel}
                exportFileStem="inflation-rate"
                multiSeriesYAxisNameOverrides={{
                  0: L(isFa, "Inflation rate (% YoY)", `${faEconomic.inflation} (${faEconomic.yoyAnnual})`),
                }}
              />
              </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"} sections={inflationLearningSections(isFa)} />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {inflationSource ? (
                <SourceInfo
                  items={[
                    {
                      label: L(isFa, "CPI inflation", faEconomic.cpiInflation),
                      sourceName: inflationSource.name ?? "World Bank World Development Indicators",
                      sourceUrl: inflationSource.url ?? "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
                      sourceDetail: inflationSource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% change (annual)", "تغییر سالانه (٪)"),
                      unitNote: L(
                        isFa,
                        "Indicator FP.CPI.TOTL.ZG — inflation, consumer prices (annual %).",
                        "شاخص FP.CPI.TOTL.ZG — تورم، قیمت‌های مصرف‌کننده (٪ سالانه)."
                      ),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      Inflation here means the yearly change in consumer prices: when the line is high, prices climbed faster
                      that year; when it is below zero, average prices fell compared with the year before.
                    </p>
                    <p>
                      Comparing six economies on one chart highlights different inflation regimes over time; it does not by
                      itself explain causes (energy shocks, policy, exchange rates, etc.).
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isGdpGlobalComparison && gdpGlobalDisplayed ? (
            <>
              {gdpGlobalLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {gdpGlobalLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{gdpGlobalLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {gdpGlobalWdiLoading && !gdpGlobalLoadFailed && !gdpGlobalDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading World Bank GDP series…", `در حال بارگذاری سری ${faEconomic.gdp} بانک جهانی…`)}
                </p>
              ) : null}
              {gdpGlobalSeriesWarnings && Object.keys(gdpGlobalSeriesWarnings).length > 0 && gdpGlobalDataReady ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-4 max-w-3xl">
                  {L(isFa, "Some country series failed to load:", "بارگذاری برخی سری‌های کشور ناموفق بود:")}{" "}
                  {Object.entries(gdpGlobalSeriesWarnings)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </p>
              ) : null}
              {gdpGlobalDataReady ? (
              <>
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label: L(isFa, "United States", "ایالات متحده"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.us,
                  },
                  {
                    label: L(isFa, "China", "چین"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.china,
                  },
                  {
                    label: L(isFa, "Iran", "ایران"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.iran,
                  },
                  {
                    label: L(isFa, "Turkey", "ترکیه"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.turkey,
                  },
                  {
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.saudi_arabia,
                  },
                  {
                    label: L(isFa, "World", "جهان"),
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.world,
                  },
                ]}
                timeRange={gdpGlobalTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportPresentationTitle={
                  gdpGlobalDisplayMode === "indexed"
                    ? L(isFa, "GDP — indexed (2000 = 100)", `${faEconomic.gdp} — شاخص‌شده (۲۰۰۰ = ۱۰۰)`)
                    : L(isFa, "GDP — levels (US$)", `${faEconomic.gdp} — سطح (دلار)`)
                }
                exportSourceFooter={studyChartExportSource(isFa, [
                  gdpGlobalSource?.name ?? "World Bank World Development Indicators",
                  cpiDeflationExtraExport,
                ])}
                tooltipValueBasisNote={
                  gdpGlobalDisplayMode === "absolute" ? usdTooltipBasisNote : undefined
                }
                data={[]}
                valueKey="value"
                label={L(isFa, "GDP (total)", `${faEconomic.gdp} (کل)`)}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, gdpGlobalFilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                yAxisLog={gdpGlobalDisplayMode === "absolute" && gdpGlobalAbsoluteLog}
                yAxisNameSuffix={
                  gdpGlobalDisplayMode === "absolute" && gdpGlobalAbsoluteLog
                    ? L(isFa, "(log scale)", "(مقیاس لگاریتمی)")
                    : undefined
                }
                yAxisMin={gdpGlobalDisplayMode === "indexed" ? 0 : undefined}
                multiSeries={[
                  {
                    key: "us",
                    label: L(isFa, "United States", "ایالات متحده"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.us,
                    color: COUNTRY_COMPARATOR_STYLES.us.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.us.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "china",
                    label: L(isFa, "China", "چین"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.china,
                    color: COUNTRY_COMPARATOR_STYLES.china.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.china.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "iran",
                    label: L(isFa, "Iran", "ایران"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.iran,
                    color: COUNTRY_COMPARATOR_STYLES.iran.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.iran.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "turkey",
                    label: L(isFa, "Turkey", "ترکیه"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.turkey,
                    color: COUNTRY_COMPARATOR_STYLES.turkey.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.turkey.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "saudi_arabia",
                    label: L(isFa, "Saudi Arabia", "عربستان سعودی"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.saudi_arabia,
                    color: COUNTRY_COMPARATOR_STYLES.saudi_arabia.color,
                    symbol: COUNTRY_COMPARATOR_STYLES.saudi_arabia.symbol,
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "world",
                    label: L(isFa, "World", "جهان"),
                    yAxisIndex: 0,
                    unit:
                      gdpGlobalDisplayMode === "indexed"
                        ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                        : L(isFa, "US$ (WDI)", "دلار (WDI)"),
                    points: gdpGlobalDisplayed.world,
                    color: SIGNAL_COUNTRY.world,
                    symbol: "circle",
                    showSymbol: false,
                    lineWidth: 2.65,
                  },
                ]}
                timeRange={gdpGlobalTimeRange ?? study.timeRange}
                chartRangeGranularity="year"
                xAxisYearLabel={chartYearAxisLabel}
                exportFileStem="global-gdp-comparison"
                multiSeriesYAxisNameOverrides={{
                  0:
                    gdpGlobalDisplayMode === "indexed"
                      ? L(isFa, "GDP index (2000 = 100 when available)", `شاخص ${faEconomic.gdp} (۲۰۰۰ = ۱۰۰ در صورت وجود)`)
                      : L(isFa, "GDP (US$)", `${faEconomic.gdp} (دلار)`),
                }}
              />
              </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"} sections={gdpGlobalComparisonLearningSections(isFa)} />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {gdpGlobalSource ? (
                <SourceInfo
                  items={[
                    {
                      label: L(isFa, "GDP (total)", `${faEconomic.gdp} (کل)`),
                      sourceName: gdpGlobalSource.name ?? "World Bank World Development Indicators",
                      sourceUrl: gdpGlobalSource.url ?? "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD",
                      sourceDetail: gdpGlobalSource.publisher ?? "World Bank",
                      unitLabel:
                        gdpGlobalDisplayMode === "indexed"
                          ? L(isFa, "Index (2000 = 100)", "شاخص (۲۰۰۰ = ۱۰۰)")
                          : L(isFa, "US$ total GDP", `${faEconomic.gdp} کل به دلار`),
                      unitNote: L(
                        isFa,
                        gdpGlobalPerCountryIndicatorId
                          ? `Per economy WDI codes: ${Object.entries(gdpGlobalPerCountryIndicatorId)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join("; ")}.`
                          : "NY.GDP.MKTP.KD preferred; NY.GDP.MKTP.CD when KD missing for an economy.",
                        gdpGlobalPerCountryIndicatorId
                          ? `کدهای WDI به‌ازای هر اقتصاد: ${Object.entries(gdpGlobalPerCountryIndicatorId)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join("؛ ")}.`
                          : "ترجیح NY.GDP.MKTP.KD؛ در نبود KD برای یک اقتصاد از NY.GDP.MKTP.CD استفاده می‌شود."
                      ),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      GDP totals measure finished goods and services produced in a year. Dollar levels mix real growth,
                      prices, and (for international series) exchange-rate effects, so very large economies can visually flatten
                      smaller ones on one axis.
                    </p>
                    <p>
                      The default indexed view sets each country to 100 in calendar year 2000 when that year exists in WDI
                      for that series (otherwise an early usable base year), so you can compare relative expansion. The world
                      line is the Bank’s WLD aggregate—not the sum of the five countries.
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isIsiDiagnostics ? (
            <>
              {isiLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {isiLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{isiLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {isiWdiLoading && !isiLoadFailed && !isiDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading World Bank panel data…", "در حال بارگذاری دادهٔ پانل بانک جهانی…")}
                </p>
              ) : null}
              {isiSeriesWarnings && Object.keys(isiSeriesWarnings).length > 0 && isiDataReady ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-4 max-w-3xl">
                  {L(isFa, "Some country/indicator series failed to load:", "بارگذاری برخی سری‌ها ناموفق بود:")}{" "}
                  {Object.entries(isiSeriesWarnings)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </p>
              ) : null}
              {isiDataReady ? (
              <>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                <label className="text-muted-foreground shrink-0 flex flex-wrap items-center gap-2" htmlFor="isi-overview-focus-country">
                  <span>{L(isFa, "Overview country", "کشور برای نمای کلی")}</span>
                  <select
                    id="isi-overview-focus-country"
                    name="isi_overview_focus_country"
                    value={isiFocusCountry}
                    onChange={(e) => setIsiFocusCountry(e.target.value as IsiCountryKey)}
                    className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ISI_COUNTRY_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {isiCountryLabel(c, isFa)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {isiOverviewIndexed ? (
                <div className="space-y-2 mb-8 pb-8 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(
                      isFa,
                      "Overview — indexed trade & industry shares",
                      "نمای کلی — سهم‌های شاخص‌شدهٔ تجارت و صنعت"
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                    {L(
                      isFa,
                      `Each series is indexed to 100 in calendar year ${isiOverviewIndexed.baseYear} when that year has valid data for every line shown (otherwise the earliest common year with valid values for all four). The chart compares co-movement of structure, not absolute levels.`,
                      `هر سری به شاخص ۱۰۰ در سال ${localizeChartNumericDisplayString(String(isiOverviewIndexed.baseYear), "fa")} نرمال می‌شود (اگر آن سال برای همهٔ خطوط معتبر نباشد، نزدیک‌ترین سال مشترک با مقادیر معتبر). این نما هم‌حرکتی ساختار را نشان می‌دهد، نه سطح مطلق.`
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — overview (indexed)`,
                      `${displayStudy.title} — نمای کلی (شاخص‌شده)`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      isiDiagnosticsData?.source?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Indexed overview (100 = base year)", "نمای شاخص‌شده (۱۰۰ = سال مبنا)")}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, isiFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={isiOverviewIndexed.multiSeries.map((s) => ({
                      ...s,
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    }))}
                    timeRange={isiTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    multiSeriesYAxisNameOverrides={{
                      0: isFa
                        ? `شاخص (${localizeChartNumericDisplayString(String(isiOverviewIndexed.baseYear), "fa")} = ۱۰۰)`
                        : `Index (${isiOverviewIndexed.baseYear} = 100)`,
                    }}
                    exportFileStem="isi-overview-indexed"
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
              ) : null}
              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(
                      isFa,
                      "1. Trade structure (imports vs exports, % of GDP)",
                      `۱. ساختار تجارت (${faEconomic.imports} در برابر ${faEconomic.exports}، ${faEconomic.gdpPctUnit})`
                    )}
                  </h3>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(isFa, "ISI — Trade (% of GDP)", `ISI — تجارت (${faEconomic.gdpPctUnit})`)}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      isiDiagnosticsData?.source?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Trade, % of GDP", `تجارت، ${faEconomic.gdpPctUnit}`)}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, isiFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={isiTradeMultiSeries.map((s) => ({
                      ...s,
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    }))}
                    timeRange={isiTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="isi-trade-structure"
                    multiSeriesYAxisNameOverrides={{
                      0: L(isFa, "Share of GDP (%)", faEconomic.gdpPctUnit),
                    }}
                    multiSeriesLegendLayout="grouped"
                    multiSeriesLegendGroupedVariant="country"
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(
                      isFa,
                      "2. Industrial structure (manufacturing & industry, % of GDP)",
                      `۲. ${faEconomic.manufacturingIndustryPanelTitle}`
                    )}
                  </h3>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      "ISI — Industry (% of GDP)",
                      `ISI — ${faEconomic.manufacturingIndustryPanelTitle}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      isiDiagnosticsData?.source?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Industry, % of GDP", `صنعت، ${faEconomic.gdpPctUnit}`)}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, isiFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={isiIndustrialMultiSeries.map((s) => ({
                      ...s,
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    }))}
                    timeRange={isiTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="isi-industrial-structure"
                    multiSeriesYAxisNameOverrides={{
                      0: L(isFa, "Share of GDP (%)", faEconomic.gdpPctUnit),
                    }}
                    multiSeriesLegendLayout="grouped"
                    multiSeriesLegendGroupedVariant="country"
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "3. Outcome — Real GDP growth (annual %)", `۳. پیامد — ${faEconomic.realGdpGrowth} (٪ سالانه)`)}
                  </h3>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — Real GDP growth`,
                      `${displayStudy.title} — ${faEconomic.realGdpGrowth}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      isiDiagnosticsData?.source?.name ?? "World Bank World Development Indicators",
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Real GDP growth (annual %)", `${faEconomic.realGdpGrowth} (٪ سالانه)`)}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, isiFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={isiGdpGrowthMultiSeries.map((s) => ({
                      ...s,
                      symbolSize: CHART_LINE_SYMBOL_SIZE,
                    }))}
                    timeRange={isiTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="isi-gdp-growth"
                    multiSeriesYAxisNameOverrides={{
                      0: L(isFa, "Annual growth (%)", "رشد سالانه (٪)"),
                    }}
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
              </div>
              </>
              ) : null}
              <LearningNote
                locale={isFa ? "fa" : "en"}
                sections={isiDiagnosticsLearningSections(isFa)}
                links={[
                  {
                    label: L(isFa, "Learning: import substitution (ISI)", "یادگیری: جایگزینی واردات (ISI)"),
                    href: "/learning#import-substitution-industrialization",
                  },
                ]}
              />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {isiDiagnosticsData?.source && isiDiagnosticsData.indicator_ids ? (
                <SourceInfo
                  items={[
                    {
                      label: L(isFa, "Imports (% of GDP)", `${faEconomic.imports} — ${faEconomic.gdpPctUnit}`),
                      sourceName: isiDiagnosticsData.source.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${isiDiagnosticsData.indicator_ids.imports_pct_gdp}`,
                      sourceDetail: isiDiagnosticsData.source.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                      unitNote: L(isFa, "NE.IMP.GNFS.ZS", "NE.IMP.GNFS.ZS"),
                    },
                    {
                      label: L(isFa, "Exports (% of GDP)", `${faEconomic.exports} — ${faEconomic.gdpPctUnit}`),
                      sourceName: isiDiagnosticsData.source.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${isiDiagnosticsData.indicator_ids.exports_pct_gdp}`,
                      sourceDetail: isiDiagnosticsData.source.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                      unitNote: L(isFa, "NE.EXP.GNFS.ZS", "NE.EXP.GNFS.ZS"),
                    },
                    {
                      label: L(isFa, "Manufacturing (% of GDP)", faEconomic.manufacturingPctGdp),
                      sourceName: isiDiagnosticsData.source.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${isiDiagnosticsData.indicator_ids.manufacturing_pct_gdp}`,
                      sourceDetail: isiDiagnosticsData.source.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                      unitNote: L(isFa, "NV.IND.MANF.ZS", "NV.IND.MANF.ZS"),
                    },
                    {
                      label: L(isFa, "Industry (% of GDP)", faEconomic.industryPctGdp),
                      sourceName: isiDiagnosticsData.source.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${isiDiagnosticsData.indicator_ids.industry_pct_gdp}`,
                      sourceDetail: isiDiagnosticsData.source.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of GDP", faEconomic.gdpPctUnit),
                      unitNote: L(isFa, "NV.IND.TOTL.ZS", "NV.IND.TOTL.ZS"),
                    },
                    {
                      label: L(isFa, "Real GDP growth (annual %)", `${faEconomic.realGdpGrowth} (٪ سالانه)`),
                      sourceName: isiDiagnosticsData.source.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${isiDiagnosticsData.indicator_ids.gdp_growth_pct}`,
                      sourceDetail: isiDiagnosticsData.source.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% change", "تغییر (٪)"),
                      unitNote: L(isFa, "NY.GDP.MKTP.KD.ZG", "NY.GDP.MKTP.KD.ZG"),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      {L(
                        isFa,
                        "Import substitution industrialization (ISI) is a development strategy that favors domestic production over imports—often supported by tariffs, licensing, or directed credit—so you might expect industrial shares to rise while import intensity falls, at least for a period.",
                        "صنعتی‌سازی جایگزین واردات (ISI) تلاشی برای تقویت تولید داخلی در برابر واردات است—اغلب با تعرفه یا محدودیت—بنابراین ممکن است برای مدتی سهم صنعت بالا برود و شدت واردات کم شود."
                      )}
                    </p>
                    <p>
                      {L(
                        isFa,
                        "These charts do not prove causality. Use the indexed overview for pattern timing; use raw % of GDP panels for levels; GDP growth is a coarse outcome measure. Compare Brazil, Argentina, India, Turkey, and Iran on the same definitions from WDI.",
                        "این نمودها علیت را ثابت نمی‌کنند. نمای شاخص‌شده برای زمان‌بندی الگو؛ پانل‌های خام به‌صورت درصدی از تولید ناخالص داخلی برای سطح؛ رشد واقعی سالانهٔ تولید ناخالص داخلی معیار خشن پیامد است. برزیل، آرژانتین، هند، ترکیه و ایران با تعاریف یکسان WDI مقایسه می‌شوند."
                      )}
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isIranMoneySupplyM2 ? (
            <>
              {moneySupplyLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {moneySupplyLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{moneySupplyLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {moneySupplyWdiLoading && !moneySupplyLoadFailed && !moneySupplyDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(
                    isFa,
                    "Loading money supply and CPI series…",
                    `در حال بارگذاری سری ${faEconomic.m2Growth} و ${faEconomic.cpiInflation}…`
                  )}
                </p>
              ) : null}
              {moneySupplyDataReady ? (
              <>
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label: L(isFa, "Broad money growth (M2)", faEconomic.m2Growth),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: moneySupplyM2Points,
                  },
                  {
                    label: L(isFa, "CPI inflation — Iran (WDI)", `${faEconomic.cpiInflation} — ایران (WDI)`),
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: moneySupplyCpiPoints,
                  },
                ]}
                timeRange={moneySupplyTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportPresentationTitle={L(
                  isFa,
                  "Broad money growth (annual %)",
                  `${faEconomic.m2Growth} (٪ سالانه)`
                )}
                exportSourceFooter={studyChartExportSource(isFa, [
                  moneySupplyCitation
                    ? isFa
                      ? moneySupplyCitation.fa
                      : moneySupplyCitation.en
                    : null,
                ])}
                data={[]}
                valueKey="value"
                label={L(isFa, "Broad money growth", faEconomic.m2Growth)}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, moneySupplyFilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "m2",
                    label: L(
                      isFa,
                      "M2 growth (WDI/IFS through 2016; 2017+ = CBI-style liquidity YoY)",
                      faEconomic.m2Growth
                    ),
                    yAxisIndex: 0,
                    unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                    points: moneySupplyM2Points,
                    color: SIGNAL_CONCEPT.broad_money_m2,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                  },
                ]}
                timeRange={moneySupplyTimeRange ?? study.timeRange}
                chartRangeGranularity="year"
                xAxisYearLabel={chartYearAxisLabel}
                forceTimeAxis
                exportFileStem="iran-m2-growth"
                multiSeriesYAxisNameOverrides={{
                  0: L(isFa, "Growth rate (% YoY)", "نرخ رشد (٪ نسبت به سال قبل)"),
                }}
              />
              <IranMoneySupplyMethodology isFa={isFa} />
              <div className="space-y-2 border-t border-border pt-8 mt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {L(
                    isFa,
                    "M2 growth vs CPI inflation (same calendar year)",
                    `${faEconomic.m2Growth} در برابر ${faEconomic.cpiInflation} (همان سال میلادی)`
                  )}
                </h3>
                <p className="text-xs text-muted-foreground max-w-3xl">
                  {L(
                    isFa,
                    "Both series use the same WDI year alignment. CPI can extend after M2 stops; compare only overlapping years for timing statements.",
                    `هر دو سری WDI و سال میلادی یکسان‌اند. ${faEconomic.cpiInflation} ممکن است پس از توقف دادهٔ ${faEconomic.m2Growth} ادامه یابد؛ برای زمان‌بندی فقط سال‌های هم‌پوشان را در نظر بگیرید.`
                  )}
                </p>
                <TimelineChart
                  chartLocale={chartLocaleForCharts}
                  exportPresentationStudyHeading={displayStudy.title}
                  exportPresentationTitle={L(
                    isFa,
                    "M2 growth and CPI inflation (Iran)",
                    `${faEconomic.m2Growth} و ${faEconomic.cpiInflation} (ایران)`
                  )}
                  exportSourceFooter={studyChartExportSource(isFa, [
                    moneySupplyCitation
                      ? isFa
                        ? moneySupplyCitation.fa
                        : moneySupplyCitation.en
                      : null,
                    L(
                      isFa,
                      "CPI: WDI FP.CPI.TOTL.ZG (Iran, annual %).",
                      "CPI: WDI FP.CPI.TOTL.ZG (ایران، ٪ سالانه)."
                    ),
                  ])}
                  data={[]}
                  valueKey="value"
                  label={L(isFa, "Liquidity vs prices", `${faEconomic.m2Growth} و ${faEconomic.cpiInflation}`)}
                  events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, moneySupplyFilteredEvents)}
                  anchorEventId={anchorEventId || undefined}
                  multiSeries={[
                    {
                      key: "m2_cmp",
                      label: L(isFa, "Broad money growth", faEconomic.m2Growth),
                      yAxisIndex: 0,
                      unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                      points: moneySupplyM2Points,
                      color: SIGNAL_CONCEPT.broad_money_m2,
                      symbol: "circle",
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                    {
                      key: "cpi_iran",
                      label: L(isFa, "CPI inflation (Iran)", `${faEconomic.cpiInflation} (ایران)`),
                      yAxisIndex: 0,
                      unit: L(isFa, "% YoY", "٪ نسبت به سال قبل"),
                      points: moneySupplyCpiPoints,
                      color: SIGNAL_CONCEPT.inflation,
                      symbol: "diamond",
                      symbolSize: CHART_LINE_SYMBOL_SIZE_MINI,
                    },
                  ]}
                  timeRange={moneySupplyTimeRange ?? study.timeRange}
                  chartRangeGranularity="year"
                  xAxisYearLabel={chartYearAxisLabel}
                  forceTimeAxis
                  exportFileStem="iran-m2-vs-cpi"
                  multiSeriesYAxisNameOverrides={{
                    0: L(isFa, "Percent per year", "درصد در سال"),
                  }}
                />
              </div>
              </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"} sections={moneySupplyM2LearningSections(isFa)} />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {moneySupplyWdiSource && moneySupplyIndicatorIds ? (
                <SourceInfo
                  note={L(
                    isFa,
                    "پس از ۲۰۱۶: نرخ رشد از سطوح نقدینگی به‌سبک بانک مرکزی (٪نسبت به سال قبل)؛ جزییات در بلوک روش‌شناسی فوق.",
                    "Post-2016: values derived from CBI-style year-end liquidity (YoY); see Methodology (Post-2016 Extension) above."
                  )}
                  items={[
                    {
                      label: L(isFa, "Broad money growth", faEconomic.m2Growth),
                      sourceName: moneySupplyWdiSource.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${moneySupplyIndicatorIds.broad_money_growth}`,
                      sourceDetail: moneySupplyWdiSource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% per year (YoY)", "٪ در سال (نسبت به سال قبل)"),
                      unitNote: L(
                        isFa,
                        (() => {
                          const w = moneySupplyCoverage?.broad_money_wdi;
                          const c = moneySupplyCoverage?.broad_money_cbi_liquidity_yoy;
                          const tot = moneySupplyCoverage?.broad_money;
                          const parts: string[] = [];
                          if (w)
                            parts.push(
                              `M2: WDI FM.LBL.BMNY.ZG ${w.first_year}–${w.last_year}; IFS. 2017+: CBI-style liquidity–derived YoY ${c ? `${c.first_year}–${c.last_year}` : ""} (static file, continuity est.).`
                            );
                          if (tot && c)
                            parts.push(
                              `Combined M2 line on chart: ${tot.first_year}–${tot.last_year} in this window.`
                            );
                          return (
                            parts.join(" ") ||
                            "M2: WDI/IFS through 2016; 2017+ = CBI-style liquidity YoY (see methodology and export footer)."
                          );
                        })(),
                        (() => {
                          const w = moneySupplyCoverage?.broad_money_wdi;
                          const c = moneySupplyCoverage?.broad_money_cbi_liquidity_yoy;
                          const tot = moneySupplyCoverage?.broad_money;
                          const parts: string[] = [];
                          if (w)
                            parts.push(
                              `M2: WDI ${w.first_year}–${w.last_year}؛ IFS. ۲۰۱۷+: ٪نقدینگی به‌سبک بانک مرکزی ${c ? `${c.first_year}–${c.last_year}` : ""} (فایل ثابت، تخمین تداوم).`
                            );
                          if (tot && c)
                            parts.push(
                              `خط ترکیبی در نمودار: ${tot.first_year}–${tot.last_year} در این پنجره.`
                            );
                          return (
                            parts.join(" ") ||
                            "M2: WDI/IFS تا ۲۰۱۶؛ ۲۰۱۷+ = ٪نقدینگی به‌سبک بانک (روش‌شناسی و پاورقی خروج را ببینید)."
                          );
                        })()
                      ),
                    },
                    {
                      label: L(isFa, "CPI inflation (Iran)", `${faEconomic.cpiInflation} (ایران)`),
                      sourceName: moneySupplyWdiSource.name ?? "World Bank World Development Indicators",
                      sourceUrl: `https://data.worldbank.org/indicator/${moneySupplyIndicatorIds.cpi_inflation_yoy_iran}`,
                      sourceDetail: moneySupplyWdiSource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% per year (YoY)", "٪ در سال (نسبت به سال قبل)"),
                      unitNote: L(
                        isFa,
                        moneySupplyCoverage?.cpi_inflation_iran
                          ? `Coverage in WDI: ${moneySupplyCoverage.cpi_inflation_iran.first_year}–${moneySupplyCoverage.cpi_inflation_iran.last_year}.`
                          : "Coverage: see WDI (FP.CPI.TOTL.ZG) for Iran.",
                        moneySupplyCoverage?.cpi_inflation_iran
                          ? `پوشش در WDI: ${moneySupplyCoverage.cpi_inflation_iran.first_year}–${moneySupplyCoverage.cpi_inflation_iran.last_year}.`
                          : "پوشش: WDI (FP.CPI.TOTL.ZG) ایران."
                      ),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      {L(
                        isFa,
                        "Money supply growth means how fast the amount of money and spendable deposits in the economy is increasing. It is often tracked with broad money (M2). High growth can add to inflation pressure, but the link is not always immediate or one-to-one—output, expectations, and the exchange environment also matter.",
                        "رشد نقدینگی یعنی سرعت افزایش حجم پول و سپرده‌های قابل خرج در اقتصاد — اغلب با پول وسیع (M2) دنبال می‌شود. رشد تند می‌تواند به فشار تورمی کمک کند اما ارتباط همیشه سریع یا یک‌به‌یک نیست."
                      )}
                    </p>
                    <p>
                      {L(
                        isFa,
                        "The second chart places CPI inflation on the same year as M2 to see whether liquidity changes line up with price changes. Event markers are optional context only.",
                        "نمودار دوم تورم را کنار M2 در همان سال می‌گذارد تا ببینید تغییرات نقدینگی با تغییرات قیمت چقدر هم‌زمان‌اند. نشانگرهای رویداد اختیاری و صرفاً زمینه‌اند."
                      )}
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isPovertyHeadcountIran ? (
            <>
              {povertyLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {povertyLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{povertyLoadDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {povertyWdiLoading && !povertyLoadFailed && !povertyDataReady ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading World Bank poverty headcount series…", "در حال بارگذاری سری شمارش فقر بانک جهانی…")}
                </p>
              ) : null}
              {povertyDataReady ? (
              <>
              <MultiSeriesStats
                locale={isFa ? "fa" : "en"}
                series={[
                  {
                    label:
                      povertyDdayLineLabel ||
                      L(isFa, "Line 1 (SI.POV.DDAY)", "خط ۱ (SI.POV.DDAY)"),
                    unit: L(isFa, "% of population", "٪ از جمعیت"),
                    points: povertyDdayPoints,
                  },
                  {
                    label:
                      povertyLmicLineLabel ||
                      L(isFa, "Line 2 (SI.POV.LMIC)", "خط ۲ (SI.POV.LMIC)"),
                    unit: L(isFa, "% of population", "٪ از جمعیت"),
                    points: povertyLmicPoints,
                  },
                ]}
                timeRange={povertyTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                exportSourceFooter={studyChartExportSource(isFa, [
                  povertySource?.name ?? "World Bank World Development Indicators",
                ])}
                data={[]}
                valueKey="value"
                label={L(isFa, "Poverty headcount ratio", "نرخ شمارش فقر")}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, povertyFilteredEvents)}
                anchorEventId={anchorEventId || undefined}
                multiSeries={[
                  {
                    key: "pov_dday",
                    label: povertyDdayLineLabel || "SI.POV.DDAY",
                    yAxisIndex: 0,
                    unit: L(isFa, "% of population", "٪ از جمعیت"),
                    points: povertyDdayPoints,
                    color: SIGNAL_CONCEPT.gini,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "pov_lmic",
                    label: povertyLmicLineLabel || "SI.POV.LMIC",
                    yAxisIndex: 0,
                    unit: L(isFa, "% of population", "٪ از جمعیت"),
                    points: povertyLmicPoints,
                    color: SIGNAL_CONCEPT.poverty,
                    symbol: "diamond",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                timeRange={povertyTimeRange ?? study.timeRange}
                chartRangeGranularity="year"
                xAxisYearLabel={chartYearAxisLabel}
                forceTimeAxis
                exportFileStem="poverty-rate"
                multiSeriesYAxisNameOverrides={{
                  0: L(isFa, "Poverty rate (% of population)", "نرخ فقر (٪ از جمعیت)"),
                }}
                dataCoverageGapMarkArea={povertyPageCoverageExtras?.gapMarkArea}
                dataCoverageLastMarkLine={
                  povertyPageCoverageExtras?.lastMarkLineX
                    ? {
                        xAxis: povertyPageCoverageExtras.lastMarkLineX,
                        label: L(isFa, "Last available data", "آخرین داده موجود"),
                      }
                    : undefined
                }
              />
              {povertyPageCoverageExtras?.lines.length ? (
                <div className="mt-2 space-y-0.5 max-w-3xl">
                  {povertyPageCoverageExtras.lines.map((ln, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                      {L(isFa, ln.en, ln.fa)}
                    </p>
                  ))}
                </div>
              ) : null}
              </>
              ) : null}
              <LearningNote locale={isFa ? "fa" : "en"} sections={povertyLearningSections(isFa)} />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              {povertySource ? (
                <SourceInfo
                  items={[
                    {
                      label: povertyDdayLineLabel || "SI.POV.DDAY",
                      sourceName: povertySource.name ?? "World Bank World Development Indicators",
                      sourceUrl:
                        povertyDdayIndicatorId !== ""
                          ? `https://data.worldbank.org/indicator/${povertyDdayIndicatorId}`
                          : (povertySource.url ?? "https://data.worldbank.org/indicator/SI.POV.DDAY"),
                      sourceDetail: povertySource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of population", "٪ از جمعیت"),
                      unitNote: L(
                        isFa,
                        `Indicator ${povertyDdayIndicatorId || "SI.POV.DDAY"} — poverty headcount ratio.`,
                        `شاخص ${povertyDdayIndicatorId || "SI.POV.DDAY"} — نسبت شمارش فقر.`
                      ),
                    },
                    {
                      label: povertyLmicLineLabel || "SI.POV.LMIC",
                      sourceName: povertySource.name ?? "World Bank World Development Indicators",
                      sourceUrl:
                        povertyLmicIndicatorId !== ""
                          ? `https://data.worldbank.org/indicator/${povertyLmicIndicatorId}`
                          : "https://data.worldbank.org/indicator/SI.POV.LMIC",
                      sourceDetail: povertySource.publisher ?? "World Bank",
                      unitLabel: L(isFa, "% of population", "٪ از جمعیت"),
                      unitNote: L(
                        isFa,
                        `Indicator ${povertyLmicIndicatorId || "SI.POV.LMIC"} — poverty headcount ratio.`,
                        `شاخص ${povertyLmicIndicatorId || "SI.POV.LMIC"} — نسبت شمارش فقر.`
                      ),
                    },
                  ]}
                />
              ) : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      Each line answers: what fraction of people in Iran lived below a specific international consumption
                      poverty line in a given year, according to World Bank harmonized estimates.
                    </p>
                    <p>
                      Event markers are optional background only; they do not by themselves explain year-to-year changes in
                      survey-based poverty statistics.
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isIranEconomyReconstruction1368 ? (
            <>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 max-w-3xl mb-6 text-sm leading-relaxed text-foreground">
                <p className="font-medium mb-1 text-foreground">{L(isFa, "Historical context", "زمینهٔ تاریخی")}</p>
                <p>
                  {L(
                    isFa,
                    "This study focuses on Iran’s post-war reconstruction period under President Akbar Hashemi Rafsanjani. It is intended as an exploratory economic history view, not a causal model.",
                    "«این مطالعه بر دوره بازسازی پس از جنگ در دوران ریاست‌جمهوری اکبر هاشمی رفسنجانی تمرکز دارد. هدف آن ارائه یک نمای اکتشافی از تاریخ اقتصادی است، نه مدل‌سازی علّی.»"
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                  {L(isFa, "Range: 1368–1376 SH (≈1989–1997 CE)", "بازه: ۱۳۶۸–۱۳۷۶ ش (حدود ۱۹۸۹–۱۹۹۷ میلادی)")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl mb-4">
                {L(isFa, enEconomic.annualWdiVsMarketNoteEn, faEconomic.annualWdiVsMarketNoteFa)}
              </p>
              {recoLoading && !recoLoadFailed ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {L(isFa, "Loading macro series…", "در حال بارگذاری سری‌های کلان…")}
                </p>
              ) : null}
              {recoLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {recoLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{recoLoadDetail}</p>
                  ) : null}
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
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Inflation`,
                            `${displayStudy.title} — ${faEconomic.inflation}`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoInflationSource?.name ?? "World Bank WDI",
                            "FP.CPI.TOTL.ZG",
                          ])}
                          data={recoInflationIranPoints}
                          valueKey="value"
                          label={L(isFa, "CPI inflation", "تورم")}
                          unit="%"
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-inflation"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          seriesColor="hsl(0, 84%, 59%)"
                          gridLeft={80}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
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
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Real GDP growth`,
                            `${displayStudy.title} — ${faEconomic.realGdpGrowth}`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoIsiSource?.name ?? "World Bank WDI",
                            recoIsiIndicatorIds?.gdp_growth_pct ?? "NY.GDP.MKTP.KD.ZG",
                          ])}
                          data={recoGdpGrowthPoints}
                          valueKey="value"
                          label={L(isFa, "Real GDP growth", "رشد GDP")}
                          unit="%"
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-gdp-growth"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          seriesColor="hsl(217, 91%, 59%)"
                          gridLeft={80}
                          regimeArea={recoWelfareRegimeArea}
                          focusGregorianYearRange={{
                            startYear: reconstructionGregorianYearBounds.start,
                            endYear: reconstructionGregorianYearBounds.end,
                          }}
                          focusHoverHint={{
                            en: "Inside focus period",
                            fa: "داخل دورهٔ تمرکز",
                          }}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2 space-y-1.5">
                      <CardTitle className="text-base font-semibold">
                        {recoGdpDecompMode === "real"
                          ? L(
                              isFa,
                              "GDP decomposition: oil rents vs non-oil GDP (real)",
                              "تفکیک GDP: رانت نفتی و GDP غیرنفتی (واقعی)"
                            )
                          : L(isFa, "GDP decomposition: oil rents vs non-oil GDP", "تفکیک GDP: رانت نفتی و GDP غیرنفتی")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                        {recoGdpDecompMode === "real"
                          ? L(
                              isFa,
                              "Inflation-adjusted proxy using constant-price GDP and WDI oil rents as a share of GDP. Not an official non-oil GDP series.",
                              "«تفکیک تقریبیِ تعدیل‌شده با تورم، با استفاده از GDP به قیمت ثابت و سهم رانت نفتی در داده‌های WDI. این سری، GDP غیرنفتی رسمی نیست.»"
                            )
                          : L(
                              isFa,
                              "This is a proxy decomposition using WDI oil rents as a share of GDP. It should not be read as an official non-oil GDP series.",
                              "«این تفکیک تقریبی است و از سهم رانت نفتی در GDP بر اساس داده‌های WDI ساخته شده است. نباید آن را معادل سری رسمی GDP غیرنفتی دانست.»"
                            )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recoGdpDecompMode === "real"
                          ? L(
                              isFa,
                              "WDI NY.GDP.MKTP.KD (GDP, constant 2015 US$) × NY.GDP.PETR.RT.ZS (oil rents % of GDP).",
                              "WDI NY.GDP.MKTP.KD (GDP، دلار ثابت ۲۰۱۵) × NY.GDP.PETR.RT.ZS (رانت نفتی٪ GDP)."
                            )
                          : L(
                              isFa,
                              "WDI NY.GDP.MKTP.CD (GDP, current US$) × NY.GDP.PETR.RT.ZS (oil rents % of GDP) — nominal levels only.",
                              "WDI NY.GDP.MKTP.CD (GDP، دلار جاری) × NY.GDP.PETR.RT.ZS (رانت نفتی٪ GDP) — فقط سطح اسمی."
                            )}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoLoading && !recoLoadFailed ? (
                        <div className="space-y-2" aria-live="polite">
                          <p className="text-xs text-muted-foreground">
                            {L(isFa, "Loading data…", "در حال بارگذاری داده‌ها…")}
                          </p>
                          <GdpDecompositionChartSkeleton />
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
                      ) : reconstructionSelectedGdpDecompositionMultiSeries ? (
                        <div className="space-y-0">
                          <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                            <button
                              type="button"
                              onClick={() => setRecoGdpDecompMode("nominal")}
                              className={`px-2.5 py-1 text-xs rounded ${
                                recoGdpDecompMode === "nominal"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {L(isFa, "Nominal", "اسمی")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecoGdpDecompMode("real")}
                              className={`px-2.5 py-1 text-xs rounded ${
                                recoGdpDecompMode === "real"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {L(isFa, "Real", "واقعی")}
                            </button>
                          </div>
                          <TimelineChart
                            chartLocale={chartLocaleForCharts}
                            exportPresentationStudyHeading={displayStudy.title}
                            exportPresentationTitle={L(
                              isFa,
                              recoGdpDecompMode === "real"
                                ? `${displayStudy.title} — GDP decomposition (real)`
                                : `${displayStudy.title} — GDP decomposition (nominal)`,
                              recoGdpDecompMode === "real"
                                ? `${displayStudy.title} — تفکیک GDP (واقعی)`
                                : `${displayStudy.title} — تفکیک GDP (اسمی)`
                            )}
                            exportSourceFooter={studyChartExportSource(isFa, [
                              recoDemandNominalSource?.name ?? "World Bank WDI",
                              recoGdpDecompMode === "real"
                                ? recoDemandIndicatorIds?.gdp_kd ?? "NY.GDP.MKTP.KD"
                                : recoDemandIndicatorIds?.gdp_usd ?? "NY.GDP.MKTP.CD",
                              recoDemandIndicatorIds?.oil_rents_pct_gdp ?? "NY.GDP.PETR.RT.ZS",
                              recoGdpDecompMode === "real"
                                ? "Derived: NY.GDP.MKTP.KD×NY.GDP.PETR.RT.ZS/100"
                                : recoDemandIndicatorIds?.gdp_oil_proxy_usd ?? "Derived: NY.GDP.MKTP.CD×NY.GDP.PETR.RT.ZS/100",
                              recoGdpDecompMode === "real"
                                ? "Derived: NY.GDP.MKTP.KD−(NY.GDP.MKTP.KD×NY.GDP.PETR.RT.ZS/100)"
                                : recoDemandIndicatorIds?.gdp_non_oil_proxy_usd ??
                                  "Derived: NY.GDP.MKTP.CD−(NY.GDP.MKTP.CD×NY.GDP.PETR.RT.ZS/100)",
                            ])}
                            data={[]}
                            valueKey="value"
                            label={L(
                              isFa,
                              recoGdpDecompMode === "real" ? "GDP decomposition (real)" : "GDP decomposition (nominal)",
                              recoGdpDecompMode === "real" ? "تفکیک GDP (واقعی)" : "تفکیک GDP (اسمی)"
                            )}
                            events={reconstructionChartEvents}
                            multiSeries={reconstructionSelectedGdpDecompositionMultiSeries}
                            timeRange={reconstructionTimeRange ?? study.timeRange}
                            chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                            chartRangeGranularity="year"
                            forceTimeRangeAxis
                            xAxisYearLabel={chartYearAxisLabel}
                            exportFileStem={
                              recoGdpDecompMode === "real"
                                ? "iran-reco-gdp-decomposition-real"
                                : "iran-reco-gdp-decomposition-nominal"
                            }
                            showChartControls
                            chartHeight="h-56 md:h-64"
                            mutedEventLines
                            multiSeriesValueFormat="gdp_absolute"
                            multiSeriesYAxisNameOverrides={{
                              0:
                                recoGdpDecompMode === "real"
                                  ? L(isFa, "GDP (constant 2015 US$)", "تولید ناخالص داخلی (دلار ثابت ۲۰۱۵)")
                                  : L(isFa, "GDP (current US$)", "تولید ناخالص داخلی (دلار جاری آمریکا)"),
                            }}
                            regimeArea={recoWelfareRegimeArea}
                            focusGregorianYearRange={{
                              startYear: reconstructionGregorianYearBounds.start,
                              endYear: reconstructionGregorianYearBounds.end,
                            }}
                            focusHoverHint={{
                              en: "Inside focus period",
                              fa: "داخل دورهٔ تمرکز",
                            }}
                            gridLeft={80}
                          />
                          {reconstructionSelectedGdpDecompPartialNote ? (
                            <p className="text-xs text-muted-foreground mt-2 max-w-3xl leading-relaxed">
                              {reconstructionSelectedGdpDecompPartialNote}
                            </p>
                          ) : null}
                        </div>
                      ) : (recoGdpDecompMode === "real" ? recoDemandRealGdpPoints.length : recoDemandGdpPoints.length) > 0 ? (
                        <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                          {L(
                            isFa,
                            recoGdpDecompMode === "real"
                              ? "No overlapping real-GDP and oil-rents data for this window (join uses Gregorian calendar years)."
                              : "No overlapping GDP and oil-rents data for this window (join uses Gregorian calendar years).",
                            recoGdpDecompMode === "real"
                              ? "برای این بازه دادهٔ هم‌پوشان GDP واقعی و رانت نفتی (با کلید سال میلادی) وجود ندارد."
                              : "برای این بازه دادهٔ هم‌پوشان GDP و رانت نفتی (با کلید سال میلادی) وجود ندارد."
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
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(
                          isFa,
                          recoDemandMode === "real"
                            ? "3. Consumption, investment, and GDP (real)"
                            : "3. Consumption, investment, and GDP (nominal)",
                          recoDemandMode === "real"
                            ? `۳. مصرف، سرمایه‌گذاری و تولید ناخالص داخلی (واقعی)`
                            : `۳. مصرف، سرمایه‌گذاری و تولید ناخالص داخلی (اسمی)`
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground max-w-3xl">
                        {recoDemandMode === "real"
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
                    <CardContent className="pt-0">
                      <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                        <button
                          type="button"
                          onClick={() => setRecoDemandMode("nominal")}
                          className={`px-2.5 py-1 text-xs rounded ${
                            recoDemandMode === "nominal"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {L(isFa, "Nominal", "اسمی")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecoDemandMode("real")}
                          className={`px-2.5 py-1 text-xs rounded ${
                            recoDemandMode === "real"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {L(isFa, "Real", "واقعی")}
                        </button>
                      </div>
                      {(recoDemandMode === "real" ? reconstructionHasRealDemandData : reconstructionHasNominalDemandData) ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            recoDemandMode === "real"
                              ? `${displayStudy.title} — Consumption, investment, GDP (real)`
                              : `${displayStudy.title} — Consumption, investment, GDP (nominal)`,
                            recoDemandMode === "real"
                              ? `${displayStudy.title} — مصرف، سرمایه‌گذاری و GDP (واقعی)`
                              : `${displayStudy.title} — مصرف، سرمایه‌گذاری و GDP (اسمی)`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoDemandNominalSource?.name ?? "World Bank WDI",
                            recoDemandMode === "real"
                              ? recoDemandIndicatorIds?.consumption_kd ?? "NE.CON.TOTL.KD"
                              : recoDemandIndicatorIds?.consumption_usd ?? "NE.CON.TOTL.CD",
                            recoDemandMode === "real"
                              ? recoDemandIndicatorIds?.investment_kd ?? "NE.GDI.TOTL.KD"
                              : recoDemandIndicatorIds?.investment_usd ?? "NE.GDI.TOTL.CD",
                            recoDemandMode === "real"
                              ? recoDemandIndicatorIds?.gdp_kd ?? "NY.GDP.MKTP.KD"
                              : recoDemandIndicatorIds?.gdp_usd ?? "NY.GDP.MKTP.CD",
                          ])}
                          data={[]}
                          valueKey="value"
                          label={L(
                            isFa,
                            recoDemandMode === "real" ? "Real demand aggregates" : "Nominal demand aggregates",
                            recoDemandMode === "real" ? "جمع تقاضای واقعی" : "جمع تقاضای اسمی"
                          )}
                          events={reconstructionChartEvents}
                          multiSeries={reconstructionSelectedDemandMultiSeries}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          forceTimeRangeAxis
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem={recoDemandMode === "real" ? "iran-reco-demand-real" : "iran-reco-demand-nominal"}
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          multiSeriesValueFormat="gdp_absolute"
                          multiSeriesYAxisNameOverrides={{
                            0:
                              recoDemandMode === "real"
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
                              recoDemandMode === "real"
                                ? L(isFa, "GDP (constant US$)", "تولید ناخالص داخلی (دلار ثابت)")
                                : L(isFa, "GDP (current US$)", "تولید ناخالص داخلی (دلار جاری آمریکا)"),
                          }}
                        />
                      ) : reconstructionHasNominalDemandData ? (
                        <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                          {L(
                            isFa,
                            "Constant-price (real) series did not load (empty response). The nominal chart above uses an older-compatible payload; deploy the latest SignalMap API (bundle with NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD) and hard-refresh, or wait for CDN cache to expire.",
                            "سری‌های قیمت ثابت (واقعی) بارگذاری نشدند (پاسخ خالی). نمودار اسمی بالا با پاسخ قدیمی‌تر سازگار است؛ آخرین نسخهٔ API سیگنال‌مپ (شامل NE.CON.TOTL.KD، NE.GDI.TOTL.KD، NY.GDP.MKTP.KD) را مستقر کنید و صفحه را سخت‌ریفرش کنید، یا تا انقضای کش CDN صبر کنید."
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
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "5. Oil rents (% of GDP)", `۵. ${faEconomic.oilRentsPctGdp}`)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">WDI NY.GDP.PETR.RT.ZS — Iran.</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoOilRentsPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Oil rents (% of GDP)`,
                            `${displayStudy.title} — ${faEconomic.oilRentsPctGdp}`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoDutchSource?.name ?? "World Bank WDI",
                            "NY.GDP.PETR.RT.ZS",
                          ])}
                          data={recoOilRentsPoints}
                          valueKey="value"
                          label={L(isFa, "Oil rents (% of GDP)", faEconomic.oilRentsPctGdp)}
                          unit="%"
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-oil-rents"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2 space-y-1">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "Natural gas rents (% of GDP)", "رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                        {L(
                          isFa,
                          "Natural gas rents are estimated resource rents as a share of GDP. They are not the same as government gas revenue or export revenue.",
                          "«رانت گاز طبیعی برآوردی از رانت منابع طبیعی به‌عنوان درصدی از GDP است و معادل درآمد دولت یا صادرات گاز نیست.»"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">WDI NY.GDP.NGAS.RT.ZS — Iran.</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoNaturalGasRentsPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Natural gas rents (% of GDP)`,
                            `${displayStudy.title} — رانت گاز طبیعی (% از GDP)`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [recoDutchSource?.name ?? "World Bank WDI", "NY.GDP.NGAS.RT.ZS"])}
                          data={recoNaturalGasRentsPoints}
                          valueKey="value"
                          label={L(isFa, "Natural gas rents (% of GDP)", "رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
                          unit="%"
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          forceTimeAxis
                          exportFileStem="iran-reco-natural-gas-rents"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                        />
                      ) : recoOilRentsPoints.length > 0 ? (
                        <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                          {L(
                            isFa,
                            "No natural-gas-rents observations are available in this window (NY.GDP.NGAS.RT.ZS). Missing years are left blank rather than interpolated.",
                            "در این بازه مشاهده‌ای از رانت گاز طبیعی (NY.GDP.NGAS.RT.ZS) وجود ندارد. سال‌های بدون داده به‌جای درون‌یابی خالی مانده‌اند."
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
                    <CardHeader className="pb-2">
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
                    <CardContent className="pt-0 space-y-4">
                      {recoFxOfficialPoints.length > 0 || recoOpenAnnualMean.length > 0 ? (
                        <>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="reco-fx-levels-log-scale">
                            <input
                              id="reco-fx-levels-log-scale"
                              name="reco_fx_levels_log_scale"
                              type="checkbox"
                              checked={iranEconomyFxLevelsLogScale}
                              onChange={(e) => setIranEconomyFxLevelsLogScale(e.target.checked)}
                              className="rounded border-border"
                            />
                            {L(isFa, "Log scale", "مقیاس لگاریتمی")}
                          </label>
                          <TimelineChart
                            chartLocale={chartLocaleForCharts}
                            exportPresentationStudyHeading={displayStudy.title}
                            exportPresentationTitle={L(
                              isFa,
                              `${displayStudy.title} — FX levels`,
                              `${displayStudy.title} — ${faEconomic.exchangeRate}`
                            )}
                            exportSourceFooter={studyChartExportSource(isFa, [
                              recoFxOfficialSource?.name,
                              recoFxOpenSource?.name,
                            ])}
                            data={[]}
                            valueKey="value"
                            label={L(isFa, "Toman per USD", faEconomic.tomanPerUsd)}
                            events={reconstructionChartEvents}
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
                            timeRange={reconstructionTimeRange ?? study.timeRange}
                            chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                            chartRangeGranularity="year"
                            xAxisYearLabel={chartYearAxisLabel}
                            exportFileStem="iran-reco-fx-levels"
                            showChartControls
                            chartHeight="h-56 md:h-64"
                            mutedEventLines
                            yAxisLog={iranEconomyFxLevelsLogScale}
                            multiSeriesYAxisNameOverrides={{
                              0: iranEconomyFxLevelsLogScale
                                ? L(isFa, "toman/USD (log scale)", "تومان به ازای دلار (مقیاس لگاریتمی)")
                                : L(isFa, "toman/USD", "تومان به ازای دلار"),
                            }}
                            yAxisDetailNote={iranRecoFxLevelsLogNote}
                          />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "FX data unavailable for this window.", "داده نرخ در این بازه در دسترس نیست.")}
                        </p>
                      )}
                      {recoFxSpreadPctPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — FX spread`,
                            `${displayStudy.title} — ${faEconomic.fxSpread}`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoFxOfficialSource?.name,
                            recoFxOpenSource?.name,
                            "Derived: (annual mean open / official − 1) × 100",
                          ])}
                          data={recoFxSpreadPctPoints}
                          valueKey="value"
                          label={L(isFa, "FX spread (%)", faEconomic.fxSpreadPct)}
                          unit="%"
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-fx-spread"
                          showChartControls
                          chartHeight="h-48 md:h-56"
                          mutedEventLines
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
                        {L(isFa, "7. Broad money (M2) growth vs CPI inflation (annual %)", `۷. ${faEconomic.liquidityAndCpiTitle}`)}
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
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — M2 and CPI`,
                            `${displayStudy.title} — ${faEconomic.m2Growth} و ${faEconomic.cpiInflation}`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoMoneyCitation ? (isFa ? recoMoneyCitation.fa : recoMoneyCitation.en) : null,
                          ])}
                          data={[]}
                          valueKey="value"
                          label={L(isFa, "Broad money growth & inflation", faEconomic.growthLiquidityAndInflationAxis)}
                          events={reconstructionChartEvents}
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
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-m2-cpi"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          multiSeriesYAxisNameOverrides={{
                            0: L(isFa, "Percent per year", "درصد در سال"),
                          }}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "8. Imports & exports (% of GDP)", `۸. ${faEconomic.importsExportsPctGdp}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoImportsPoints.length > 0 || recoExportsPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(isFa, `${displayStudy.title} — Trade`, `${displayStudy.title} — تجارت`)}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoIsiSource?.name ?? "World Bank WDI",
                            recoIsiIndicatorIds?.imports_pct_gdp,
                            recoIsiIndicatorIds?.exports_pct_gdp,
                          ])}
                          data={[]}
                          valueKey="value"
                          label={L(isFa, "% of GDP", faEconomic.pctOfGdp)}
                          events={reconstructionChartEvents}
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
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-trade"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "9. Manufacturing & industry (% of GDP)", `۹. ${faEconomic.manufacturingIndustryPanelTitle}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoManufacturingPoints.length > 0 || recoIndustryPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(isFa, `${displayStudy.title} — Industry`, `${displayStudy.title} — صنعت`)}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoIsiSource?.name ?? "World Bank WDI",
                            recoIsiIndicatorIds?.manufacturing_pct_gdp,
                            recoIsiIndicatorIds?.industry_pct_gdp,
                          ])}
                          data={[]}
                          valueKey="value"
                          label={L(isFa, "% of GDP", faEconomic.pctOfGdp)}
                          events={reconstructionChartEvents}
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
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-industry"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6">
                          {L(isFa, "Data unavailable for this window.", "داده در این بازه در دسترس نیست.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "10. Real wages / purchasing power", `۱۰. دستمزد واقعی / ${faEconomic.purchasingPower}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                        {L(
                          isFa,
                          "Minimum wage and related household series in SignalMap begin around 2010 in the current dataset; no separate wage chart is shown for 1368–1376.",
                          "حداقل دستمزد و سری‌های مرتبط در این محصول از سال حدود ۲۰۱۰ در دادهٔ فعلی شروع می‌شوند؛ برای ۱۳۶۸–۱۳۷۶ نمودار جداگانه‌ای اینجا نمایش داده نمی‌شود."
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <div className="md:col-span-2 mt-6 pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      {L(isFa, "Welfare and distribution", "رفاه و توزیع")}
                    </h3>
                  </div>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        {L(isFa, "Gini index", "ضریب جینی")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground max-w-3xl">
                        {L(
                          isFa,
                          "WDI SI.POV.GINI (income inequality, 0–100). Survey-based; many years have no published value.",
                          "WDI SI.POV.GINI (نابرابری درآمد، ۰–۱۰۰). مبتنی بر نظرسنجی؛ بسیاری از سال‌ها بدون مقدار منتشرشده‌اند."
                        )}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recoWelfareGiniIranPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Gini index`,
                            `${displayStudy.title} — ضریب جینی`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoWelfareGiniSource?.name ?? "World Bank WDI",
                            recoWelfareGiniIndicatorId || "SI.POV.GINI",
                          ])}
                          data={recoWelfareGiniIranPoints}
                          valueKey="value"
                          label={L(isFa, "Gini index", "ضریب جینی")}
                          unit={L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)")}
                          events={reconstructionChartEvents}
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-welfare-gini"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          regimeArea={recoWelfareRegimeArea}
                          focusGregorianYearRange={{
                            startYear: reconstructionGregorianYearBounds.start,
                            endYear: reconstructionGregorianYearBounds.end,
                          }}
                          focusHoverHint={{
                            en: "Inside focus period",
                            fa: "داخل دورهٔ تمرکز",
                          }}
                          dataCoverageGapMarkArea={recoGiniCoverageExtras?.gapMarkArea}
                          dataCoverageLastMarkLine={
                            recoGiniCoverageExtras?.lastMarkLineX
                              ? {
                                  xAxis: recoGiniCoverageExtras.lastMarkLineX,
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
                            "No Gini estimate in this window (SI.POV.GINI is sparse; none may fall in 1989–1997).",
                            "در این بازه برآورد جینی نیست (SI.POV.GINI پراکنده است؛ ممکن است برای ۱۹۸۹–۱۹۹۷ مقداری نباشد)."
                          )}
                        </p>
                      )}
                      {recoGiniCoverageExtras?.lines.length ? (
                        <div className="mt-2 space-y-0.5 max-w-3xl">
                          {recoGiniCoverageExtras.lines.map((ln, i) => (
                            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                              {L(isFa, ln.en, ln.fa)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                  <Card className="chart-card border-border md:col-span-2">
                    <CardHeader className="pb-2 space-y-1.5">
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
                    <CardContent className="pt-0">
                      {recoWelfarePovertyDdayPoints.length > 0 || recoWelfarePovertyLmicPoints.length > 0 ? (
                        <TimelineChart
                          chartLocale={chartLocaleForCharts}
                          exportPresentationStudyHeading={displayStudy.title}
                          exportPresentationTitle={L(
                            isFa,
                            `${displayStudy.title} — Poverty headcount`,
                            `${displayStudy.title} — نرخ فقر`
                          )}
                          exportSourceFooter={studyChartExportSource(isFa, [
                            recoWelfarePovertySource?.name ?? "World Bank WDI",
                            recoWelfarePovertyDdayId || "SI.POV.DDAY",
                            recoWelfarePovertyLmicId || "SI.POV.LMIC",
                          ])}
                          data={[]}
                          valueKey="value"
                          label={L(isFa, "Poverty headcount ratio", "نرخ شمارش فقر")}
                          events={reconstructionChartEvents}
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
                          timeRange={reconstructionTimeRange ?? study.timeRange}
                          chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                          chartRangeGranularity="year"
                          xAxisYearLabel={chartYearAxisLabel}
                          exportFileStem="iran-reco-welfare-poverty"
                          showChartControls
                          chartHeight="h-56 md:h-64"
                          mutedEventLines
                          forceTimeAxis
                          regimeArea={recoWelfareRegimeArea}
                          multiSeriesYAxisNameOverrides={{
                            0: L(isFa, "Poverty headcount (% of population)", "نرخ فقر (٪ از جمعیت)"),
                          }}
                          dataCoverageGapMarkArea={recoPovertyCoverageExtras?.gapMarkArea}
                          dataCoverageLastMarkLine={
                            recoPovertyCoverageExtras?.lastMarkLineX
                              ? {
                                  xAxis: recoPovertyCoverageExtras.lastMarkLineX,
                                  label: L(isFa, "Last available data", "آخرین داده موجود"),
                                }
                              : undefined
                          }
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                          {L(
                            isFa,
                            "No poverty headcount observations in this window (SI.POV.DDAY / SI.POV.LMIC are sparse and may not cover 1989–1997).",
                            "در این بازه دادهٔ شمارش فقر نیست (SI.POV.DDAY و SI.POV.LMIC پراکنده‌اند و ممکن است ۱۹۸۹–۱۹۹۷ را پوشش ندهند)."
                          )}
                        </p>
                      )}
                      {recoPovertyCoverageExtras?.lines.length ? (
                        <div className="mt-2 space-y-0.5 max-w-3xl">
                          {recoPovertyCoverageExtras.lines.map((ln, i) => (
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
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                note={L(
                  isFa,
                  "WDI/IMF may omit some years; charts only plot years with valid values.",
                  "IMF/WDI در برخی سال‌ها ممکن است خالی باشد؛ نمودارها فقط سال‌هایی را که مقدار معتبر دارند نشان می‌دهند."
                )}
                items={[
                  {
                    label: L(isFa, "CPI inflation", faEconomic.cpiInflation),
                    sourceName: recoInflationSource?.name ?? "World Bank WDI",
                    sourceUrl: recoInflationSource?.url ?? "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
                    sourceDetail: recoInflationSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Annual %", "٪ سالانه"),
                  },
                  {
                    label: L(isFa, "Growth & shares", "رشد و سهم‌ها"),
                    sourceName: recoIsiSource?.name ?? "World Bank WDI",
                    sourceUrl: recoIsiSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoIsiSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "% of GDP or % growth",
                      `${faEconomic.pctOfGdp} یا ٪ رشد`
                    ),
                  },
                  {
                    label: L(isFa, "Consumption, investment, GDP (nominal)", "مصرف، سرمایه‌گذاری و GDP (اسمی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "current US$ (NE.CON.TOTL.CD, NE.GDI.TOTL.CD, NY.GDP.MKTP.CD)",
                      "دلار جاری (NE.CON.TOTL.CD، NE.GDI.TOTL.CD، NY.GDP.MKTP.CD)"
                    ),
                  },
                  {
                    label: L(isFa, "GDP decomposition (proxy)", "تفکیک GDP (تقریبی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "current US$ — NY.GDP.MKTP.CD, NY.GDP.PETR.RT.ZS; derived non-oil / oil proxy levels",
                      "دلار جاری — NY.GDP.MKTP.CD، NY.GDP.PETR.RT.ZS؛ سطوح تقریبی غیرنفتی/نفتی"
                    ),
                  },
                  {
                    label: L(isFa, "Consumption, investment, GDP (real)", "مصرف، سرمایه‌گذاری و GDP (واقعی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "constant 2015 US$ (NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD)",
                      "دلار ثابت ۲۰۱۵ (NE.CON.TOTL.KD، NE.GDI.TOTL.KD، NY.GDP.MKTP.KD)"
                    ),
                  },
                  {
                    label: L(isFa, "Oil rents", faEconomic.oilRents),
                    sourceName: recoDutchSource?.name ?? "World Bank WDI",
                    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.PETR.RT.ZS",
                    sourceDetail: recoDutchSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "% of GDP", faEconomic.pctOfGdp),
                  },
                  {
                    label: L(isFa, "Money supply", faEconomic.broadMoney),
                    sourceName: recoMoneyWdiSource?.name ?? "World Bank WDI",
                    sourceUrl: recoMoneyIndicatorIds
                      ? `https://data.worldbank.org/indicator/${recoMoneyIndicatorIds.broad_money_growth}`
                      : "https://data.worldbank.org/indicator/FM.LBL.BMNY.ZG",
                    sourceDetail: recoMoneyWdiSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Annual %", "٪ سالانه"),
                  },
                  {
                    label: L(isFa, "Exchange rates", faEconomic.exchangeRate),
                    sourceName: recoFxOpenSource?.name ?? "—",
                    sourceUrl: recoFxOpenSource?.url,
                    sourceDetail: recoFxOpenSource?.publisher ?? "",
                    unitLabel: L(isFa, "toman/USD", "تومان/دلار"),
                  },
                  {
                    label: L(isFa, "Gini index", "ضریب جینی"),
                    sourceName: recoWelfareGiniSource?.name ?? "World Bank WDI",
                    sourceUrl:
                      recoWelfareGiniIndicatorId !== ""
                        ? `https://data.worldbank.org/indicator/${recoWelfareGiniIndicatorId}`
                        : "https://data.worldbank.org/indicator/SI.POV.GINI",
                    sourceDetail: recoWelfareGiniSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                  },
                  {
                    label: L(isFa, "Poverty headcount", "نرخ فقر"),
                    sourceName: recoWelfarePovertySource?.name ?? "World Bank WDI",
                    sourceUrl: recoWelfarePovertyDdayId
                      ? `https://data.worldbank.org/indicator/${recoWelfarePovertyDdayId}`
                      : "https://data.worldbank.org/indicator/SI.POV.DDAY",
                    sourceDetail: recoWelfarePovertySource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "% of population (SI.POV.DDAY; SI.POV.LMIC in chart legend)",
                      "٪ از جمعیت (SI.POV.DDAY؛ SI.POV.LMIC در راهنما)"
                    ),
                  },
                ]}
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      Each small chart uses the same fixed calendar window (about 1989–1997) aligned to Persian years
                      1368–1376 on the axis when you choose Solar Hijri. Indicators are descriptive; co-movement is not a
                      causal proof.
                    </p>
                    <p>
                      IMF/WDI coverage can leave gaps; where a series has no value, the chart shows a short “data
                      unavailable” note instead of fabricating points.
                    </p>
                  </>
                )}
              </InSimpleTerms>
              {iranMacroAiInterpretationParagraphs ? (
                <StudyAiInterpretation locale={isFa ? "fa" : "en"}>
                  {iranMacroAiInterpretationParagraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </StudyAiInterpretation>
              ) : null}
            </>
          ) : isIranEconomyPeriodComparison ? (
            <>
              <ClientOnlyAfterMount
                fallback={
                  <div className="mb-5 max-w-6xl space-y-3" aria-hidden>
                    <div className="flex min-h-[30px] flex-wrap gap-1.5 rounded-md border border-transparent bg-muted/5" />
                    <div className="grid min-h-[56px] max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-transparent bg-muted/5" />
                  </div>
                }
              >
                <div className="flex flex-wrap gap-1.5 mb-3 max-w-6xl">
                  {IPC_PRESET_UI_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyIpcPreset(id)}
                      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                        ipcPresetId === id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {L(isFa, IPC_PRESET_CHIP[id].en, IPC_PRESET_CHIP[id].fa)}
                    </button>
                  ))}
                </div>
                {ipcFocusBandContextParagraph ? (
                  <p className="text-xs text-muted-foreground mb-3 max-w-3xl leading-relaxed">
                    {ipcFocusBandContextParagraph}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs max-w-3xl">
                  <label className="flex flex-col gap-0.5" htmlFor="ipc-outer-start-year">
                    <span className="text-muted-foreground">{L(isFa, "Outer start (year)", "شروع بازه بیرونی (سال)")}</span>
                    <input
                      id="ipc-outer-start-year"
                      name="ipc_outer_start_year"
                      type="number"
                      min={IPC_OUTER_CHART_YEAR_MIN}
                      max={ipcGregorianYear}
                      value={ipcOuterStartYear}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        setIpcOuterStartYear(v);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5" htmlFor="ipc-outer-end-year">
                    <span className="text-muted-foreground">{L(isFa, "Outer end (year)", "پایان بازه بیرونی (سال)")}</span>
                    <input
                      id="ipc-outer-end-year"
                      name="ipc_outer_end_year"
                      type="number"
                      min={IPC_OUTER_CHART_YEAR_MIN}
                      max={ipcGregorianYear}
                      value={ipcOuterEndYear}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        setIpcOuterEndYear(v);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5" htmlFor="ipc-focus-start-year">
                    <span className="text-muted-foreground">{L(isFa, "Focus start (year)", "شروع دوره تمرکز (سال)")}</span>
                    <input
                      id="ipc-focus-start-year"
                      name="ipc_focus_start_year"
                      type="number"
                      min={IPC_OUTER_CHART_YEAR_MIN}
                      max={ipcGregorianYear}
                      value={ipcFocusStartYear}
                      onChange={(e) => {
                        markIpcCustomFocusLabel();
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        setIpcFocusStartYear(v);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5" htmlFor="ipc-focus-end-year">
                    <span className="text-muted-foreground">{L(isFa, "Focus end (year)", "پایان دوره تمرکز (سال)")}</span>
                    <input
                      id="ipc-focus-end-year"
                      name="ipc_focus_end_year"
                      type="number"
                      min={IPC_OUTER_CHART_YEAR_MIN}
                      max={ipcGregorianYear}
                      value={ipcFocusEndYear}
                      onChange={(e) => {
                        markIpcCustomFocusLabel();
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        setIpcFocusEndYear(v);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 w-full"
                    />
                  </label>
                </div>
              </ClientOnlyAfterMount>
              {ipcTimeRange ? (
                <IranEconomyPeriodComparisonPanels
                  isFa={isFa}
                  L={L}
                  studyTitle={displayStudy.title}
                  chartLocaleForCharts={chartLocaleForCharts}
                  chartYearAxisLabel={chartYearAxisLabel}
                  timeRange={ipcTimeRange}
                  regimeArea={ipcRegimeAreaWithLabel}
                  focusGregorianYearRange={{
                    startYear: ipcFocusResolved.start,
                    endYear: ipcFocusResolved.end,
                  }}
                  focusHoverHint={{
                    en: "Inside focus period",
                    fa: "داخل دورهٔ تمرکز",
                  }}
                  events={ipcChartEvents}
                  exportStudyHeading={displayStudy.title}
                  studyChartExportSource={studyChartExportSource}
                  recoInflationIranPoints={recoInflationIranPoints}
                  recoInflationSource={recoInflationSource}
                  recoGdpGrowthPoints={recoGdpGrowthPoints}
                  recoDemandConsumptionPoints={recoDemandConsumptionPoints}
                  recoDemandInvestmentPoints={recoDemandInvestmentPoints}
                  recoDemandGdpPoints={recoDemandGdpPoints}
                  recoGdpDecompNonOilPoints={recoGdpDecompNonOilPoints}
                  recoGdpDecompOilPoints={recoGdpDecompOilPoints}
                  recoGdpDecompCoverage={recoGdpDecompCoverage}
                  recoDemandRealConsumptionPoints={recoDemandRealConsumptionPoints}
                  recoDemandRealInvestmentPoints={recoDemandRealInvestmentPoints}
                  recoDemandRealGdpPoints={recoDemandRealGdpPoints}
                  recoDemandNominalSource={recoDemandNominalSource}
                  recoDemandIndicatorIds={recoDemandIndicatorIds}
                  recoImportsPoints={recoImportsPoints}
                  recoExportsPoints={recoExportsPoints}
                  recoManufacturingPoints={recoManufacturingPoints}
                  recoIndustryPoints={recoIndustryPoints}
                  recoIsiSource={recoIsiSource}
                  recoIsiIndicatorIds={recoIsiIndicatorIds}
                  recoOilRentsPoints={recoOilRentsPoints}
                  recoNaturalGasRentsPoints={recoNaturalGasRentsPoints}
                  recoDutchSource={recoDutchSource}
                  recoM2Points={recoM2Points}
                  recoM2CpiPoints={recoM2CpiPoints}
                  recoMoneyCitation={recoMoneyCitation}
                  recoMoneyWdiSource={recoMoneyWdiSource}
                  recoMoneyIndicatorIds={recoMoneyIndicatorIds}
                  recoFxOfficialPoints={recoFxOfficialPoints}
                  recoOpenAnnualMean={recoOpenAnnualMean}
                  recoFxSpreadPctPoints={recoFxSpreadPctPoints}
                  recoFxOfficialSource={recoFxOfficialSource}
                  recoFxOpenSource={recoFxOpenSource}
                  ipcWageRealKTomans={ipcWageRealKTomans}
                  ipcWageSource={ipcWageSource}
                  ipcWageLoadFailed={ipcWageLoadFailed}
                  recoLoading={recoLoading}
                  recoLoadFailed={recoLoadFailed}
                  recoLoadDetail={recoLoadDetail}
                  recoWelfareGiniIranPoints={recoWelfareGiniIranPoints}
                  recoWelfareGiniSource={recoWelfareGiniSource}
                  recoWelfareGiniIndicatorId={recoWelfareGiniIndicatorId}
                  recoWelfarePovertyDdayPoints={recoWelfarePovertyDdayPoints}
                  recoWelfarePovertyLmicPoints={recoWelfarePovertyLmicPoints}
                  recoWelfarePovertyDdayShort={recoWelfarePovertyDdayShort}
                  recoWelfarePovertyLmicShort={recoWelfarePovertyLmicShort}
                  recoWelfarePovertyDdayTitle={recoWelfarePovertyDdayTitle}
                  recoWelfarePovertyLmicTitle={recoWelfarePovertyLmicTitle}
                  recoWelfarePovertySource={recoWelfarePovertySource}
                  recoWelfarePovertyDdayId={recoWelfarePovertyDdayId}
                  recoWelfarePovertyLmicId={recoWelfarePovertyLmicId}
                  showRevolution1979Marker={showIran1979RevolutionMarker}
                  chartPeriodOverlayBands={iranIraqWarChartPeriodOverlayBands}
                />
              ) : null}
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? (
                <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} groupConceptsCoreFirst />
              ) : null}
              <SourceInfo
                note={L(
                  isFa,
                  "WDI/IMF may omit some years; charts only plot years with valid values.",
                  "IMF/WDI در برخی سال‌ها ممکن است خالی باشد؛ نمودارها فقط سال‌هایی را که مقدار معتبر دارند نشان می‌دهند."
                )}
                items={[
                  {
                    label: L(isFa, "CPI inflation", faEconomic.cpiInflation),
                    sourceName: recoInflationSource?.name ?? "World Bank WDI",
                    sourceUrl: recoInflationSource?.url ?? "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
                    sourceDetail: recoInflationSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Annual %", "٪ سالانه"),
                  },
                  {
                    label: L(isFa, "Growth & shares", "رشد و سهم‌ها"),
                    sourceName: recoIsiSource?.name ?? "World Bank WDI",
                    sourceUrl: recoIsiSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoIsiSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "% of GDP or % growth", `${faEconomic.pctOfGdp} یا ٪ رشد`),
                  },
                  {
                    label: L(isFa, "Consumption, investment, GDP (nominal)", "مصرف، سرمایه‌گذاری و GDP (اسمی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "current US$ (NE.CON.TOTL.CD, NE.GDI.TOTL.CD, NY.GDP.MKTP.CD)",
                      "دلار جاری (NE.CON.TOTL.CD، NE.GDI.TOTL.CD، NY.GDP.MKTP.CD)"
                    ),
                  },
                  {
                    label: L(isFa, "GDP decomposition (proxy)", "تفکیک GDP (تقریبی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "current US$ — NY.GDP.MKTP.CD, NY.GDP.PETR.RT.ZS; derived non-oil / oil proxy levels",
                      "دلار جاری — NY.GDP.MKTP.CD، NY.GDP.PETR.RT.ZS؛ سطوح تقریبی غیرنفتی/نفتی"
                    ),
                  },
                  {
                    label: L(isFa, "Consumption, investment, GDP (real)", "مصرف، سرمایه‌گذاری و GDP (واقعی)"),
                    sourceName: recoDemandNominalSource?.name ?? "World Bank WDI",
                    sourceUrl: recoDemandNominalSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: recoDemandNominalSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "constant 2015 US$ (NE.CON.TOTL.KD, NE.GDI.TOTL.KD, NY.GDP.MKTP.KD)",
                      "دلار ثابت ۲۰۱۵ (NE.CON.TOTL.KD، NE.GDI.TOTL.KD، NY.GDP.MKTP.KD)"
                    ),
                  },
                  {
                    label: L(isFa, "Oil rents", faEconomic.oilRents),
                    sourceName: recoDutchSource?.name ?? "World Bank WDI",
                    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.PETR.RT.ZS",
                    sourceDetail: recoDutchSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "% of GDP", faEconomic.pctOfGdp),
                  },
                  {
                    label: L(isFa, "Money supply", faEconomic.broadMoney),
                    sourceName: recoMoneyWdiSource?.name ?? "World Bank WDI",
                    sourceUrl: recoMoneyIndicatorIds
                      ? `https://data.worldbank.org/indicator/${recoMoneyIndicatorIds.broad_money_growth}`
                      : "https://data.worldbank.org/indicator/FM.LBL.BMNY.ZG",
                    sourceDetail: recoMoneyWdiSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Annual %", "٪ سالانه"),
                  },
                  {
                    label: L(isFa, "Exchange rates", faEconomic.exchangeRate),
                    sourceName: recoFxOpenSource?.name ?? "—",
                    sourceUrl: recoFxOpenSource?.url,
                    sourceDetail: recoFxOpenSource?.publisher ?? "",
                    unitLabel: L(isFa, "toman/USD", "تومان/دلار"),
                  },
                  {
                    label: L(isFa, "Gini index", "ضریب جینی"),
                    sourceName: recoWelfareGiniSource?.name ?? "World Bank WDI",
                    sourceUrl:
                      recoWelfareGiniIndicatorId !== ""
                        ? `https://data.worldbank.org/indicator/${recoWelfareGiniIndicatorId}`
                        : "https://data.worldbank.org/indicator/SI.POV.GINI",
                    sourceDetail: recoWelfareGiniSource?.publisher ?? "World Bank",
                    unitLabel: L(isFa, "Gini (0–100)", "ضریب جینی (۰–۱۰۰)"),
                  },
                  {
                    label: L(isFa, "Poverty headcount", "نرخ فقر"),
                    sourceName: recoWelfarePovertySource?.name ?? "World Bank WDI",
                    sourceUrl: recoWelfarePovertyDdayId
                      ? `https://data.worldbank.org/indicator/${recoWelfarePovertyDdayId}`
                      : "https://data.worldbank.org/indicator/SI.POV.DDAY",
                    sourceDetail: recoWelfarePovertySource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "% of population (SI.POV.DDAY; SI.POV.LMIC in chart legend)",
                      "٪ از جمعیت (SI.POV.DDAY؛ SI.POV.LMIC در راهنما)"
                    ),
                  },
                ]}
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <p>
                    {L(
                      isFa,
                      "This view can compare late Pahlavi and Islamic Republic economic periods where data is available. Long-run series stay visible while a selected window is highlighted. The shaded band is a visual aid for comparison; it does not imply causality.",
                      "«این نما — جایی که داده هست — دورهٔ پایانی پهلوی و جمهوری اسلامی را کنار هم می‌تواند نشان دهد؛ روند بلندمدت دیده می‌شود و یک پنجرهٔ انتخابی با سایه برجسته می‌شود. سایه فقط برای مقایسه بصری است و به معنی رابطه علّی نیست.»"
                    )}
                  </p>
                )}
              </InSimpleTerms>
              {iranMacroAiInterpretationParagraphs ? (
                <StudyAiInterpretation locale={isFa ? "fa" : "en"}>
                  {iranMacroAiInterpretationParagraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </StudyAiInterpretation>
              ) : null}
              <div className="mt-4 max-w-3xl space-y-2 rounded-lg border border-border/50 bg-muted/10 px-4 py-3 text-sm leading-relaxed text-foreground/90">
                <p className="font-medium text-foreground">
                  {L(isFa, "Quick takeaways", "جمع‌بندی کوتاه")}
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                  <li>
                    {L(
                      isFa,
                      "Pick one shaded focus window and read the small charts as parallel timelines: similar slopes can reflect common shocks or policy phases, not proof that one series caused another.",
                      "یک بازهٔ تمرکز را انتخاب کنید و نمودارهای کوچک را موازی بخوانید: هم‌جهتی ممکن است شوک مشترک یا فاز سیاست را منعکس کند، نه اثبات علّی مستقیم."
                    )}
                  </li>
                  <li>
                    {L(
                      isFa,
                      "Annual WDI gaps are real: when a year is missing, the chart leaves space rather than inventing a bridge—especially for survey-based welfare indicators.",
                      "خالی‌بودن سال‌ها در WDI واقعی است؛ برای شاخص‌های رفاهی مبتنی بر پژوهش، نمودار سال بدون داده را پر نمی‌کند."
                    )}
                  </li>
                </ul>
              </div>
            </>
          ) : isDutchDiseaseDiagnostics ? (
            <>
              {dutchWdiLoadFailed ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4 max-w-3xl space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {L(isFa, "This study could not load right now.", "این مطالعه اکنون بارگذاری نشد.")}
                  </p>
                  {dutchWdiLoadDetail ? (
                    <p className="text-xs text-muted-foreground font-mono break-words">{dutchWdiLoadDetail}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {L(
                      isFa,
                      "Other sections on this page may still load (for example FX context).",
                      "بخش‌های دیگر این صفحه ممکن است همچنان بارگذاری شوند (مثلاً زمینهٔ ارزی)."
                    )}
                  </p>
                </div>
              ) : null}
              {dutchWdiSeriesWarnings && Object.keys(dutchWdiSeriesWarnings).length > 0 && !dutchWdiLoadFailed ? (
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-4 max-w-3xl">
                  {L(isFa, "Some World Bank indicators failed to load:", "بارگذاری برخی شاخص‌های بانک جهانی ناموفق بود:")}{" "}
                  {Object.entries(dutchWdiSeriesWarnings)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </p>
              ) : null}
              {dutchWdiLoading &&
              dutchOilRentsPoints.length === 0 &&
              dutchNaturalGasRentsPoints.length === 0 &&
              dutchManufacturingPoints.length === 0 &&
              dutchImportsPoints.length === 0 &&
              !dutchWdiLoadFailed ? (
                <p className="text-sm text-muted-foreground mb-6">
                  {L(isFa, "Loading World Bank annual indicators…", "در حال بارگذاری شاخص‌های سالانه بانک جهانی…")}
                </p>
              ) : null}
              {dutchOverviewIndexed ? (
                <div className="space-y-2 mb-8 pb-8 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "Overview — indexed pattern comparison", "نمای کلی — مقایسهٔ الگو (شاخص‌شده)")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                    {L(
                      isFa,
                      `Each series is indexed to 100 in ${dutchOverviewIndexed.baseYear} (or the earliest calendar year where every line shown here has a valid value, if ${dutchOverviewIndexed.baseYear} is unavailable). Units differ (% of GDP vs toman/USD); this view is for visual pattern comparison only, not direct level comparison.`,
                      `هر سری به شاخص ۱۰۰ در سال ${localizeChartNumericDisplayString(String(dutchOverviewIndexed.baseYear), "fa")} نرمال شده است (اگر آن سال داده نباشد، نزدیک‌ترین سالی که همهٔ خطوط مقدار معتبر دارند). واحدها متفاوت‌اند (${faEconomic.gdpPctUnit} در برابر تومان/دلار)؛ این نما فقط برای مقایسهٔ الگوی بصری است، نه سطح مطلق.`
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — ${"Overview (indexed)"}`,
                      `${displayStudy.title} — ${"نمای کلی (شاخص‌شده)"}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      dutchWdiSource?.name ?? "World Bank WDI",
                      dutchFxSource?.name,
                    ])}
                    data={[]}
                    valueKey="value"
                    label={L(isFa, "Indexed overview (100 = base year)", "نمای شاخص‌شده (۱۰۰ = سال مبنا)")}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={dutchOverviewIndexed.multiSeries}
                    timeRange={dutchTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    multiSeriesYAxisNameOverrides={{
                      0: isFa
                        ? `شاخص (${localizeChartNumericDisplayString(String(dutchOverviewIndexed.baseYear), "fa")} = ۱۰۰)`
                        : `Index (${dutchOverviewIndexed.baseYear} = 100)`,
                    }}
                    exportFileStem="dutch-disease-overview-indexed"
                    showChartControls={false}
                    mutedEventLines
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`}
                  />
                </div>
              ) : null}
              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "1. Oil rents (% of GDP)", `۱. ${faEconomic.oilRentsPctGdp}`)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {L(
                      isFa,
                      "World Bank WDI NY.GDP.PETR.RT.ZS — oil rents as a share of GDP (annual).",
                      "WDI بانک جهانی NY.GDP.PETR.RT.ZS — رانت نفتی به‌صورت درصدی از تولید ناخالص داخلی (سالانه)."
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — ${"Oil rents (% of GDP)"}`,
                      `${displayStudy.title} — ${faEconomic.oilRentsPctGdp}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      dutchWdiSource?.name ?? "World Bank WDI",
                      "NY.GDP.PETR.RT.ZS",
                    ])}
                    data={dutchOilRentsPoints}
                    valueKey="value"
                    label={L(isFa, "Oil rents (% of GDP)", faEconomic.oilRentsPctGdp)}
                    unit="%"
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    timeRange={dutchTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="dutch-disease-oil-rents"
                    showChartControls={false}
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "2. Natural gas rents (% of GDP)", "۲. رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                    {L(
                      isFa,
                      "Natural gas rents are estimated resource rents as a share of GDP. They are not the same as government gas revenue or export revenue.",
                      "«رانت گاز طبیعی برآوردی از رانت منابع طبیعی به‌عنوان درصدی از GDP است و معادل درآمد دولت یا صادرات گاز نیست.»"
                    )}
                  </p>
                  {dutchNaturalGasRentsPoints.length > 0 ? (
                    <TimelineChart
                      chartLocale={chartLocaleForCharts}
                      exportPresentationStudyHeading={displayStudy.title}
                      exportPresentationTitle={L(
                        isFa,
                        `${displayStudy.title} — Natural gas rents (% of GDP)`,
                        `${displayStudy.title} — رانت گاز طبیعی (% از GDP)`
                      )}
                      exportSourceFooter={studyChartExportSource(isFa, [
                        dutchWdiSource?.name ?? "World Bank WDI",
                        "NY.GDP.NGAS.RT.ZS",
                      ])}
                      data={dutchNaturalGasRentsPoints}
                      valueKey="value"
                      label={L(isFa, "Natural gas rents (% of GDP)", "رانت گاز طبیعی (% از تولید ناخالص داخلی)")}
                      unit="%"
                      events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                      anchorEventId={anchorEventId || undefined}
                      timeRange={dutchTimeRange ?? study.timeRange}
                      chartRangeGranularity="year"
                      xAxisYearLabel={chartYearAxisLabel}
                      forceTimeAxis
                      exportFileStem="dutch-disease-natural-gas-rents"
                      showChartControls={false}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-6 max-w-3xl leading-relaxed">
                      {L(
                        isFa,
                        "No natural-gas-rents observations in this window (NY.GDP.NGAS.RT.ZS). Missing years are left blank rather than interpolated.",
                        "در این بازه مشاهده‌ای از رانت گاز طبیعی (NY.GDP.NGAS.RT.ZS) وجود ندارد. سال‌های بدون داده به‌جای درون‌یابی خالی مانده‌اند."
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "3. Manufacturing value added (% of GDP)", `۳. ${faEconomic.manufacturingPctGdp}`)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {L(
                      isFa,
                      "World Bank WDI NV.IND.MANF.ZS — one tradable-sector proxy; not all tradables.",
                      "WDI بانک جهانی NV.IND.MANF.ZS — یک نماینده بخش قابل‌معامله؛ همه بخش‌های قابل‌معامله نیست."
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — ${"Manufacturing (% of GDP)"}`,
                      `${displayStudy.title} — ${faEconomic.manufacturingPctGdp}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      dutchWdiSource?.name ?? "World Bank WDI",
                      "NV.IND.MANF.ZS",
                    ])}
                    data={dutchManufacturingPoints}
                    valueKey="value"
                    label={L(isFa, "Manufacturing (% of GDP)", faEconomic.manufacturingPctGdp)}
                    unit="%"
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    timeRange={dutchTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="dutch-disease-manufacturing"
                    showChartControls={false}
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(
                      isFa,
                      "4. Imports of goods and services (% of GDP)",
                      `۴. واردات کالا و خدمات — ${faEconomic.gdpPctUnit}`
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {L(
                      isFa,
                      "World Bank WDI NE.IMP.GNFS.ZS — imports relative to GDP (annual).",
                      "WDI بانک جهانی NE.IMP.GNFS.ZS — واردات نسبت به GDP (سالانه)."
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — ${"Imports (% of GDP)"}`,
                      `${displayStudy.title} — ${faEconomic.imports} — ${faEconomic.gdpPctUnit}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      dutchWdiSource?.name ?? "World Bank WDI",
                      "NE.IMP.GNFS.ZS",
                    ])}
                    data={dutchImportsPoints}
                    valueKey="value"
                    label={L(isFa, "Imports (% of GDP)", `${faEconomic.imports} — ${faEconomic.gdpPctUnit}`)}
                    unit="%"
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    timeRange={dutchTimeRange ?? study.timeRange}
                    chartRangeGranularity="year"
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="dutch-disease-imports"
                    showChartControls={false}
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {L(isFa, "5. Open-market USD→toman (context)", `۵. ${faEconomic.openMarketExchangeRate} (زمینه)`)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {L(
                      isFa,
                      "Same series as the USD→toman study; higher frequency than WDI panels. Read alongside annual shares, not as a strict year-by-year match.",
                      "همان سری مطالعهٔ دلار/تومان؛ تناوب بالاتر از پنل‌های WDI؛ کنار سهم‌های سالانه ببینید، نه تطبیق دقیق سال‌به‌سال."
                    )}
                  </p>
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    exportPresentationTitle={L(
                      isFa,
                      `${displayStudy.title} — ${"Open-market USD→toman"}`,
                      `${displayStudy.title} — ${faEconomic.exchangeRate}`
                    )}
                    exportSourceFooter={studyChartExportSource(isFa, [dutchFxSource?.name, dutchFxSource?.publisher])}
                    data={dutchFxPoints}
                    valueKey="value"
                    label={L(isFa, "Open-market toman per USD", faEconomic.tomanPerUsd)}
                    unit={L(isFa, "toman/USD", "تومان/دلار")}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, dutchFilteredEvents)}
                    anchorEventId={anchorEventId || undefined}
                    timeRange={dutchFxTimeRange ?? study.timeRange}
                    xAxisYearLabel={chartYearAxisLabel}
                    exportFileStem="dutch-disease-fx-context"
                    showChartControls={false}
                    forceTimeAxis
                  />
                </div>
              </div>
              <LearningNote
                locale={isFa ? "fa" : "en"}
                sections={dutchDiseaseDiagnosticsLearningSections(isFa)}
                links={[
                  {
                    label: L(isFa, "Learning: Dutch disease", "یادگیری: بیم هلندی"),
                    href: "/learning#dutch-disease",
                  },
                ]}
              />
              {displayStudy.observations?.length ? (
                <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} />
              ) : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: L(isFa, "WDI bundle", "بسته WDI"),
                    sourceName: dutchWdiSource?.name ?? "World Bank World Development Indicators",
                    sourceUrl: dutchWdiSource?.url ?? "https://data.worldbank.org/country/iran",
                    sourceDetail: dutchWdiSource?.publisher ?? "World Bank",
                    unitLabel: L(
                      isFa,
                      "Annual % of GDP (three indicators)",
                      `${faEconomic.gdpPctUnit} (سه شاخص، سالانه)`
                    ),
                    unitNote: L(
                      isFa,
                      "NY.GDP.PETR.RT.ZS; NV.IND.MANF.ZS; NE.IMP.GNFS.ZS.",
                      "NY.GDP.PETR.RT.ZS؛ NV.IND.MANF.ZS؛ NE.IMP.GNFS.ZS."
                    ),
                  },
                  {
                    label: L(isFa, "Open-market FX", faEconomic.openMarketExchangeRate),
                    sourceName: dutchFxSource?.name ?? "—",
                    sourceUrl: dutchFxSource?.url,
                    sourceDetail: dutchFxSource?.publisher ?? "",
                    unitLabel: L(isFa, "toman per USD", faEconomic.tomanPerUsd),
                  },
                ]}
                note={L(
                  isFa,
                  "این صفحه برای اکتشاف آموزشی است؛ فرضیه ساختاری را به‌صورت یک شاخص واحد اندازه نمی‌گیرد و علیت ادعا نمی‌کند.",
                  "Educational exploration only: no composite Dutch-disease index and no causal claims."
                )}
              />
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                {isFa && faRich?.simpleTermsParagraphs?.length ? (
                  faRich.simpleTermsParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <>
                    <p>
                      Economists sometimes discuss &quot;Dutch disease&quot; when a resource boom coincides with a shrinking
                      tradable sector or rising external imbalance—but those are patterns people investigate with several
                      indicators, not one magic number.
                    </p>
                    <p>
                      Here you get separate charts so you can compare timing and scale without pretending the lines are a single
                      official score. The FX panel uses the same open-market USD→toman series as elsewhere on SignalMap, shown
                      as macro pressure context rather than a formal real exchange rate index.
                    </p>
                  </>
                )}
              </InSimpleTerms>
            </>
          ) : isWageCpiReal ? (
            <>
              <Card className="chart-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                    {monetarySeriesMode === "nominal"
                      ? L(isFa, "Nominal minimum wage", "حداقل دستمزد اسمی")
                      : L(isFa, "Real minimum wage (inflation-adjusted)", "حداقل دستمزد واقعی (تعدیل‌شده با تورم)")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {displayStudy.subtitle ?? displayStudy.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
                    {monetarySeriesMode === "real" ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" htmlFor="wage-cpi-show-real-index">
                        <input
                          id="wage-cpi-show-real-index"
                          name="wage_cpi_show_real_index"
                          type="checkbox"
                          checked={showWageIndex}
                          onChange={(e) => setShowWageIndex(e.target.checked)}
                          className="rounded border-border"
                        />
                        {L(isFa, "Real wage index (base = 100)", "شاخص دستمزد واقعی (پایه = ۱۰۰)")}
                      </label>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <MultiSeriesStats
                    series={wageChartMultiSeries.map((s) => ({
                      label: s.label,
                      unit: s.unit ?? "",
                      points: s.points,
                    }))}
                    timeRange={wageTimeRange ?? undefined}
                  />
                  <TimelineChart
                    chartLocale={chartLocaleForCharts}
                    exportPresentationStudyHeading={displayStudy.title}
                    xAxisYearLabel={chartYearAxisLabel}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      wageSource?.nominal,
                      wageSource?.cpi,
                      "Derived (nominal × CPI adjustment)",
                      monetarySeriesMode === "real"
                        ? L(isFa, "Chart: Real (Iran CPI-adjusted)", "نمودار: واقعی (تعدیل با CPI ایران)")
                        : L(isFa, "Chart: Nominal", "نمودار: اسمی"),
                    ])}
                    tooltipValueBasisNote={wageTooltipBasisNote || undefined}
                    data={[]}
                    valueKey="value"
                    label={monetarySeriesMode === "nominal" ? "Nominal" : "Real (inflation-adjusted)"}
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={wageChartMultiSeries}
                    timeRange={wageTimeRange ?? study.timeRange}
                    mutedBands={false}
                    chartRangeGranularity="year"
                  />
                  <LearningNote locale={isFa ? "fa" : "en"}
                    sections={[
                      {
                        heading: "How to read this chart",
                        bullets: [
                          "Nominal minimum wage: the official monthly minimum wage in current terms.",
                          "Real minimum wage: nominal adjusted for inflation (CPI) so values are comparable in purchasing power over time.",
                        ],
                      },
                      {
                        heading: "Why real wages matter",
                        bullets: [
                          "Nominal wages can rise while purchasing power falls if inflation is high. Real wages show whether workers can buy more or less over time.",
                          "This study describes the evolution of inflation-adjusted minimum wage in Iran. It does not explain causes or predict future levels.",
                        ],
                      },
                      {
                        heading: "Measurement choices & limitations",
                        bullets: [
                          "Chart shows minimum wage in thousand tomans per month (k tomans); source data are in million rials (1 million rials = 100 k tomans). Nominal: annual (ILO/national). CPI: annual, index 2010 = 100 (World Bank, Iran).",
                          wageBaseYear != null
                            ? `Real wage = nominal × (CPI_base / CPI_t); base year ${wageBaseYear}. Real wage is expressed in ${wageBaseYear} purchasing power.`
                            : "Real wage = nominal × (CPI_base / CPI_t); a fixed base year is used so levels are comparable across years.",
                          "The optional real wage index rescales real wage so the first year in the dataset equals 100.",
                          "Minimum wage is statutory; actual pay and informal work may differ. CPI is a national index and may not reflect all households or regions equally.",
                          "Data are annual. Revisions in source data may change historical values.",
                        ],
                      },
                      {
                        heading: "What this study does not claim",
                        bullets: [
                          "It does not explain why real wages change or what causes inflation.",
                          "It does not forecast or project future wages or prices.",
                          "It does not measure poverty, inequality, or adequacy of the minimum wage.",
                    ],
                  },
                ]}
                  />
                  {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
                  {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
                  <SourceInfo
                    items={[
                      {
                        label: "Nominal minimum wage",
                        sourceName: wageSource?.nominal ?? "—",
                        sourceUrl: "https://ilostat.ilo.org/data/",
                        sourceDetail: "Annual, chart in k tomans/month (source: million rials)",
                        unitLabel: "k tomans/month",
                      },
                      {
                        label: "CPI",
                        sourceName: wageSource?.cpi ?? "—",
                        sourceUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=IR",
                        sourceDetail: wageBaseYear != null ? `Base year ${wageBaseYear} for real wage` : "Consumer price index",
                        unitLabel: "Index",
                      },
                      {
                        label: "Real minimum wage",
                        sourceName: "Derived",
                        sourceDetail: "Nominal × (CPI_base / CPI_t)",
                        unitLabel: wageBaseYear != null ? `k tomans/month (${wageBaseYear} prices)` : "k tomans/month (constant prices)",
                      },
                    ]}
                    note={wageBaseYear != null ? `Real wage base year: ${wageBaseYear}. Educational use; not for policy or causal inference.` : undefined}
                  />
                  <InSimpleTerms locale={isFa ? "fa" : "en"}>
                    <p>
                      The nominal minimum wage is the official number set each year. The real minimum wage adjusts that number for inflation so you can compare purchasing power across years. When prices rise faster than the nominal wage, the real wage falls—workers can buy less with their pay.
                    </p>
                    <p>
                      This chart shows both: the nominal minimum wage in Iran (current thousand tomans per month, k tomans) and the same wage expressed in constant purchasing power (real wage). It describes how these series have evolved. It does not explain why they move or what should be done.
                    </p>
                    <p>
                      Measurement limits apply: the data come from official and international sources. Definitions and coverage may differ from what people actually earn or spend. The study aims to illustrate nominal vs real and the role of CPI adjustment, not to make causal or policy claims.
                    </p>
                  </InSimpleTerms>
                </CardContent>
              </Card>
            </>
          ) : isRealOil ? (
            <>
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [
                  realOilSource?.oil,
                  realOilSource?.cpi,
                ])}
                data={[]}
                valueKey="value"
                label="Real oil price"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: "Oil price",
                  unit: "USD/bbl, 2015 dollars",
                  points: realOilPoints,
                  yAxisIndex: 1,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={false}
                chartRangeGranularity="day"
              />
              <RealOilDescription />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "What this means",
                    bullets: [
                      "Oil price in constant 2015 US dollars.",
                      "Nominal price divided by US CPI and scaled to 2015 purchasing power.",
                      "Real prices support long-term comparison across decades.",
                      "Inflation adjustment removes nominal currency effects.",
                    ],
                  },
                  {
                    heading: "Reading guidance",
                    bullets: [
                      "Y-axis: USD per barrel in 2015-dollar terms. Scale is linear.",
                      "Resolution: daily (from Brent).",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Base year (2015) is arbitrary; levels depend on base choice.",
                      "US CPI is used; domestic burdens differ by country. Do not infer causality.",
                    ],
                  },
                ]}
              />
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026" locale={isFa ? "fa" : "en"}>
                <p>
                  As of March 2026, real oil prices remain in a moderate range relative to the 2015 baseline. Recent
                  volatility has been moderate compared with earlier periods. Levels are comparable to those seen in the
                  early 2020s.
                </p>
                <p>
                  Limitation: Data lag and CPI revisions may affect the most recent values; the trailing month may be
                  incomplete.
                </p>
              </CurrentSnapshot>
              {realOilSource && (
                <SourceInfo
                  items={[
                    {
                      label: "Real oil price",
                      sourceName: `${realOilSource.oil}; ${realOilSource.cpi}`,
                      sourceUrl: "https://fred.stlouisfed.org/series/DCOILBRENTEU",
                      sourceDetail: "Nominal Brent divided by U.S. CPI",
                      unitLabel: "USD/bbl (2015 dollars)",
                      unitNote: "Base year: 2015 (US CPI)",
                    },
                  ]}
                  note="Base year: 2015 (US CPI). FRED CPIAUCSL (Consumer Price Index, All Urban Consumers)."
                />
              )}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.
                  The chart shows these prices adjusted for inflation, so you can compare “how expensive” oil felt in different decades.
                  Without this adjustment, a price from decades ago would look much smaller than today’s, even if oil was relatively more expensive then.
                </p>
                <p>
                  The chart aims to show that comparison—what oil meant in terms of purchasing power over time—not to prove any cause or effect.
                </p>
              </InSimpleTerms>
            </>
          ) : isGoldAndOil ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
              </div>
              {oilShockDates.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2" htmlFor="gold-oil-chart-show-shocks">
                  <input
                    id="gold-oil-chart-show-shocks"
                    name="gold_oil_chart_show_shocks"
                    type="checkbox"
                    checked={showShocks}
                    onChange={(e) => setShowShocks(e.target.checked)}
                  />
                  Show shocks
                </label>
              )}
              <MultiSeriesStats
                series={[
                  { label: "Gold price", unit: "USD/oz", points: goldPointsUsdDisplay },
                  { label: "Oil price", unit: "USD/bbl", points: oilPointsWithVolatility },
                ]}
                timeRange={oilTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [
                  goldSource?.name,
                  oilSource?.name,
                  cpiDeflationExtraExport,
                ])}
                tooltipValueBasisNote={usdTooltipBasisNote}
                data={[]}
                valueKey="value"
                label="Gold"
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                multiSeries={[
                  {
                    key: "gold",
                    label: "Gold price",
                    yAxisIndex: 0,
                    unit: "USD/oz",
                    points: goldPointsUsdDisplay,
                    color: SIGNAL_CONCEPT.gold_spot,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                  {
                    key: "oil",
                    label: "Oil price",
                    yAxisIndex: 1,
                    unit: "USD/bbl",
                    points: oilPointsWithVolatility,
                    color: SIGNAL_CONCEPT.oil_price,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  },
                ]}
                oilShockDates={oilShockDates}
                showOilShocks={showShocks}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands
                yAxisLog
                chartRangeGranularity="month"
              />
              {showShocks && oilShockDates.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: "rgba(180, 30, 30, 0.6)" }}
                  />
                  Oil price shock (&gt;2× recent volatility)
                </div>
              )}
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: "What this means",
                    bullets: [
                      "Gold price (USD/oz) on the left axis (log scale); oil price (USD/bbl) on the right axis (linear).",
                      "Dual axes because the two series have different scales.",
                      "Log scale for gold makes early decades (1900–1970) visible instead of appearing flat.",
                      "Gold and oil are used as separate macroeconomic stress indicators.",
                      "Long-range view supports comparison across periods.",
                    ],
                  },
                  {
                    heading: "Reading guidance",
                    bullets: [
                      "Left y-axis: gold (USD/oz, log scale). Right y-axis: oil (USD/bbl, linear). Scale differs; do not compare numerically.",
                      "Gold uses a log scale so early decades (1900–1970) are visible; oil stays linear.",
                      "Resolution: gold is annual; oil is annual pre-1987, daily from 1987.",
                    ],
                  },
                  {
                    heading: "Pitfalls",
                    bullets: [
                      "Different y-axes; do not compare gold and oil levels.",
                      "Do not infer causality from co-movement or event overlays.",
                    ],
                  },
                ]}
              />
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026" locale={isFa ? "fa" : "en"}>
                <p>
                  As of March 2026, gold and oil both trade at elevated levels relative to pre-2020 norms. Gold shows
                  a sustained upward trend over the observation period; oil displays more cyclical volatility. The two
                  series have moved in broadly similar directions in recent years.
                </p>
                <p>
                  Limitation: Gold data are annual; oil switches from annual to daily in 1987. Alignment of peaks and
                  troughs across the two series is approximate.
                </p>
              </CurrentSnapshot>
              {(goldSource || oilSource) && (
                <SourceInfo
                  items={[
                    ...(goldSource
                      ? [
                          {
                            label: "Gold",
                            sourceName: goldSource.name,
                            sourceUrl: goldSource.url,
                            sourceDetail: goldSource.publisher,
                            unitLabel: "USD/oz",
                            unitNote: "annual data only",
                          },
                        ]
                      : []),
                    ...(oilSourceAnnual || oilSource
                      ? [
                          {
                            label: "Oil",
                            sourceName: "EIA, FRED",
                            sourceUrl: "https://fred.stlouisfed.org/series/DCOILBRENTEU",
                            sourceDetail: "Pre-1987: EIA U.S. Crude Oil First Purchase Price (annual); from 1987: FRED Brent spot (daily)",
                            unitLabel: "USD/bbl",
                            unitNote: "bbl = barrel (42 US gal ≈ 159 L)",
                          },
                        ]
                      : []),
                  ]}
                  note="Gold and oil are shown on separate axes due to differing scales. Earlier periods use lower-frequency data where daily prices are unavailable."
                />
              )}
            </>
          ) : isOilBrent || isOilGlobalLong ? (
            <>
              <div className="chart-container">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {oilShockDates.length > 0 ? (
                    <label className="flex cursor-pointer items-center gap-2" htmlFor="oil-brent-chart-show-shocks">
                      <input
                        id="oil-brent-chart-show-shocks"
                        name="oil_brent_chart_show_shocks"
                        type="checkbox"
                        checked={showShocks}
                        onChange={(e) => setShowShocks(e.target.checked)}
                      />
                      Show shocks
                    </label>
                  ) : null}
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Events on chart
                  </span>
                  <label className="flex cursor-pointer items-center gap-2" htmlFor="oil-event-density-story">
                    <input
                      id="oil-event-density-story"
                      type="radio"
                      name="oil-event-density"
                      checked={oilEventStoryMode}
                      onChange={() => setOilEventStoryMode(true)}
                    />
                    Story (major markers)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2" htmlFor="oil-event-density-data">
                    <input
                      id="oil-event-density-data"
                      type="radio"
                      name="oil-event-density"
                      checked={!oilEventStoryMode}
                      onChange={() => setOilEventStoryMode(false)}
                    />
                    Data (all point events)
                  </label>
                </div>
                <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [oilSource?.name, cpiDeflationExtraExport])}
                tooltipValueBasisNote={usdTooltipBasisNote}
                  data={[]}
                  valueKey="value"
                  label={isOilGlobalLong ? "Oil price" : "Brent oil"}
                  events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                  anchorEventId={anchorEventId || undefined}
                  secondSeries={{
                    label: isOilGlobalLong ? "Oil price" : "Brent oil",
                    unit: "USD/barrel",
                    points: oilPointsWithVolatility,
                    yAxisIndex: 1,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  }}
                  oilShockDates={oilShockDates}
                  showOilShocks={showShocks}
                  timeRange={oilTimeRange ?? study.timeRange}
                  mutedBands={isOilGlobalLong}
                  highlightLatestPoint
                  oilPublicationLayout
                  oilEventDensity={oilEventStoryMode ? "story" : "data"}
                  chartRangeGranularity="day"
                />
                {showShocks && oilShockDates.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <span
                      className="shrink-0 rounded-full"
                      style={{ width: 8, height: 8, background: "rgba(180, 30, 30, 0.6)" }}
                    />
                    Oil price shock (&gt;2× recent volatility)
                  </div>
                )}
                {dailyReturnPoints.length > 0 && (
                  <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [oilSource?.name])}
                    data={dailyReturnPoints as { date: string; value: number }[]}
                    valueKey="value"
                    label="Daily return"
                    unit="%"
                    timeRange={oilTimeRange ?? study.timeRange}
                    chartHeight={`${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-64`}
                    referenceLine={{ value: 0, label: "0%" }}
                    gridRight="12%"
                    chartLineRole="secondary"
                    chartRangeGranularity="day"
                  />
                )}
              </div>
              <LearningNote locale={isFa ? "fa" : "en"}
                  sections={[
                    {
                      heading: "What this means",
                      bullets: [
                        "Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.",
                        "This chart shows its spot price in USD, reflecting international market conditions.",
                        "Nominal oil is used as a context signal for energy and commodity markets.",
                        "Daily resolution supports event-anchored analysis.",
                      ],
                    },
                    {
                      heading: "Reading guidance",
                      bullets: [
                        "Y-axis: USD per barrel. Scale is linear.",
                        "Resolution: daily. Event overlays are exogenous; use for context only.",
                      ],
                    },
                    {
                      heading: "Pitfalls",
                      bullets: [
                        "Nominal prices are not inflation-adjusted; use real oil for long-term comparison.",
                        "Do not infer causality from event overlays. Regional premiums differ from spot.",
                      ],
                    },
                  ]}
                />
              {displayStudy.observations?.length ? <DataObservations locale={isFa ? "fa" : "en"} observations={displayStudy.observations ?? []} /> : null}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026" locale={isFa ? "fa" : "en"}>
                <p>
                  As of March 2026, Brent crude trades in a moderate range relative to the 2021–2024 period. Volatility
                  has eased from the spikes seen in 2022. Nominal levels remain above the pre-2020 average.
                </p>
                <p>
                  Limitation: Nominal prices are not inflation-adjusted; for long-term comparison, use the real oil
                  study. Spot data may lag by one trading day.
                </p>
              </CurrentSnapshot>
              {oilSource && (
                <SourceInfo
                  items={[
                    {
                      label: isOilGlobalLong ? "Oil" : "Brent oil",
                      sourceName: oilSource.name,
                      sourceUrl: oilSource.url,
                      sourceDetail: isOilGlobalLong
                        ? "Pre-1987: EIA annual; from 1987: FRED Brent daily"
                        : oilSource.series_id,
                      unitLabel: "USD/bbl",
                      unitNote: "bbl = barrel (42 US gal ≈ 159 L)",
                    },
                  ]}
                />
              )}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.
                  This chart shows how its price has moved over time.
                </p>
                <p>
                  It gives you a sense of the broader backdrop for energy costs and risk—when prices spike or fall, that context matters for many decisions.
                  The chart does not predict anything or prove cause and effect. It simply displays the pattern so you can see what happened when.
                </p>
              </InSimpleTerms>
            </>
          ) : isOilAndFx ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <NominalRealToggle mode={monetarySeriesMode} onChange={setMonetarySeriesMode} isFa={isFa} />
              </div>
              {oilShockDates.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2" htmlFor="oil-fx-chart-show-shocks">
                  <input
                    id="oil-fx-chart-show-shocks"
                    name="oil_fx_chart_show_shocks"
                    type="checkbox"
                    checked={showShocks}
                    onChange={(e) => setShowShocks(e.target.checked)}
                  />
                  Show shocks
                </label>
              )}
              {showGold ? (
                <>
                  <MultiSeriesStats
                    series={[
                      { label: "Brent oil", unit: "USD/barrel", points: oilPointsWithVolatility },
                      { label: "USD→Toman", unit: "toman/USD", points: fxPoints },
                      { label: "Gold price", unit: "USD/oz", points: goldPointsUsdDisplay },
                    ]}
                    timeRange={dualTimeRange ?? undefined}
                  />
                  <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      oilSource?.name,
                      fxSource?.name,
                      goldSource?.name,
                      cpiDeflationExtraExport,
                    ])}
                    tooltipValueBasisNote={usdTooltipBasisNote}
                    data={[]}
                    valueKey="value"
                    label="Brent oil"
                    events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={[
                      {
                        key: "oil",
                        label: "Brent oil",
                        yAxisIndex: 0,
                        unit: "USD/barrel",
                        points: oilPointsWithVolatility,
                        color: SIGNAL_CONCEPT.oil_price,
                        symbol: "triangle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "fx",
                        label: "USD→Toman",
                        yAxisIndex: 1,
                        unit: "toman/USD",
                        points: fxPoints,
                        color: SIGNAL_CONCEPT.exchange_rate,
                        symbol: "diamond",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                      {
                        key: "gold",
                        label: "Gold price",
                        yAxisIndex: 2,
                        unit: "USD/oz",
                        points: goldPointsUsdDisplay,
                        color: SIGNAL_CONCEPT.gold_spot,
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE,
                      },
                    ]}
                  oilShockDates={oilShockDates}
                  showOilShocks={showShocks}
                  timeRange={dualTimeRange ?? study.timeRange}
                  chartRangeGranularity="month"
                />
                </>
              ) : (
                <>
                  <MultiSeriesStats
                    series={[
                      { label: "Brent oil", unit: "USD/barrel", points: oilPointsWithVolatility },
                      { label: "USD→Toman", unit: "toman/USD", points: fxPoints },
                    ]}
                    timeRange={dualTimeRange ?? undefined}
                  />
                  <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                    exportSourceFooter={studyChartExportSource(isFa, [
                      oilSource?.name,
                      fxSource?.name,
                      cpiDeflationExtraExport,
                    ])}
                    tooltipValueBasisNote={usdTooltipBasisNote}
                    data={oilPointsWithVolatility}
                  valueKey="value"
                  label="Brent oil"
                  unit="USD/barrel"
                  events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                  anchorEventId={anchorEventId || undefined}
                  secondSeries={{
                    label: "USD→Toman",
                    unit: "toman/USD",
                    points: fxPoints,
                    yAxisIndex: 1,
                    symbol: "triangle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                  }}
                  oilShockDates={oilShockDates}
                  showOilShocks={showShocks}
                  timeRange={dualTimeRange ?? study.timeRange}
                  chartRangeGranularity="month"
                />
                </>
              )}
              {showShocks && oilShockDates.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: "rgba(180, 30, 30, 0.6)" }}
                  />
                  Oil price shock (&gt;2× recent volatility)
                </div>
              )}
              {(oilSource || fxSource) && (
                <SourceInfo
                  items={[
                    ...(oilSource
                      ? [
                          {
                            label: "Brent oil",
                            sourceName: oilSource.name,
                            sourceUrl: oilSource.url,
                            sourceDetail: oilSource.series_id,
                            unitLabel: "USD/bbl",
                            unitNote: "bbl = barrel (42 US gal ≈ 159 L)",
                          },
                        ]
                      : []),
                    ...(fxSource
                      ? [
                          {
                            label: "USD→Toman",
                            sourceName: fxSource.name,
                            sourceUrl: fxSource.url,
                            sourceDetail: fxSource.publisher,
                            unitLabel: "toman/USD",
                            unitNote: "1 toman = 10 rials",
                          },
                        ]
                      : []),
                    ...(showGold
                      ? [
                          {
                            label: "Gold",
                            sourceName: "LBMA / Treasury",
                            sourceUrl: "https://www.gold.org/goldhub/data/gold-prices",
                            sourceDetail: "annual data only",
                            unitLabel: "USD/oz",
                          },
                        ]
                      : []),
                  ]}
                />
              )}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices.
                  This chart shows two things side by side: Brent oil prices and the exchange rate between the US dollar and the Iranian toman.
                </p>
                <p>
                  It tries to give context—when oil moves, how does the local currency move? When both move together or apart, that pattern can be informative.
                  The chart does not explain why they move or prove any cause. It simply displays the pattern so you can see what happened when.
                </p>
              </InSimpleTerms>
            </>
          ) : isFxIranCurrencyRegime ? (
            <>
              <MultiSeriesStats
                series={[
                  {
                    label: L(isFa, "Open market", "بازار آزاد"),
                    unit: L(isFa, "toman/USD", "تومان/دلار"),
                    points: fxDualOpenPoints,
                  },
                  ...(fxRegimeShowOfficial
                    ? [
                        {
                          label: L(isFa, "Official (WDI, annual)", "رسمی (WDI، سالانه)"),
                          unit: L(isFa, "toman/USD", "تومان/دلار"),
                          points: fxDualOfficialPoints,
                        },
                      ]
                    : []),
                  ...(showFxSpread
                    ? [
                        {
                          label: L(isFa, "Spread (approx. %)", faEconomic.fxSpreadApproxPct),
                          unit: "%",
                          points: fxDualYearSpreadPoints,
                        },
                      ]
                    : []),
                ]}
                timeRange={fxIranRegimeTimeRange ?? undefined}
              />
              <TimelineChart
                chartLocale={chartLocaleForCharts}
                exportPresentationStudyHeading={displayStudy.title}
                xAxisYearLabel={chartYearAxisLabel}
                exportSourceFooter={studyChartExportSource(isFa, [
                  "World Bank (official rate, PA.NUS.FCRF); FRED PWT (XRNCUSIRA618NRUG) only where WDI has no year",
                  "Open market: FRED pre-2012; rial-archive + Bonbast when available",
                ])}
                data={[]}
                valueKey="value"
                label={L(isFa, "Open market (USD→toman)", "بازار آزاد (دلار→تومان)")}
                events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
                anchorEventId={anchorEventId || undefined}
                timeRange={fxIranRegimeTimeRange ?? study.timeRange}
                highlightLatestPoint
                forceTimeAxis
                yAxisLog={fxUsdTomanYAxisLog}
                yAxisNameSuffix={
                  fxUsdTomanYAxisLog ? L(isFa, "(log₁₀ scale)", "(لگ ۱۰)") : undefined
                }
                chartRangeGranularity="month"
                exportFileStem="iran-fx-regime"
                yAxisDetailNote={L(
                  isFa,
                  "Y-axis: open-market tomans per USD. Series: merged rial-archive + Bonbast; pre-2012 uses annual FRED.",
                  "محور: تومان بازار آزاد به ازای هر دلار. سری: ادغام آرشیو نرخ ریال + بان‌بست؛ پیش از ۲۰۱۲ سالانهٔ FRED."
                )}
                multiSeries={[
                  {
                    key: "open",
                    label: L(
                      isFa,
                      "Open market (archive + Bonbast; FRED annual pre-2012)",
                      "بازار آزاد (آرشیو + بان‌بست؛ FRED سالانه پیش از ۲۰۱۲)"
                    ),
                    yAxisIndex: 0,
                    unit: L(isFa, "toman/USD", "تومان/دلار"),
                    points: fxDualOpenPoints,
                    color: SIGNAL_CONCEPT.fx_open,
                    symbol: "circle",
                    symbolSize: CHART_LINE_SYMBOL_SIZE,
                    showSymbol: false,
                    lineWidth: 2.25,
                    linePattern: "solid",
                  },
                  ...(fxRegimeShowOfficial && fxDualOfficialPoints.length > 0
                    ? [
                        {
                          key: "official",
                          label: L(isFa, "Official (WDI, annual)", "رسمی (WDI، سالانه)"),
                          yAxisIndex: 0,
                          unit: L(isFa, "toman/USD", "تومان/دلار"),
                          points: fxDualOfficialPoints,
                          color: SIGNAL_CONCEPT.fx_official,
                          symbol: "diamond",
                          symbolSize: CHART_LINE_SYMBOL_SIZE * 0.85,
                          showSymbol: false,
                          lineWidth: 1.5,
                          linePattern: "dashed" as const,
                        } satisfies ChartSeries,
                      ]
                    : []),
                  ...(showFxSpread && fxDualYearSpreadPoints.length > 0
                    ? [
                        {
                          key: "spread",
                          label: L(isFa, "Spread (%)", faEconomic.fxSpreadPct),
                          yAxisIndex: 1,
                          unit: "%",
                          color: SIGNAL_CONCEPT.fx_spread,
                          symbol: "triangle",
                          symbolSize: CHART_LINE_SYMBOL_SIZE,
                          points: fxDualYearSpreadPoints,
                        } as ChartSeries,
                      ]
                    : []),
                ]}
              />
              <LearningNote locale={isFa ? "fa" : "en"}
                sections={[
                  {
                    heading: L(isFa, "Three rates", "سه نما"),
                    bullets: [
                      L(
                        isFa,
                        "Open market: the merged Bonbast / rial-archive / FRED series—closest to the exchange rate people actually trade at in normal times.",
                        "بازار آزاد: سری ادغام‌شدهٔ بان‌بست / آرشیو / FRED — نزدیک‌تر به نرخی که در شرایط عادی معامله می‌شود."
                      ),
                      L(
                        isFa,
                        "Official rate: policy-controlled proxy from international statistics (WDI annual, with FRED backfill)—not a street quote.",
                        "نرخ رسمی: پراکسی کنترل‌شدهٔ سیاست از آمار بین‌المللی (WDI سالانه، با پرکن FRED) — نه قیمت خیابان."
                      ),
                      L(
                        isFa,
                        "Spread (optional): yearly gap between mean open and official, expressed as a percentage—useful as a distortion indicator when both exist for that year.",
                        "شکاف (اختیاری): فاصلهٔ سالانه بین میانگین بازار آزاد و رسمی به صورت درصد — وقتی هر دو برای آن سال هستند، به‌عنوان نشانگر اعوجاج مفید است."
                      ),
                    ],
                  },
                  {
                    heading: L(isFa, "Measurement limits", "محدودیت اندازه‌گیری"),
                    bullets: [
                      L(
                        isFa,
                        "Official and open lines may start/end in different years; spread is only computed when both sides have data in the same calendar year.",
                        "خطوط رسمی و آزاد ممکن است سال شروع/پایان متفاوت داشته باشند؛ شکاف فقط وقتی هر دو در همان سال میلادی داده دارند محاسبه می‌شود."
                      ),
                    ],
                  },
                ]}
              />
              {(fxDualOpenSource || fxDualOfficialSource) && (
                <SourceInfo
                  items={[
                    ...(fxDualOpenSource
                      ? [
                          {
                            label: L(isFa, "Open market", "بازار آزاد"),
                            sourceName: fxDualOpenSource.name ?? "Bonbast + rial-archive",
                            sourceUrl: fxDualOpenSource.url || undefined,
                            sourceDetail: fxDualOpenSource.publisher ?? "",
                            unitLabel: L(isFa, "toman/USD", "تومان/دلار"),
                            unitNote: fxDualOpenSource.notes ?? undefined,
                          },
                        ]
                      : []),
                    ...(fxDualOfficialSource
                      ? [
                          {
                            label: L(isFa, "Official (WDI + PWT backfill)", "رسمی (WDI + پرکن PWT)"),
                            sourceName: fxDualOfficialSource.name ?? "World Bank WDI",
                            sourceUrl: fxDualOfficialSource.url || undefined,
                            sourceDetail: fxDualOfficialSource.publisher ?? "",
                            unitLabel: L(isFa, "toman/USD", "تومان/دلار"),
                            unitNote: fxDualOfficialSource.notes ?? undefined,
                          },
                        ]
                      : []),
                  ]}
                  note="Official: WDI (annual) + PWT (FRED) for missing years. Open: FRED pre-2012; rial-archive + Bonbast. 1 toman = 10 rials."
                />
              )}
              {study.concepts?.length ? <ConceptsUsed locale={isFa ? "fa" : "en"} conceptKeys={study.concepts} /> : null}
              <InSimpleTerms locale={isFa ? "fa" : "en"}>
                <p>
                  {L(
                    isFa,
                    "By default you see only the open-market rate—the signal closest to the lived economy. Turn on the official rate to compare policy-controlled reference levels. The optional spread summarizes how far those two diverge in a year (when both are defined)—a distortion indicator, not a causal explanation.",
                    "پیش‌فرض فقط بازار آزاد است — نزدیک‌تر به نرخ تجربه‌شده. نرخ رسمی را برای مقایسهٔ سیاست می‌توان روشن کرد؛ شکاف سالانه فاصلهٔ آن دو را توصیفی نشان می‌دهد، نه علت یا پیش‌بینی."
                  )}
                </p>
              </InSimpleTerms>
            </>
          ) : data ? (
            <TimelineChart
              chartLocale={chartLocaleForCharts}
              exportPresentationStudyHeading={displayStudy.title}
              xAxisYearLabel={chartYearAxisLabel}
              exportSourceFooter={studyChartExportSource(
                isFa,
                showOil ? [oilSource?.name, "YouTube Data API"] : ["YouTube Data API"]
              )}
              data={data.timeline}
              valueKey="value"
              label="Sentiment"
              events={withTimeSeriesEventOverlay(showTimeSeriesEventOverlay, events)}
              anchorEventId={anchorEventId || undefined}
              secondSeries={
                showOil
                  ? {
                      label: "Brent oil",
                      unit: "USD/barrel",
                      points: oilPoints,
                      yAxisIndex: 1,
                    }
                  : undefined
              }
              timeRange={data.time_range}
            />
          ) : null}
            </>
          )}
        </CardContent>
      </Card>
      )}
      </div>
    </StudyChartExportFilenameProvider>
  );
}
