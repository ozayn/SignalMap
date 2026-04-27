"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  domainInclusiveYearBounds,
  endYearFromViewEnd,
  normalizeYearPair,
  startYearFromViewStart,
  viewMsFromInclusiveYearsClamped,
} from "@/lib/signalmap-timeline";
import { t as tLang, type StudyLocale } from "@/lib/iran-study-fa";

const FIELD_LABEL =
  "mb-0.5 block min-h-[0.875rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
const CONTROL_INPUT =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";
const TOOLBAR_ROW = "flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border/40 pb-2";
const INPUT_PLACEHOLDER = `${CONTROL_INPUT} pointer-events-none animate-pulse bg-muted/30 tabular-nums text-transparent`;
/** Shadcn outline button look without Radix Slot; keeps hydration trees simple. */
const FIT_BUTTON =
  "h-8 shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 text-xs font-normal leading-none text-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground";
const FIT_PLACEHOLDER = "h-8 inline-flex w-[4.5rem] shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20";

export type SignalMapYearRangeControlsProps = {
  domainStartMs: number;
  domainEndMs: number;
  viewStart: number;
  viewEnd: number;
  onApplyViewMs: (startMs: number, endMs: number) => void;
  onFitAll: () => void;
  lang: StudyLocale;
  className?: string;
};

/**
 * Start / end year + Fit all — matches study chart range control styling; EN/FA labels.
 */
export function SignalMapYearRangeControls({
  domainStartMs,
  domainEndMs,
  viewStart,
  viewEnd,
  onApplyViewMs,
  onFitAll,
  lang,
  className,
}: SignalMapYearRangeControlsProps) {
  const { minY, maxY } = domainInclusiveYearBounds(domainStartMs, domainEndMs);
  const displayStart = startYearFromViewStart(viewStart, minY, maxY);
  const displayEnd = endYearFromViewEnd(viewStart, viewEnd, minY, maxY);

  const [draftStart, setDraftStart] = useState(String(displayStart));
  const [draftEnd, setDraftEnd] = useState(String(displayEnd));
  const [controlsReady, setControlsReady] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const lastExternal = useRef({ displayStart, displayEnd });
  /** While > 0, a year field is focused; do not overwrite drafts from view/pan/URL. */
  const yearFieldFocusDepth = useRef(0);
  const draftStartRef = useRef(draftStart);
  const draftEndRef = useRef(draftEnd);
  draftStartRef.current = draftStart;
  draftEndRef.current = draftEnd;
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const nameStart = `sm-tl-ys-${uid.replace(/:/g, "")}`;
  const nameEnd = `sm-tl-ye-${uid.replace(/:/g, "")}`;

  useLayoutEffect(() => {
    setControlsReady(true);
  }, []);

  useEffect(
    () => () => {
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (yearFieldFocusDepth.current > 0) {
      return;
    }
    if (lastExternal.current.displayStart === displayStart && lastExternal.current.displayEnd === displayEnd) {
      return;
    }
    lastExternal.current = { displayStart, displayEnd };
    setDraftStart(String(displayStart));
    setDraftEnd(String(displayEnd));
  }, [displayStart, displayEnd]);

  const applyPair = useCallback(
    (rawA: string, rawB: string) => {
      if (rawA === "" || rawB === "") {
        setHint(
          tLang("Enter a start and end year.", "سال شروع و پایان را وارد کنید.", lang)
        );
        return;
      }
      const a = parseInt(rawA, 10);
      const b = parseInt(rawB, 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        setHint(
          tLang("Years must be valid numbers.", "سال‌ها باید عدد معتبر باشند.", lang)
        );
        return;
      }
      const n = normalizeYearPair(a, b, minY, maxY);
      const m = viewMsFromInclusiveYearsClamped(n.startY, n.endY, domainStartMs, domainEndMs);
      onApplyViewMs(m.startMs, m.endMs);
      setDraftStart(String(n.startY));
      setDraftEnd(String(n.endY));
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
        hintTimer.current = null;
      }
      if (n.wasCorrected || m.wasCorrected) {
        setHint(
          tLang("Adjusted to available data range.", "محدوده با دادهٔ موجود هم‌خوانی داده شد.", lang)
        );
        hintTimer.current = setTimeout(() => {
          setHint(null);
          hintTimer.current = null;
        }, 3000);
      } else {
        setHint(null);
      }
    },
    [domainStartMs, domainEndMs, minY, maxY, lang, onApplyViewMs]
  );

  if (!controlsReady) {
    return (
      <div className={className}>
        <span className="sr-only">{tLang("Loading year range controls", "در حال بارگذاری کنترل‌های سال", lang)}</span>
        <div className={TOOLBAR_ROW} aria-hidden>
          <div className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr">
            <span className={FIELD_LABEL}>{tLang("START YEAR", "سال شروع", lang)}</span>
            <div className={INPUT_PLACEHOLDER} aria-hidden>
              0000
            </div>
          </div>
          <div className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr">
            <span className={FIELD_LABEL}>{tLang("END YEAR", "سال پایان", lang)}</span>
            <div className={INPUT_PLACEHOLDER} aria-hidden>
              0000
            </div>
          </div>
          <div className={FIT_PLACEHOLDER} aria-hidden>
            <span className="text-[10px] text-muted-foreground/50">—</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className={TOOLBAR_ROW}
        aria-label={tLang("Timeline year range", "محدوده سال تایم‌لاین", lang)}
      >
        <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr">
          <span className={FIELD_LABEL} id={`${nameStart}-cap`}>
            {tLang("START YEAR", "سال شروع", lang)}
          </span>
          <input
            id={nameStart}
            type="text"
            name={nameStart}
            value={draftStart}
            autoComplete="off"
            spellCheck={false}
            inputMode="numeric"
            data-lpignore="true"
            data-1p-ignore="true"
            onChange={(e) => setDraftStart(e.target.value)}
            onFocus={() => {
              yearFieldFocusDepth.current += 1;
            }}
            onBlur={() => {
              yearFieldFocusDepth.current = Math.max(0, yearFieldFocusDepth.current - 1);
              applyPair(draftStartRef.current, draftEndRef.current);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={CONTROL_INPUT}
            aria-labelledby={`${nameStart}-cap`}
          />
        </label>
        <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr">
          <span className={FIELD_LABEL} id={`${nameEnd}-cap`}>
            {tLang("END YEAR", "سال پایان", lang)}
          </span>
          <input
            id={nameEnd}
            type="text"
            name={nameEnd}
            value={draftEnd}
            autoComplete="off"
            spellCheck={false}
            inputMode="numeric"
            data-lpignore="true"
            data-1p-ignore="true"
            onChange={(e) => setDraftEnd(e.target.value)}
            onFocus={() => {
              yearFieldFocusDepth.current += 1;
            }}
            onBlur={() => {
              yearFieldFocusDepth.current = Math.max(0, yearFieldFocusDepth.current - 1);
              applyPair(draftStartRef.current, draftEndRef.current);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={CONTROL_INPUT}
            aria-labelledby={`${nameEnd}-cap`}
          />
        </label>
        <button
          type="button"
          className={FIT_BUTTON}
          onClick={onFitAll}
          name="signalmap-timeline-fit"
          data-lpignore="true"
          data-1p-ignore="true"
        >
          {tLang("Fit all", "همه", lang)}
        </button>
      </div>
      {hint ? (
        <p className="mb-0 mt-1 text-[10px] text-amber-700/90 dark:text-amber-400/90" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
