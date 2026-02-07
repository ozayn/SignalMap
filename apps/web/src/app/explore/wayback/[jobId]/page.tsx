"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FollowersChart, type FollowersPoint } from "@/components/followers-chart";

type JobResult = {
  timestamp: string;
  archived_url: string;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  confidence?: number;
  evidence?: string | null;
  source?: string;
};

type JobResponse = {
  job_id: string;
  status: string;
  username?: string;
  total?: number;
  processed?: number;
  error?: string;
  results?: JobResult[];
  /** Merged cache + job results for the chart (all available data) */
  all_results?: JobResult[];
  snapshots_found?: number | null;
  snapshots_sampled?: number | null;
  snapshots_with_metrics?: number | null;
  snapshots_cached?: number | null;
  snapshots_fetched?: number | null;
  summary?: string | null;
};

export default function WaybackJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/wayback/jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) setError("Job not found");
        else setError(`Request failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as JobResponse;
      setJob(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    fetchJob();
  }, [jobId, fetchJob]);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const interval = setInterval(fetchJob, 1500);
    return () => clearInterval(interval);
  }, [job?.status, fetchJob]);

  const chartData = job?.all_results ?? job?.results ?? [];
  const followersPoints: FollowersPoint[] = chartData
    .map((r) => {
      const ts = r.timestamp;
      const date = ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : "";
      return {
        date,
        followers: r.followers ?? null,
        confidence: r.confidence ?? 0.2,
        archived_url: r.archived_url ?? "",
      };
    })
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleCancel = async () => {
    try {
      await fetch(`/api/wayback/jobs/${jobId}/cancel`, { method: "POST" });
      fetchJob();
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this job and its results? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/wayback/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/explore/wayback");
      } else {
        setError("Failed to delete job");
      }
    } catch {
      setError("Failed to delete job");
    } finally {
      setDeleting(false);
    }
  };

  if (error && !job) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Link href="/explore/wayback" className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Wayback
        </Link>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Link href="/explore/wayback" className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Wayback
        </Link>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const isRunning = ["queued", "running"].includes(job.status);
  const total = job.total ?? 0;
  const processed = job.processed ?? 0;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <Link href="/explore/wayback" className="text-xs text-muted-foreground hover:text-foreground mb-2 inline-block">
          ← Back to Wayback
        </Link>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Wayback job: @{job.username ?? "—"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status: {job.status}
          {job.job_id && ` · ${job.job_id.slice(0, 8)}…`}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-muted-foreground hover:text-red-600 border border-border hover:border-red-600/50 rounded px-2 py-1 transition disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete job"}
          </button>
        </div>
      </div>

      {isRunning && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Processed {processed} / {total || "…"}
          </p>
          <div
            role="progressbar"
            aria-valuenow={processed}
            aria-valuemin={0}
            aria-valuemax={total || 100}
            className="h-[2.5px] w-full rounded-full bg-border overflow-hidden"
          >
            <div
              className="h-full bg-muted-foreground/40 rounded-full transition-all duration-300 ease-out"
              style={{ width: total ? `${(processed / total) * 100}%` : "30%" }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {job.status === "failed" && job.error && (
        <p className="text-sm text-muted-foreground italic">{job.error}</p>
      )}

      {!isRunning && (job.snapshots_found != null || job.snapshots_sampled != null || job.summary) && (
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium mb-3">Job summary</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            {job.snapshots_found != null && <p>Snapshots found: {job.snapshots_found}</p>}
            {job.snapshots_sampled != null && <p>Sampled: {job.snapshots_sampled}</p>}
            {job.snapshots_with_metrics != null && <p>With metrics: {job.snapshots_with_metrics}</p>}
            {(job.snapshots_cached != null || job.snapshots_fetched != null) && (
              <p>
                Source: {job.snapshots_cached ?? 0} from cache, {job.snapshots_fetched ?? 0} from archive
              </p>
            )}
            {job.summary && <p className="mt-2 italic">{job.summary}</p>}
          </div>
        </div>
      )}

      {((job.results && job.results.length > 0) || followersPoints.length > 0) && (
        <div className="space-y-6">
          {followersPoints.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <h2 className="text-sm font-medium mb-3">Followers over time</h2>
              <FollowersChart data={followersPoints} username={job.username ?? ""} />
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium mb-2">Snapshots</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(job.all_results ?? job.results ?? []).map((r, i) => (
                <div
                  key={`${r.timestamp}-${i}`}
                  className="rounded-md border border-border p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground">
                      {r.timestamp.slice(0, 4)}-{r.timestamp.slice(4, 6)}-{r.timestamp.slice(6, 8)}
                    </p>
                    {r.source && (
                      <span className="text-xs text-muted-foreground/80">source: {r.source}</span>
                    )}
                  </div>
                  {(r.followers != null || r.following != null || r.posts != null) && (
                    <p>
                      Followers: {r.followers?.toLocaleString() ?? "—"} · Following: {r.following?.toLocaleString() ?? "—"} · Posts: {r.posts?.toLocaleString() ?? "—"}
                      {r.confidence != null && r.confidence > 0 && ` (conf: ${r.confidence})`}
                    </p>
                  )}
                  {r.archived_url && (
                    <a
                      href={r.archived_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground truncate block"
                    >
                      {r.archived_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
