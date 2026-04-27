"use client";

import { Fragment, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StudyLanguageToggle } from "@/components/study-language-toggle";
import { StudyYearDisplayToggle } from "@/components/study-year-display-toggle";
import { DynastiesYearRangeControls } from "@/components/iran-dynasties-vertical/dynasties-year-range-controls";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import { cn } from "@/lib/utils";
import { formatDynastyProlepticRange, formatDynastyProlepticYear } from "@/lib/iran-dynasties-vertical/format-year";
import {
  type IranVerticalDynasty,
  bandRectFromYears,
  bandRectFromYearsHorizontal,
  getVerticalTimelineDomain,
  hasStrictSubspanChild,
  isStrictlyNestedInAnother,
  totalSpanYears,
  yearToOffsetFromLeft,
  yearToOffsetFromTop,
} from "@/lib/iran-dynasties-vertical";
import { resolveProlepticViewFromSearchParams, setViewInSearchParams } from "@/lib/iran-dynasties-vertical/view-range";
import { t as tLang, type StudyLocale } from "@/lib/iran-study-fa";

/** Band column (vertical) / row height (horizontal): keep modest so the chart fits the viewport. */
const STRIP_PX = 200;
const MIN_INNER_LABEL_PX = 40;
/** Minimum band width to show a label in horizontal mode. */
const MIN_INNER_LABEL_H_PX = 48;
const BAND_ROW_H_PX = 48;
const YEAR_TICKS = 13;
const VERTICAL_TRACK_MIN_PX = 240;
const HORIZONTAL_TRACK_MIN_PX = 260;
/** Stagger (px) between stacked external labels in horizontal mode. */
const H_NARROW_LANE_STRIDE_PX = 12;
/** Half-width of each external label in px for horizontal overlap resolution (max-w 6.5rem ≈ 52px rad). */
const H_NARROW_LABEL_HALF_PX = 48;
/** Reserve vertical space in the callout block for 2–3 lines of 7px copy (e.g. “Early caliphal era”). */
const H_NARROW_TEXT_LINE_PX = 22;
const H_NARROW_CONNECTOR_BASE_PX = 4;
const H_NARROW_MAX_LANES = 8;

export type DynastyTimelineLayout = "vertical" | "horizontal";

/**
 * Muted, museum-style bands: one entry per row in `IRAN_VERTICAL_DYNASTIES` (13 polities) so
 * late periods are not all the same stone/grey from index wrap.
 */
const BAND_VISUAL: readonly { bar: string; border: string; label: string }[] = [
  { bar: "bg-stone-300/85", border: "border-stone-500/25", label: "text-stone-900" },
  { bar: "bg-amber-100/90", border: "border-amber-800/20", label: "text-amber-950" },
  { bar: "bg-rose-100/80", border: "border-rose-900/15", label: "text-rose-950" },
  { bar: "bg-teal-200/50", border: "border-teal-800/20", label: "text-teal-950" },
  { bar: "bg-orange-100/75", border: "border-orange-800/20", label: "text-orange-950" },
  { bar: "bg-sky-200/50", border: "border-sky-800/20", label: "text-sky-950" },
  { bar: "bg-violet-200/50", border: "border-violet-800/20", label: "text-violet-950" },
  { bar: "bg-indigo-200/55", border: "border-indigo-800/20", label: "text-indigo-950" },
  { bar: "bg-emerald-200/50", border: "border-emerald-800/20", label: "text-emerald-950" },
  { bar: "bg-cyan-200/50", border: "border-cyan-800/20", label: "text-cyan-950" },
  { bar: "bg-fuchsia-200/45", border: "border-fuchsia-800/20", label: "text-fuchsia-950" },
  { bar: "bg-blue-200/50", border: "border-blue-800/20", label: "text-blue-950" },
  { bar: "bg-lime-200/45", border: "border-lime-800/20", label: "text-lime-950" },
];

