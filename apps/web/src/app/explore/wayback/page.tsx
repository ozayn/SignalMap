"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/api";

type Snapshot = {
  timestamp: string;
  archived_url: string;
  metric_name?: string;
  metric_value?: number;
  confidence?: number;
  evidence_snippet?: string;
};

type WaybackResponse = {
  url: string;
  snapshots: Snapshot[];
  notes: string;
};

type InstagramResult = {
  timestamp: string;
  archived_url: string;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  confidence?: number;
  evidence?: string | null;
};

type InstagramProgress = {
  total: number;
  processed: number;
};

type InstagramResponse = {
  platform: string;
  username: string;
  url?: string;
  canonical_url?: string;
  snapshots_total: number;
  snapshots_sampled: number;
  results: InstagramResult[];
  notes: string;
  progress?: InstagramProgress;
};

export default function WaybackExplorePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WaybackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [igUsername, setIgUsername] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [igData, setIgData] = useState<InstagramResponse | null>(null);
  const [igError, setIgError] = useState<string | null>(null);
  const [igProgress, setIgProgress] = useState<{ processed: number; total: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        url: url.trim(),
        sample: "30",
      });
      const result = await fetchJson<WaybackResponse>(
        `/api/wayback/snapshots?${params}`
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const SAMPLE_SIZE = 30;

  const handleInstagramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igUsername.trim()) return;
    setIgLoading(true);
    setIgError(null);
    setIgData(null);
    setIgProgress({ processed: 0, total: SAMPLE_SIZE });
    let completed = false;
    try {
      const params = new URLSearchParams({
        username: igUsername.trim(),
        from_year: "2012",
        to_year: "2026",
        sample: String(SAMPLE_SIZE),
        progress: "true",
      });
      const res = await fetch(`/api/wayback/instagram?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const result = (await res.json()) as InstagramResponse;
      setIgData(result);
      completed = true;
      if (result.progress) {
        setIgProgress({
          processed: result.progress.processed,
          total: result.progress.total,
        });
      }
    } catch (e) {
      setIgError(e instanceof Error ? e.message : "Request failed");
      setIgProgress(null);
    } finally {
      setIgLoading(false);
      if (completed) {
        setTimeout(() => setIgProgress(null), 400);
      }
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <Link
          href="/explore"
          className="text-xs text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← Explore
        </Link>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Wayback snapshots
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Archival snapshots with optional follower/subscriber extraction. Sparse coverage; metrics are contextual signals only.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
        >
          {loading ? "Fetching…" : "Fetch snapshots"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-muted-foreground">{error}</p>
      )}

      {data && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{data.notes}</p>
          <p className="text-sm text-muted-foreground">
            {data.snapshots.length} snapshot(s) for {data.url}
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.snapshots.map((s, i) => (
              <div
                key={`${s.timestamp}-${i}`}
                className="rounded-md border border-border p-3 text-sm space-y-1"
              >
                <p className="text-muted-foreground">
                  {s.timestamp.slice(0, 4)}-{s.timestamp.slice(4, 6)}-{s.timestamp.slice(6, 8)}
                </p>
                {s.metric_name && (
                  <p>
                    {s.metric_name}: {s.metric_value?.toLocaleString()}
                    {s.confidence != null && ` (confidence: ${s.confidence})`}
                  </p>
                )}
                <a
                  href={s.archived_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground truncate block"
                >
                  {s.archived_url}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-border" />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Instagram profile</h2>
        <form onSubmit={handleInstagramSubmit} className="space-y-4">
          <input
            type="text"
            value={igUsername}
            onChange={(e) => setIgUsername(e.target.value)}
            placeholder="username (e.g. golfarahani)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={igLoading}
          />
          <button
            type="submit"
            disabled={igLoading}
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
          >
            {igLoading ? "Fetching…" : "Fetch Instagram snapshots"}
          </button>
        </form>
        {igError && <p className="text-sm text-muted-foreground">{igError}</p>}
        {(igLoading || igProgress) && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Fetching archival snapshots (
              {igProgress && igProgress.processed > 0 ? igProgress.processed : "…"} / {igProgress?.total ?? SAMPLE_SIZE}
              )
            </p>
            <div
              role="progressbar"
              aria-valuenow={igProgress?.processed ?? 0}
              aria-valuemin={0}
              aria-valuemax={igProgress?.total ?? SAMPLE_SIZE}
              className="h-[2.5px] w-full rounded-full bg-border overflow-hidden"
            >
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all duration-300 ease-out"
                style={
                  igProgress && igProgress.processed > 0
                    ? { width: `${(igProgress.processed / igProgress.total) * 100}%` }
                    : { width: "30%", animation: "progress-indeterminate 1.5s ease-in-out infinite" }
                }
              />
            </div>
          </div>
        )}
        {igData && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{igData.notes}</p>
            <p className="text-sm text-muted-foreground">
              {igData.snapshots_sampled} of {igData.snapshots_total} snapshots for @{igData.username}
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {igData.results.map((r, i) => (
                <div
                  key={`${r.timestamp}-${i}`}
                  className="rounded-md border border-border p-3 text-sm space-y-1"
                >
                  <p className="text-muted-foreground">
                    {r.timestamp.slice(0, 4)}-{r.timestamp.slice(4, 6)}-{r.timestamp.slice(6, 8)}
                  </p>
                  {(r.followers != null || r.following != null || r.posts != null) && (
                    <p>
                      Followers: {r.followers?.toLocaleString() ?? "—"} · Following: {r.following?.toLocaleString() ?? "—"} · Posts: {r.posts?.toLocaleString() ?? "—"}
                      {r.confidence != null && r.confidence > 0 && ` (conf: ${r.confidence})`}
                    </p>
                  )}
                  <a
                    href={r.archived_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground truncate block"
                  >
                    {r.archived_url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
