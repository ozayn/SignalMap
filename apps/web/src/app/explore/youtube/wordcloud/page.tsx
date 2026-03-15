"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CommentWordCloud } from "@/components/comment-word-cloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/api";

const SAMPLE_URL =
  "/explore/youtube/wordcloud?channel_id=UC-test-wordcloud&window_start=2024-06-01&window_end=2024-06-30";
const BPLUS_URL =
  "/explore/youtube/wordcloud?channel_id=bpluspodcast&window_start=2024-06-01&window_end=2024-06-30";
/** Real Bplus data (after running ingest script): use channel ID and a wide window by published_at */
const BPLUS_REAL_URL =
  "/explore/youtube/wordcloud?channel_id=UChWB95_-n9rUc3H9srsn9bQ&window_start=2024-01-01&window_end=2025-12-31";

type WordCloudData = {
  items: Array<{ token: string; count: number }>;
  window_start: string;
  window_end: string;
};

function YouTubeWordCloudContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel_id") ?? "";
  const windowStart = searchParams.get("window_start") ?? "";
  const windowEnd = searchParams.get("window_end") ?? "";
  const showCountOnHover = searchParams.get("show_counts") === "1";

  const [formChannelId, setFormChannelId] = useState(channelId);
  const [formWindowStart, setFormWindowStart] = useState(windowStart);
  const [formWindowEnd, setFormWindowEnd] = useState(windowEnd);
  const [formShowCounts, setFormShowCounts] = useState(showCountOnHover);
  const [data, setData] = useState<WordCloudData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep form in sync when URL changes (e.g. sample link)
  useEffect(() => {
    setFormChannelId(channelId);
    setFormWindowStart(windowStart);
    setFormWindowEnd(windowEnd);
    setFormShowCounts(showCountOnHover);
  }, [channelId, windowStart, windowEnd, showCountOnHover]);

  const tryChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const cid = formChannelId.trim();
    const start = formWindowStart.trim();
    const end = formWindowEnd.trim();
    if (!cid || !start || !end) {
      setError("Please enter a channel ID or handle and both date fields.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({ channel_id: cid, window_start: start, window_end: end });
    if (formShowCounts) params.set("show_counts", "1");
    router.push(`/explore/youtube/wordcloud?${params.toString()}`);
  };

  useEffect(() => {
    if (!channelId.trim() || !windowStart.trim() || !windowEnd.trim()) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      channel_id: channelId.trim(),
      window_start: windowStart.trim(),
      window_end: windowEnd.trim(),
    });
    fetchJson<WordCloudData>(`/api/youtube/comments/wordcloud?${params}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [channelId, windowStart, windowEnd]);

  return (
    <div className="container max-w-3xl py-6 min-w-0 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">YouTube comments — word cloud</CardTitle>
          <p className="text-sm text-muted-foreground">
            Descriptive only. Enter channel ID and date window; optional: show_counts=1 for count on
            hover.
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            <Link href={SAMPLE_URL} className="underline text-foreground/80 hover:text-foreground">
              Sample data
            </Link>
            {" · "}
            <Link href={BPLUS_URL} className="underline text-foreground/80 hover:text-foreground">
              Bplus (demo)
            </Link>
            {" · "}
            <Link href={BPLUS_REAL_URL} className="underline text-foreground/80 hover:text-foreground">
              Bplus (real data)
            </Link>
            {" "}— real data needs API on port 8000, DATABASE_URL set, and ingest script run.{" "}
            <Link href="/explore/youtube/sentiment" className="underline text-foreground/80 hover:text-foreground">
              Sentiment (one video)
            </Link>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={tryChannel} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Channel ID or handle
              <input
                type="text"
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
                placeholder="e.g. UC…, UC-test-wordcloud, or bpluspodcast"
                className="rounded border bg-background px-2 py-1.5 text-sm w-56"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Window start
              <input
                type="date"
                value={formWindowStart}
                onChange={(e) => setFormWindowStart(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Window end
              <input
                type="date"
                value={formWindowEnd}
                onChange={(e) => setFormWindowEnd(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formShowCounts}
                onChange={(e) => setFormShowCounts(e.target.checked)}
              />
              Show counts on hover
            </label>
            <Button type="submit">Try this channel</Button>
          </form>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {data && !loading && (
            <CommentWordCloud
              items={data.items}
              windowStart={data.window_start}
              windowEnd={data.window_end}
              showCountOnHover={showCountOnHover}
              trySampleUrl={
                channelId.trim() !== "UC-test-wordcloud" &&
                channelId.trim().toLowerCase().replace(/^@/, "") !== "bpluspodcast"
                  ? SAMPLE_URL
                  : undefined
              }
            />
          )}
          {!data && !loading && !error && (
            <p className="text-sm text-muted-foreground">
              Add query params: channel_id, window_start, window_end (ISO dates). Or{" "}
              <Link href={SAMPLE_URL} className="underline text-foreground/80 hover:text-foreground">
                try sample data
              </Link>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function YouTubeWordCloudPage() {
  return (
    <Suspense fallback={<div className="container max-w-3xl py-6 text-sm text-muted-foreground min-w-0 w-full">Loading…</div>}>
      <YouTubeWordCloudContent />
    </Suspense>
  );
}
