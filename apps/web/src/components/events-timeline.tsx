"use client";

import { useState, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type TimelineEvent = {
  id: string;
  title: string;
  category: string;
  date_start: string;
  date_end?: string | null;
  description?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  iran_domestic: "Iran: domestic politics",
  iran_external: "Iran: external pressure",
  global_geopolitics: "Global geopolitics",
  energy_markets: "Energy & markets",
};

const CATEGORY_COLORS: Record<string, string> = {
  iran_domestic: "hsl(220 70% 50% / 0.6)",
  iran_external: "hsl(280 60% 50% / 0.6)",
  global_geopolitics: "hsl(160 50% 40% / 0.6)",
  energy_markets: "hsl(35 80% 45% / 0.6)",
};

const CATEGORY_BORDERS: Record<string, string> = {
  iran_domestic: "hsl(220 70% 45%)",
  iran_external: "hsl(280 60% 45%)",
  global_geopolitics: "hsl(160 50% 35%)",
  energy_markets: "hsl(35 80% 40%)",
};

function formatDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  if (m && d && d > 1) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (m && m > 1) return `${y}-${String(m).padStart(2, "0")}`;
  return String(y);
}

function formatDateRange(start: string, end?: string | null): string {
  if (!end) return formatDate(start);
  return `${formatDate(start)} — ${formatDate(end)}`;
}

type Props = {
  events: TimelineEvent[];
  timeRange: [string, string];
};

export function EventsTimeline({ events, timeRange }: Props) {
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(
    () => new Set(Object.keys(CATEGORY_LABELS))
  );

  const categories = useMemo(() => {
    const order = ["iran_domestic", "iran_external", "global_geopolitics", "energy_markets"];
    const cats = new Set(events.map((e) => e.category));
    return order.filter((c) => cats.has(c)).concat([...cats].filter((c) => !order.includes(c)).sort());
  }, [events]);

  const [minTime, maxTime] = useMemo(() => {
    const start = new Date(timeRange[0]).getTime();
    const end = new Date(timeRange[1]).getTime();
    return [start, end];
  }, [timeRange]);

  const timeToPercent = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    const p = ((t - minTime) / (maxTime - minTime)) * 100;
    return Math.max(0, Math.min(100, p));
  };

  const visibleEvents = useMemo(
    () => events.filter((e) => visibleCategories.has(e.category)),
    [events, visibleCategories]
  );

  const toggleCategory = (cat: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const yearMarks = useMemo(() => {
    const startY = parseInt(timeRange[0].slice(0, 4), 10);
    const endY = parseInt(timeRange[1].slice(0, 4), 10);
    const step = endY - startY > 80 ? 20 : endY - startY > 40 ? 10 : 5;
    const marks: number[] = [];
    for (let y = Math.ceil(startY / step) * step; y <= endY; y += step) {
      marks.push(y);
    }
    return marks;
  }, [timeRange]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Categories:</span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            className="flex items-center gap-2 text-sm text-left bg-transparent border-none cursor-pointer p-0 hover:opacity-80 transition-opacity"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                visibleCategories.has(cat)
                  ? "bg-primary border-primary"
                  : "bg-transparent border-border"
              }`}
              aria-hidden
            >
              {visibleCategories.has(cat) && (
                <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 6l3 3 5-6" />
                </svg>
              )}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#888" }}
            />
            <span className="text-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 w-full overflow-x-auto overflow-y-visible pb-16 px-2">
        <div className="min-w-[900px] w-max relative">
          {/* Time axis */}
          <div className="h-6 flex items-center text-xs text-muted-foreground mb-2 relative">
            {yearMarks.map((y) => (
              <div
                key={y}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${timeToPercent(`${y}-01-01`)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {y}
              </div>
            ))}
          </div>

          {/* Lanes */}
          {categories.map((cat, laneIdx) => {
            if (!visibleCategories.has(cat)) return null;
            const laneEvents = visibleEvents.filter((e) => e.category === cat);
            return (
              <div
                key={cat}
                className="flex items-center gap-1 mb-1"
                style={{ minHeight: 36 }}
              >
                <span className="w-36 shrink-0 text-xs text-muted-foreground truncate">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <div className="flex-1 relative h-8 bg-muted/30 rounded overflow-visible">
                  {laneEvents.map((ev) => {
                    const left = timeToPercent(ev.date_start);
                    const endDate = ev.date_end ?? ev.date_start;
                    const right = timeToPercent(endDate);
                    const width = Math.max(right - left, 0.5);
                    const isPoint = width < 2;
                    return (
                      <Tooltip key={ev.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-1/2 -translate-y-1/2 cursor-help rounded transition-opacity hover:opacity-90"
                              style={{
                                left: `${left}%`,
                                width: isPoint ? "6px" : `${width}%`,
                                minWidth: isPoint ? "6px" : "8px",
                                height: isPoint ? "6px" : "10px",
                                backgroundColor: CATEGORY_COLORS[cat] ?? "#888",
                                borderLeft: isPoint ? "none" : `2px solid ${CATEGORY_BORDERS[cat] ?? "#666"}`,
                                borderRadius: isPoint ? "50%" : "2px",
                              }}
                              title={ev.title}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            sideOffset={10}
                            collisionPadding={16}
                            avoidCollisions={true}
                            className="max-w-xs z-[9999]"
                          >
                            <p className="font-medium">{ev.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDateRange(ev.date_start, ev.date_end)}
                            </p>
                            {ev.description && (
                              <p className="text-xs mt-1">{ev.description}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
