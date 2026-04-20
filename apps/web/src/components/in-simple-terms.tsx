type InSimpleTermsProps = {
  children: React.ReactNode;
  locale?: "en" | "fa";
};

/**
 * Plain-language explainer for study pages. Light styling, smaller text.
 * Use for intuition and meaning only—no jargon, no causal claims, no equations, no links.
 * Educational links belong in the "Concepts used in this study" section.
 */
export function InSimpleTerms({ children, locale = "en" }: InSimpleTermsProps) {
  const isFa = locale === "fa";
  const label = isFa ? "به زبان ساده" : "In simple terms";
  return (
    <details className="study-interpretation">
      <summary>
        <span>{label}</span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed break-words min-w-0 [&>p]:mb-0 [&>ul]:mt-1 [&>ul]:list-inside [&>ul]:list-disc [&>li]:mb-0.5">
          {children}
        </div>
      </div>
    </details>
  );
}
