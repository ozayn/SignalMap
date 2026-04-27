"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatChartTimeAxisYearLabel,
  type ChartAxisNumeralLocale,
  type ChartAxisYearMode,
} from "@/lib/chart-axis-year";
import {
  TimelineTooltipPortal,
  type FloatingTip,
} from "@/components/signalmap-timeline/timeline-floating-tooltip";
import {
  SIGNALMAP_TIMELINE_SEED,
  TIMELINE_ERA_BANDS,
  buildYearAxisTicks,
  buildTimelineNodes,
  eventEndMs,
  getEventImportance,
  minImportanceForViewPortion,
  parseYmdToUtcMs,
  shouldShowInlaneLabelsByZoom,
  toXPercent,
  zoomAroundCenter,
  type SignalMapTimelineEvent,
  type SignalMapTimelineProps,
} from "@/lib/signalmap-timeline";

const DAY = 86_400_000;
const LANE_PITCH = 40;
const EVENT_STRIP_MIN_PX = 180;
const EVENT_STRIP_TOP_PAD = 4;

const LAYERS: {
  key: SignalMapTimelineEvent["category"];
  labelEn: string;
  labelFa: string;
}[] = [
  { key: "global", labelEn: "Global", labelFa: "جهانی" },
  { key: "iran", labelEn: "Iran", labelFa: "ایران" },
  { key: "oil", labelEn: "Oil", labelFa: "نفت" },
  { key: "fx", labelEn: "FX", labelFa: "ارز" },
  { key: "war", labelEn: "Wars", labelFa: "جنگ" },
];

const CAT_STYLE: Record<
  SignalMapTimelineEvent["category"],
  { bar: string; ring: string; text: string }
> = {
  global: { bar: "bg-sky-500/90", ring: "ring-sky-400/50", text: "text-sky-700 dark:text-sky-200" },
  iran: { bar: "bg-violet-500/90", ring: "ring-violet-400/50", text: "text-violet-700 dark:text-violet-200" },
  oil: { bar: "bg-amber-500/90", ring: "ring-amber-400/50", text: "text-amber-800 dark:text-amber-200" },
  fx: { bar: "bg-emerald-500/90", ring: "ring-emerald-400/50", text: "text-emerald-800 dark:text-emerald-200" },
  war: { bar: "bg-rose-600/90", ring: "ring-rose-500/50", text: "text-rose-800 dark:text-rose-200" },
};

function eventSpanMs(e: SignalMapTimelineEvent) {
  const a = parseYmdToUtcMs(e.date_start);
  const b = eventEndMs(e.date_start, e.date_end);
  return [a, b] as const;
}

function titleOf(e: SignalMapTimelineEvent, locale: "en" | "fa") {
  return locale === "fa" ? e.title_fa : e.title_en;
}

function descOf(e: SignalMapTimelineEvent, locale: "en" | "fa") {
  return locale === "fa" ? e.description_fa : e.description_en;
}

function YearAxisTickText({
  tMs,
  mode,
  numeralLoc,
}: {
  tMs: number;
  mode: ChartAxisYearMode;
  numeralLoc: ChartAxisNumeralLocale;
}) {
  const text = formatChartTimeAxisYearLabel(tMs, mode, numeralLoc);
  const nl = text.indexOf("\n");
  if (nl === -1) {
    return <span className="tabular-nums">{text}</span>;
  }
  return (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      <span className="text-[9px] font-medium text-foreground/90 tabular-nums md:text-[10px]">{text.slice(0, nl)}</span>
      <span className="text-[8.5px] text-muted-foreground/85 tabular-nums md:text-[9.5px]">{text.slice(nl + 1)}</span>
    </span>
  );
}

/**
 * Reusable, zoomable, layer-filtered time axis (BBC-style: quiet, narrative-first).
 * Names stay off by default; tooltips on hover, optional in-chart text only at strong zoom;
 * importance + bucketing at wide zoom; lane packing for legibility. Click opens an inline card.
 */
