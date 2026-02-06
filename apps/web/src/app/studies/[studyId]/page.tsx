"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/timeline-chart";

type OverviewData = {
  study_id: string;
  study_title: string;
  time_range: [string, string];
  kpis: Array<{ label: string; value: string | number; unit?: string | null }>;
  timeline: Array<{ date: string; value: number }>;
};

const PLACEHOLDER_TABS = [
  { id: "overview", label: "Overview", active: true },
  { id: "timeline", label: "Timeline", active: false },
  { id: "network", label: "Network", active: false },
  { id: "topics", label: "Topics", active: false },
  { id: "hashtags", label: "Hashtags", active: false },
];

export default function StudyDetailPage() {
  const params = useParams();
  const studyId = params.studyId as string;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studyId !== "1") return;
    const controller = new AbortController();

    fetch("/api/overview", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch overview");
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (e?.name !== "AbortError") setError(e.message ?? "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [studyId]);

  if (studyId !== "1") {
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
        <div className="rounded-lg border border-border p-6 text-muted-foreground">
          {error || "No data available"}
        </div>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/studies"
            className="text-xs text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Studies
          </Link>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Study 1 — Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.time_range[0]} — {data.time_range[1]}
          </p>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-border">
        {PLACEHOLDER_TABS.map((tab) => (
          <span
            key={tab.id}
            className={`text-sm px-3 py-2 border-b-2 -mb-px transition ${
              tab.active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {tab.label}
          </span>
        ))}
      </nav>

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
        </CardHeader>
        <CardContent>
          <TimelineChart data={data.timeline} valueKey="value" label="Sentiment" />
        </CardContent>
      </Card>
    </div>
  );
}
