"use client";

import { useEffect, useState } from "react";
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
};

type EventsData = {
  study_id: string;
  events: Event[];
};

const WINDOW_OPTIONS = [
  { value: 7, label: "±7 days" },
  { value: 30, label: "±30 days" },
  { value: 90, label: "±90 days" },
] as const;

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.studyId as string;
  const study = getStudyById(studyId);
  const [data, setData] = useState<OverviewData | null>(null);
  const [events, setEvents] = useState<EventsData["events"]>([]);
  const [anchorEventId, setAnchorEventId] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    fetchJson<EventsData>(`/api/events?study_id=${studyId}`)
      .then((res) => mounted && setEvents(res.events ?? []))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [studyId, study]);

  useEffect(() => {
    if (!study) return;
    let mounted = true;
    if (!data) setLoading(true);
    const params = new URLSearchParams({ study_id: studyId });
    if (anchorEventId) {
      params.set("anchor_event_id", anchorEventId);
      params.set("window_days", String(windowDays));
    }
    fetchJson<OverviewData>(`/api/overview?${params}`)
      .then((res) => mounted && setData(res))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [studyId, study, anchorEventId, windowDays]);

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

  if (loading) {
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

  if (error || !data) {
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

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Sentiment over time
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Average sentiment score (sampled over time)
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
          </div>
        </CardHeader>
        <CardContent>
          <TimelineChart
            data={data.timeline}
            valueKey="value"
            label="Sentiment"
            events={events}
            anchorEventId={anchorEventId || undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