export function SignalMapTimeline({
  events = SIGNALMAP_TIMELINE_SEED,
  timeRange: timeRangeProp,
  locale = "en",
  xAxisYearLabel,
  onEventClick,
  className,
  initialZoom = 1,
}: SignalMapTimelineProps) {
  const yearAxisMode: ChartAxisYearMode = xAxisYearLabel ?? "gregorian";
  const numeralLoc: ChartAxisNumeralLocale = locale === "fa" ? "fa" : "en";
  const [layers, setLayers] = useState<Set<SignalMapTimelineEvent["category"]>>(
    () => new Set(["global", "iran", "oil", "fx", "war"])
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [floatTip, setFloatTip] = useState<FloatingTip | null>(null);
  const axisRowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { domainStartMs, domainEndMs } = useMemo(() => {
    let tMin = Infinity;
    let tMax = -Infinity;
    for (const e of events) {
      const [a, b] = eventSpanMs(e);
      tMin = Math.min(tMin, a);
      tMax = Math.max(tMax, b);
    }
    if (timeRangeProp) {
      const a = parseYmdToUtcMs(timeRangeProp[0]);
      const b = parseYmdToUtcMs(timeRangeProp[1]);
      return { domainStartMs: a, domainEndMs: b };
    }
    if (tMin === Infinity) {
      const n = Date.now();
      return { domainStartMs: n - 100 * 365 * DAY, domainEndMs: n };
    }
    const pad = Math.max(30 * DAY, (tMax - tMin) * 0.02);
    return { domainStartMs: tMin - pad, domainEndMs: tMax + pad };
  }, [events, timeRangeProp]);

  const [viewStart, setViewStart] = useState(() => domainStartMs);
  const [viewEnd, setViewEnd] = useState(() => domainEndMs);

  useEffect(() => {
    const full = domainEndMs - domainStartMs;
    const v = full * Math.min(1, Math.max(0.04, initialZoom));
    const c = (domainStartMs + domainEndMs) / 2;
    setViewStart(c - v / 2);
    setViewEnd(c + v / 2);
  }, [domainStartMs, domainEndMs, initialZoom]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(800);
  const pendingDrag = useRef<{
    startX: number;
    startMs: [number, number];
  } | null>(null);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackWidth(el.clientWidth || 800));
    ro.observe(el);
    setTrackWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  const viewPortion = useMemo(() => {
    const full = Math.max(1, domainEndMs - domainStartMs);
    return Math.min(1, (viewEnd - viewStart) / full);
  }, [viewStart, viewEnd, domainStartMs, domainEndMs]);

  const minImportance = useMemo(() => minImportanceForViewPortion(viewPortion), [viewPortion]);
  const showNarrativeLabels = useMemo(() => shouldShowInlaneLabelsByZoom(viewPortion), [viewPortion]);

  const filtered = useMemo(
    () => events.filter((e) => layers.has(e.category)),
    [events, layers]
  );

  const axisTicks = useMemo(
    () =>
      buildYearAxisTicks(viewStart, viewEnd, trackWidth, {
        viewPortion,
        domainStartMs,
        domainEndMs,
      }),
    [viewStart, viewEnd, trackWidth, viewPortion, domainStartMs, domainEndMs]
  );

  const { nodes, maxLane } = useMemo(
    () =>
      buildTimelineNodes(filtered, viewStart, viewEnd, trackWidth, {
        domainStartMs,
        domainEndMs,
        minImportance,
        viewPortion,
      }),
    [filtered, viewStart, viewEnd, trackWidth, domainStartMs, domainEndMs, minImportance, viewPortion]
  );

  const eventStripHeight = useMemo(
    () => Math.max(EVENT_STRIP_MIN_PX, EVENT_STRIP_TOP_PAD * 2 + (maxLane + 1) * LANE_PITCH + 4),
    [maxLane]
  );

  const setViewport = (a: number, b: number) => {
    const full = domainEndMs - domainStartMs;
    const w0 = b - a;
    if (w0 > full) {
      setViewStart(domainStartMs);
      setViewEnd(domainEndMs);
      return;
    }
    let a0 = a;
    let b0 = b;
    if (a0 < domainStartMs) {
      a0 = domainStartMs;
      b0 = domainStartMs + w0;
    } else if (b0 > domainEndMs) {
      b0 = domainEndMs;
      a0 = domainEndMs - w0;
    }
    if (a0 < domainStartMs) a0 = domainStartMs;
    if (b0 > domainEndMs) b0 = domainEndMs;
    setViewStart(a0);
    setViewEnd(b0);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const center = viewStart + frac * (viewEnd - viewStart);
    const z = e.deltaY < 0 ? 1 / 1.12 : 1.12;
    const next = zoomAroundCenter(viewStart, viewEnd, center, z, domainStartMs, domainEndMs);
    setViewStart(next.startMs);
    setViewEnd(next.endMs);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pendingDrag.current = { startX: e.clientX, startMs: [viewStart, viewEnd] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = pendingDrag.current;
    if (!d) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wMs = d.startMs[1] - d.startMs[0];
    const dMs = ((e.clientX - d.startX) / rect.width) * wMs;
    setViewport(d.startMs[0] - dMs, d.startMs[1] - dMs);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    pendingDrag.current = null;
  };

  const zoomCenter = (factor: number) => {
    const c = (viewStart + viewEnd) / 2;
    const n = zoomAroundCenter(viewStart, viewEnd, c, factor, domainStartMs, domainEndMs);
    setViewStart(n.startMs);
    setViewEnd(n.endMs);
  };

  const fitAll = () => {
    setViewStart(domainStartMs);
    setViewEnd(domainEndMs);
  };

  const pickEvent = useCallback(
    (e: SignalMapTimelineEvent) => {
      setSelectedId(e.id);
      setOpenCluster(null);
      onEventClick?.(e);
    },
    [onEventClick]
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  const axisBottomGetter = useCallback(() => axisRowRef.current?.getBoundingClientRect().bottom ?? 0, []);

  const setFloatFromEvent = useCallback(
    (ev: SignalMapTimelineEvent, e: { clientX: number; clientY: number }) => {
      setFloatTip({
        kind: "event",
        id: ev.id,
        x: e.clientX,
        y: e.clientY,
        content: { title: titleOf(ev, locale), date: ev.date_start },
      });
    },
    [locale]
  );

  const clearFloatTip = useCallback(() => {
    setFloatTip(null);
  }, []);

  useEffect(() => {
    clearFloatTip();
  }, [viewStart, viewEnd, trackWidth, clearFloatTip]);

  const selected = useMemo(
    () => (selectedId ? events.find((x) => x.id === selectedId) ?? null : null),
    [selectedId, events]
  );

  return (
    <>
      <div
        className={cn("rounded-xl border border-border bg-card/50 p-3 backdrop-blur-sm md:p-4", className)}
        dir="ltr"
      >
        <div
          className={cn(
            "mb-3 flex flex-wrap items-center justify-between gap-2 gap-y-2",
            locale === "fa" && "font-[family-name:Vazirmatn] study-page-fa"
          )}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Layer filters">
            {LAYERS.map((L) => {
              const on = layers.has(L.key);
              return (
                <button
                  key={L.key}
                  type="button"
                  onClick={() => {
                    setLayers((prev) => {
                      const n = new Set(prev);
                      if (n.has(L.key)) n.delete(L.key);
                      else n.add(L.key);
                      return n;
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all duration-200",
                    on
                      ? "border-border bg-muted/80 text-foreground"
                      : "border-border/50 bg-background/30 text-muted-foreground opacity-60"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-sm", CAT_STYLE[L.key].bar)} />
                  {locale === "fa" ? L.labelFa : L.labelEn}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground/90">
            <button
              type="button"
              className="rounded border border-border/80 bg-background/50 px-2 py-0.5 transition-colors duration-200 hover:bg-muted/60"
              onClick={() => zoomCenter(1 / 1.2)}
            >
              +
            </button>
            <button
              type="button"
              className="rounded border border-border/80 bg-background/50 px-2 py-0.5 transition-colors duration-200 hover:bg-muted/60"
              onClick={() => zoomCenter(1.2)}
            >
              −
            </button>
            <button
              type="button"
              className="rounded border border-border/80 bg-background/50 px-2 py-0.5 transition-colors duration-200 hover:bg-muted/60"
              onClick={fitAll}
            >
              {locale === "fa" ? "همه" : "Fit all"}
            </button>
            <span className="max-w-[14rem] pl-0.5 text-[10px] leading-snug text-muted-foreground/70">
              {locale === "fa" ? "کشیدن · اسکرول برای بزرگ‌نمایی" : "Drag · scroll to zoom · names in hover, or on strong zoom"}
            </span>
          </div>
        </div>

        <div
          ref={trackRef}
          className="relative w-full min-h-[12rem] select-none touch-pan-y transition-[opacity] duration-200"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={axisRowRef}
            className={cn(
              "relative cursor-grab border-b border-border/50 transition-transform duration-200 ease-out active:cursor-grabbing",
              yearAxisMode === "both" ? "h-9 py-0.5" : "h-7"
            )}
          >
            {axisTicks.map((t) => (
              <div
                key={t.tMs}
                className="absolute top-0.5 text-[10px] text-muted-foreground/75 transition-all duration-200 ease-out md:text-[11px]"
                style={{ left: `${toXPercent(t.tMs, viewStart, viewEnd)}%`, transform: "translateX(-50%)" }}
              >
                <YearAxisTickText tMs={t.tMs} mode={yearAxisMode} numeralLoc={numeralLoc} />
              </div>
            ))}
          </div>

          <div
            className="relative overflow-visible"
            style={{ minHeight: eventStripHeight }}
          >
            <div
              className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-md"
              aria-hidden
            >
              {TIMELINE_ERA_BANDS.map((era, i) => {
                const a0 = parseYmdToUtcMs(era.start);
                const a1 = parseYmdToUtcMs(era.end);
                if (a1 < viewStart || a0 > viewEnd) return null;
                const s0 = Math.max(a0, viewStart);
                const s1 = Math.min(a1, viewEnd);
                const left = toXPercent(s0, viewStart, viewEnd);
                const w = toXPercent(s1, viewStart, viewEnd) - left;
                if (w < 0.04) return null;
                return (
                  <div
                    key={`${era.start}-${era.end}`}
                    className={cn(
                      "absolute top-0 h-full",
                      i % 2 === 0 ? "bg-foreground/[0.028] dark:bg-foreground/[0.05]" : "bg-foreground/[0.04] dark:bg-foreground/[0.07]"
                    )}
                    style={{ left: `${left}%`, width: `${w}%` }}
                    title={era.label}
                  />
                );
              })}
            </div>
            {selected ? (
              <div
                ref={cardRef}
                data-timeline-card
                className={cn(
                  "absolute right-0 top-1 z-30 max-w-[20rem] rounded-lg border border-border bg-popover p-3 text-sm shadow-md transition-all duration-200 ease-out"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="pr-1 font-semibold leading-snug text-foreground">{titleOf(selected, locale)}</h3>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={clearSelection}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selected.date_start}
                  {selected.date_end ? ` — ${selected.date_end}` : ""} · I{getEventImportance(selected)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/95">{descOf(selected, locale)}</p>
                {selected.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.tags.map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {nodes.map((node) => {
              const rowTop = EVENT_STRIP_TOP_PAD + node.lane * LANE_PITCH;
              if (node.kind === "event") {
                const ev = node.event;
                const s = toXPercent(node.startMs, viewStart, viewEnd);
                const e0 = toXPercent(node.endMs, viewStart, viewEnd);
                const wPct = Math.max(e0 - s, 0.08);
                const isSpan = wPct > 1.1;
                const cat = CAT_STYLE[ev.category];
                const isSel = selectedId === ev.id;
                const isHover = hoveredId === ev.id;
                const t = titleOf(ev, locale);
                return (
                  <div
                    key={ev.id}
                    className="absolute z-10 transition-all duration-200 ease-out"
                    style={
                      isSpan
                        ? { left: `${s}%`, width: `${wPct}%`, top: rowTop, height: LANE_PITCH }
                        : { left: `${s}%`, top: rowTop, height: LANE_PITCH, width: 0, transform: "translateX(-50%)" }
                    }
                  >
                      <button
                        type="button"
                        onClick={() => pickEvent(ev)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerMove={(e) => {
                          setHoveredId(ev.id);
                          setFloatFromEvent(ev, e);
                        }}
                        onPointerEnter={(e) => {
                          setHoveredId(ev.id);
                          setFloatFromEvent(ev, e);
                        }}
                        onPointerLeave={() => {
                          setHoveredId((h) => (h === ev.id ? null : h));
                          clearFloatTip();
                        }}
                        className={cn(
                          "group relative flex h-full w-full items-center justify-center outline-none",
                          isSpan ? "w-full" : "min-w-[0.5rem] max-w-[0.5rem] translate-x-0"
                        )}
                      >
                          {showNarrativeLabels ? (
                            <span
                              className={cn(
                                "pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 w-max max-w-[6.5rem] -translate-x-1/2 line-clamp-2 text-center text-[9px] font-medium leading-tight text-foreground/80",
                                isSpan && "left-0 w-full max-w-full translate-x-0 truncate",
                                isSel && "text-foreground"
                              )}
                            >
                              {t}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "block shrink-0 transition-all duration-200 ease-out",
                              isSpan
                                ? `h-1.5 w-full rounded-sm ${cat.bar} ring-1 ${cat.ring}`
                                : `h-2.5 w-2.5 rounded-sm ${cat.bar} ring-1 ${cat.ring}`,
                              (isSel || isHover) && "z-20 scale-110 ring-2 ring-foreground/30"
                            )}
                            aria-hidden
                          />
                        </button>
                  </div>
                );
              }
              const cx = toXPercent(node.centerMs, viewStart, viewEnd);
              const isOpen = openCluster === node.id;
              const clusterTipLine =
                (locale === "fa" ? "کلیک برای فهرست" : "Click to list") +
                " · " +
                String(node.count) +
                (locale === "fa" ? " رویداد" : " events");
              return (
                <div
                  key={node.id}
                  className="absolute z-10 flex items-center justify-center transition-all duration-200 ease-out"
                  style={{
                    left: `${cx}%`,
                    top: rowTop,
                    height: LANE_PITCH,
                    width: 0,
                    transform: "translateX(-50%)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenCluster(isOpen ? null : node.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerEnter={(e) => {
                      setFloatTip({
                        kind: "cluster",
                        id: node.id,
                        x: e.clientX,
                        y: e.clientY,
                        line: clusterTipLine,
                      });
                    }}
                    onPointerMove={(e) => {
                      setFloatTip({
                        kind: "cluster",
                        id: node.id,
                        x: e.clientX,
                        y: e.clientY,
                        line: clusterTipLine,
                      });
                    }}
                    onPointerLeave={clearFloatTip}
                    className="flex h-6 min-w-[1.4rem] items-center justify-center rounded border border-border/80 bg-card/90 px-1.5 text-[10px] font-semibold text-foreground shadow-sm ring-1 ring-foreground/5 transition-transform duration-200 hover:scale-105"
                    aria-label={locale === "fa" ? `${node.count} رویداد` : `${node.count} events`}
                  >
                    {node.count}
                  </button>
                  {isOpen ? (
                    <div className="absolute left-1/2 z-30 mt-1 w-56 -translate-x-1/2 rounded-md border border-border/80 bg-popover p-2 text-left text-xs shadow-lg">
                      <p className="mb-1.5 text-muted-foreground">
                        {locale === "fa" ? `${node.count} رویداد` : `${node.count} events`}
                      </p>
                      <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {node.events.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              className="w-full text-left text-foreground transition-colors hover:underline"
                              onClick={() => pickEvent(e)}
                            >
                              {titleOf(e, locale)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <TimelineTooltipPortal tip={floatTip} axisBottomGetter={axisBottomGetter} />
    </>
  );
}
