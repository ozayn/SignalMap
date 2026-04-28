"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StudyLanguageToggle } from "@/components/study-language-toggle";
import { StudyYearDisplayToggle } from "@/components/study-year-display-toggle";
import { SignalMapBandTimeline } from "@/components/signalmap-band-timeline";
import { trackEvent } from "@/lib/analytics";
import { L, mergeIranStudyDisplay, t, type StudyLocale } from "@/lib/iran-study-fa";
import { getStudyById, isStudyListedForDeployment } from "@/lib/studies";
import {
  COMPARATIVE_HISTORY_BAND,
  COMPARATIVE_HISTORY_LANE_ORDER,
  COMPARATIVE_HISTORY_LAYER_UI,
} from "@/lib/signalmap-band-timeline";
import { useIranStudyChartYearMode } from "@/hooks/use-iran-study-chart-year-mode";
import { cn } from "@/lib/utils";

const study = getStudyById("comparative-history-timeline");
const studyId = "comparative-history-timeline" as const;

export default function ComparativeHistoryTimelinePage() {
  const [lang, setLang] = useState<StudyLocale>("en");
  const { yearAxisMode, setYearAxisMode } = useIranStudyChartYearMode();
  const [showAllImportance, setShowAllImportance] = useState(false);
  const isFa = lang === "fa";
  const chartYearAxis = yearAxisMode;

  useEffect(() => {
    if (study && isStudyListedForDeployment(study)) {
      trackEvent("study_viewed", { study_id: studyId });
    }
  }, [study]);

  if (!study || !isStudyListedForDeployment(study)) {
    return (
      <div className="study-page-container py-12 text-muted-foreground">
        <p>Study not found.</p>
        <Link
          href="/studies"
          className="mt-4 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:text-foreground"
        >
          Back to studies
        </Link>
      </div>
    );
  }

  const display = mergeIranStudyDisplay(study, studyId, isFa);

  return (
    <div
      className={cn(
        "study-page-container pb-10",
        isFa && "font-[family-name:Vazirmatn] study-page-fa"
      )}
    >
      <div
        className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="space-y-2">
          <Link
            href="/studies"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("Back to studies", "بازگشت به مطالعات", lang)}
          </Link>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground md:text-3xl">
            {display.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground/95">{display.description}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StudyLanguageToggle locale={lang} onLocaleChange={setLang} />
            <span className="inline-flex flex-wrap items-center gap-1.5 border-s border-border/60 ps-3 text-xs text-muted-foreground">
              <span className="shrink-0 whitespace-nowrap">{L(isFa, "Year axis:", "محور سال:")}</span>
              <StudyYearDisplayToggle size="compact" isFa={isFa} value={yearAxisMode} onChange={setYearAxisMode} />
            </span>
          </div>
        </div>
      </div>

      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground/90">
        {t(
          "Five swimlanes: Iran, France, the UK, the U.S., and world-scale cultural/political eras. Dates are schematic. Use year range, Fit all, layer toggles, and zoom. Hover a band for dates and a short blurb; click to open the detail card.",
          "پنج لایه: ایران، فرانسه، بریتانیا، ایالات متحده و دوره‌های اصلی سیاسی/فکری جهان. سال‌ها نمادین‌اند. از «شروع/پایان سال» و «نمایش همه» و لایه‌ها و بزرگ‌نمایی استفاده کنید. روی باند هاور بزنید (تاریخ + توضیح کوتاه) و برای کارت، کلیک کنید.",
          lang
        )}
      </p>
      <div className="mb-2 flex max-w-2xl flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <input
          id="comparative-band-all-importance"
          type="checkbox"
          className="h-3.5 w-3.5 rounded border border-border"
          checked={showAllImportance}
          onChange={(e) => setShowAllImportance(e.target.checked)}
        />
        <label htmlFor="comparative-band-all-importance" className="cursor-pointer select-none leading-snug">
          {t(
            "Show more context bands at the current zoom (incl. minor importance).",
            "نمایش باندهای بیشتر در همین زوم (شامل اهمیت پایین‌تر).",
            lang
          )}
        </label>
      </div>

      <SignalMapBandTimeline
        className="min-w-0"
        events={COMPARATIVE_HISTORY_BAND}
        laneOrder={COMPARATIVE_HISTORY_LANE_ORDER}
        layerUi={COMPARATIVE_HISTORY_LAYER_UI}
        timeRange={study.timeRange}
        locale={lang}
        xAxisYearLabel={chartYearAxis}
        importanceDetail={showAllImportance ? "all" : "default"}
        initialZoom={1}
        syncYearRangeToUrl
        onEventClick={(e) => trackEvent("band_timeline_event_click", { study_id: studyId, event_id: e.id, kind: e.kind })}
      />
    </div>
  );
}
