"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StudyLanguageToggle } from "@/components/study-language-toggle";
import { cn } from "@/lib/utils";
import { formatYearADBC } from "@/lib/iran-dynasties-vertical/format-year";
import {
  type IranVerticalDynasty,
  bandRectFromYears,
  getVerticalTimelineDomain,
  totalSpanYears,
  yearToOffsetFromTop,
} from "@/lib/iran-dynasties-vertical";
import { t as tLang, type StudyLocale } from "@/lib/iran-study-fa";

const TRACK_PX = 2560;
const STRIP_PX = 300;
const MIN_INNER_LABEL_PX = 44;
const YEAR_TICKS = 13;

/** Muted, museum-style bands (order matches `IRAN_VERTICAL_DYNASTIES` in seed). */
const BAND_VISUAL: readonly { bar: string; border: string; label: string }[] = [
  { bar: "bg-stone-300/85", border: "border-stone-500/25", label: "text-stone-900" },
  { bar: "bg-amber-100/90", border: "border-amber-800/20", label: "text-amber-950" },
  { bar: "bg-rose-100/80", border: "border-rose-900/15", label: "text-rose-950" },
  { bar: "bg-teal-200/50", border: "border-teal-800/20", label: "text-teal-950" },
  { bar: "bg-orange-100/75", border: "border-orange-800/20", label: "text-orange-950" },
  { bar: "bg-sky-200/50", border: "border-sky-800/20", label: "text-sky-950" },
  { bar: "bg-violet-200/50", border: "border-violet-800/20", label: "text-violet-950" },
  { bar: "bg-slate-200/80", border: "border-slate-600/25", label: "text-slate-900" },
  { bar: "bg-neutral-200/75", border: "border-neutral-600/25", label: "text-neutral-900" },
];

type IranDynastiesVerticalTimelineProps = {
  data: readonly IranVerticalDynasty[];
  className?: string;
  /** Initial language (page can pass default). */
  initialLocale?: StudyLocale;
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
  lang: StudyLocale
) {
  const a = Math.max(s, tMin);
  const b = Math.min(e, tMax);
  if (a > b) return "—";
  if (a === b) return formatYearADBC(a, lang);
  return `${formatYearADBC(a, lang)} – ${formatYearADBC(b, lang)}`;
}

