"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/timeline-chart";
import { SourceInfo } from "@/components/source-info";
import { RealOilDescription } from "@/components/real-oil-description";
import { OilPppIranDescription } from "@/components/oil-ppp-iran-description";
import { LearningNote } from "@/components/learning-note";
import { ConceptsUsed } from "@/components/concepts-used";
import { CurrentSnapshot } from "@/components/current-snapshot";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { EventsTimeline, type TimelineEvent } from "@/components/events-timeline";
import { FollowerGrowthChart } from "@/components/follower-growth-chart";
import { getStudyById } from "@/lib/studies";
import { fetchJson } from "@/lib/api";

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
  layer?: "iran_core" | "world_core" | "world_1900" | "sanctions" | "iran_presidents";
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
  { value: 7, label: "±7 days" },
  { value: 30, label: "±30 days" },
  { value: 90, label: "±90 days" },
] as const;

const WINDOW_OPTIONS_LONG_RANGE = [
  { value: 90, label: "±90 days" },
  { value: 180, label: "±6 months" },
  { value: 365, label: "±1 year" },
  { value: 730, label: "±2 years" },
] as const;


function computeWindowRange(
  eventDate: string,
  windowDays: number
): [string, string] {
  const d = new Date(eventDate);
  const start = new Date(d);
  start.setDate(start.getDate() - windowDays);
  const end = new Date(d);
  end.setDate(end.getDate() + windowDays);
  return [
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  ];
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

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.studyId as string;
  const studyRaw = getStudyById(studyId);
  const study = studyRaw?.visible !== false ? studyRaw : undefined;
  const [data, setData] = useState<OverviewData | null>(null);
  const [events, setEvents] = useState<EventsData["events"]>([]);
  const [anchorEventId, setAnchorEventId] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(30);
  const [showOil, setShowOil] = useState(false);
  const [showGold, setShowGold] = useState(false);
  const [showIranEvents, setShowIranEvents] = useState(true);
  const [showWorldEvents, setShowWorldEvents] = useState(false);
  const [showSanctionsEvents, setShowSanctionsEvents] = useState(false);
  const [showPresidentialTerms, setShowPresidentialTerms] = useState(false);
  const [pppYAxisLog, setPppYAxisLog] = useState(true);
  const [showSanctionsPeriods, setShowSanctionsPeriods] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fgPlatform, setFgPlatform] = useState<"twitter" | "instagram" | "youtube">("twitter");
  const [fgUsername, setFgUsername] = useState("");
  const [fgData, setFgData] = useState<{
    results: { timestamp: string; followers?: number | null; subscribers?: number | null }[];
  } | null>(null);
  const [fgLoading, setFgLoading] = useState(false);
  const [fgError, setFgError] = useState<string | null>(null);
  const [fgShowLinear, setFgShowLinear] = useState(true);
  const [fgShowExponential, setFgShowExponential] = useState(true);
  const [fgShowLogistic, setFgShowLogistic] = useState(true);
  const [fgMetadata, setFgMetadata] = useState<{
    source?: "cache" | "wayback_live";
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
  const isEventsTimeline = study?.primarySignal.kind === "events_timeline";
  const isFollowerGrowthDynamics = study?.primarySignal.kind === "follower_growth_dynamics";

  const windowOptions = isGoldAndOil ? WINDOW_OPTIONS_LONG_RANGE : WINDOW_OPTIONS;
  const effectiveWindowDays = useMemo(
    () => (windowOptions.some((o) => o.value === windowDays) ? windowDays : windowOptions[0].value),
    [isGoldAndOil, windowDays]
  );

  const oilTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowDays);
      }
    }
    return study.timeRange;
  }, [study, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran, isOilExportCapacity, anchorEventId, events, effectiveWindowDays]);

  const exportCapacityTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilExportCapacity) return null;
    return study.timeRange;
  }, [study, isOilExportCapacity]);

  const fxTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isFxUsdToman || isOilAndFx)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowDays);
      }
    }
    return study.timeRange;
  }, [study, isFxUsdToman, isOilAndFx, anchorEventId, events, effectiveWindowDays]);

  const dualTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilAndFx) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowDays);
      }
    }
    return study.timeRange;
  }, [study, isOilAndFx, anchorEventId, events, effectiveWindowDays]);

  const pppEarlierPeriodMedian = useMemo(() => {
    if (!isOilPppIran || pppIranPoints.length === 0) return undefined;
    const earlier = pppIranPoints.filter((p) => p.date < "2016-01-01").map((p) => p.value);
    if (earlier.length === 0) return undefined;
    const sorted = [...earlier].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }, [isOilPppIran, pppIranPoints]);

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

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    const params = new URLSearchParams({
      study_id: isFxUsdToman || isOilAndFx ? "iran" : studyId,
    });
    const hasEventLayers = isOverviewStub || isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity || isEventsTimeline;
    if (hasEventLayers && !isEventsTimeline) {
      let layers: string[];
      if (((isOilGlobalLong || isGoldAndOil || isRealOil || isOilExportCapacity) && study.eventLayers?.length) || (hasTurkeyComparator && study.eventLayers !== undefined)) {
        if (isOilExportCapacity) {
          layers = showSanctionsPeriods ? ["sanctions"] : [];
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
      .then((res) => mounted && setEvents(res.events ?? []))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, isOilBrent, isOilGlobalLong, isGoldAndOil, isFxUsdToman, isOilAndFx, isRealOil, isOilPppIran, isOilExportCapacity, hasTurkeyComparator, isEventsTimeline, showIranEvents, showWorldEvents, showSanctionsEvents, showPresidentialTerms, showSanctionsPeriods]);

  useEffect(() => {
    if (study && (isEventsTimeline || isFollowerGrowthDynamics)) {
      setLoading(false);
    }
  }, [study, isEventsTimeline, isFollowerGrowthDynamics]);

  useEffect(() => {
    if (!study || !isOverviewStub) return;
    let mounted = true;
    if (!data) setLoading(true);
    const qs = new URLSearchParams({ study_id: studyId });
    if (anchorEventId) {
      qs.set("anchor_event_id", anchorEventId);
      qs.set("window_days", String(effectiveWindowDays));
    }
    fetchJson<OverviewData>(`/api/overview?${qs}`)
      .then((res) => mounted && setData(res))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, anchorEventId, effectiveWindowDays, data]);

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

  const isSingleSignalStudy = isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran || isOilExportCapacity;
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
          <Link
            href="/learning"
            className="text-xs text-muted-foreground hover:text-foreground inline-block"
          >
            Learning resources
          </Link>
          {!isEventsTimeline && (
            <Link
              href="/studies/events_timeline"
              className="text-xs text-muted-foreground hover:text-foreground inline-block"
            >
              Reference timeline
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Study {study.number}
        </h1>
        <p className="text-lg text-muted-foreground">{study.title}</p>
        <p className="text-sm text-muted-foreground">
          {study.timeRange[0]} — {study.timeRange[1]}
        </p>
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
                  const un = fgUsername.trim().replace(/^@/, "");
                  if (!un) return;
                  setFgLoading(true);
                  setFgError(null);
                  setFgData(null);
                  setFgMetadata(null);
                  try {
                    if (fgPlatform === "instagram") {
                      const res = await fetchJson<{
                        results: { timestamp: string; followers?: number | null }[];
                        metadata?: { source?: string; count?: number; last_cached_at?: string | null };
                      }>(`/api/wayback/instagram/cache-first?username=${encodeURIComponent(un)}&sample=40`);
                      setFgData(res);
                      const meta = res.metadata;
                      setFgMetadata(
                        meta
                          ? {
                              source: (meta.source === "cache" ? "cache" : "wayback_live") as "cache" | "wayback_live",
                              count: meta.count,
                              last_cached_at: meta.last_cached_at ?? undefined,
                            }
                          : {
                              source: "wayback_live" as const,
                              count: res.results?.length,
                            }
                      );
                      return;
                    }
                    if (fgPlatform === "youtube") {
                      const val = un.startsWith("@") ? un : `@${un}`;
                      const res = await fetchJson<{
                        results: { timestamp: string; subscribers?: number | null }[];
                        metadata?: { source?: string; count?: number; last_cached_at?: string | null };
                      }>(`/api/wayback/youtube/cache-first?input=${encodeURIComponent(val)}&sample=40`);
                      setFgData(res);
                      const meta = res.metadata;
                      setFgMetadata(
                        meta
                          ? {
                              source: (meta.source === "cache" ? "cache" : "wayback_live") as "cache" | "wayback_live",
                              count: meta.count,
                              last_cached_at: meta.last_cached_at ?? undefined,
                            }
                          : {
                              source: "wayback_live" as const,
                              count: res.results?.length,
                            }
                      );
                      return;
                    }
                    const res = await fetchJson<{ results: { timestamp: string; followers?: number | null }[] }>(
                      `/api/wayback/twitter?username=${encodeURIComponent(un)}&sample=40`
                    );
                    setFgData(res);
                    setFgMetadata({ source: "wayback_live", count: res.results?.length });
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
                  <span className="text-xs text-muted-foreground">{fgPlatform === "youtube" ? "Handle (e.g. @channel)" : "Username"}</span>
                  <input
                    type="text"
                    suppressHydrationWarning
                    value={fgUsername}
                    onChange={(e) => setFgUsername(e.target.value)}
                    placeholder={fgPlatform === "youtube" ? "@channel" : "username"}
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
              {fgData && fgData.results.length > 0 && (
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
                const metric = fgPlatform === "youtube" ? "subscribers" : "followers";
                const points = fgData.results
                  .filter((r) => (r[metric as keyof typeof r] ?? null) != null)
                  .map((r) => {
                    const ts = r.timestamp;
                    const date = ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts;
                    const val = metric === "subscribers" ? (r.subscribers ?? 0) : (r.followers ?? 0);
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
                          Data source: {fgMetadata.source === "cache" ? "cache" : "Wayback (live)"}
                          {fgMetadata.count != null && ` · ${fgMetadata.count} snapshot${fgMetadata.count !== 1 ? "s" : ""}`}
                          {fgMetadata.source === "cache" && fgMetadata.last_cached_at != null && (
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
                        Data source: {fgMetadata.source === "cache" ? "cache" : "Wayback (live)"}
                        {fgMetadata.count != null && ` · ${fgMetadata.count} snapshot${fgMetadata.count !== 1 ? "s" : ""}`}
                        {fgMetadata.source === "cache" && fgMetadata.last_cached_at != null && (
                          <> · Last cached: {new Date(fgMetadata.last_cached_at).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </>
                );
              })()}
              {!fgData && !fgLoading && (
                <p className="text-sm text-muted-foreground">
                  Enter a username and click Fetch data to load Wayback snapshots.
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
                  "Points show follower counts at snapshot dates. The line connects them in time order.",
                  "Irregular spacing reflects when the archive captured the profile.",
                ],
              },
              {
                heading: "Fitted models",
                bullets: [
                  "Models are fit to the observed data only. No extrapolation beyond the last point.",
                  "Linear: constant growth per day. Exponential: percentage growth. Logistic: S-curve with saturation.",
                  "Models are descriptive aids, not predictions or causal explanations.",
                ],
              },
              {
                heading: "Pitfalls",
                bullets: [
                  "Wayback coverage is sparse; gaps and missing values are expected.",
                  "Do not infer causality. Different models may fit similarly; overfitting is a risk.",
                ],
              },
            ]}
          />
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

      {!isEventsTimeline && (
      <Card className="border-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {isGoldAndOil
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
            {isGoldAndOil
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
            {!hasTurkeyComparator && !isOilExportCapacity && (
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
                  value={effectiveWindowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
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
          </div>
        </CardHeader>
        <CardContent>
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
              <p className="mt-3 text-xs text-muted-foreground max-w-2xl break-words">
                Export capacity proxy = oil price × estimated export volume. Indexed to first year = 100. Proxy for earning capacity, not realized revenue.
              </p>
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
                    heading: "Pitfalls",
                    bullets: [
                      "Export volumes are estimates. Volumes under sanctions are uncertain.",
                      "Does not equal government revenue. Pricing, discounts, and payment terms vary.",
                      "Does not capture discounts or informal trade.",
                      "Do not infer causality from co-movement with sanctions events.",
                    ],
                  },
                ]}
                links={[
                  { label: "EIA Iran Country Analysis", href: "https://www.eia.gov/international/content/analysis/countries_long/iran/" },
                ]}
              />
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <SourceInfo
                items={[
                  {
                    label: "Oil price",
                    sourceName: "FRED DCOILBRENTEU",
                    sourceDetail: "Brent crude, annual average",
                    unitLabel: "USD/barrel",
                  },
                  {
                    label: "Export volume",
                    sourceName: "EIA / tanker tracking estimates",
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
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Gold"
                events={events}
                multiSeries={[
                  { key: "gold", label: "Gold price", yAxisIndex: 0, unit: "USD/oz", points: goldPoints },
                  { key: "oil", label: "Oil price", yAxisIndex: 1, unit: "USD/bbl", points: oilPoints },
                ]}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands
              />
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
              <TimelineChart
                data={[]}
                valueKey="value"
                label={isOilGlobalLong ? "Oil price" : "Brent oil"}
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: isOilGlobalLong ? "Oil price" : "Brent oil",
                  unit: "USD/barrel",
                  points: oilPoints,
                  yAxisIndex: 1,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={isOilGlobalLong}
              />
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
              {showGold ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Brent oil"
                  events={events}
                  anchorEventId={anchorEventId || undefined}
                  multiSeries={[
                    { key: "oil", label: "Brent oil", yAxisIndex: 0, unit: "USD/barrel", points: oilPoints },
                    { key: "fx", label: "USD→Toman", yAxisIndex: 1, unit: "toman/USD", points: fxPoints },
                    { key: "gold", label: "Gold price", yAxisIndex: 2, unit: "USD/oz", points: goldPoints },
                  ]}
                  timeRange={dualTimeRange ?? study.timeRange}
                />
              ) : (
                <TimelineChart
                  data={oilPoints}
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
                  timeRange={dualTimeRange ?? study.timeRange}
                />
              )}
              {(oilSource || fxSource) && (
                <SourceInfo
                  items={[
                    ...(oilSource
                      ? [
                          {
                            label: "Brent oil",
                            sourceName: oilSource.name,
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
        </CardContent>
      </Card>
      )}
    </div>
  );
}
