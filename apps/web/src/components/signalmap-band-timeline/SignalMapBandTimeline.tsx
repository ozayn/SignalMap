"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  BAND_LANE_ORDER,
  BAND_TIMELINE_SEED,
  clusterPointsInLane,
  getBandEventEndMs,
  getBandEventStartMs,
  getBandTimelineDomain,
} from "@/lib/signalmap-band-timeline";
import { SignalMapYearRangeControls } from "@/components/signalmap-timeline/SignalMapYearRangeControls";
import {
  buildYearAxisTicks,
  domainInclusiveYearBounds,
  endYearFromViewEnd,
  minImportanceForViewPortion,
  parseYmdToUtcMs,
  readYearRangeFromCurrentUrl,
  shouldShowInlaneLabelsByZoom,
  startYearFromViewStart,
  toXPercent,
  viewMsFromInclusiveYearsClamped,
  writeYearRangeToUrl,
  zoomAroundCenter,
} from "@/lib/signalmap-timeline";
import type { BandLane } from "./lane-meta";
import type {
  BandTimelineEvent,
  BandTimelineLane,
  BandTimelinePointEvent,
} from "@/lib/signalmap-band-timeline";
import { LAYER_ROW_H_PX, LAYER_UI } from "./lane-meta";
import { t as tLang, type StudyLocale } from "@/lib/iran-study-fa";

const BAND_LABEL_MIN_PX = 40;

const CAT: Record<
  BandTimelineLane,
  { bar: string; line: string; mark: string; ring: string }
> = {
  global: {
    bar: "bg-sky-500/25",
    line: "border-sky-500/40",
    mark: "bg-sky-500/90",
    ring: "ring-sky-400/45",
  },
  iran: {
    bar: "bg-violet-500/25",
    line: "border-violet-500/40",
    mark: "bg-violet-500/90",
    ring: "ring-violet-400/45",
  },
  oil: {
    bar: "bg-amber-500/25",
    line: "border-amber-500/40",
    mark: "bg-amber-600/90",
    ring: "ring-amber-400/45",
  },
  fx: {
    bar: "bg-emerald-500/25",
    line: "border-emerald-500/40",
    mark: "bg-emerald-600/90",
    ring: "ring-emerald-400/45",
  },
  war: {
    bar: "bg-rose-500/25",
    line: "border-rose-500/40",
    mark: "bg-rose-600/90",
    ring: "ring-rose-400/45",
  },
  policy: {
    bar: "bg-slate-500/25",
    line: "border-slate-500/40",
    mark: "bg-slate-600/90",
    ring: "ring-slate-400/45",
  },
};

function titleOf(e: BandTimelineEvent, lang: StudyLocale) {
  return tLang(e.title_en, e.title_fa, lang);
}

function descOf(e: BandTimelineEvent, lang: StudyLocale) {
  return tLang(e.description_en, e.description_fa, lang);
}

