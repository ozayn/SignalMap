"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/api";

type SentimentData = {
  video_id: string;
  channel_id: string;
  count: number;
  avg_polarity: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
};

export default function YouTubeSentimentPage() {
  const [channelId, setChannelId] = useState("UChWB95_-n9rUc3H9srsn9bQ");
  const [videoId, setVideoId] = useState("");
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSentiment = (e: React.FormEvent) => {
    e.preventDefault();
    const cid = channelId.trim();
    const vid = videoId.trim();
    if (!cid || !vid) {
      setError("Enter channel ID and video ID.");
      return;
    }
    setError(null);
    setLoading(true);
    fetchJson<SentimentData>(
      `/api/youtube/comments/sentiment?channel_id=${encodeURIComponent(cid)}&video_id=${encodeURIComponent(vid)}`
    )
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="container max-w-2xl py-6 min-w-0 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">YouTube comments — sentiment (one video)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uses comments already in the DB (run the ingest script first). English-oriented
            sentiment; other languages may score neutral.
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            <Link
              href="/explore/youtube/wordcloud"
              className="underline text-foreground/80 hover:text-foreground"
            >
              Word cloud
            </Link>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={runSentiment} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Channel ID
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="e.g. UChWB95_-n9rUc3H9srsn9bQ"
                className="rounded border bg-background px-2 py-1.5 text-sm w-64"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Video ID (from URL: youtube.com/watch?v=<strong>VIDEO_ID</strong>)
              <input
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="e.g. dQw4w9WgXcQ"
                className="rounded border bg-background px-2 py-1.5 text-sm w-64"
              />
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading…" : "Get sentiment"}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && !loading && (
            <Card className="border-border bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">
                  Video <code className="text-xs bg-muted px-1 rounded">{data.video_id}</code> —{" "}
                  {data.count} comments
                </p>
                <p className="text-sm text-muted-foreground">
                  Average polarity: <strong>{data.avg_polarity}</strong> (‑1 to 1)
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    Positive: {data.positive_pct}%
                  </span>
                  <span className="text-muted-foreground">Neutral: {data.neutral_pct}%</span>
                  <span className="text-red-600 dark:text-red-400">
                    Negative: {data.negative_pct}%
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
