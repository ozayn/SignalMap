"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";
import { FollowersChart, type FollowersPoint } from "@/components/followers-chart";

type RecentJob = {
  job_id: string;
  platform?: string;
  username: string;
  status: string;
  total: number;
  processed: number;
  created_at: string | null;
  finished_at: string | null;
  snapshots_found?: number | null;
  snapshots_sampled?: number | null;
  snapshots_with_metrics?: number | null;
  snapshots_cached?: number | null;
  snapshots_fetched?: number | null;
  summary?: string | null;
};

function apiErrorToString(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string") return d.error;
  const detail = d.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return first?.msg ?? JSON.stringify(detail[0]);
  }
  return fallback;
}

function jobStatusLabel(j: RecentJob): string {
  if (j.status !== "completed") return j.status;
  const p = j.processed ?? 0;
  const summary = j.summary ?? "";
  if (p === 0) {
    if (summary) return `completed — ${summary.toLowerCase()}`;
    return "completed — no snapshots in selected range";
  }
  if (summary) return `completed — ${summary.toLowerCase()}`;
  return `completed (${p} snapshots)`;
}

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

type YouTubeResult = {
  timestamp: string;
  original_url: string;
  archived_url: string;
  subscribers: number | null;
  confidence: number;
  evidence: string | null;
};

type YouTubeResponse = {
  platform: string;
  input: string;
  canonical_url: string;
  snapshots_total: number;
  snapshots_sampled: number;
  results: YouTubeResult[];
  notes: string;
};

type TwitterResult = {
  timestamp: string;
  original_url: string;
  archived_url: string;
  followers: number | null;
  confidence: number;
  evidence: string | null;
};

type TwitterResponse = {
  platform: string;
  username: string;
  canonical_url: string;
  snapshots_total: number;
  snapshots_sampled: number;
  results: TwitterResult[];
  notes: string;
};

