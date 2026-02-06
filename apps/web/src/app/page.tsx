"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart } from "@/components/timeline-chart";

type OverviewData = {
  study_id: string;
  study_title: string;
  time_range: [string, string];
  kpis: Array<{ label: string; value: string | number; unit?: string | null }>;
  timeline: Array<{ date: string; value: number }>;
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch overview");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          {error || "No data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {data.study_title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.time_range[0]} — {data.time_range[1]}
        </p>
      </div>

      {/* 3 KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {data.kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
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

      {/* 1 timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Daily average sentiment score
          </p>
        </CardHeader>
        <CardContent>
          <TimelineChart
            data={data.timeline}
            valueKey="value"
            label="Sentiment"
            color="#6366f1"
          />
        </CardContent>
      </Card>
    </div>
  );
}
