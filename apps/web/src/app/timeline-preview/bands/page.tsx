"use client";

import { useCallback, useState } from "react";
import { SignalMapBandTimeline } from "@/components/signalmap-band-timeline";
import type { BandTimelineEvent } from "@/lib/signalmap-band-timeline";
import { cn } from "@/lib/utils";

export default function BandTimelinePreviewPage() {
  const [lastClick, setLastClick] = useState<string | null>(null);
  const onEventClick = useCallback((e: BandTimelineEvent) => {
    setLastClick(`${e.id} (${e.kind})`);
  }, []);

  return (
    <div className="mx-auto min-h-[50vh] max-w-5xl px-3 py-8 text-foreground md:px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Band / swimlane timeline</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Periods render as soft horizontal bands; single dates render as lane markers. Scroll to zoom, drag to pan. Use
          the layer toggles to focus lanes. <code className="text-xs">onEventClick</code> is wired for chart integration
          (last: <span className="text-foreground/80">{lastClick ?? "—"}</span>).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          <a href="/timeline-preview" className="text-primary underline-offset-2 hover:underline">
            ← Timeline preview hub
          </a>
        </p>
      </div>
      <SignalMapBandTimeline
        className={cn("min-w-0")}
        onEventClick={onEventClick}
        locale="en"
      />
    </div>
  );
}
