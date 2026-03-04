"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart, type ChartSeries } from "@/components/timeline-chart";
import { SourceInfo } from "@/components/source-info";
import { RealOilDescription } from "@/components/real-oil-description";
import { OilPppIranDescription } from "@/components/oil-ppp-iran-description";
import { LearningNote } from "@/components/learning-note";
import { DataObservations } from "@/components/data-observations";
import { ConceptsUsed } from "@/components/concepts-used";
import { CurrentSnapshot } from "@/components/current-snapshot";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { EventsTimeline, type TimelineEvent } from "@/components/events-timeline";
import { FollowerGrowthChart } from "@/components/follower-growth-chart";
import { NetworkGraph, type NetworkNode, type NetworkEdge } from "@/components/network-graph";
import { getStudyById, getPrevNextStudies } from "@/lib/studies";
import { fetchJson } from "@/lib/api";
import { enrichOilPointsWithVolatility } from "@/lib/oil-volatility";

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
  date?: string;
  date_start?: string;
  date_end?: string;
  type?: string;
  description?: string;
  confidence?: string;
  sources?: string[];
  layer?: "iran_core" | "world_core" | "world_1900" | "sanctions" | "iran_presidents" | "opec_decisions";
  scope?: "iran" | "world" | "sanctions" | "oil_exports";
  category?: string;
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

const WINDOW_OPTIONS = [
  { value: 1, label: "±1 year" },
  { value: 2, label: "±2 years" },
  { value: 5, label: "±5 years" },
] as const;

const WINDOW_OPTIONS_LONG_RANGE = [
  { value: 2, label: "±2 years" },
  { value: 5, label: "±5 years" },
  { value: 10, label: "±10 years" },
] as const;

