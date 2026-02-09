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
  scope?: "iran" | "world" | "sanctions";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOverviewStub = study?.primarySignal.kind === "overview_stub";
  const isOilBrent = study?.primarySignal.kind === "oil_brent";
  const isOilGlobalLong = study?.primarySignal.kind === "oil_global_long";
  const isGoldAndOil = study?.primarySignal.kind === "gold_and_oil";
  const isFxUsdToman = study?.primarySignal.kind === "fx_usd_toman";
  const isOilAndFx = study?.primarySignal.kind === "oil_and_fx";
  const isRealOil = study?.primarySignal.kind === "real_oil";
  const isOilPppIran = study?.primarySignal.kind === "oil_ppp_iran";

  const windowOptions = isGoldAndOil ? WINDOW_OPTIONS_LONG_RANGE : WINDOW_OPTIONS;
  const effectiveWindowDays = useMemo(
    () => (windowOptions.some((o) => o.value === windowDays) ? windowDays : windowOptions[0].value),
    [isGoldAndOil, windowDays]
  );

  const oilTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isOilBrent || isOilGlobalLong || isGoldAndOil || isOilAndFx || isRealOil || isOilPppIran)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) {
        const anchorDate = ev.date ?? ev.date_start ?? ev.date_end;
        if (anchorDate) return computeWindowRange(anchorDate, effectiveWindowDays);
      }
    }
    return study.timeRange;
  }, [study, isOilBrent, isOilGlobalLong, isGoldAndOil, isOilAndFx, isRealOil, isOilPppIran, anchorEventId, events, effectiveWindowDays]);

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

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    const params = new URLSearchParams({
      study_id: isFxUsdToman || isOilAndFx ? "iran" : studyId,
    });
    const hasEventLayers = isOverviewStub || isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran;
    if (hasEventLayers) {
      let layers: string[];
      if ((isOilGlobalLong || isGoldAndOil || isRealOil) && study.eventLayers?.length) {
        layers = study.eventLayers;
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
    fetchJson<EventsData>(`/api/events?${params}`)
      .then((res) => mounted && setEvents(res.events ?? []))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, isOilBrent, isOilGlobalLong, isGoldAndOil, isFxUsdToman, isOilAndFx, isRealOil, isOilPppIran, showIranEvents, showWorldEvents, showSanctionsEvents, showPresidentialTerms]);

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

  const isSingleSignalStudy = isOilBrent || isOilGlobalLong || isGoldAndOil || isFxUsdToman || isOilAndFx || isRealOil || isOilPppIran;
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
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
      <header className="space-y-1">
        <Link
          href="/studies"
          className="text-xs text-muted-foreground hover:text-foreground inline-block"
        >
          ← Studies
        </Link>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Study {study.number}
        </h1>
        <p className="text-lg text-muted-foreground">{study.title}</p>
        <p className="text-sm text-muted-foreground">
          {study.timeRange[0]} — {study.timeRange[1]}
        </p>
      </header>

      {(isOilBrent || isOilGlobalLong) && oilKpis ? (
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
      ) : isOilPppIran && pppIranKpis ? (
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

      <Card className="border-border">
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
              : isOilPppIran
              ? "Oil price burden (PPP)"
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
              ? "Daily Brent crude oil price (USD/barrel) with event markers"
              : isRealOil
              ? "Inflation-adjusted oil price (constant 2015 USD/bbl) with world event overlays"
              : isOilPppIran
              ? "PPP-adjusted oil burden in Iran (annual) with event overlays"
              : isFxUsdToman
                ? "Open-market USD/toman rate (toman per USD) with event markers"
                : isOilAndFx
                  ? "Brent oil (left axis) and USD→toman (right axis) with event markers"
                  : data?.timeline?.length
                    ? "Average sentiment score (sampled over time)"
                    : "Event markers and optional external signals"}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
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
            {isOverviewStub && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOil}
                  onChange={(e) => setShowOil(e.target.checked)}
                  className="rounded border-border"
                />
                Show Brent oil price
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
          </div>
        </CardHeader>
        <CardContent>
          {(isOverviewStub || isOilBrent || isFxUsdToman || isOilAndFx || isOilPppIran) && !isOilGlobalLong && !isGoldAndOil && !isRealOil && (
            <div className="mb-3 flex flex-shrink-0 items-center gap-4 border-b border-border pb-3">
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
                  label: "Oil price burden",
                  unit: "toman/bbl (PPP)",
                  points: pppIranPoints,
                  yAxisIndex: 1,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
                mutedBands={false}
                yAxisLog={pppYAxisLog}
                yAxisNameSuffix={pppYAxisLog ? "(log scale)" : undefined}
                mutedEventLines
                referenceLine={
                  pppYAxisLog && pppEarlierPeriodMedian != null
                    ? { value: pppEarlierPeriodMedian, label: "Earlier-period median" }
                    : undefined
                }
              />
              <OilPppIranDescription />
              <LearningNote
                sections={[
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
                ]}
                links={[{ label: "Purchasing power parity (Wikipedia)", href: "https://en.wikipedia.org/wiki/Purchasing_power_parity" }]}
              />
              {study.concepts?.length ? <ConceptsUsed conceptKeys={study.concepts} /> : null}
              <CurrentSnapshot asOf="March 2026">
                <p>
                  As of March 2026, PPP-adjusted oil burden in Iran remains elevated relative to the previous decade.
                  The series appears to show a step-up in levels from the late 2010s onward. Volatility is moderate, with annual
                  data absorbing intra-year swings.
                </p>
                <p>
                  Limitation: World Bank PPP data lag by one year or more; the most recent point may reflect prior-year
                  conversion factors.
                </p>
              </CurrentSnapshot>
              {pppIranSource && (
                <SourceInfo
                  items={[
                    {
                      label: "Oil price burden (PPP)",
                      sourceName: `${pppIranSource.oil}; ${pppIranSource.ppp}`,
                      sourceDetail: "Annual average oil × Iran PPP conversion factor",
                      unitLabel: "PPP-adjusted toman per barrel",
                      unitNote: "PPP values reflect domestic purchasing power; values are not market exchange rates.",
                    },
                  ]}
                  note="PPP values reflect domestic purchasing power; values are not market exchange rates. Annual resolution."
                />
              )}
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
                links={[{ label: "Real price (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_price" }]}
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
                links={[
                  { label: "Brent Crude (Wikipedia)", href: "https://en.wikipedia.org/wiki/Brent_Crude" },
                  { label: "West Texas Intermediate (Wikipedia)", href: "https://en.wikipedia.org/wiki/West_Texas_Intermediate" },
                ]}
              />
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
                        "Spot price of Brent crude oil, a global benchmark for light sweet crude.",
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
                  links={[{ label: "Brent Crude (Wikipedia)", href: "https://en.wikipedia.org/wiki/Brent_Crude" }]}
                />
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
            </>
          ) : (
            <TimelineChart
              data={data!.timeline}
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
              timeRange={data!.time_range}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
