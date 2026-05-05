import type { ReactNode } from "react";

type StudyAiInterpretationProps = {
  children: ReactNode;
  locale?: "en" | "fa";
};

/**
 * Collapsible, data-grounded narrative (MVP: deterministic summaries).
 * Default closed — same disclosure pattern as `InSimpleTerms`.
 */
export function StudyAiInterpretation({ children, locale = "en" }: StudyAiInterpretationProps) {
  const isFa = locale === "fa";
  const title = isFa ? "تفسیر با کمک هوش مصنوعی" : "AI-assisted interpretation";
  const subtitle = isFa
    ? "بر اساس سری‌های دیده‌شده و بازهٔ انتخاب‌شده تولید شده است؛ تفسیری است، نه علّی."
    : "Generated from the visible series and selected period. Interpretive, not causal.";

  return (
    <details className="study-interpretation">
      <summary>
        <span>{title}</span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body">
        <p className="text-xs text-muted-foreground leading-relaxed break-words min-w-0 mb-2">{subtitle}</p>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed break-words min-w-0 [&>p]:mb-0">
          {children}
        </div>
      </div>
    </details>
  );
}