function computeWindowRange(eventDate: string, windowYears: number): [string, string] {
  const d = new Date(eventDate);
  const start = new Date(d);
  start.setFullYear(start.getFullYear() - windowYears);
  const end = new Date(d);
  end.setFullYear(end.getFullYear() + windowYears);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function computeOilKpis(points: { value: number }[]) {
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return {
    avg: Math.round(avg).toLocaleString(),
    min: Math.round(min).toLocaleString(),
    max: Math.round(max).toLocaleString(),
  };
}

function computeFxKpis(points: { date: string; value: number }[]) {
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const latest = points[points.length - 1]?.value;
  return {
    latest: latest != null ? latest.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—",
    min: Math.min(...vals).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    max: Math.max(...vals).toLocaleString(undefined, { maximumFractionDigits: 0 }),
  };
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

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.studyId as string;
  const studyRaw = getStudyById(studyId);
  const study = studyRaw?.visible !== false ? studyRaw : undefined;
  const [data, setData] = useState<OverviewData | null>(null);
  const [events, setEvents] = useState<EventsData["events"]>([]);
  const [anchorEventId, setAnchorEventId] = useState<string>("");
  const [windowYears, setWindowYears] = useState<number>(2);
  const [showOil, setShowOil] = useState(false);
  const [showGold, setShowGold] = useState(false);
  const [showIranEvents, setShowIranEvents] = useState(true);
  const [showWorldEvents, setShowWorldEvents] = useState(false);
  const [showSanctionsEvents, setShowSanctionsEvents] = useState(true);
  const [showPresidentialTerms, setShowPresidentialTerms] = useState(false);
  const [showOpecEvents, setShowOpecEvents] = useState(true);
  const [pppYAxisLog, setPppYAxisLog] = useState(true);
  const [showSanctionsPeriods, setShowSanctionsPeriods] = useState(false);
  const [showShocks, setShowShocks] = useState(true);
  const [oilPoints, setOilPoints] = useState<OilSignalData["points"]>([]);
  const [oilSource, setOilSource] = useState<OilSource | null>(null);
  const [oilSourceAnnual, setOilSourceAnnual] = useState<OilSource | null>(null);
  const [oilResolutionNote, setOilResolutionNote] = useState<string | null>(null);
  const [goldPoints, setGoldPoints] = useState<OilSignalData["points"]>([]);
  const [goldSource, setGoldSource] = useState<OilSource | null>(null);
  const [fxPoints, setFxPoints] = useState<FxUsdTomanSignalData["points"]>([]);
  const [fxSource, setFxSource] = useState<FxUsdTomanSource | null>(null);
  const [realOilPoints, setRealOilPoints] = useState<RealOilSignalData["points"]>([]);
  const [realOilSource, setRealOilSource] = useState<RealOilSignalData["source"] | null>(null);
  const [realOilMetadata, setRealOilMetadata] = useState<RealOilSignalData["metadata"] | null>(null);
  const [pppIranPoints, setPppIranPoints] = useState<OilPppIranSignalData["points"]>([]);
  const [pppIranSource, setPppIranSource] = useState<OilPppIranSignalData["source"] | null>(null);
  const [pppTurkeyPoints, setPppTurkeyPoints] = useState<OilPppIranSignalData["points"]>([]);
  const [pppTurkeySource, setPppTurkeySource] = useState<OilPppIranSignalData["source"] | null>(null);
  const [exportCapacityOilPoints, setExportCapacityOilPoints] = useState<{ date: string; value: number }[]>([]);
  const [exportCapacityProxyPoints, setExportCapacityProxyPoints] = useState<{ date: string; value: number }[]>([]);
  const [exportCapacityBaseYear, setExportCapacityBaseYear] = useState<number | null>(null);
  const [productionUsPoints, setProductionUsPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionSaudiPoints, setProductionSaudiPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionRussiaPoints, setProductionRussiaPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionIranPoints, setProductionIranPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionTotalPoints, setProductionTotalPoints] = useState<{ date: string; value: number }[]>([]);
  const [productionSource, setProductionSource] = useState<{ name: string; url?: string; publisher?: string } | null>(null);
  const [fxDualOfficialPoints, setFxDualOfficialPoints] = useState<{ date: string; value: number }[]>([]);
  const [fxDualOpenPoints, setFxDualOpenPoints] = useState<{ date: string; value: number }[]>([]);
  const [fxDualOfficialSource, setFxDualOfficialSource] = useState<FxUsdTomanSource | null>(null);
  const [fxDualOpenSource, setFxDualOpenSource] = useState<FxUsdTomanSource | null>(null);
  const [showFxSpread, setShowFxSpread] = useState(false);
  const [fxDualYAxisLog, setFxDualYAxisLog] = useState(false);
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
  const [fgMetadata, setFgMetadata] = useState<{
    source?: "cache" | "live" | "mixed";
    count?: number;
    last_cached_at?: string | null;
  } | null>(null);

  const isOverviewStub = study?.primarySignal.kind === "overview_stub";
  const isOilBrent = study?.primarySignal.kind === "oil_brent";
  const isOilGlobalLong = study?.primarySignal.kind === "oil_global_long";
  const isGoldAndOil = study?.primarySignal.kind === "gold_and_oil";
  const isFxUsdToman = study?.primarySignal.kind === "fx_usd_toman";
  const isOilAndFx = study?.primarySignal.kind === "oil_and_fx";
  const isRealOil = study?.primarySignal.kind === "real_oil";
  const isOilPppIran = study?.primarySignal.kind === "oil_ppp_iran";
  const hasTurkeyComparator = study?.comparatorCountry === "Turkey";
  const isOilExportCapacity = study?.primarySignal.kind === "oil_export_capacity";
  const isOilProductionMajorExporters = study?.primarySignal.kind === "oil_production_major_exporters";
  const isEventsTimeline = study?.primarySignal.kind === "events_timeline";
  const isFollowerGrowthDynamics = study?.primarySignal.kind === "follower_growth_dynamics";
  const isFxUsdIrrDual = study?.primarySignal.kind === "fx_usd_irr_dual";
  const isWageCpiReal = study?.primarySignal.kind === "wage_cpi_real";
  const isOilTradeNetwork = study?.primarySignal.kind === "oil_trade_network";

  const windowOptions = isGoldAndOil ? WINDOW_OPTIONS_LONG_RANGE : WINDOW_OPTIONS;
  const effectiveWindowYears = useMemo(
    () => (windowOptions.some((o) => o.value === windowYears) ? windowYears : windowOptions[0].value),
    [isGoldAndOil, windowYears]
  );

  const oilTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    return study.timeRange;
  }, [study, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran, isOilExportCapacity, anchorEventId, events, effectiveWindowYears]);

  const exportCapacityTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilExportCapacity) return null;
    return study.timeRange;
  }, [study, isOilExportCapacity]);

  const productionTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilProductionMajorExporters) return null;
    const [start, end] = study.timeRange;
    const resolvedEnd = end === "today" ? new Date().toISOString().slice(0, 10) : end;
    return [start, resolvedEnd];
  }, [study, isOilProductionMajorExporters]);

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

  const networkYears = useMemo(() => {
    const yrs = Object.keys(networkYearsData).sort();
    return yrs;
  }, [networkYearsData]);

  const { networkNodesForYear, networkEdgesForYear } = useMemo(() => {
    const yrs = Object.keys(networkYearsData).sort();
    const year = networkSelectedYear || yrs[yrs.length - 1] || "";
    const edges = year ? (networkYearsData[year] ?? []) : [];
    const ids = new Set<string>();
    for (const e of edges) {
      ids.add(e.source);
      ids.add(e.target);
    }
    const nodes = [...ids].sort().map((id) => ({ id }));
    return { networkNodesForYear: nodes, networkEdgesForYear: edges };
  }, [networkYearsData, networkSelectedYear]);

  const fxDualTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isFxUsdIrrDual) return null;
    return study.timeRange;
  }, [study, isFxUsdIrrDual]);

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
    if (!study || !(isFxUsdToman || isOilAndFx)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    return study.timeRange;
  }, [study, isFxUsdToman, isOilAndFx, anchorEventId, events, effectiveWindowYears]);

  const dualTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilAndFx) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowYears);
      }
    }
    return study.timeRange;
  }, [study, isOilAndFx, anchorEventId, events, effectiveWindowYears]);

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

  const sanctionsPeriodsFromEvents = useMemo(() => {
    if (!isOilExportCapacity || !showSanctionsPeriods || !study) return undefined;
    const rangeEnd = exportCapacityTimeRange?.[1] ?? study.timeRange[1];
    return events
      .filter((e): e is Event & { date_start: string } => e.scope === "oil_exports" && !!e.date_start)
      .map((e) => ({
        date_start: e.date_start,
        date_end: e.date_end ?? rangeEnd,
        title: e.title,
        scope: "Oil exports" as const,
      }));
  }, [isOilExportCapacity, showSanctionsPeriods, study, events, exportCapacityTimeRange]);

  const oilPointsWithVolatility = useMemo(
    () => enrichOilPointsWithVolatility(oilPoints),
    [oilPoints]
  );
  const oilShockDates = useMemo(
    () => oilPointsWithVolatility.filter((p) => p.is_shock).map((p) => p.date),
    [oilPointsWithVolatility]
  );
  const dailyReturnPoints = useMemo(() => {
    const byDate = new Map(oilPointsWithVolatility.map((p) => [p.date, p.daily_return]));
    const dates = [...new Set(oilPointsWithVolatility.map((p) => p.date))].sort();
    return dates.map((date) => ({
      date,
      value: byDate.get(date) as number | null,
    }));
  }, [oilPointsWithVolatility]);

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    const params = new URLSearchParams({
      study_id: isFxUsdToman || isOilAndFx ? "iran" : studyId,
    });
    const hasEventLayers = isOverviewStub || isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity || isOilProductionMajorExporters || isWageCpiReal || isEventsTimeline;
    if (hasEventLayers && !isEventsTimeline) {
      let layers: string[];
      if (((isOilGlobalLong || isGoldAndOil || isRealOil || isOilExportCapacity || isOilProductionMajorExporters) && study.eventLayers?.length) || (hasTurkeyComparator && study.eventLayers !== undefined)) {
        if (isOilExportCapacity) {
          layers = showSanctionsPeriods ? ["sanctions"] : [];
        } else if (isOilProductionMajorExporters) {
          layers = [
            ...(showIranEvents ? ["iran_core"] : []),
            ...(showSanctionsEvents ? ["sanctions"] : []),
            ...(showOpecEvents ? ["opec_decisions"] : []),
          ];
        } else {
          layers = study.eventLayers ?? [];
        }
      } else {
        layers = [
          ...(showIranEvents ? ["iran_core"] : []),
          ...(showWorldEvents ? ["world_core", "world_1900"] : []),
          ...(showSanctionsEvents ? ["sanctions"] : []),
          ...(showPresidentialTerms && (isFxUsdToman || isOilPppIran) ? ["iran_presidents"] : []),
        ];
      }
      params.set("layers", layers.length ? layers.join(",") : "none");
    }
    if (isEventsTimeline) {
      params.set("study_id", "events_timeline");
    }
    fetchJson<EventsData>(`/api/events?${params}`)
      .then((res) => {
        if (mounted) {
          const evs = res.events ?? [];
          if (isOilProductionMajorExporters) {
            console.debug("[Study14] Event fetch layers:", params.get("layers"), "events returned:", evs.length, evs);
          }
          setEvents(evs);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, isOilBrent, isOilGlobalLong, isGoldAndOil, isFxUsdToman, isOilAndFx, isRealOil, isOilPppIran, isOilExportCapacity, isOilProductionMajorExporters, isWageCpiReal, hasTurkeyComparator, isEventsTimeline, showIranEvents, showWorldEvents, showSanctionsEvents, showPresidentialTerms, showSanctionsPeriods, showOpecEvents]);

  useEffect(() => {
    if (study && (isEventsTimeline || isFollowerGrowthDynamics)) {
      setLoading(false);
    }
  }, [study, isEventsTimeline, isFollowerGrowthDynamics]);

  useEffect(() => {
    if (!study || !isOilTradeNetwork) return;
    let mounted = true;
    setLoading(true);
    fetchJson<{ years: Record<string, NetworkEdge[]> }>("/api/networks/oil-trade")
      .then((res) => {
        if (mounted && res.years) {
          setNetworkYearsData(res.years);
          const yrs = Object.keys(res.years).sort();
          if (yrs.length > 0) setNetworkSelectedYear(yrs[yrs.length - 1]!);
        }
      })
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Network fetch failed"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [study, isOilTradeNetwork]);

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
    if (!oilTimeRange || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran)) {
      if (isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran) {
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
        }
      }
      return;
    }
    if (isOilAndFx) return;
    if (isOilPppIran) {
      const [start, end] = oilTimeRange;
      let mounted = true;
      setLoading(true);
      setError(null);
      fetchJson<OilPppIranSignalData>(`/api/signals/oil/ppp-iran?start=${start}&end=${end}`)
        .then((res) => {
          if (mounted) {
            setPppIranPoints(res.points ?? []);
            setPppIranSource(res.source ?? null);
          }
        })
        .catch((e) => {
          if (mounted) {
            setPppIranPoints([]);
            setPppIranSource(null);
            setError(e instanceof Error ? e.message : "Signal fetch failed");
          }
        })
        .finally(() => mounted && setLoading(false));
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
    const url = isOilGlobalLong
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
  }, [oilTimeRange, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran]);

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
    if (!fxDualTimeRange || !isFxUsdIrrDual) {
      if (isFxUsdIrrDual) {
        setFxDualOfficialPoints([]);
        setFxDualOpenPoints([]);
        setFxDualOfficialSource(null);
        setFxDualOpenSource(null);
      }
      return;
    }
    const [start, end] = fxDualTimeRange;
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
  }, [fxDualTimeRange, isFxUsdIrrDual]);

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
          setFxPoints((results[1] as FxUsdTomanSignalData).points ?? []);
          setFxSource((results[1] as FxUsdTomanSignalData).source ?? null);
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
    if (!fxTimeRange || !(isFxUsdToman || isOilAndFx)) {
      if (isFxUsdToman || isOilAndFx) {
        setFxPoints([]);
        setFxSource(null);
      }
      return;
    }
    if (isOilAndFx) return;
    const [start, end] = fxTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<FxUsdTomanSignalData>(`/api/signals/fx/usd-toman?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setFxPoints(res.points ?? []);
          setFxSource(res.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setFxPoints([]);
          setFxSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fxTimeRange, isFxUsdToman, isOilAndFx]);

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

  if (!study) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 space-y-4">
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

  const showError = error || (isOverviewStub && !data);

  const isSingleSignalStudy = isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity || isOilProductionMajorExporters || isFxUsdIrrDual || isWageCpiReal || isOilTradeNetwork;
  const singleSignalReady =
    isGoldAndOil
      ? goldPoints.length > 0 && oilPoints.length > 0
      : isOilBrent || isOilGlobalLong
      ? oilPoints.length > 0
      : isFxUsdToman
        ? fxPoints.length > 0
        : isOilAndFx
          ? oilPoints.length > 0 && fxPoints.length > 0
          : isRealOil
            ? realOilPoints.length > 0
            : isOilPppIran
              ? pppIranPoints.length > 0
              : isOilExportCapacity
                ? exportCapacityOilPoints.length > 0 && exportCapacityProxyPoints.length > 0
                : isOilProductionMajorExporters
                  ? productionUsPoints.length > 0 || productionSaudiPoints.length > 0 || productionRussiaPoints.length > 0 || productionIranPoints.length > 0
                  : isFxUsdIrrDual
                  ? fxDualOpenPoints.length > 0
                  : isWageCpiReal
                    ? wageNominalPoints.length > 0 && wageCpiPoints.length > 0
                    : isOilTradeNetwork
                      ? networkNodesForYear.length > 0
                      : false;
  if (loading && (isOverviewStub ? !data : isSingleSignalStudy && !singleSignalReady)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 animate-pulse space-y-8">
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
      <div className="container mx-auto max-w-4xl py-12 space-y-4">
        <p className="text-muted-foreground">{error || "No data available"}</p>
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
  const fxKpis = isFxUsdToman ? computeFxKpis(fxPoints) : null;

  /** Header date range: min/max from all data arrays. Expand to requested range when chart axis extends beyond data. */
  const displayTimeRange = (() => {
    const collect = (arr: { date: string }[]) => arr.map((p) => p.date);

    const allDates: string[] = [];
    if ((isFxUsdToman || isOilAndFx) && fxPoints.length > 0) allDates.push(...collect(fxPoints));
    if ((isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx) && oilPoints.length > 0) allDates.push(...collect(oilPoints));
    if (isGoldAndOil && goldPoints.length > 0) allDates.push(...collect(goldPoints));
    if (isRealOil && realOilPoints.length > 0) allDates.push(...collect(realOilPoints));
    if (isOilPppIran && pppIranPoints.length > 0) allDates.push(...collect(pppIranPoints));
    if (hasTurkeyComparator && pppTurkeyPoints.length > 0) allDates.push(...collect(pppTurkeyPoints));
    if (isOilExportCapacity) {
      if (exportCapacityOilPoints.length > 0) allDates.push(...collect(exportCapacityOilPoints));
      if (exportCapacityProxyPoints.length > 0) allDates.push(...collect(exportCapacityProxyPoints));
    }
    if (isOilProductionMajorExporters) {
      if (productionUsPoints.length > 0) allDates.push(...collect(productionUsPoints));
      if (productionSaudiPoints.length > 0) allDates.push(...collect(productionSaudiPoints));
      if (productionRussiaPoints.length > 0) allDates.push(...collect(productionRussiaPoints));
      if (productionIranPoints.length > 0) allDates.push(...collect(productionIranPoints));
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
    if (isFxUsdIrrDual) {
      if (fxDualOpenPoints.length > 0) allDates.push(...collect(fxDualOpenPoints));
      if (fxDualOfficialPoints.length > 0) allDates.push(...collect(fxDualOfficialPoints));
    }
    if (isWageCpiReal) {
      if (wageNominalPoints.length > 0) allDates.push(...collect(wageNominalPoints));
      if (wageCpiPoints.length > 0) allDates.push(...collect(wageCpiPoints));
    }
    if (isOilTradeNetwork && networkYears.length > 0) {
      return [networkYears[0]!, networkYears[networkYears.length - 1]!] as [string, string];
    }
    const requestedRange =
      oilTimeRange ?? fxTimeRange ?? dualTimeRange ?? exportCapacityTimeRange ?? productionTimeRange ?? fxDualTimeRange ?? wageTimeRange ?? study.timeRange;
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
      if ((isFxUsdToman || isOilAndFx) && fxPoints.length > 0) arrays.push(fxPoints);
      if ((isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx) && oilPoints.length > 0) arrays.push(oilPoints);
      if (isGoldAndOil && goldPoints.length > 0) arrays.push(goldPoints);
      if (isRealOil && realOilPoints.length > 0) arrays.push(realOilPoints);
      if (isOilPppIran && pppIranPoints.length > 0) arrays.push(pppIranPoints);
      if (hasTurkeyComparator && pppTurkeyPoints.length > 0) arrays.push(pppTurkeyPoints);
      if (isOilExportCapacity) {
        if (exportCapacityOilPoints.length > 0) arrays.push(exportCapacityOilPoints);
        if (exportCapacityProxyPoints.length > 0) arrays.push(exportCapacityProxyPoints);
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
      if (isFxUsdIrrDual) {
        if (fxDualOpenPoints.length > 0) arrays.push(fxDualOpenPoints);
        if (fxDualOfficialPoints.length > 0) arrays.push(fxDualOfficialPoints);
      }
      if (isWageCpiReal) {
        if (wageNominalPoints.length > 0) arrays.push(wageNominalPoints);
        if (wageCpiPoints.length > 0) arrays.push(wageCpiPoints);
      }
      if (isOilTradeNetwork && networkYears.length > 0) {
        arrays.push(networkYears.map((y) => ({ date: `${y}-01-01` })));
      }
      return arrays;
    })()
  );

  const { prev: prevStudy, next: nextStudy } = getPrevNextStudies(study?.id ?? studyId);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10 min-w-0">
      <header className="space-y-1">
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/studies"
            className="text-xs text-muted-foreground hover:text-foreground inline-block"
          >
            ← Studies
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">
              Study {study.number}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {prevStudy ? (
              <Link
                href={`/studies/${prevStudy.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title={`Study ${prevStudy.number}: ${prevStudy.title}`}
              >
                <span aria-hidden>←</span>
                <span>Previous</span>
              </Link>
            ) : null}
            {prevStudy && nextStudy ? (
              <span className="text-muted-foreground/50">|</span>
            ) : null}
            {nextStudy ? (
              <Link
                href={`/studies/${nextStudy.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title={`Study ${nextStudy.number}: ${nextStudy.title}`}
              >
                <span>Next</span>
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        </div>
        <p className="text-lg text-muted-foreground">{study.title}</p>
        {study.subtitle ? (
          <p className="text-sm text-muted-foreground">{study.subtitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {displayTimeRange ? `${displayTimeRange[0]} — ${displayTimeRange[1]}` : "No data loaded"}
        </p>
        {latestDataDate && (
          <p className="text-sm text-muted-foreground">
            Data last available: {isOilTradeNetwork ? latestDataDate.getFullYear() : formatDate(latestDataDate)}
          </p>
        )}
        {lastUpdated && (
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(lastUpdated).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </header>

      {isEventsTimeline ? (
        <>
        <Card className="border-border min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Reference timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {study.description}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Hover over events for details. Toggle categories to focus.
            </p>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mr-2">Focus on event:</label>
              <select
                value={anchorEventId}
                onChange={(e) => setAnchorEventId(e.target.value)}
                className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Full timeline</option>
                {events
                  .filter((e): e is Event & { category: string } => !!e.category)
                  .sort((a, b) => (a.date_start ?? a.date ?? "").localeCompare(b.date_start ?? b.date ?? ""))
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
        {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
        <InSimpleTerms>
          <p>
            This timeline provides chronological context for political, economic, and geopolitical events.
            Use it as a reference when interpreting charts—events are anchors for understanding, not explanations of cause and effect.
          </p>
        </InSimpleTerms>
        </>
      ) : isFollowerGrowthDynamics ? (
        <>
          <Card className="border-border min-w-0 overflow-visible">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Follower growth dynamics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {study.description}
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
                <label className="flex flex-col gap-1" suppressHydrationWarning>
                  <span className="text-xs text-muted-foreground">Platform</span>
                  <select
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
                <label className="flex flex-col gap-1" suppressHydrationWarning>
                  <span className="text-xs text-muted-foreground">Handle</span>
                  <input
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
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fgShowLinear}
                      onChange={(e) => setFgShowLinear(e.target.checked)}
                      className="rounded border-border"
                    />
                    Linear model
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fgShowExponential}
                      onChange={(e) => setFgShowExponential(e.target.checked)}
                      className="rounded border-border"
                    />
                    Exponential model
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
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
          <LearningNote
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
          {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
          {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
          <InSimpleTerms>
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
      ) : isFxUsdIrrDual ? (
        <>
          <Card className="border-border overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Official vs open-market USD/IRR
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {study.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFxSpread}
                    onChange={(e) => setShowFxSpread(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show FX spread (%)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fxDualYAxisLog}
                    onChange={(e) => setFxDualYAxisLog(e.target.checked)}
                    className="rounded border-border"
                  />
                  Y-axis log scale
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Official"
                events={[]}
                yAxisLog={fxDualYAxisLog}
                yAxisNameSuffix={fxDualYAxisLog ? "log scale" : undefined}
                multiSeries={[
                  {
                    key: "official",
                    label: "Official (proxy)",
                    yAxisIndex: 0,
                    unit: "toman/USD",
                    points: fxDualOfficialPoints,
                  },
                  {
                    key: "open",
                    label: "Open market",
                    yAxisIndex: 0,
                    unit: "toman/USD",
                    points: fxDualOpenPoints,
                  },
                  ...(showFxSpread
                    ? [
                        {
                          key: "spread",
                          label: "Spread (%)",
                          yAxisIndex: 1,
                          unit: "%",
                          points: (() => {
                            const byDate: Record<string, number> = {};
                            fxDualOfficialPoints.forEach((p) => {
                              byDate[p.date] = p.value;
                            });
                            return fxDualOfficialPoints
                              .map((p) => {
                                const openPt = fxDualOpenPoints.find((o) => o.date === p.date);
                                if (!openPt || p.value === 0) return null;
                                return { date: p.date, value: ((openPt.value - p.value) / p.value) * 100 };
                              })
                              .filter((q): q is { date: string; value: number } => q != null);
                          })(),
                        } as ChartSeries,
                      ]
                    : []),
                ]}
                timeRange={fxDualTimeRange ?? study.timeRange}
                mutedBands={false}
              />
              <LearningNote
                sections={[
                  {
                    heading: "How to read this chart",
                    bullets: [
                      "Two lines: official rate (policy-set proxy, FRED annual) and open-market rate (toman per USD).",
                      "Same unit on the y-axis: toman per USD. Higher values mean a weaker rial/toman.",
                    ],
                  },
                  {
                    heading: "Why the FX spread matters",
                    bullets: [
                      "When official and market rates diverge, the gap reflects constraints and expectations rather than a single “true” price.",
                      "Large or persistent spreads often coincide with capital controls, rationing of foreign exchange, or informal markets.",
                    ],
                  },
                  {
                    heading: "Measurement choices & limitations",
                    bullets: [
                      "Official series used here is a FRED proxy (Penn World Table); it is annual and ends 2019.",
                      "Open-market data is from Bonbast/archive (daily where available). Different resolutions and sources imply the two series are not strictly comparable at each date.",
                      "Spread (%) is computed only where both series have a value; interpretation should allow for measurement gaps.",
                    ],
                  },
                  {
                    heading: "What this study does not claim",
                    bullets: [
                      "This study does not explain why the spread exists or what causes it to change.",
                      "It does not predict future rates or policy. It describes the coexistence of two rates and the gap between them.",
                    ],
                  },
                ]}
              />
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  ...(fxDualOfficialSource
                    ? [
                        {
                          label: "Official (proxy)",
                          sourceName: fxDualOfficialSource.name ?? "FRED",
                          sourceUrl: fxDualOfficialSource.url || undefined,
                          sourceDetail: fxDualOfficialSource.publisher ?? "",
                          unitLabel: "toman/USD",
                          unitNote: fxDualOfficialSource.notes ?? undefined,
                        },
                      ]
                    : []),
                  ...(fxDualOpenSource
                    ? [
                        {
                          label: "Open market",
                          sourceName: fxDualOpenSource.name ?? "",
                          sourceUrl: fxDualOpenSource.url || undefined,
                          sourceDetail: fxDualOpenSource.publisher ?? "",
                          unitLabel: "toman/USD",
                          unitNote: fxDualOpenSource.notes ?? undefined,
                        },
                      ]
                    : []),
                ]}
                note="Official series is annual and ends 2019. Open-market data is daily where available. Do not infer causality from the spread."
              />
              <InSimpleTerms>
                <p>
                  Iran has at times had an official exchange rate set by policy and a different rate at which people actually buy and sell currency in the open market.
                  This chart shows both: the official (proxy) series and the open-market rate. The gap between them is descriptive—it does not explain why the gap exists or what will happen next.
                </p>
                <p>
                  The study emphasizes constraint and measurement: two rates can coexist, and the way we measure them (sources, frequency) affects what we see. It does not make causal or predictive claims.
                </p>
              </InSimpleTerms>
            </CardContent>
          </Card>
        </>
      ) : (isOilBrent || isOilGlobalLong) && oilKpis ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {oilKpis.avg}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/barrel
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {oilKpis.min}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/barrel
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {oilKpis.max}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/barrel
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : isRealOil && realOilKpis ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {realOilKpis.avg}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/bbl (2015)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {realOilKpis.min}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/bbl (2015)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {realOilKpis.max}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  USD/bbl (2015)
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : isOilPppIran && pppIranKpis && !hasTurkeyComparator ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {pppIranKpis.avg}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/bbl (PPP)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {pppIranKpis.min}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/bbl (PPP)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {pppIranKpis.max}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/bbl (PPP)
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : isFxUsdToman && fxKpis ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {fxKpis.latest}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/USD
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {fxKpis.min}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/USD
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium">
                {fxKpis.max}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  toman/USD
                </span>
              </p>
            </CardContent>
          </Card>
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
                  {typeof kpi.value === "number" && Number.isInteger(kpi.value)
                    ? kpi.value.toLocaleString()
                    : kpi.value}
                  {kpi.unit && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {kpi.unit}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isEventsTimeline && !isFollowerGrowthDynamics && !isFxUsdIrrDual && !isWageCpiReal && (
      <Card className="border-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {isOilTradeNetwork
              ? "Network"
              : isGoldAndOil
              ? "Gold and oil prices"
              : isOilGlobalLong
              ? "Oil price"
              : isOilBrent
              ? "Brent oil price"
              : isRealOil
              ? "Real oil price"
              : hasTurkeyComparator
              ? "Iran and Turkey: PPP oil burden"
              : isOilPppIran
              ? "Oil price burden (PPP)"
              : isOilExportCapacity
              ? "Oil price and export capacity proxy"
              : isFxUsdToman
                ? "USD→Toman (open market)"
                : isOilAndFx
                  ? "Oil and USD/Toman"
                  : data?.timeline?.length
                    ? "Sentiment over time"
                    : "Timeline"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isOilTradeNetwork
              ? "Oil trade flows between major exporters and importers. Nodes are countries/regions; edge width reflects trade volume (thousand barrels/day). Drag nodes, zoom, pan."
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
              : isOilExportCapacity
              ? "Oil price (left) and export capacity proxy (right, indexed). Sanctions markers."
              : isFxUsdToman
                ? "Open-market USD/toman rate (toman per USD) with event markers"
                : isOilAndFx
                  ? "Brent oil (left axis) and USD→toman (right axis) with event markers. Brent is a benchmark oil type traded on world markets."
                  : data?.timeline?.length
                    ? "Average sentiment score (sampled over time)"
                    : "Event markers and optional external signals"}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!hasTurkeyComparator && !isOilExportCapacity && !isOilTradeNetwork && (
              <>
                <select
                  value={anchorEventId}
                  onChange={(e) => setAnchorEventId(e.target.value)}
                  className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (full timeline)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}{" "}
                      ({ev.date ?? (ev.date_start && ev.date_end ? `${ev.date_start}–${ev.date_end}` : ev.date_start ?? ev.date_end ?? "")})
                    </option>
                  ))}
                </select>
                <select
                  value={effectiveWindowYears}
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
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOil}
                  onChange={(e) => setShowOil(e.target.checked)}
                  className="rounded border-border"
                />
                Show Brent oil price (benchmark oil type traded on world markets)
              </label>
            )}
            {isOilAndFx && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGold}
                  onChange={(e) => setShowGold(e.target.checked)}
                  className="rounded border-border"
                />
                Show gold price
              </label>
            )}
            {isOilPppIran && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={pppYAxisLog}
                  onChange={(e) => setPppYAxisLog(e.target.checked)}
                  className="rounded border-border"
                />
                Log scale
              </label>
            )}
            {isOilExportCapacity && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
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
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIranEvents}
                    onChange={(e) => setShowIranEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show Iran events
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSanctionsEvents}
                    onChange={(e) => setShowSanctionsEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show sanctions
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOpecEvents}
                    onChange={(e) => setShowOpecEvents(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show OPEC decisions
                </label>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isOilTradeNetwork ? (
            <>
              <NetworkGraph
                key={networkSelectedYear || networkYears[networkYears.length - 1]}
                nodes={networkNodesForYear}
                edges={networkEdgesForYear}
                year={networkSelectedYear}
              />
              {networkYears.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center py-2">
                  <label className="text-sm font-medium text-foreground shrink-0">
                    Year:
                  </label>
                  <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                    {networkYears[0]} – {networkYears[networkYears.length - 1]}
                  </span>
                  <input
                    type="range"
                    min={networkYears[0]}
                    max={networkYears[networkYears.length - 1]}
                    step={1}
                    value={networkSelectedYear || networkYears[networkYears.length - 1]!}
                    onChange={(e) => setNetworkSelectedYear(e.target.value)}
                    className="oil-trade-year-slider accent-primary min-h-[44px] w-full min-w-0 sm:w-40 flex-1 sm:flex-none touch-manipulation"
                  />
                  <span className="text-base font-medium tabular-nums min-w-[4ch] shrink-0">
                    {networkSelectedYear || networkYears[networkYears.length - 1]}
                  </span>
                </div>
              )}
              <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <h4 className="mb-3 font-medium text-foreground">How to read this network</h4>
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
                      Darker nodes represent net exporters. Lighter nodes represent net importers. Intermediate shades indicate more balanced trade.
                    </p>
                    <div className="mt-1.5 flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#1e40af]" />
                        Exporter
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#3b82f6]" />
                        Balanced
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-4 w-4 rounded-full bg-[#60a5fa]" />
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
                </div>
              </div>
              <LearningNote
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
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
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
                note="Unit: thousand barrels per day. Values converted from net weight (kg) using 1 tonne ≈ 7.33 barrels."
              />
              <InSimpleTerms>
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
          ) : (
            <>
          {(isOverviewStub || isOilBrent || isFxUsdToman || isOilAndFx || (isOilPppIran && !hasTurkeyComparator)) && !isOilGlobalLong && !isGoldAndOil && !isRealOil && (
            <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border pb-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIranEvents}
                  onChange={(e) => setShowIranEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show Iran events
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWorldEvents}
                  onChange={(e) => setShowWorldEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show world events
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSanctionsEvents}
                  onChange={(e) => setShowSanctionsEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show sanctions
              </label>
              {(isFxUsdToman || isOilPppIran) && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPresidentialTerms}
                    onChange={(e) => setShowPresidentialTerms(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show presidential terms
                </label>
              )}
            </div>
          )}
          {isOilPppIran ? (
            <>
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Oil price burden"
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: hasTurkeyComparator ? "Iran (PPP)" : "Oil price burden",
                  unit: "toman/bbl (PPP)",
                  points: pppIranPoints,
                  yAxisIndex: 1,
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
                    ? { label: "Turkey (PPP)", points: pppTurkeyPoints }
                    : undefined
                }
                indexComparator={hasTurkeyComparator}
              />
              {hasTurkeyComparator && (
                <p className="mt-3 text-xs text-muted-foreground max-w-2xl break-words">
                  Both series are indexed to the first common year (= 100). Values above 100 indicate a higher estimated burden relative to that baseline; below 100, a lower burden. Example: 200 = twice the baseline.
                </p>
              )}
              <OilPppIranDescription />
              <LearningNote
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
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026">
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
              <InSimpleTerms>
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
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Oil price"
                events={events}
                multiSeries={[
                  {
                    key: "oil",
                    label: "Oil price",
                    yAxisIndex: 0,
                    unit: "USD/bbl",
                    points: exportCapacityOilPoints,
                  },
                  {
                    key: "proxy",
                    label: "Export capacity proxy",
                    yAxisIndex: 1,
                    unit: exportCapacityBaseYear ? `Index (base=${exportCapacityBaseYear})` : "Index",
                    points: exportCapacityProxyPoints,
                  },
                ]}
                timeRange={exportCapacityTimeRange ?? study.timeRange}
                mutedBands={false}
                sanctionsPeriods={sanctionsPeriodsFromEvents}
              />
              <LearningNote
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
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
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
              <InSimpleTerms>
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
          ) : isOilProductionMajorExporters ? (
            <>
              {typeof window !== "undefined" && console.debug("[Study14] Chart render events:", events.length, events.map((e) => ({ id: e.id, date: e.date ?? e.date_start, layer: e.layer })))}
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Oil production"
                events={events}
                multiSeries={[
                  { key: "us", label: "United States", yAxisIndex: 0, unit: "million bbl/day", points: extendedProductionUsPoints },
                  { key: "saudi", label: "Saudi Arabia", yAxisIndex: 0, unit: "million bbl/day", points: extendedProductionSaudiPoints },
                  { key: "russia", label: "Russia", yAxisIndex: 0, unit: "million bbl/day", points: extendedProductionRussiaPoints },
                  { key: "iran", label: "Iran", yAxisIndex: 0, unit: "million bbl/day", points: extendedProductionIranPoints },
                  ...(extendedProductionTotalPoints.length > 0
                    ? [{ key: "total", label: "Total (US + Saudi + Russia + Iran)", yAxisIndex: 0 as const, unit: "million bbl/day", points: extendedProductionTotalPoints }]
                    : []),
                ]}
                timeRange={productionTimeRange ?? study.timeRange}
                extendedDates={productionExtendedDates}
                lastOfficialDateForExtension={productionLastOfficialDate}
              />
              <LearningNote
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
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
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
              <InSimpleTerms>
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
          ) : isWageCpiReal ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Real minimum wage (CPI-adjusted)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {study.subtitle ?? study.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWageIndex}
                        onChange={(e) => setShowWageIndex(e.target.checked)}
                        className="rounded border-border"
                      />
                      Real wage index (base = 100)
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label="Nominal"
                    events={events}
                    anchorEventId={anchorEventId || undefined}
                    multiSeries={[
                      {
                        key: "nominal",
                        label: "Nominal minimum wage",
                        yAxisIndex: 0,
                        unit: "k tomans/month",
                        points: wageNominalKTomans,
                      },
                      {
                        key: "real",
                        label: "Real minimum wage",
                        yAxisIndex: 0,
                        unit: `k tomans/month (${wageBaseYear ?? ""} prices)`,
                        points: wageRealKTomans,
                      },
                      ...(showWageIndex
                        ? [
                            {
                              key: "index",
                              label: "Real wage index",
                              yAxisIndex: 1,
                              unit: "Index (base=100)",
                              points: wageIndexPoints,
                            } as ChartSeries,
                          ]
                        : []),
                    ]}
                    timeRange={wageTimeRange ?? study.timeRange}
                    mutedBands={false}
                  />
                  <LearningNote
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
                  {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
                  {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
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
                  <InSimpleTerms>
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
                data={[]}
                valueKey="value"
                label="Real oil price"
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: "Oil price",
                  unit: "USD/bbl, 2015 dollars",
                  points: realOilPoints,
                  yAxisIndex: 1,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={false}
              />
              <RealOilDescription />
              <LearningNote
                sections={[
                  {
                    heading: "What this measures",
                    bullets: [
                      "Oil price in constant 2015 US dollars.",
                      "Nominal price divided by US CPI and scaled to 2015 purchasing power.",
                    ],
                  },
                  {
                    heading: "Purpose",
                    bullets: [
                      "Real prices are used for long-term comparison across decades.",
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
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026">
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
              <InSimpleTerms>
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
              {oilShockDates.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showShocks}
                    onChange={(e) => setShowShocks(e.target.checked)}
                  />
                  Show shocks
                </label>
              )}
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Gold"
                events={events}
                multiSeries={[
                  { key: "gold", label: "Gold price", yAxisIndex: 0, unit: "USD/oz", points: goldPoints },
                  { key: "oil", label: "Oil price", yAxisIndex: 1, unit: "USD/bbl", points: oilPointsWithVolatility },
                ]}
                oilShockDates={oilShockDates}
                showOilShocks={showShocks}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands
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
              <LearningNote
                sections={[
                  {
                    heading: "What this measures",
                    bullets: [
                      "Gold price (USD/oz) on the left axis; oil price (USD/bbl) on the right axis.",
                      "Dual axes because the two series have different scales.",
                    ],
                  },
                  {
                    heading: "Purpose",
                    bullets: [
                      "Gold and oil are used as separate macroeconomic stress indicators.",
                      "Long-range view supports comparison across periods.",
                    ],
                  },
                  {
                    heading: "Reading guidance",
                    bullets: [
                      "Left y-axis: gold (USD/oz). Right y-axis: oil (USD/bbl). Scale differs; do not compare numerically.",
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
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026">
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
              {oilShockDates.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showShocks}
                    onChange={(e) => setShowShocks(e.target.checked)}
                  />
                  Show shocks
                </label>
              )}
              <TimelineChart
                data={[]}
                valueKey="value"
                label={isOilGlobalLong ? "Oil price" : "Brent oil"}
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: isOilGlobalLong ? "Oil price" : "Brent oil",
                  unit: "USD/barrel",
                  points: oilPointsWithVolatility,
                  yAxisIndex: 1,
                }}
                oilShockDates={oilShockDates}
                showOilShocks={showShocks}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={isOilGlobalLong}
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
              {dailyReturnPoints.length > 0 && (
                <TimelineChart
                  data={dailyReturnPoints as { date: string; value: number }[]}
                  valueKey="value"
                  label="Daily return"
                  unit="%"
                  timeRange={oilTimeRange ?? study.timeRange}
                  chartHeight="h-48"
                  referenceLine={{ value: 0, label: "0%" }}
                  gridRight="12%"
                />
              )}
              <LearningNote
                  sections={[
                    {
                    heading: "What this measures",
                    bullets: [
                      "Brent crude oil is a benchmark oil type traded on world markets, often used as a reference for global oil prices. This chart shows its spot price.",
                      "Brent is traded in USD and reflects international market conditions.",
                      ],
                    },
                    {
                      heading: "Purpose",
                      bullets: [
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
              {study.observations?.length ? <DataObservations observations={study.observations} /> : null}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026">
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
              <InSimpleTerms>
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
              {oilShockDates.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showShocks}
                    onChange={(e) => setShowShocks(e.target.checked)}
                  />
                  Show shocks
                </label>
              )}
              {showGold ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Brent oil"
                  events={events}
                  anchorEventId={anchorEventId || undefined}
                  multiSeries={[
                    { key: "oil", label: "Brent oil", yAxisIndex: 0, unit: "USD/barrel", points: oilPointsWithVolatility },
                    { key: "fx", label: "USD→Toman", yAxisIndex: 1, unit: "toman/USD", points: fxPoints },
                    { key: "gold", label: "Gold price", yAxisIndex: 2, unit: "USD/oz", points: goldPoints },
                  ]}
                  oilShockDates={oilShockDates}
                  showOilShocks={showShocks}
                  timeRange={dualTimeRange ?? study.timeRange}
                />
              ) : (
                <TimelineChart
                  data={oilPointsWithVolatility}
                  valueKey="value"
                  label="Brent oil"
                  unit="USD/barrel"
                  events={events}
                  anchorEventId={anchorEventId || undefined}
                  secondSeries={{
                    label: "USD→Toman",
                    unit: "toman/USD",
                    points: fxPoints,
                    yAxisIndex: 1,
                  }}
                  oilShockDates={oilShockDates}
                  showOilShocks={showShocks}
                  timeRange={dualTimeRange ?? study.timeRange}
                />
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
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <InSimpleTerms>
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
          ) : isFxUsdToman ? (
            <>
              <TimelineChart
                data={[]}
                valueKey="value"
                label="USD→Toman"
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: "USD→Toman",
                  unit: "toman/USD",
                  points: fxPoints,
                  yAxisIndex: 1,
                }}
                timeRange={fxTimeRange ?? study.timeRange}
              />
              {fxSource && (
                <SourceInfo
                  items={[
                    {
                      label: "USD→Toman",
                      sourceName: fxSource.name,
                      sourceUrl: fxSource.url,
                      sourceDetail: fxSource.publisher,
                      unitLabel: "toman/USD",
                      unitNote: "1 toman = 10 rials",
                    },
                  ]}
                />
              )}
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <InSimpleTerms>
                <p>
                  The chart shows the open-market exchange rate between the US dollar and the Iranian toman—how many tomans you get for one dollar.
                  The toman is Iran’s main currency unit (one toman equals ten rials).
                </p>
                <p>
                  When the rate rises, it means more tomans are needed to buy one dollar—a sign of a weaker toman.
                  The chart aims to show that pattern over time and give context for economic pressure. It does not explain why the rate moves or prove any cause.
                </p>
              </InSimpleTerms>
            </>
          ) : data ? (
            <TimelineChart
              data={data.timeline}
              valueKey="value"
              label="Sentiment"
              events={events}
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
  );
}
