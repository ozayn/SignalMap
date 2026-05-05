"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { clampProlepticView } from "@/lib/iran-dynasties-vertical/view-range";
import { t as tLang, type StudyLocale } from "@/lib/iran-study-fa";

const FIELD_LABEL =
  "mb-0.5 block min-h-[0.875rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
const CONTROL_INPUT =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25";
const TOOLBAR_ROW = "flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border/40 pb-2";
const FIT_BUTTON =
  "h-8 shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 text-xs font-normal leading-none text-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground";

type Props = {
  domainMin: number;
  domainMax: number;
  viewTMin: number;
  viewTMax: number;
  lang: StudyLocale;
  onApply: (tMin: number, tMax: number) => void;
  onFit: () => void;
  className?: string;
};

/**
 * Start / end proleptic years (BCE = negative), shared styling with `StudyChartControls` / timeline band UI.
 */
export function DynastiesYearRangeControls({
  domainMin,
  domainMax,
  viewTMin,
  viewTMax,
  lang,
  onApply,
  onFit,
  className,
}: Props) {
  const [draftS, setDraftS] = useState(String(viewTMin));
  const [draftE, setDraftE] = useState(String(viewTMax));
  const sFocus = useRef(false);
  const eFocus = useRef(false);
  const lastView = useRef({ viewTMin, viewTMax });
  const uid = useId();

  useEffect(() => {
    if (sFocus.current || eFocus.current) return;
    if (lastView.current.viewTMin === viewTMin && lastView.current.viewTMax === viewTMax) return;
    lastView.current = { viewTMin, viewTMax };
    setDraftS(String(viewTMin));
    setDraftE(String(viewTMax));
  }, [viewTMin, viewTMax]);

  const commit = useCallback(() => {
    const a = parseInt(draftS.trim(), 10);
    const b = parseInt(draftE.trim(), 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setDraftS(String(viewTMin));
      setDraftE(String(viewTMax));
      return;
    }
    const { tMin, tMax } = clampProlepticView(a, b, domainMin, domainMax);
    onApply(tMin, tMax);
    setDraftS(String(tMin));
    setDraftE(String(tMax));
  }, [draftS, draftE, domainMin, domainMax, onApply, viewTMin, viewTMax]);

  return (
    <div className={["min-w-0 w-full", className].filter(Boolean).join(" ")}>
      <p className="text-[9px] leading-relaxed text-muted-foreground/90 mb-2" dir="ltr">
        {tLang(
          "Proleptic calendar years. BCE as negative (e.g. -550 for 550 BCE). The range is restricted to the dataset and present year.",
          "سال‌های میلادی طلّایی؛ قبل از میلاد با منفی (مثال: ‎-550). محدوده فقط درون دامنه داده و سال حال است.",
          lang
        )}
      </p>
      <div className={TOOLBAR_ROW}>
        <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr" htmlFor={`dys-${uid}`}>
          <span className={FIELD_LABEL} id={`dys-l-${uid}`}>
            {tLang("Start year", "سال شروع", lang)}
          </span>
          <input
            id={`dys-${uid}`}
            name={`dys_start_${uid}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-labelledby={`dys-l-${uid}`}
            value={draftS}
            onChange={(e) => setDraftS(e.target.value)}
            onFocus={() => {
              sFocus.current = true;
            }}
            onBlur={() => {
              sFocus.current = false;
              commit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            className={CONTROL_INPUT}
          />
        </label>
        <label className="flex w-[5.5rem] shrink-0 flex-col" dir="ltr" htmlFor={`dye-${uid}`}>
          <span className={FIELD_LABEL} id={`dye-l-${uid}`}>
            {tLang("End year", "سال پایان", lang)}
          </span>
          <input
            id={`dye-${uid}`}
            name={`dys_end_${uid}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-labelledby={`dye-l-${uid}`}
            value={draftE}
            onChange={(e) => setDraftE(e.target.value)}
            onFocus={() => {
              eFocus.current = true;
            }}
            onBlur={() => {
              eFocus.current = false;
              commit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            className={CONTROL_INPUT}
          />
        </label>
        <div className="flex flex-col">
          <span className={FIELD_LABEL}>&nbsp;</span>
          <button
            type="button"
            className={FIT_BUTTON}
            onClick={onFit}
            title={tLang("Reset view to the full data span", "نمای کامل دامنهٔ داده", lang)}
          >
            {tLang("Full span", "همه", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