function FloatingTip({
  d,
  x,
  y,
  tMin,
  tMax,
  lang,
  dir: dirText,
}: {
  d: IranVerticalDynasty;
  x: number;
  y: number;
  tMin: number;
  tMax: number;
  lang: StudyLocale;
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
      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
        {formatRange(d.start_year, d.end_year, tMin, tMax, lang)}
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
  className,
}: {
  tMin: number;
  tMax: number;
  heightPx: number;
  lang: StudyLocale;
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

  return (
    <div
      className={cn("relative flex-shrink-0 pr-2 text-right font-mono text-[9px] text-muted-foreground/70", className)}
      style={{ width: 64, height: heightPx }}
    >
      {lines.map((L, i) => (
        <div
          key={i}
          className="absolute right-0 flex w-full translate-y-0 items-baseline justify-end"
          style={{ top: L.y, transform: "translateY(-3px)" }}
        >
          <span className="line-clamp-1 block max-w-full truncate tabular-nums" title={String(L.year)}>
            {formatYearADBC(L.year, lang)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({
  d,
  lang,
  tMin,
  tMax,
  onClose,
}: {
  d: IranVerticalDynasty;
  lang: StudyLocale;
  tMin: number;
  tMax: number;
  onClose: () => void;
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
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {formatRange(d.start_year, d.end_year, tMin, tMax, lang)}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{descOf(d, lang)}</p>
    </div>
  );
}

export function IranDynastiesVerticalTimeline({ data, className, initialLocale = "en" }: IranDynastiesVerticalTimelineProps) {
  const [lang, setLang] = useState<StudyLocale>(initialLocale);
  const [hover, setHover] = useState<TipState>({ kind: "empty" });
  const [selected, setSelected] = useState<IranVerticalDynasty | null>(null);
  const presentYear = new Date().getFullYear();
  const { tMin, tMax } = useMemo(() => getVerticalTimelineDomain(data, presentYear), [data, presentYear]);
  const yearsTotal = useMemo(() => totalSpanYears(tMin, tMax), [tMin, tMax]);

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
          dir={lang === "fa" ? "rtl" : "ltr"}
        />, document.body) : null}
      <header className="mb-12 max-w-2xl space-y-4" dir={lang === "fa" ? "rtl" : "ltr"}>
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {tLang("Chronology", "گاه‌شمار", lang)}
        </p>
        <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
          {tLang("Iranian states & dynasties", "دولت‌ها و دودمان‌های بزرگ ایران", lang)}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground/95">
          {tLang(
            "The present is at the top; time runs downward. Length of each block matches its relative duration across the view.",
            "حال، بالای نما است؛ زمان به‌سوی پایین می‌رود. ارتفاع هر نوار با طول نسبی دوره در همین دامنه متناسب است.",
            lang
          )}
        </p>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 pt-2",
            lang === "fa" && "flex-row-reverse"
          )}
        >
          <p className="text-[10px] tabular-nums text-muted-foreground/80">
            {tLang("Span: ", "دامنه: ", lang)}
            {formatYearADBC(tMin, lang)}
            {" ➔ "}
            {formatYearADBC(tMax, lang)}
            <span className="ms-1 text-muted-foreground/60">({tLang("years", "سال", lang)}: {Math.round(yearsTotal)})</span>
          </p>
          <StudyLanguageToggle locale={lang} onLocaleChange={setLang} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr,minmax(0,22rem)]" dir={lang === "fa" ? "rtl" : "ltr"}>
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "min(85vh, 2000px)" }}
          onPointerMove={onPointerMove}
          onPointerLeave={onBandLeave}
        >
          {/* LTR: present at top, past below; year labels read consistently in both site languages. */}
          <div className="flex min-h-0 gap-0 pb-16" dir="ltr">
            <YearAxisRuler tMin={tMin} tMax={tMax} heightPx={TRACK_PX} lang={lang} />
            <div className="relative" style={{ width: STRIP_PX, minHeight: TRACK_PX, height: TRACK_PX }}>
              {data.map((d, i) => {
                const a = Math.max(d.start_year, tMin);
                const b = Math.min(d.end_year, tMax);
                if (a >= b) return <Fragment key={d.id} />;
                const { top, height: h0 } = bandRectFromYears(a, b, tMin, tMax, TRACK_PX);
                const h = Math.max(h0, 6);
                const vis = BAND_VISUAL[i] ?? BAND_VISUAL[0]!;
                const canLabel = h >= MIN_INNER_LABEL_PX;
                return (
                  <button
                    type="button"
                    key={d.id}
                    className={cn(
                      "absolute left-0 box-border w-full rounded-sm border text-center shadow-sm transition-[filter] hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      vis.bar,
                      vis.border,
                      canLabel ? "py-1.5" : "py-0"
                    )}
                    style={{ top, height: h }}
                    onMouseEnter={onBandMove(d)}
                    onMouseMove={onBandMove(d)}
                    onMouseLeave={onBandLeave}
                    onClick={() => setSelected((p) => (p?.id === d.id ? null : d))}
                    aria-pressed={selected?.id === d.id}
                    aria-label={titleOf(d, lang)}
                  >
                    {canLabel ? (
                      <span className={cn("block min-h-0 w-full px-1.5 text-[9px] font-medium leading-tight", vis.label)}>
                        {titleOf(d, lang)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <aside className="min-h-0 self-start text-sm leading-relaxed text-muted-foreground/85 lg:sticky lg:top-8" dir={lang === "fa" ? "rtl" : "ltr"}>
          {selected ? (
            <>
              <DetailPanel
                d={selected}
                lang={lang}
                tMin={tMin}
                tMax={tMax}
                onClose={() => setSelected(null)}
              />
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                {tLang("Click the same band again to clear.", "برای بستن دوبار همان نوار را بزنید.", lang)}
              </p>
            </>
          ) : (
            <p className="hidden max-w-prose md:block">
              {tLang("Select a block for a longer read.", "روی نوار بزنید برای متن بیشتر.", lang)}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
