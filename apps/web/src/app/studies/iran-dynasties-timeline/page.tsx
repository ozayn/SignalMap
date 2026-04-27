"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IranDynastiesVerticalTimeline } from "@/components/iran-dynasties-vertical/iran-dynasties-vertical-timeline";
import { StudyLanguageToggle } from "@/components/study-language-toggle";
import { trackEvent } from "@/lib/analytics";
import { IRAN_VERTICAL_DYNASTIES } from "@/lib/iran-dynasties-vertical";
import { t, type StudyLocale, mergeIranStudyDisplay } from "@/lib/iran-study-fa";
import { getStudyById } from "@/lib/studies";
import { cn } from "@/lib/utils";

const study = getStudyById("iran-dynasties-timeline");

export default function IranDynastiesTimelinePage() {
  const [lang, setLang] = useState<StudyLocale>("en");

  useEffect(() => {
    trackEvent("study_viewed", { study_id: "iran-dynasties-timeline" });
  }, []);

  if (!study) {
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

  const display = mergeIranStudyDisplay(study, "iran-dynasties-timeline", lang === "fa");
  const descExtra = t(
    "Blocks are a curated subset for chart alignment; treat labels as period references, not exhaustive political history.",
    "نوارها زیرمجموعه‌ای گزینش‌شده برای همراستایی با نمودارند؛ برچسب‌ها را مرجع دوره بگیرید، نه تاریخ کامل و نه تفسیر علّی.",
    lang
  );

  return (
    <div
      className={cn(
        "study-page-container pb-10",
        lang === "fa" && "font-[family-name:Vazirmatn] study-page-fa"
      )}
    >
      <div
        className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between"
        dir={lang === "fa" ? "rtl" : "ltr"}
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
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground/80">{descExtra}</p>
        </div>
        <StudyLanguageToggle locale={lang} onLocaleChange={setLang} />
      </div>

      <IranDynastiesVerticalTimeline
        data={IRAN_VERTICAL_DYNASTIES}
        locale={lang}
        onLocaleChange={setLang}
        showLanguageToggle={false}
        embedInStudyPage
        className="py-0 px-0"
      />
    </div>
  );
}