function dateLineOf(e: BandTimelineEvent) {
  if (e.kind === "period") {
    return `${e.start_date} — ${e.end_date}`;
  }
  return e.date;
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

export type SignalMapBandTimelineProps = {
  events?: BandTimelineEvent[];
  timeRange?: [string, string];
  locale?: "en" | "fa";
  /** Same optional wiring as the dots timeline: Gregorian, Jalali, or both. */
  xAxisYearLabel?: ChartAxisYearMode;
  /** `default` = filter by zoom like the dot timeline; `all` = show importance 1+ at current zoom. */
  importanceDetail?: "default" | "all";
  onEventClick?: (event: BandTimelineEvent) => void;
  className?: string;
  initialZoom?: number;
  /** When true (default), visible year range is written to `?start=YYYY&end=YYYY` (client only). */
  syncYearRangeToUrl?: boolean;
};

/**
 * World-history style swimlane: periods as soft rounded bands, points as compact markers; zoom/pan on time.
 */
export function SignalMapBandTimeline({
  events = BAND_TIMELINE_SEED,
  timeRange: timeRangeProp,
  locale = "en",
  xAxisYearLabel,
  importanceDetail = "default",
  onEventClick,
  className,
  initialZoom = 1,
  syncYearRangeToUrl: syncYearRangeToUrlProp = true,
}: SignalMapBandTimelineProps) {
  const syncYearRangeToUrl = syncYearRangeToUrlProp;
  const lang: StudyLocale = locale;
  const yearAxisMode: ChartAxisYearMode = xAxisYearLabel ?? "gregorian";
  const numeralLoc: ChartAxisNumeralLocale = lang === "fa" ? "fa" : "en";

  const { domainStartMs, domainEndMs } = useMemo(() => {
    if (timeRangeProp) {
      return {
        domainStartMs: parseYmdToUtcMs(timeRangeProp[0]),
        domainEndMs: parseYmdToUtcMs(timeRangeProp[1]),
      };
    }
    const [a, b] = getBandTimelineDomain(events);
    return { domainStartMs: a, domainEndMs: b };
  }, [timeRangeProp, events]);

  const [layers, setLayers] = useState<Set<BandLane>>(() => new Set(LAYER_UI.map((x) => x.key)));
  const [viewStart, setViewStart] = useState(() => domainStartMs);
  const [viewEnd, setViewEnd] = useState(() => domainEndMs);
  const [trackWidth, setTrackWidth] = useState(800);
  const trackRef = useRef<HTMLDivElement>(null);
  const axisRowRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [floatTip, setFloatTip] = useState<FloatingTip | null>(null);
  const pendingDrag = useRef<{
    startX: number;
    startMs: [number, number];
  } | null>(null);

  const { minY, maxY } = useMemo(
    () => domainInclusiveYearBounds(domainStartMs, domainEndMs),
    [domainStartMs, domainEndMs]
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = readYearRangeFromCurrentUrl();
    if (fromUrl) {
      const m = viewMsFromInclusiveYearsClamped(
        fromUrl.startY,
        fromUrl.endY,
        domainStartMs,
        domainEndMs
      );
      setViewStart(m.startMs);
      setViewEnd(m.endMs);
    } else {
      const full = Math.max(1, domainEndMs - domainStartMs);
      const v = full * Math.min(1, Math.max(0.04, initialZoom));
      const c = (domainStartMs + domainEndMs) / 2;
      setViewStart(c - v / 2);
      setViewEnd(c + v / 2);
    }
  }, [domainStartMs, domainEndMs, initialZoom]);

  useEffect(() => {
    if (!syncYearRangeToUrl || typeof window === "undefined") return;
    const a = startYearFromViewStart(viewStart, minY, maxY);
    const b = endYearFromViewEnd(viewStart, viewEnd, minY, maxY);
    writeYearRangeToUrl(a, b);
  }, [viewStart, viewEnd, minY, maxY, syncYearRangeToUrl]);

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

  const minImportance = useMemo((): 1 | 2 | 3 => {
    if (importanceDetail === "all") return 1;
    return minImportanceForViewPortion(viewPortion);
  }, [importanceDetail, viewPortion]);
  const showPointLabels = useMemo(() => shouldShowInlaneLabelsByZoom(viewPortion), [viewPortion]);

  const axisTicks = useMemo(
    () =>
      buildYearAxisTicks(viewStart, viewEnd, trackWidth, {
        viewPortion,
        domainStartMs,
        domainEndMs,
      }),
    [viewStart, viewEnd, trackWidth, viewPortion, domainStartMs, domainEndMs]
  );

  const filtered = useMemo(
    () => events.filter((e) => layers.has(e.lane) && e.importance >= minImportance),
    [events, layers, minImportance]
  );

  const setViewport = (a: number, b: number) => {
    const full = domainEndMs - domainStartMs;
    const w0 = b - a;
    if (w0 >= full) {
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

  const applyYearViewMs = useCallback((startMs: number, endMs: number) => {
    setViewStart(startMs);
    setViewEnd(endMs);
  }, []);

  const pick = useCallback(
    (e: BandTimelineEvent) => {
      setSelectedId(e.id);
      setOpenCluster(null);
      onEventClick?.(e);
    },
    [onEventClick]
  );

  const clearSelection = useCallback(() => setSelectedId(null), []);
  const clearFloatTip = useCallback(() => setFloatTip(null), []);
  const axisBottomGetter = useCallback(() => axisRowRef.current?.getBoundingClientRect().bottom ?? 0, []);

  const setFloatFrom = useCallback(
    (e: BandTimelineEvent, p: { clientX: number; clientY: number }) => {
      setFloatTip({
        kind: "event",
        id: e.id,
        x: p.clientX,
        y: p.clientY,
        content: { title: titleOf(e, lang), date: dateLineOf(e) },
      });
    },
    [lang]
  );

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
        className={cn(
          "rounded-xl border border-border bg-card/50 p-3 backdrop-blur-sm md:p-4",
          className
        )}
        dir="ltr"
      >
        <SignalMapYearRangeControls
          className={cn("mb-3", lang === "fa" && "font-[family-name:Vazirmatn] study-page-fa")}
          domainStartMs={domainStartMs}
          domainEndMs={domainEndMs}
          viewStart={viewStart}
          viewEnd={viewEnd}
          onApplyViewMs={applyYearViewMs}
          onFitAll={fitAll}
          lang={lang}
        />
        <div
          className={cn(
            "mb-3 flex flex-wrap items-center justify-between gap-2 gap-y-2",
            lang === "fa" && "font-[family-name:Vazirmatn] study-page-fa"
          )}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Layer filters">
            {LAYER_UI.map((L) => {
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
                  <span className={cn("h-2.5 w-2.5 rounded-sm", CAT[L.key].mark)} />
                  {tLang(L.labelEn, L.labelFa, lang)}
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
            <span className="max-w-[16rem] pl-0.5 text-[10px] leading-snug text-muted-foreground/70">
              {tLang(
                "Drag · scroll to zoom · periods as bands, points on hover or zoom",
                "کشیدن · بزرگ‌نمایی با اسکرول · روی باند/نقطه",
                lang
              )}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 gap-0">
          <div
            className="flex w-[4.75rem] shrink-0 flex-col text-[9px] font-medium text-muted-foreground/90 sm:w-[5.5rem] sm:text-[10px]"
            aria-hidden
          >
            <div
              className="flex items-end justify-end pr-1.5 pb-0.5"
              style={{ minHeight: yearAxisMode === "both" ? 36 : 28 }}
            />
            {BAND_LANE_ORDER.map((lane) => {
              if (!layers.has(lane as BandLane)) {
                return (
                  <div
                    key={lane}
                    className="border-t border-dashed border-border/40 text-right opacity-40"
                    style={{ minHeight: LAYER_ROW_H_PX }}
                  />
                );
              }
              const ui = LAYER_UI.find((x) => x.key === lane);
              return (
                <div
                  key={lane}
                  className="flex items-center justify-end border-t border-border/30 pr-1.5"
                  style={{ minHeight: LAYER_ROW_H_PX }}
                >
                  <span className="line-clamp-2 text-right leading-tight text-muted-foreground/85">
                    {ui ? tLang(ui.labelEn, ui.labelFa, lang) : lane}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            ref={trackRef}
            className="min-w-0 flex-1 cursor-grab select-none touch-pan-y active:cursor-grabbing"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              ref={axisRowRef}
              className={cn(
                "relative w-full border-b border-border/50",
                yearAxisMode === "both" ? "h-9 py-0.5" : "h-7"
              )}
            >
              {axisTicks.map((t) => (
                <div
                  key={t.tMs}
                  className="absolute top-0.5 text-[10px] text-muted-foreground/75 transition-all duration-200 ease-out md:text-[11px]"
                  style={{
                    left: `${toXPercent(t.tMs, viewStart, viewEnd)}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <YearAxisTickText tMs={t.tMs} mode={yearAxisMode} numeralLoc={numeralLoc} />
                </div>
              ))}
            </div>

            {BAND_LANE_ORDER.map((lane) => {
              if (!layers.has(lane as BandLane)) {
                return (
                  <div
                    key={lane}
                    className="relative w-full border-t border-dashed border-border/30 opacity-30"
                    style={{ minHeight: LAYER_ROW_H_PX }}
                  />
                );
              }
              const periods = filtered
                .filter((e): e is Extract<BandTimelineEvent, { kind: "period" }> => e.kind === "period" && e.lane === lane)
                .sort(
                  (a, b) =>
                    getBandEventEndMs(b) - getBandEventStartMs(b) - (getBandEventEndMs(a) - getBandEventStartMs(a))
                );
              const points = filtered.filter(
                (e): e is BandTimelinePointEvent => e.kind === "point" && e.lane === lane
              );
              const pointNodes = clusterPointsInLane(points, lane, viewStart, viewEnd, trackWidth);

              return (
                <div
                  key={lane}
                  className="relative w-full overflow-visible border-t border-border/30"
                  style={{ minHeight: LAYER_ROW_H_PX }}
                >
                  {axisTicks.map((t) => (
                    <div
                      key={`g-${lane}-${t.tMs}`}
                      className="pointer-events-none absolute bottom-0 top-0 w-px bg-border/25"
                      style={{ left: `${toXPercent(t.tMs, viewStart, viewEnd)}%` }}
                    />
                  ))}

                  {periods.map((e) => {
                    const a0 = getBandEventStartMs(e);
                    const a1 = getBandEventEndMs(e);
                    if (a1 < viewStart || a0 > viewEnd) return null;
                    const s0 = Math.max(a0, viewStart);
                    const s1 = Math.min(a1, viewEnd);
                    const left = toXPercent(s0, viewStart, viewEnd);
                    const w = toXPercent(s1, viewStart, viewEnd) - left;
                    if (w < 0.04) return null;
                    const wPx = (w / 100) * trackWidth;
                    const canLabel = wPx >= BAND_LABEL_MIN_PX;
                    const cat = CAT[e.category];
                    const bandTitle = titleOf(e, lang);
                    const isSel = selectedId === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={() => pick(e)}
                        onPointerMove={(ev) => {
                          setHoveredId(e.id);
                          setFloatFrom(e, ev);
                        }}
                        onPointerEnter={(ev) => {
                          setHoveredId(e.id);
                          setFloatFrom(e, ev);
                        }}
                        onPointerLeave={() => {
                          setHoveredId((h) => (h === e.id ? null : h));
                          clearFloatTip();
                        }}
                        className={cn(
                          "absolute top-1/2 box-border h-5 max-w-full -translate-y-1/2 rounded-full border text-left transition-all duration-200",
                          cat.bar,
                          cat.line,
                          isSel && "ring-2 ring-foreground/30",
                          hoveredId === e.id && "z-20 brightness-110"
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(w, 0.1)}%`,
                        }}
                        aria-label={bandTitle}
                      >
                        {canLabel ? (
                          <span
                            className="pointer-events-none block truncate px-2.5 text-[9px] font-medium leading-5 text-foreground/90 tabular-nums"
                            title={bandTitle}
                          >
                            {bandTitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  {pointNodes.map((n) => {
                    if (n.kind === "one") {
                      const e = n.p;
                      const cx = toXPercent(n.tMs, viewStart, viewEnd);
                      const bandTitle = titleOf(e, lang);
                      const isSel = selectedId === e.id;
                      return (
                        <div
                          key={e.id}
                          className="absolute top-1/2 z-10 w-0 -translate-y-1/2"
                          style={{ left: `${cx}%` }}
                        >
                          <button
                            type="button"
                            onPointerDown={(ev) => ev.stopPropagation()}
                            onClick={() => pick(e)}
                            onPointerMove={(ev) => {
                              setHoveredId(e.id);
                              setFloatFrom(e, ev);
                            }}
                            onPointerEnter={(ev) => {
                              setHoveredId(e.id);
                              setFloatFrom(e, ev);
                            }}
                            onPointerLeave={() => {
                              setHoveredId((h) => (h === e.id ? null : h));
                              clearFloatTip();
                            }}
                            className="relative -translate-x-1/2 outline-none"
                            aria-label={bandTitle}
                          >
                            <span
                              className={cn(
                                "block h-2.5 w-2.5 rounded-full ring-1",
                                CAT[e.category].mark,
                                CAT[e.category].ring,
                                (isSel || hoveredId === e.id) && "z-20 scale-125 ring-2 ring-foreground/30"
                              )}
                            />
                            {showPointLabels ? (
                              <span
                                className="pointer-events-none absolute left-1/2 top-full z-20 mt-0.5 w-max max-w-[8rem] -translate-x-1/2 line-clamp-2 text-center text-[8.5px] font-medium text-foreground/80"
                                title={bandTitle}
                              >
                                {bandTitle}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      );
                    }
                    const cx = toXPercent(n.centerMs, viewStart, viewEnd);
                    const isOpen = openCluster === n.id;
                    const clusterLine =
                      tLang("Click to list", "کلیک برای فهرست", lang) +
                      " · " +
                      String(n.list.length) +
                      tLang(" events", " رویداد", lang);
                    return (
                      <div
                        key={n.id}
                        className="absolute top-1/2 z-10 w-0 -translate-y-1/2"
                        style={{ left: `${cx}%` }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenCluster(isOpen ? null : n.id)}
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onPointerEnter={(ev) => {
                            setFloatTip({
                              kind: "cluster",
                              id: n.id,
                              x: ev.clientX,
                              y: ev.clientY,
                              line: clusterLine,
                            });
                          }}
                          onPointerMove={(ev) => {
                            setFloatTip({
                              kind: "cluster",
                              id: n.id,
                              x: ev.clientX,
                              y: ev.clientY,
                              line: clusterLine,
                            });
                          }}
                          onPointerLeave={clearFloatTip}
                          className="relative -translate-x-1/2 flex h-5 min-w-[1.2rem] items-center justify-center rounded border border-border/80 bg-card/90 px-1 text-[9px] font-bold text-foreground shadow-sm"
                          aria-label={String(n.list.length)}
                        >
                          {n.list.length}
                        </button>
                        {isOpen ? (
                          <div className="absolute left-1/2 z-30 mt-1 w-52 -translate-x-1/2 rounded-md border border-border/80 bg-popover p-2 text-left text-xs shadow-lg">
                            <ul className="max-h-44 space-y-1 overflow-y-auto">
                              {n.list.map((e) => (
                                <li key={e.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left text-foreground transition-colors hover:underline"
                                    onClick={() => pick(e)}
                                  >
                                    {titleOf(e, lang)}
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
              );
            })}

            {selected ? (
              <div
                className="mt-3 max-w-2xl rounded-lg border border-border/80 bg-popover/95 p-3 text-sm text-popover-foreground shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="pr-1 font-semibold leading-snug text-foreground">{titleOf(selected, lang)}</h3>
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
                  {dateLineOf(selected)} · I{selected.importance}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/95">{descOf(selected, lang)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <TimelineTooltipPortal tip={floatTip} axisBottomGetter={axisBottomGetter} />
    </>
  );
}
