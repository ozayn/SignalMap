"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/timeline-chart";
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
  date: string;
  type?: string;
  description?: string;
  confidence?: string;
  sources?: string[];
  layer?: "iran_core" | "world_core";
  scope?: "iran" | "world";
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

const WINDOW_OPTIONS = [
  { value: 7, label: "±7 days" },
  { value: 30, label: "±30 days" },
  { value: 90, label: "±90 days" },
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
  return {
    avg: avg.toFixed(2),
    min: Math.min(...vals).toFixed(2),
    max: Math.max(...vals).toFixed(2),
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
  const study = getStudyById(studyId);
  const [data, setData] = useState<OverviewData | null>(null);
  const [events, setEvents] = useState<EventsData["events"]>([]);
  const [anchorEventId, setAnchorEventId] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(30);
  const [showOil, setShowOil] = useState(false);
  const [showWorldEvents, setShowWorldEvents] = useState(false);
  const [oilPoints, setOilPoints] = useState<OilSignalData["points"]>([]);
  const [oilSource, setOilSource] = useState<OilSource | null>(null);
  const [fxPoints, setFxPoints] = useState<FxUsdTomanSignalData["points"]>([]);
  const [fxSource, setFxSource] = useState<FxUsdTomanSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOverviewStub = study?.primarySignal.kind === "overview_stub";
  const isOilBrent = study?.primarySignal.kind === "oil_brent";
  const isFxUsdToman = study?.primarySignal.kind === "fx_usd_toman";
  const isOilAndFx = study?.primarySignal.kind === "oil_and_fx";

  const oilTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isOilBrent || isOilAndFx)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) return computeWindowRange(ev.date, windowDays);
    }
    return study.timeRange;
  }, [study, isOilBrent, isOilAndFx, anchorEventId, events, windowDays]);

  const fxTimeRange = useMemo((): [string, string] | null => {
    if (!study || !(isFxUsdToman || isOilAndFx)) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) return computeWindowRange(ev.date, windowDays);
    }
    return study.timeRange;
  }, [study, isFxUsdToman, isOilAndFx, anchorEventId, events, windowDays]);

  const dualTimeRange = useMemo((): [string, string] | null => {
    if (!study || !isOilAndFx) return null;
    if (anchorEventId) {
      const ev = events.find((e) => e.id === anchorEventId);
      if (ev) return computeWindowRange(ev.date, windowDays);
    }
    return study.timeRange;
  }, [study, isOilAndFx, anchorEventId, events, windowDays]);

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    const params = new URLSearchParams({
      study_id: isFxUsdToman || isOilAndFx ? "iran" : studyId,
    });
    if (isOilBrent || isFxUsdToman || isOilAndFx) {
      params.set("layers", showWorldEvents ? "iran_core,world_core" : "iran_core");
    }
    fetchJson<EventsData>(`/api/events?${params}`)
      .then((res) => mounted && setEvents(res.events ?? []))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOilBrent, isFxUsdToman, isOilAndFx, showWorldEvents]);

  useEffect(() => {
    if (!study || !isOverviewStub) return;
    let mounted = true;
    if (!data) setLoading(true);
    const qs = new URLSearchParams({ study_id: studyId });
    if (anchorEventId) {
      qs.set("anchor_event_id", anchorEventId);
      qs.set("window_days", String(windowDays));
    }
    fetchJson<OverviewData>(`/api/overview?${qs}`)
      .then((res) => mounted && setData(res))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [studyId, study, isOverviewStub, anchorEventId, windowDays, data]);

  useEffect(() => {
    if (!oilTimeRange || !(isOilBrent || isOilAndFx)) {
      if (isOilBrent || isOilAndFx) {
        setOilPoints([]);
        setOilSource(null);
      }
      return;
    }
    if (isOilAndFx) return;
    const [start, end] = oilTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchJson<OilSignalData>(`/api/signals/oil/brent?start=${start}&end=${end}`)
      .then((res) => {
        if (mounted) {
          setOilPoints(res.points ?? []);
          setOilSource(res.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setOilPoints([]);
          setOilSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [oilTimeRange, isOilBrent, isOilAndFx]);

  useEffect(() => {
    if (!dualTimeRange || !isOilAndFx) return;
    const [start, end] = dualTimeRange;
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<OilSignalData>(`/api/signals/oil/brent?start=${start}&end=${end}`),
      fetchJson<FxUsdTomanSignalData>(`/api/signals/fx/usd-toman?start=${start}&end=${end}`),
    ])
      .then(([oilRes, fxRes]) => {
        if (mounted) {
          setOilPoints(oilRes.points ?? []);
          setOilSource(oilRes.source ?? null);
          setFxPoints(fxRes.points ?? []);
          setFxSource(fxRes.source ?? null);
        }
      })
      .catch((e) => {
        if (mounted) {
          setOilPoints([]);
          setOilSource(null);
          setFxPoints([]);
          setFxSource(null);
          setError(e instanceof Error ? e.message : "Signal fetch failed");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [dualTimeRange, isOilAndFx]);

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

  const isSingleSignalStudy = isOilBrent || isFxUsdToman || isOilAndFx;
  const singleSignalReady =
    isOilBrent ? oilPoints.length > 0 : isFxUsdToman ? fxPoints.length > 0 : isOilAndFx ? oilPoints.length > 0 && fxPoints.length > 0 : false;
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

  const oilKpis = isOilBrent ? computeOilKpis(oilPoints) : null;
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

      {isOilBrent && oilKpis ? (
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
            {isOilBrent
              ? "Brent oil price"
              : isFxUsdToman
                ? "USD→Toman (open market)"
                : isOilAndFx
                  ? "Oil and USD/Toman"
                  : data?.timeline?.length
                    ? "Sentiment over time"
                    : "Timeline"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isOilBrent
              ? "Daily Brent crude oil price (USD/barrel) with event markers"
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
                  {ev.title} ({ev.date})
                </option>
              ))}
            </select>
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              disabled={!anchorEventId}
              className="text-xs text-muted-foreground bg-transparent border border-border rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              {WINDOW_OPTIONS.map((o) => (
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
            {(isOilBrent || isFxUsdToman || isOilAndFx) && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWorldEvents}
                  onChange={(e) => setShowWorldEvents(e.target.checked)}
                  className="rounded border-border"
                />
                Show world events
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isOilBrent ? (
            <>
              <TimelineChart
                data={[]}
                valueKey="value"
                label="Brent oil"
                events={events}
                anchorEventId={anchorEventId || undefined}
                secondSeries={{
                  label: "Brent oil",
                  unit: "USD/barrel",
                  points: oilPoints,
                  yAxisIndex: 1,
                }}
                timeRange={oilTimeRange ?? study.timeRange}
              />
              {oilSource && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Source: {oilSource.name} ({oilSource.publisher}), Brent crude oil spot price (USD/barrel).
                </p>
              )}
            </>
          ) : isOilAndFx ? (
            <>
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
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {oilSource && (
                  <p>Brent oil: {oilSource.name} ({oilSource.publisher}), spot price (USD/barrel).</p>
                )}
                {fxSource && (
                  <p>USD→Toman: {fxSource.name} (open market proxy). Values in toman (1 toman = 10 rials).</p>
                )}
              </div>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  Source: {fxSource.name} (open market proxy). Values in toman (1 toman = 10 rials).
                </p>
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