type IranDynastiesVerticalTimelineProps = {
  data: readonly IranVerticalDynasty[];
  className?: string;
  /** Initial language when uncontrolled (default). */
  initialLocale?: StudyLocale;
  /** When set with `onLocaleChange`, the parent controls language. */
  locale?: StudyLocale;
  onLocaleChange?: (l: StudyLocale) => void;
  /** If false, omit the header toggle (e.g. when the page supplies one). */
  showLanguageToggle?: boolean;
  /** When true, the main line title is rendered as h2 (page supplies h1). */
  embedInStudyPage?: boolean;
  /**
   * Initial view: `vertical` (tall scroll) or `horizontal` (time along the width). Default: horizontal.
   * User can change it with the Vertical / Horizontal control.
   */
  defaultLayout?: DynastyTimelineLayout;
};

type TipState =
  | { kind: "empty" }
  | { kind: "ok"; d: IranVerticalDynasty; x: number; y: number };

function titleOf(d: IranVerticalDynasty, lang: StudyLocale) {
  return tLang(d.title_en, d.title_fa, lang);
}

function descOf(d: IranVerticalDynasty, lang: StudyLocale) {
  return tLang(d.description_en, d.description_fa, lang);
}

function formatRange(
  s: number,
  e: number,
  tMin: number,
  tMax: number,
  lang: StudyLocale,
  yearMode: ChartAxisYearMode
) {
  return formatDynastyProlepticRange(s, e, tMin, tMax, lang, yearMode);
}

function FloatingTip({
  d,
  x,
  y,
  tMin,
  tMax,
  lang,
  yearMode,
  dir: dirText,
}: {
  d: IranVerticalDynasty;
  x: number;
  y: number;
  tMin: number;
  tMax: number;
  lang: StudyLocale;
  yearMode: ChartAxisYearMode;
  dir: "ltr" | "rtl";
}) {
  const maxLeft = typeof window !== "undefined" ? Math.max(8, window.innerWidth - 220) : 8;
  return (
    <div
      className="pointer-events-none fixed z-50 min-w-[12rem] max-w-[20rem] rounded border border-border/60 bg-card/95 px-3 py-2 shadow-md backdrop-blur"
      style={{
        left: Math.min(x + 12, maxLeft),
        top: y + 12,
        textAlign: dirText === "rtl" ? "right" : "left",
        direction: dirText,
      }}
      role="tooltip"
    >
      <p className="text-sm font-medium text-foreground">{titleOf(d, lang)}</p>
      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground whitespace-pre-line">
        {formatRange(d.start_year, d.end_year, tMin, tMax, lang, yearMode)}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/95">{descOf(d, lang)}</p>
    </div>
  );
}

function YearAxisRuler({
  tMin,
  tMax,
  heightPx,
  lang,
  yearMode,
  className,
}: {
  tMin: number;
  tMax: number;
  heightPx: number;
  lang: StudyLocale;
  yearMode: ChartAxisYearMode;
  className?: string;
}) {
  const span = tMax - tMin;
  const lines = useMemo(() => {
    const out: { y: number; year: number }[] = [];
    for (let i = 0; i <= YEAR_TICKS; i++) {
      const frac = i / YEAR_TICKS;
      const year = Math.round(tMax - frac * span);
      const y = yearToOffsetFromTop(year, tMin, tMax, heightPx);
      out.push({ y, year });
    }
    return out;
  }, [tMin, tMax, heightPx]);

  /* Width fits tabular year lines; "CE"/"BCE" needs room so the right edge of the text is not on the plot edge. */
  const w = yearMode === "both" && lang === "fa" ? 80 : 62;
  return (
    <div
      className={cn(
        "relative flex-shrink-0 pr-2.5 text-right font-mono text-[8px] text-muted-foreground/70",
        className
      )}
      style={{ width: w, height: heightPx }}
    >
      {lines.map((L, i) => (
        <div
          key={i}
          className="absolute right-0 flex w-full translate-y-0 items-baseline justify-end"
          style={{ top: L.y, transform: "translateY(-3px)" }}
        >
          <span
            className="line-clamp-2 block max-w-full leading-tight tabular-nums whitespace-pre-line"
            title={String(L.year)}
          >
            {formatDynastyProlepticYear(L.year, lang, yearMode)}
          </span>
        </div>
      ))}
    </div>
  );
}

