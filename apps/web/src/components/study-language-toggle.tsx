"use client";

import type { StudyLocale } from "@/lib/iran-study-fa";

type StudyLanguageToggleProps = {
  locale: StudyLocale;
  onLocaleChange: (locale: StudyLocale) => void;
};

/** Compact EN/FA switch for Iran-related study pages. */
export function StudyLanguageToggle({ locale, onLocaleChange }: StudyLanguageToggleProps) {
  return (
    <div
      className="inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0"
      role="group"
      aria-label="Study language"
    >
      <button
        type="button"
        onClick={() => onLocaleChange("en")}
        className={`px-2.5 py-1.5 font-medium transition-colors ${
          locale === "en" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted/60"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onLocaleChange("fa")}
        className={`px-2.5 py-1.5 font-medium transition-colors ${
          locale === "fa" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted/60"
        }`}
      >
        FA
      </button>
    </div>
  );
}
