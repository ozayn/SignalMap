"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type WordCloudItem = { token: string; count: number };

type CommentWordCloudProps = {
  items: WordCloudItem[];
  windowStart: string;
  windowEnd: string;
  showCountOnHover?: boolean;
  /** When items are empty, show this link (e.g. "Try sample data") so user can see a demo cloud */
  trySampleUrl?: string;
};

const NEUTRAL_COLORS = [
  "text-foreground/90",
  "text-foreground/80",
  "text-muted-foreground",
  "text-muted-foreground/90",
  "text-foreground/70",
];

function scaleSize(count: number, minCount: number, maxCount: number): number {
  if (maxCount <= minCount) return 14;
  const t = (count - minCount) / (maxCount - minCount);
  return Math.round(12 + t * 18); // 12px–30px
}

export function CommentWordCloud({
  items,
  windowStart,
  windowEnd,
  showCountOnHover = false,
  trySampleUrl,
}: CommentWordCloudProps) {
  if (items.length === 0) {
    return (
      <Card className="mt-3 border-border bg-muted/30 overflow-hidden">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium text-foreground/90">
            Common words in observed comments
          </p>
          <p className="text-sm text-muted-foreground">
            No tokens in this window. Results depend on moderation and sampling. For real channels,
            data must exist in youtube_comment_snapshots for this window.
          </p>
          {trySampleUrl && (
            <p className="mt-2 text-sm">
              <Link
                href={trySampleUrl}
                className="underline text-foreground/80 hover:text-foreground"
              >
                Try sample data
              </Link>{" "}
              to see a demo cloud (no database required).
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const counts = items.map((i) => i.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  const wordEl = (item: WordCloudItem, i: number) => {
    const size = scaleSize(item.count, minCount, maxCount);
    const colorClass = NEUTRAL_COLORS[i % NEUTRAL_COLORS.length];
    const span = (
      <span
        key={`${item.token}-${i}`}
        className={`inline-block mr-2 mb-1.5 ${colorClass}`}
        style={{ fontSize: size }}
        dir="auto"
      >
        {item.token}
      </span>
    );
    if (showCountOnHover) {
      return (
        <Tooltip key={`${item.token}-${i}`}>
          <TooltipTrigger asChild>{span}</TooltipTrigger>
          <TooltipContent>
            <span className="font-mono">{item.count}</span>
          </TooltipContent>
        </Tooltip>
      );
    }
    return span;
  };

  return (
    <Card className="mt-3 border-border bg-muted/30 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-2 text-sm font-medium text-foreground/90">
          Common words in observed comments
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          {windowStart} — {windowEnd}
        </p>
        <TooltipProvider delayDuration={200}>
          <div
            className="flex flex-wrap gap-x-2 gap-y-1.5 items-baseline min-w-0 break-words"
            dir="auto"
          >
            {items.map((item, i) => wordEl(item, i))}
          </div>
        </TooltipProvider>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          Word frequency ≠ sentiment. Word frequency ≠ importance. Results depend on moderation and
          sampling.
        </p>
      </CardContent>
    </Card>
  );
}