function YearAxisRulerHorizontal({
  tMin,
  tMax,
  widthPx,
  lang,
  yearMode,
  className,
}: {
  tMin: number;
  tMax: number;
  widthPx: number;
  lang: StudyLocale;
  yearMode: ChartAxisYearMode;
  className?: string;
}) {
  const span = tMax - tMin;
  const lines = useMemo(() => {
    const out: { x: number; year: number }[] = [];
    for (let i = 0; i <= YEAR_TICKS; i++) {
      const frac = i / YEAR_TICKS;
      const year = Math.round(tMin + frac * span);
      const x = yearToOffsetFromLeft(year, tMin, tMax, widthPx);
      out.push({ x, year });
    }
    return out;
  }, [tMin, tMax, widthPx]);

  const tickH = yearMode === "both" && lang === "fa" ? "min-h-[2.75rem]" : "min-h-[2.25rem]";
  return (
    <div
      className={cn("relative max-w-full select-none", className)}
      style={{ width: widthPx > 0 ? widthPx : "100%", minHeight: yearMode === "both" && lang === "fa" ? 40 : 36 }}
      dir="ltr"
    >
      <div className="pointer-events-none relative h-3 w-full" aria-hidden>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/80" />
        {lines.map((L, i) => (
          <div
            key={i}
            className="absolute bottom-0 w-px bg-border/60"
            style={{ left: L.x, height: 8, transform: "translateX(-0.5px)" }}
          />
        ))}
      </div>
      <div
        className={cn("relative mt-2 font-mono text-[8px] text-muted-foreground/80", tickH)}
      >
        {lines.map((L, i) => (
          <div
            key={i}
            className="absolute top-0 w-16 -translate-x-1/2 text-center tabular-nums leading-tight"
            style={{ left: L.x }}
          >
            <span className="line-clamp-2 whitespace-pre-line" title={String(L.year)}>
              {formatDynastyProlepticYear(L.year, lang, yearMode)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  d,
  lang,
  tMin,
  tMax,
  onClose,
  yearMode,
}: {
  d: IranVerticalDynasty;
  lang: StudyLocale;
  tMin: number;
  tMax: number;
  onClose: () => void;
  yearMode: ChartAxisYearMode;
}) {
  return (
    <div
      className="mt-2 rounded-lg border border-border/60 bg-card/50 p-5 shadow-sm"
      style={{ textAlign: lang === "fa" ? "right" : "left", direction: lang === "fa" ? "rtl" : "ltr" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg font-medium tracking-tight text-foreground">{titleOf(d, lang)}</h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/40"
        >
          {tLang("Close", "بستن", lang)}
        </button>
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground whitespace-pre-line">
        {formatRange(d.start_year, d.end_year, tMin, tMax, lang, yearMode)}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{descOf(d, lang)}</p>
    </div>
  );
}

function minVerticalLabelPx(
  d: IranVerticalDynasty,
  all: readonly IranVerticalDynasty[]
) {
  return isStrictlyNestedInAnother(d, all) ? 28 : MIN_INNER_LABEL_PX;
}

function narrowOutlines(
  data: readonly IranVerticalDynasty[],
  tMin: number,
  tMax: number,
  vTrackPx: number
) {
  for (const d of data) {
    const a = Math.max(d.start_year, tMin);
    const b = Math.min(d.end_year, tMax);
    if (a >= b) continue;
    const h = Math.max(bandRectFromYears(a, b, tMin, tMax, vTrackPx).height, 6);
    const minH = minVerticalLabelPx(d, data);
    if (h < minH) return { hasVerticalNarrow: true };
    if (!isStrictlyNestedInAnother(d, data) && hasStrictSubspanChild(d, data)) {
      return { hasVerticalNarrow: true };
    }
  }
  return { hasVerticalNarrow: false };
}

type HorizontalNarrowPlacement = {
  d: IranVerticalDynasty;
  i: number;
  cx: number;
  lane: number;
};

/**
 * Staggered external labels in horizontal view: assign non-overlapping [cx−h, cx+h] intervals to “lanes”
 * (rows), then height = text + connector + maxLane * stride.
 */
function computeHorizontalNarrowCalloutLayout(
  data: readonly IranVerticalDynasty[],
  tMin: number,
  tMax: number,
  widthPx: number
): { hasItems: boolean; blockHeight: number; placements: HorizontalNarrowPlacement[] } {
  const raw: { d: IranVerticalDynasty; i: number; cx: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i]!;
    const a = Math.max(d.start_year, tMin);
    const b = Math.min(d.end_year, tMax);
    if (a >= b) continue;
    const { left, width: w0 } = bandRectFromYearsHorizontal(a, b, tMin, tMax, widthPx);
    const w = Math.max(w0, 4);
    const isNested = isStrictlyNestedInAnother(d, data);
    const parentLosesInBand = !isNested && hasStrictSubspanChild(d, data);
    /** Superscript-style nested band would paint over a centered in-band name (e.g. Sāmānid over caliphal). */
    if (parentLosesInBand) {
      raw.push({ d, i, cx: left + w / 2 });
      continue;
    }
    if (w >= MIN_INNER_LABEL_H_PX) continue;
    raw.push({ d, i, cx: left + w / 2 });
  }
  if (raw.length === 0) {
    return { hasItems: false, blockHeight: 0, placements: [] };
  }
  const half = H_NARROW_LABEL_HALF_PX;
  const sorted = [...raw].sort((a, b) => a.cx - b.cx);
  const segs: [number, number][][] = [];
  const placements: HorizontalNarrowPlacement[] = [];

  function overlaps(lo: number, hi: number, a: number, b: number) {
    return lo < b && a < hi;
  }

  for (const it of sorted) {
    const lo = it.cx - half;
    const hi = it.cx + half;
    let lane: number;
    for (lane = 0; lane < H_NARROW_MAX_LANES; lane++) {
      if (!segs[lane]) segs[lane] = [];
      const segsL = segs[lane]!;
      if (segsL.some(([a, b]) => overlaps(lo, hi, a, b))) continue;
      segsL.push([lo, hi]);
      break;
    }
    if (lane === H_NARROW_MAX_LANES) lane = H_NARROW_MAX_LANES - 1;
    placements.push({ d: it.d, i: it.i, cx: it.cx, lane });
  }
  const maxLane = Math.max(0, ...placements.map((p) => p.lane));
  const blockHeight =
    H_NARROW_TEXT_LINE_PX +
    H_NARROW_CONNECTOR_BASE_PX +
    maxLane * H_NARROW_LANE_STRIDE_PX +
    4;
  return { hasItems: true, blockHeight, placements };
}

/** LTR leader line + text when the bar is too short to show the name inside. */
function NarrowVerticalCalloutLane({
  data,
  tMin,
  tMax,
  heightPx,
  lang,
}: {
  data: readonly IranVerticalDynasty[];
  tMin: number;
  tMax: number;
  heightPx: number;
  lang: StudyLocale;
}) {
  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 border-l border-border/25 pl-1.5"
      style={{ height: heightPx, minWidth: "4.5rem" }}
      aria-hidden
    >
      {data.map((d, i) => {
        const a = Math.max(d.start_year, tMin);
        const b = Math.min(d.end_year, tMax);
        if (a >= b) return null;
        const { top, height: h0 } = bandRectFromYears(a, b, tMin, tMax, heightPx);
        const h = Math.max(h0, 6);
        const minH = minVerticalLabelPx(d, data);
        const childNested = isStrictlyNestedInAnother(d, data);
        const parentHasSubspan = hasStrictSubspanChild(d, data);
        if (h >= minH && (childNested || !parentHasSubspan)) return null;
        const y = top + h / 2;
        const vis = BAND_VISUAL[i] ?? BAND_VISUAL[0]!;
        return (
          <div
            key={`nvc-${d.id}`}
            className="pointer-events-none absolute left-0 right-0 flex min-w-0 items-center gap-1"
            style={{ top: y, transform: "translateY(-50%)" }}
            dir="ltr"
          >
            <div className="h-px w-1.5 shrink-0 bg-border/80" aria-hidden />
            <span
              className={cn("min-w-0 flex-1 truncate text-[8px] font-medium leading-tight", vis.label)}
              dir={lang === "fa" ? "rtl" : "ltr"}
            >
              {titleOf(d, lang)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked name + connector line above the bar; `placements` include precomputed lanes to avoid x-overlap. */
function NarrowHorizontalCalloutLane({
  placements,
  blockHeight,
  lang,
}: {
  placements: readonly HorizontalNarrowPlacement[];
  blockHeight: number;
  lang: StudyLocale;
}) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 w-full"
      style={{ height: blockHeight }}
      aria-hidden
    >
      {placements.map((p) => {
        const vis = BAND_VISUAL[p.i] ?? BAND_VISUAL[0]!;
        const lineH =
          H_NARROW_CONNECTOR_BASE_PX + p.lane * H_NARROW_LANE_STRIDE_PX;
        return (
          <div
            key={`nhc-${p.d.id}`}
            className="absolute bottom-0 flex w-max min-w-0 max-w-[6.5rem] -translate-x-1/2 flex-col items-center"
            style={{ left: p.cx }}
            dir="ltr"
          >
            <span
              className={cn(
                "w-full min-w-0 break-words text-center text-[7px] font-medium leading-snug text-balance [overflow-wrap:anywhere] line-clamp-3",
                vis.label
              )}
              dir={lang === "fa" ? "rtl" : "ltr"}
            >
              {titleOf(p.d, lang)}
            </span>
            <div
              className="w-px shrink-0 self-center bg-border/80"
              style={{ height: lineH }}
              aria-hidden
            />
          </div>
        );
      })}
    </div>
  );
}

function IranDynastiesVerticalTimelineInner({
  data,
  className,
  initialLocale = "en",
  locale: controlledLocale,
  onLocaleChange,
  showLanguageToggle = true,
  embedInStudyPage = false,
  defaultLayout = "horizontal",
}: IranDynastiesVerticalTimelineProps) {
  const isControlled = controlledLocale !== undefined;
  const [uncontrolledLang, setUncontrolledLang] = useState<StudyLocale>(initialLocale);
  const lang = isControlled ? controlledLocale! : uncontrolledLang;
  const setLang: (l: StudyLocale) => void = isControlled
    ? (l) => onLocaleChange?.(l)
    : setUncontrolledLang;
  const [hover, setHover] = useState<TipState>({ kind: "empty" });
  const [selected, setSelected] = useState<IranVerticalDynasty | null>(null);
  const [layout, setLayout] = useState<DynastyTimelineLayout>(defaultLayout);
  const [yearAxisMode, setYearAxisMode] = useState<ChartAxisYearMode>("gregorian");
  const presentYear = new Date().getFullYear();
  const { tMin: dataTMin, tMax: dataTMax } = useMemo(
    () => getVerticalTimelineDomain(data, presentYear),
    [data, presentYear]
  );
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { tMin, tMax } = useMemo(
    () => resolveProlepticViewFromSearchParams(searchParams, dataTMin, dataTMax),
    [searchParams, dataTMin, dataTMax]
  );
  const yearsTotal = useMemo(() => totalSpanYears(tMin, tMax), [tMin, tMax]);
  const applyViewRange = useCallback(
    (nextMin: number, nextMax: number) => {
      const sp = new URLSearchParams(searchParams.toString());
      const qs = setViewInSearchParams(sp, nextMin, nextMax, dataTMin, dataTMax);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [dataTMax, dataTMin, pathname, router, searchParams]
  );
  const hasSelection = selected != null;
  /** In horizontal view, use full width for the track until a band is chosen; vertical keeps a narrow hint column. */
  const useSideColumn = layout === "vertical" || (layout === "horizontal" && hasSelection);

  const trackBoxRef = useRef<HTMLDivElement>(null);
  const [verticalTrackPx, setVerticalTrackPx] = useState(560);
  const [horizontalTrackPx, setHorizontalTrackPx] = useState(960);

  useLayoutEffect(() => {
    const el = trackBoxRef.current;
    if (!el) return;
    const apply = (w: number, h: number) => {
      if (layout === "vertical") {
        setVerticalTrackPx(Math.max(VERTICAL_TRACK_MIN_PX, Math.floor(h)));
      } else {
        setHorizontalTrackPx(Math.max(HORIZONTAL_TRACK_MIN_PX, Math.floor(w)));
      }
    };
    const r = el.getBoundingClientRect();
    apply(r.width, r.height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      apply(width, height);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [layout]);

  const { hasVerticalNarrow } = useMemo(
    () => narrowOutlines(data, tMin, tMax, verticalTrackPx),
    [data, tMin, tMax, verticalTrackPx]
  );
  const hNarrowCallouts = useMemo(
    () => computeHorizontalNarrowCalloutLayout(data, tMin, tMax, horizontalTrackPx),
    [data, tMin, tMax, horizontalTrackPx]
  );

  const onBandMove = useCallback(
    (d: IranVerticalDynasty) => (e: React.MouseEvent) => {
      setHover({ kind: "ok", d, x: e.clientX, y: e.clientY });
    },
    []
  );
  const onBandLeave = useCallback(() => setHover({ kind: "empty" }), []);
  const onPointerMove = useCallback((e: React.MouseEvent) => {
    setHover((h) => (h.kind === "ok" ? { ...h, x: e.clientX, y: e.clientY } : h));
  }, []);

  return (
    <div
      className={cn("mx-auto max-w-5xl px-4 py-10 md:px-8", lang === "fa" && "font-[family-name:Vazirmatn] study-page-fa", className)}
    >
      {typeof document !== "undefined" && hover.kind === "ok" ? createPortal(
        <FloatingTip
          d={hover.d}
          x={hover.x}
          y={hover.y}
          tMin={tMin}
          tMax={tMax}
          lang={lang}
          yearMode={yearAxisMode}
          dir={lang === "fa" ? "rtl" : "ltr"}
        />, document.body) : null}
      <header className="mb-12 w-full max-w-4xl space-y-4" dir={lang === "fa" ? "rtl" : "ltr"}>
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {tLang("Chronology", "گاه‌شمار", lang)}
        </p>
        {embedInStudyPage ? (
          <h2 className="font-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
            {tLang("Iranian states & dynasties", "دولت‌ها و دودمان‌های بزرگ ایران", lang)}
          </h2>
        ) : (
          <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
            {tLang("Iranian states & dynasties", "دولت‌ها و دودمان‌های بزرگ ایران", lang)}
          </h1>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground/95">
          {layout === "vertical"
            ? tLang(
                "The present is at the top; time runs downward. The chart is scaled to the available height so the full span fits without vertical scrolling. Band thickness is compact by design.",
                "حال، بالا است؛ زمان پایین می‌رود. ارتفاع نما با فضا تنظیم می‌شود تا دامنه بدون اسکرول عمودی بگنجد. پهنای نوارها فشرده است.",
                lang
              )
            : tLang(
                "The present is to the right; time runs left to right. Each band’s width matches its share of the available row—sized to fit the page width without scrolling.",
                "حال، سمت راست نما است؛ زمان چپ‌به‌راست می‌رود. عرض هر باند سهم نسبی همان دوره در عرض نمایان است—برای فیت شدن در صفحه بدون اسکرول تغییرمی‌کند.",
                lang
              )}
        </p>
        <div className="w-full max-w-4xl pt-1" dir="ltr">
          <DynastiesYearRangeControls
            domainMin={dataTMin}
            domainMax={dataTMax}
            viewTMin={tMin}
            viewTMax={tMax}
            lang={lang}
            onApply={applyViewRange}
            onFit={() => {
              applyViewRange(dataTMin, dataTMax);
            }}
          />
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 pt-2",
            lang === "fa" && "flex-row-reverse"
          )}
        >
          <p
            className="text-[10px] tabular-nums text-muted-foreground/80 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-1"
            dir="ltr"
          >
            <span dir={lang === "fa" ? "rtl" : "ltr"}>
              {tLang("Span: ", "دامنه: ", lang)}
            </span>
            <span className="whitespace-pre-line break-words">{formatDynastyProlepticYear(tMin, lang, yearAxisMode)}</span>
            <span className="text-muted-foreground/50" aria-hidden>
              ➔
            </span>
            <span className="whitespace-pre-line break-words">{formatDynastyProlepticYear(tMax, lang, yearAxisMode)}</span>
            <span className="text-muted-foreground/60">
              ({tLang("years", "سال", lang)}: {Math.round(yearsTotal)})
            </span>
          </p>
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              lang === "fa" && "flex-row-reverse"
            )}
          >
            <div
              className="inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0"
              role="group"
              aria-label={tLang("Timeline layout", "نمای تایم‌لاین", lang)}
            >
              <button
                type="button"
                onClick={() => setLayout("vertical")}
                aria-pressed={layout === "vertical"}
                className={cn(
                  "px-2.5 py-1.5 font-medium transition-colors",
                  layout === "vertical"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/60"
                )}
              >
                {tLang("Vertical", "عمودی", lang)}
              </button>
              <button
                type="button"
                onClick={() => setLayout("horizontal")}
                aria-pressed={layout === "horizontal"}
                className={cn(
                  "px-2.5 py-1.5 font-medium transition-colors",
                  layout === "horizontal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/60"
                )}
              >
                {tLang("Horizontal", "افقی", lang)}
              </button>
            </div>
            {lang === "fa" ? (
              <StudyYearDisplayToggle
                value={yearAxisMode}
                onChange={setYearAxisMode}
                isFa
                className="shrink-0"
                size="compact"
              />
            ) : null}
            {showLanguageToggle ? <StudyLanguageToggle locale={lang} onLocaleChange={setLang} /> : null}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-8",
          useSideColumn ? "lg:grid-cols-[1fr,minmax(0,22rem)]" : "grid-cols-1"
        )}
        dir={lang === "fa" ? "rtl" : "ltr"}
      >
        {layout === "vertical" ? (
        <div
          ref={trackBoxRef}
          className="h-[min(64svh,600px)] w-full min-h-[14rem] min-w-0"
          onPointerMove={onPointerMove}
          onPointerLeave={onBandLeave}
        >
          {/* LTR: present at top, past below; year labels read consistently in both site languages. */}
          <div className="flex h-full min-h-0 gap-2.5" dir="ltr">
            <YearAxisRuler
              tMin={tMin}
              tMax={tMax}
              heightPx={verticalTrackPx}
              lang={lang}
              yearMode={yearAxisMode}
            />
            <div
              className="relative min-h-0 min-w-0 flex-shrink-0"
              style={{ width: STRIP_PX, height: verticalTrackPx, minHeight: verticalTrackPx }}
            >
              {data.map((d, i) => {
                const a = Math.max(d.start_year, tMin);
                const b = Math.min(d.end_year, tMax);
                if (a >= b) return <Fragment key={d.id} />;
                const { top, height: h0 } = bandRectFromYears(a, b, tMin, tMax, verticalTrackPx);
                const h = Math.max(h0, 6);
                const vis = BAND_VISUAL[i] ?? BAND_VISUAL[0]!;
                const nested = isStrictlyNestedInAnother(d, data);
                const minH = minVerticalLabelPx(d, data);
                const canLabel = h >= minH && (nested || !hasStrictSubspanChild(d, data));
                const zN = nested ? 24 + i : 2 + i;
                return (
                  <button
                    type="button"
                    key={d.id}
                    className={cn(
                      "absolute box-border rounded-sm border text-center shadow-sm transition-[filter] hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      nested
                        ? "ml-[4%] w-[92%] max-w-[92%] left-0"
                        : "left-0 w-full",
                      vis.bar,
                      vis.border,
                      canLabel ? "py-0.5" : "py-0"
                    )}
                    style={{ top, height: h, zIndex: zN }}
                    onMouseEnter={onBandMove(d)}
                    onMouseMove={onBandMove(d)}
                    onMouseLeave={onBandLeave}
                    onClick={() => setSelected((p) => (p?.id === d.id ? null : d))}
                    aria-pressed={selected?.id === d.id}
                    aria-label={titleOf(d, lang)}
                  >
                    {canLabel ? (
                      <span
                        className={cn(
                          "line-clamp-2 block min-h-0 w-full px-1 text-[8px] font-medium leading-tight",
                          vis.label
                        )}
                      >
                        {titleOf(d, lang)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {hasVerticalNarrow ? (
              <NarrowVerticalCalloutLane
                data={data}
                tMin={tMin}
                tMax={tMax}
                heightPx={verticalTrackPx}
                lang={lang}
              />
            ) : null}
          </div>
        </div>
        ) : (
        <div
          ref={trackBoxRef}
          className="min-w-0 w-full pb-2"
          onPointerMove={onPointerMove}
          onPointerLeave={onBandLeave}
          dir="ltr"
        >
            <div
              className="relative w-full min-w-0 overflow-visible rounded-sm"
              style={{
                height:
                  (hNarrowCallouts.hasItems ? hNarrowCallouts.blockHeight : 0) + BAND_ROW_H_PX,
              }}
            >
              {hNarrowCallouts.hasItems ? (
                <NarrowHorizontalCalloutLane
                  placements={hNarrowCallouts.placements}
                  blockHeight={hNarrowCallouts.blockHeight}
                  lang={lang}
                />
              ) : null}
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ height: BAND_ROW_H_PX, zIndex: 1 }}
              >
                {data.map((d, i) => {
                  const a = Math.max(d.start_year, tMin);
                  const b = Math.min(d.end_year, tMax);
                  if (a >= b) return <Fragment key={d.id} />;
                  const { left, width: w0 } = bandRectFromYearsHorizontal(
                    a,
                    b,
                    tMin,
                    tMax,
                    horizontalTrackPx
                  );
                  const w = Math.max(w0, 4);
                  const vis = BAND_VISUAL[i] ?? BAND_VISUAL[0]!;
                  const nestedH = isStrictlyNestedInAnother(d, data);
                  const canLabel =
                    w >= MIN_INNER_LABEL_H_PX && (nestedH || !hasStrictSubspanChild(d, data));
                  const zH = nestedH ? 20 + i : 2 + i;
                  return (
                    <button
                      type="button"
                      key={d.id}
                      className={cn(
                        "absolute box-border flex min-h-0 items-center justify-center rounded-sm border text-center shadow-sm transition-[filter] hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        nestedH
                          ? "top-1 h-[calc(100%-0.5rem)]"
                          : "top-0 h-full",
                        vis.bar,
                        vis.border,
                        canLabel ? "px-1" : "px-0"
                      )}
                      style={{ left, width: w, zIndex: zH }}
                      onMouseEnter={onBandMove(d)}
                      onMouseMove={onBandMove(d)}
                      onMouseLeave={onBandLeave}
                      onClick={() => setSelected((p) => (p?.id === d.id ? null : d))}
                      aria-pressed={selected?.id === d.id}
                      aria-label={titleOf(d, lang)}
                    >
                      {canLabel ? (
                        <span
                          className={cn(
                            "w-full min-w-0 max-w-full overflow-hidden break-words px-0.5 text-center text-[8px] font-medium leading-snug line-clamp-3 [overflow-wrap:anywhere]",
                            vis.label
                          )}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          title={titleOf(d, lang)}
                        >
                          {titleOf(d, lang)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="w-full min-w-0 pt-1.5">
              <YearAxisRulerHorizontal
                tMin={tMin}
                tMax={tMax}
                widthPx={horizontalTrackPx}
                lang={lang}
                yearMode={yearAxisMode}
              />
            </div>
        </div>
        )}
        {useSideColumn ? (
        <aside
          className="min-h-0 self-start text-sm leading-relaxed text-muted-foreground/85 lg:sticky lg:top-8"
          dir={lang === "fa" ? "rtl" : "ltr"}
        >
          {hasSelection && selected ? (
            <>
              <DetailPanel
                d={selected}
                lang={lang}
                tMin={tMin}
                tMax={tMax}
                onClose={() => setSelected(null)}
                yearMode={yearAxisMode}
              />
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                {tLang("Click the same band again to clear.", "برای بستن دوبار همان نوار را بزنید.", lang)}
              </p>
            </>
          ) : (
            <p className="hidden text-[10px] leading-snug text-muted-foreground/70 md:block md:max-w-prose">
              {tLang("Select a block for a longer read.", "روی نوار بزنید برای متن بیشتر.", lang)}
            </p>
          )}
        </aside>
        ) : null}
      </div>
    </div>
  );
}

function IranDynastiesVerticalTimelineFallback({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto max-w-5xl px-4 py-10 md:px-8", className)}>
      <div className="h-24 w-full max-w-4xl animate-pulse rounded-lg bg-muted/35" role="status" aria-label="Loading" />
    </div>
  );
}

/** Proleptic year view window via `?start=&end=`; wrap in `Suspense` (uses `useSearchParams`). */
export function IranDynastiesVerticalTimeline(props: IranDynastiesVerticalTimelineProps) {
  return (
    <Suspense fallback={<IranDynastiesVerticalTimelineFallback className={props.className} />}>
      <IranDynastiesVerticalTimelineInner {...props} />
    </Suspense>
  );
}