export default function WaybackExplorePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WaybackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [igUsername, setIgUsername] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [igData, setIgData] = useState<InstagramResponse | null>(null);
  const [igError, setIgError] = useState<string | null>(null);
  const [igProgress, setIgProgress] = useState<{ processed: number; total: number } | null>(null);

  const [ytInput, setYtInput] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytData, setYtData] = useState<YouTubeResponse | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytJobError, setYtJobError] = useState<string | null>(null);
  const [ytProgress, setYtProgress] = useState<{ processed: number; total: number } | null>(null);
  const [ytRangePreset, setYtRangePreset] = useState<RangePreset>("years");
  const [ytFromYear, setYtFromYear] = useState(2005);
  const [ytToYear, setYtToYear] = useState(2026);
  const [ytFromDate, setYtFromDate] = useState("");
  const [ytToDate, setYtToDate] = useState("");
  const [ytSample, setYtSample] = useState(20);

  const [twInput, setTwInput] = useState("");
  const [twLoading, setTwLoading] = useState(false);
  const [twData, setTwData] = useState<TwitterResponse | null>(null);
  const [twError, setTwError] = useState<string | null>(null);
  const [twJobError, setTwJobError] = useState<string | null>(null);
  const [twProgress, setTwProgress] = useState<{ processed: number; total: number } | null>(null);
  const [twRangePreset, setTwRangePreset] = useState<RangePreset>("years");
  const [twFromYear, setTwFromYear] = useState(2006);
  const [twToYear, setTwToYear] = useState(2026);
  const [twFromDate, setTwFromDate] = useState("");
  const [twToDate, setTwToDate] = useState("");
  const [twSample, setTwSample] = useState(20);

  const followersPoints = useMemo<FollowersPoint[]>(() => {
    if (!igData) return [];
    const out: FollowersPoint[] = [];
    for (const r of igData.results) {
      if (r.followers == null) continue;
      const ts = r.timestamp;
      if (ts.length < 8) continue;
      out.push({
        date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
        followers: r.followers,
        confidence: r.confidence ?? 0.2,
        archived_url: r.archived_url,
      });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [igData]);

  const ytSubscribersPoints = useMemo<FollowersPoint[]>(() => {
    if (!ytData) return [];
    const out: FollowersPoint[] = [];
    for (const r of ytData.results) {
      if (r.subscribers == null) continue;
      const ts = r.timestamp;
      if (ts.length < 8) continue;
      out.push({
        date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
        followers: r.subscribers,
        confidence: r.confidence ?? 0.2,
        archived_url: r.archived_url,
      });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [ytData]);

  const twFollowersPoints = useMemo<FollowersPoint[]>(() => {
    if (!twData) return [];
    const out: FollowersPoint[] = [];
    for (const r of twData.results) {
      if (r.followers == null) continue;
      const ts = r.timestamp;
      if (ts.length < 8) continue;
      out.push({
        date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
        followers: r.followers,
        confidence: r.confidence ?? 0.2,
        archived_url: r.archived_url,
      });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [twData]);

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

  type RangePreset = "years" | "2weeks" | "1month" | "3months" | "custom";
  const [rangePreset, setRangePreset] = useState<RangePreset>("years");
  const [fromYear, setFromYear] = useState(2012);
  const [toYear, setToYear] = useState(2026);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sampleSize, setSampleSize] = useState(30);
  const [jobError, setJobError] = useState<string | null>(null);

  const toYmd = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    setJobsLoaded(null);
    let mounted = true;
    const controller = new AbortController();
    fetch("/api/wayback/jobs?limit=10", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, jobs: (data?.jobs ?? []) as RecentJob[] };
      })
      .then(({ ok, jobs }) => {
        if (mounted) {
          setRecentJobs(jobs);
          setJobsLoaded(ok);
        }
      })
      .catch(() => {
        if (mounted) setJobsLoaded(false);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const handleInstagramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igUsername.trim()) return;
    const now = new Date();
    let fromDateVal: string | null = null;
    let toDateVal: string | null = null;
    let fromYearVal: number | null = null;
    let toYearVal: number | null = null;
    if (rangePreset === "years") {
      fromYearVal = Math.min(fromYear, toYear);
      toYearVal = Math.max(fromYear, toYear);
    } else if (rangePreset === "2weeks") {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "1month") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "3months") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "custom" && fromDate && toDate) {
      fromDateVal = fromDate.replace(/-/g, "");
      toDateVal = toDate.replace(/-/g, "");
    } else if (rangePreset === "custom") {
      setIgError("Please enter both from and to dates for custom range");
      return;
    }
    setIgLoading(true);
    setIgError(null);
    setJobError(null);
    setIgData(null);
    setIgProgress({ processed: 0, total: sampleSize });
    try {
      const res = await fetch("/api/wayback/instagram/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: igUsername.trim(),
          from_year: fromYearVal ?? undefined,
          to_year: toYearVal ?? undefined,
          from_date: fromDateVal ?? undefined,
          to_date: toDateVal ?? undefined,
          sample: sampleSize,
        }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setJobError("Database not configured. Using direct fetch…");
          await handleDirectFetch();
        } else {
          setIgError(apiErrorToString(data, `Request failed: ${res.status}`));
        }
        return;
      }
      router.push(`/explore/wayback/${data.job_id}`);
    } catch (e) {
      setIgError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setIgLoading(false);
    }
  };

  const handleDirectFetch = async () => {
    let completed = false;
    const now = new Date();
    let fromDateVal: string | null = null;
    let toDateVal: string | null = null;
    let fromYearVal: number | null = null;
    let toYearVal: number | null = null;
    if (rangePreset === "years") {
      fromYearVal = Math.min(fromYear, toYear);
      toYearVal = Math.max(fromYear, toYear);
    } else if (rangePreset === "2weeks") {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "1month") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "3months") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (rangePreset === "custom" && fromDate && toDate) {
      fromDateVal = fromDate.replace(/-/g, "");
      toDateVal = toDate.replace(/-/g, "");
    }
    try {
      const params = new URLSearchParams({
        username: igUsername.trim(),
        sample: String(sampleSize),
        progress: "true",
      });
      if (fromYearVal != null) params.set("from_year", String(fromYearVal));
      if (toYearVal != null) params.set("to_year", String(toYearVal));
      if (fromDateVal) params.set("from_date", fromDateVal);
      if (toDateVal) params.set("to_date", toDateVal);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      const res = await fetch(`/api/wayback/instagram?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
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
      const msg = e instanceof Error ? (e.name === "AbortError" ? "Request timed out (90s)" : e.message) : "Request failed";
      setIgError(msg);
      setIgProgress(null);
    } finally {
      setIgLoading(false);
      if (completed) {
        setTimeout(() => setIgProgress(null), 400);
      }
    }
  };

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytInput.trim()) return;
    const now = new Date();
    let fromDateVal: string | null = null;
    let toDateVal: string | null = null;
    let fromYearVal: number | null = null;
    let toYearVal: number | null = null;
    if (ytRangePreset === "years") {
      fromYearVal = Math.min(ytFromYear, ytToYear);
      toYearVal = Math.max(ytFromYear, ytToYear);
    } else if (ytRangePreset === "2weeks") {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (ytRangePreset === "1month") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (ytRangePreset === "3months") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (ytRangePreset === "custom" && ytFromDate && ytToDate) {
      fromDateVal = ytFromDate.replace(/-/g, "");
      toDateVal = ytToDate.replace(/-/g, "");
    } else if (ytRangePreset === "custom") {
      setYtError("Please enter both from and to dates for custom range");
      return;
    }
    setYtLoading(true);
    setYtError(null);
    setYtJobError(null);
    setYtData(null);
    setYtProgress({ processed: 0, total: ytSample });
    try {
      const res = await fetch("/api/wayback/youtube/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          input: ytInput.trim(),
          from_year: fromYearVal ?? undefined,
          to_year: toYearVal ?? undefined,
          from_date: fromDateVal ?? undefined,
          to_date: toDateVal ?? undefined,
          sample: ytSample,
        }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setYtJobError("Database not configured. Using direct fetch…");
          await handleYouTubeDirectFetch(fromYearVal, toYearVal, fromDateVal, toDateVal);
        } else {
          setYtError(apiErrorToString(data, `Request failed: ${res.status}`));
        }
        return;
      }
      router.push(`/explore/wayback/${data.job_id}`);
    } catch (e) {
      setYtError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setYtLoading(false);
    }
  };

  const handleYouTubeDirectFetch = async (
    fromYearVal: number | null,
    toYearVal: number | null,
    fromDateVal: string | null,
    toDateVal: string | null,
  ) => {
    let completed = false;
    try {
      const params = new URLSearchParams({
        input: ytInput.trim(),
        sample: String(ytSample),
      });
      if (fromYearVal != null) params.set("from_year", String(fromYearVal));
      if (toYearVal != null) params.set("to_year", String(toYearVal));
      if (fromDateVal) params.set("from_date", fromDateVal);
      if (toDateVal) params.set("to_date", toDateVal);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`/api/wayback/youtube?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const result = (await res.json()) as YouTubeResponse;
      setYtData(result);
      completed = true;
    } catch (e) {
      const msg = e instanceof Error ? (e.name === "AbortError" ? "Request timed out (120s)" : e.message) : "Request failed";
      setYtError(msg);
      setYtProgress(null);
    } finally {
      setYtLoading(false);
      if (completed) setTimeout(() => setYtProgress(null), 400);
    }
  };

  const handleTwitterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twInput.trim()) return;
    const now = new Date();
    let fromDateVal: string | null = null;
    let toDateVal: string | null = null;
    let fromYearVal: number | null = null;
    let toYearVal: number | null = null;
    if (twRangePreset === "years") {
      fromYearVal = Math.min(twFromYear, twToYear);
      toYearVal = Math.max(twFromYear, twToYear);
    } else if (twRangePreset === "2weeks") {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (twRangePreset === "1month") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (twRangePreset === "3months") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      fromDateVal = toYmd(start);
      toDateVal = toYmd(now);
    } else if (twRangePreset === "custom" && twFromDate && twToDate) {
      fromDateVal = twFromDate.replace(/-/g, "");
      toDateVal = twToDate.replace(/-/g, "");
    } else if (twRangePreset === "custom") {
      setTwError("Please enter both from and to dates for custom range");
      return;
    }
    setTwLoading(true);
    setTwError(null);
    setTwJobError(null);
    setTwData(null);
    setTwProgress({ processed: 0, total: twSample });
    try {
      const res = await fetch("/api/wayback/twitter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: twInput.trim(),
          from_year: fromYearVal ?? undefined,
          to_year: toYearVal ?? undefined,
          from_date: fromDateVal ?? undefined,
          to_date: toDateVal ?? undefined,
          sample: twSample,
        }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setTwJobError("Database not configured. Using direct fetch…");
          await handleTwitterDirectFetch(fromYearVal, toYearVal, fromDateVal, toDateVal);
        } else {
          setTwError(apiErrorToString(data, `Request failed: ${res.status}`));
        }
        return;
      }
      router.push(`/explore/wayback/${data.job_id}`);
    } catch (e) {
      setTwError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setTwLoading(false);
    }
  };

  const handleTwitterDirectFetch = async (
    fromYearVal: number | null,
    toYearVal: number | null,
    fromDateVal: string | null,
    toDateVal: string | null,
  ) => {
    let completed = false;
    try {
      const params = new URLSearchParams({
        username: twInput.trim(),
        sample: String(twSample),
      });
      if (fromYearVal != null) params.set("from_year", String(fromYearVal));
      if (toYearVal != null) params.set("to_year", String(toYearVal));
      if (fromDateVal) params.set("from_date", fromDateVal);
      if (toDateVal) params.set("to_date", toDateVal);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`/api/wayback/twitter?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const result = (await res.json()) as TwitterResponse;
      setTwData(result);
      completed = true;
    } catch (e) {
      const msg = e instanceof Error ? (e.name === "AbortError" ? "Request timed out (120s)" : e.message) : "Request failed";
      setTwError(msg);
      setTwProgress(null);
    } finally {
      setTwLoading(false);
      if (completed) setTimeout(() => setTwProgress(null), 400);
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
          Try <code className="text-xs">internetarchive</code> for a profile with many archives.
          Fetching respects Archive.org&apos;s 15 req/min limit — larger samples take longer.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">Build: 2025-02-08</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
        <input
          id="wayback-url"
          name="url"
          type="url"
          autoComplete="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={loading}
          suppressHydrationWarning
        />
        <button
          type="submit"
          disabled={loading}
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
          suppressHydrationWarning
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
        <form onSubmit={handleInstagramSubmit} className="space-y-4" suppressHydrationWarning>
          <input
            id="ig-username"
            name="username"
            type="text"
            autoComplete="off"
            value={igUsername}
            onChange={(e) => setIgUsername(e.target.value)}
            placeholder="username (e.g. internetarchive, golfarahani)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={igLoading}
            suppressHydrationWarning
          />
          <label htmlFor="ig-range-preset" className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Time range</span>
            <select
              id="ig-range-preset"
              name="range-preset"
              autoComplete="off"
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={igLoading}
              suppressHydrationWarning
            >
              <option value="years">All years (2012–2026)</option>
              <option value="2weeks">Past 2 weeks</option>
              <option value="1month">Past month</option>
              <option value="3months">Past 3 months</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-4 items-end">
            {(rangePreset === "years" || rangePreset === "custom") &&
              (rangePreset === "years" ? (
                <>
                  <label htmlFor="ig-from-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From year</span>
                    <input
                      id="ig-from-year"
                      name="from-year"
                      type="number"
                      autoComplete="off"
                      min={2006}
                      max={2030}
                      value={fromYear}
                      onChange={(e) => setFromYear(parseInt(e.target.value, 10) || 2012)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={igLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="ig-to-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To year</span>
                    <input
                      id="ig-to-year"
                      name="to-year"
                      type="number"
                      autoComplete="off"
                      min={2006}
                      max={2030}
                      value={toYear}
                      onChange={(e) => setToYear(parseInt(e.target.value, 10) || 2026)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={igLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ) : (
                <>
                  <label htmlFor="ig-from-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From date</span>
                    <input
                      id="ig-from-date"
                      name="from-date"
                      type="date"
                      autoComplete="off"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={igLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="ig-to-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To date</span>
                    <input
                      id="ig-to-date"
                      name="to-date"
                      type="date"
                      autoComplete="off"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={igLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ))}
            <label htmlFor="ig-sample-size" className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Snapshots to sample</span>
                <input
                  id="ig-sample-size"
                  name="sample-size"
                  type="number"
                  autoComplete="off"
                  min={1}
                  max={100}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 30)))}
                  className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  disabled={igLoading}
                  title="Number of snapshots to fetch across the time range (1–100)"
                  suppressHydrationWarning
                />
              </label>
          </div>
          <button
            type="submit"
            disabled={igLoading}
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
            suppressHydrationWarning
          >
            {igLoading ? "Starting…" : "Start fetch"}
          </button>
        </form>
        {jobError && <p className="text-xs text-muted-foreground italic">{jobError}</p>}
        {igError && <p className="text-sm text-muted-foreground">{igError}</p>}
        {(igLoading || igProgress) && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Fetching archival snapshots (
              {igProgress && igProgress.processed > 0 ? igProgress.processed : "…"} / {igProgress?.total ?? sampleSize}
              )
            </p>
            <div
              role="progressbar"
              aria-valuenow={igProgress?.processed ?? 0}
              aria-valuemin={0}
              aria-valuemax={igProgress?.total ?? sampleSize}
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
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">{igData.notes}</p>
            <p className="text-sm text-muted-foreground">
              {igData.snapshots_sampled} of {igData.snapshots_total} snapshots for @{igData.username}
            </p>
            {igData.snapshots_total === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No archived snapshots found for this profile. The archive may not have captured it, or the Wayback service may be unreachable from this environment.
              </p>
            )}

            {followersPoints.length > 0 && (
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Followers over time</h3>
                <FollowersChart data={followersPoints} username={igData.username} />
              </div>
            )}

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

      <hr className="border-border" />

      <div className="text-sm border border-border rounded-md p-3">
        <p className="text-muted-foreground mb-2 font-medium">Recent jobs</p>
        {jobsLoaded === null ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : jobsLoaded === false ? (
          <p className="text-muted-foreground text-xs">Database not configured — jobs unavailable</p>
        ) : recentJobs.length === 0 ? (
          <p className="text-muted-foreground text-xs">No jobs yet</p>
        ) : (
          <ul className="space-y-1.5">
            {recentJobs.map((j) => (
              <li key={j.job_id}>
                <Link
                  href={`/explore/wayback/${j.job_id}`}
                  className="text-muted-foreground hover:text-foreground block"
                >
                  {j.platform === "youtube" ? `YT ${j.username}` : j.platform === "twitter" ? `X @${j.username}` : j.platform === "instagram" ? `IG @${j.username}` : `@${j.username}`} — {jobStatusLabel(j)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-border" />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">YouTube channel</h2>
        <p className="text-sm text-muted-foreground">
          Subscriber counts from Wayback archival snapshots. Use @handle or full URL.
        </p>
        <form onSubmit={handleYouTubeSubmit} className="space-y-4" suppressHydrationWarning>
          <input
            id="yt-input"
            name="input"
            type="text"
            autoComplete="off"
            value={ytInput}
            onChange={(e) => setYtInput(e.target.value)}
            placeholder="@handle or https://www.youtube.com/@handle"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={ytLoading}
            suppressHydrationWarning
          />
          <label htmlFor="yt-range-preset" className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Time range</span>
            <select
              id="yt-range-preset"
              name="range-preset"
              autoComplete="off"
              value={ytRangePreset}
              onChange={(e) => setYtRangePreset(e.target.value as RangePreset)}
              className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={ytLoading}
              suppressHydrationWarning
            >
              <option value="years">All years (2005–2026)</option>
              <option value="2weeks">Past 2 weeks</option>
              <option value="1month">Past month</option>
              <option value="3months">Past 3 months</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-4 items-end">
            {(ytRangePreset === "years" || ytRangePreset === "custom") &&
              (ytRangePreset === "years" ? (
                <>
                  <label htmlFor="yt-from-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From year</span>
                    <input
                      id="yt-from-year"
                      name="from-year"
                      type="number"
                      autoComplete="off"
                      min={2005}
                      max={2030}
                      value={ytFromYear}
                      onChange={(e) => setYtFromYear(parseInt(e.target.value, 10) || 2005)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={ytLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="yt-to-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To year</span>
                    <input
                      id="yt-to-year"
                      name="to-year"
                      type="number"
                      autoComplete="off"
                      min={2005}
                      max={2030}
                      value={ytToYear}
                      onChange={(e) => setYtToYear(parseInt(e.target.value, 10) || 2026)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={ytLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ) : (
                <>
                  <label htmlFor="yt-from-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From date</span>
                    <input
                      id="yt-from-date"
                      name="from-date"
                      type="date"
                      autoComplete="off"
                      value={ytFromDate}
                      onChange={(e) => setYtFromDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={ytLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="yt-to-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To date</span>
                    <input
                      id="yt-to-date"
                      name="to-date"
                      type="date"
                      autoComplete="off"
                      value={ytToDate}
                      onChange={(e) => setYtToDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={ytLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ))}
            <label htmlFor="yt-sample" className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Snapshots to sample</span>
              <input
                id="yt-sample"
                name="sample"
                type="number"
                autoComplete="off"
                min={1}
                max={50}
                value={ytSample}
                onChange={(e) => setYtSample(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 20)))}
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={ytLoading}
                suppressHydrationWarning
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={ytLoading}
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
            suppressHydrationWarning
          >
            {ytLoading ? "Starting…" : "Start fetch"}
          </button>
        </form>
        {ytJobError && <p className="text-xs text-muted-foreground italic">{ytJobError}</p>}
        {ytError && <p className="text-sm text-muted-foreground">{ytError}</p>}
        {(ytLoading || ytProgress) && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Fetching archival snapshots (
              {ytProgress && ytProgress.processed > 0 ? ytProgress.processed : "…"} / {ytProgress?.total ?? ytSample}
              )
            </p>
            <div
              role="progressbar"
              aria-valuenow={ytProgress?.processed ?? 0}
              aria-valuemin={0}
              aria-valuemax={ytProgress?.total ?? ytSample}
              className="h-[2.5px] w-full rounded-full bg-border overflow-hidden"
            >
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all duration-300 ease-out"
                style={
                  ytProgress && ytProgress.processed > 0
                    ? { width: `${(ytProgress.processed / ytProgress.total) * 100}%` }
                    : { width: "30%", animation: "progress-indeterminate 1.5s ease-in-out infinite" }
                }
              />
            </div>
          </div>
        )}
        {ytData && (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">{ytData.notes}</p>
            <p className="text-sm text-muted-foreground">
              {ytData.snapshots_sampled} of {ytData.snapshots_total} snapshots for {ytData.input}
            </p>
            {ytData.snapshots_total === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No archived snapshots found. Try a different handle or URL format.
              </p>
            )}
            {ytSubscribersPoints.length > 0 && (
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Subscribers over time</h3>
                <FollowersChart data={ytSubscribersPoints} username={ytData.input} metricLabel="Subscribers" />
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {ytData.results.map((r, i) => (
                <div
                  key={`${r.timestamp}-${i}`}
                  className="rounded-md border border-border p-3 text-sm space-y-1"
                >
                  <p className="text-muted-foreground">
                    {r.timestamp.slice(0, 4)}-{r.timestamp.slice(4, 6)}-{r.timestamp.slice(6, 8)}
                  </p>
                  {r.subscribers != null && (
                    <p>
                      Subscribers: {r.subscribers.toLocaleString()}
                      {r.confidence > 0 && ` (conf: ${r.confidence})`}
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

      <hr className="border-border" />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Twitter / X profile</h2>
        <p className="text-sm text-muted-foreground">
          Follower counts from Wayback archival snapshots. Use @handle or full URL (twitter.com or x.com).
        </p>
        <form onSubmit={handleTwitterSubmit} className="space-y-4" suppressHydrationWarning>
          <input
            id="tw-input"
            name="input"
            type="text"
            autoComplete="off"
            value={twInput}
            onChange={(e) => setTwInput(e.target.value)}
            placeholder="@handle or https://twitter.com/username"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={twLoading}
            suppressHydrationWarning
          />
          <label htmlFor="tw-range-preset" className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Time range</span>
            <select
              id="tw-range-preset"
              name="range-preset"
              autoComplete="off"
              value={twRangePreset}
              onChange={(e) => setTwRangePreset(e.target.value as RangePreset)}
              className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={twLoading}
              suppressHydrationWarning
            >
              <option value="years">All years (2006–2026)</option>
              <option value="2weeks">Past 2 weeks</option>
              <option value="1month">Past month</option>
              <option value="3months">Past 3 months</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-4 items-end">
            {(twRangePreset === "years" || twRangePreset === "custom") &&
              (twRangePreset === "years" ? (
                <>
                  <label htmlFor="tw-from-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From year</span>
                    <input
                      id="tw-from-year"
                      name="from-year"
                      type="number"
                      autoComplete="off"
                      min={2006}
                      max={2030}
                      value={twFromYear}
                      onChange={(e) => setTwFromYear(parseInt(e.target.value, 10) || 2006)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={twLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="tw-to-year" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To year</span>
                    <input
                      id="tw-to-year"
                      name="to-year"
                      type="number"
                      autoComplete="off"
                      min={2006}
                      max={2030}
                      value={twToYear}
                      onChange={(e) => setTwToYear(parseInt(e.target.value, 10) || 2026)}
                      className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={twLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ) : (
                <>
                  <label htmlFor="tw-from-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From date</span>
                    <input
                      id="tw-from-date"
                      name="from-date"
                      type="date"
                      autoComplete="off"
                      value={twFromDate}
                      onChange={(e) => setTwFromDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={twLoading}
                      suppressHydrationWarning
                    />
                  </label>
                  <label htmlFor="tw-to-date" className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To date</span>
                    <input
                      id="tw-to-date"
                      name="to-date"
                      type="date"
                      autoComplete="off"
                      value={twToDate}
                      onChange={(e) => setTwToDate(e.target.value)}
                      className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      disabled={twLoading}
                      suppressHydrationWarning
                    />
                  </label>
                </>
              ))}
            <label htmlFor="tw-sample" className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Snapshots to sample</span>
              <input
                id="tw-sample"
                name="sample"
                type="number"
                autoComplete="off"
                min={1}
                max={50}
                value={twSample}
                onChange={(e) => setTwSample(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 20)))}
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={twLoading}
                suppressHydrationWarning
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={twLoading}
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 transition disabled:opacity-50"
            suppressHydrationWarning
          >
            {twLoading ? "Starting…" : "Start fetch"}
          </button>
        </form>
        {twJobError && <p className="text-xs text-muted-foreground italic">{twJobError}</p>}
        {twError && <p className="text-sm text-muted-foreground">{twError}</p>}
        {(twLoading || twProgress) && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Fetching archival snapshots (
              {twProgress && twProgress.processed > 0 ? twProgress.processed : "…"} / {twProgress?.total ?? twSample}
              )
            </p>
            <div
              role="progressbar"
              aria-valuenow={twProgress?.processed ?? 0}
              aria-valuemin={0}
              aria-valuemax={twProgress?.total ?? twSample}
              className="h-[2.5px] w-full rounded-full bg-border overflow-hidden"
            >
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all duration-300 ease-out"
                style={
                  twProgress && twProgress.processed > 0
                    ? { width: `${(twProgress.processed / twProgress.total) * 100}%` }
                    : { width: "30%", animation: "progress-indeterminate 1.5s ease-in-out infinite" }
                }
              />
            </div>
          </div>
        )}
        {twData && (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">{twData.notes}</p>
            <p className="text-sm text-muted-foreground">
              {twData.snapshots_sampled} of {twData.snapshots_total} snapshots for @{twData.username}
            </p>
            {twData.snapshots_total === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No archived snapshots found. Try a different handle or URL format.
              </p>
            )}
            {twFollowersPoints.length > 0 && (
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Followers over time</h3>
                <FollowersChart data={twFollowersPoints} username={twData.username} />
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {twData.results.map((r, i) => (
                <div
                  key={`${r.timestamp}-${i}`}
                  className="rounded-md border border-border p-3 text-sm space-y-1"
                >
                  <p className="text-muted-foreground">
                    {r.timestamp.slice(0, 4)}-{r.timestamp.slice(4, 6)}-{r.timestamp.slice(6, 8)}
                  </p>
                  {r.followers != null && (
                    <p>
                      Followers: {r.followers.toLocaleString()}
                      {r.confidence > 0 && ` (conf: ${r.confidence})`}
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
