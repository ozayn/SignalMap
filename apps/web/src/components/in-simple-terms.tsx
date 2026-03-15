type InSimpleTermsProps = {
  children: React.ReactNode;
};

/**
 * Plain-language explainer for study pages. Light styling, smaller text.
 * Use for intuition and meaning only—no jargon, no causal claims, no equations, no links.
 * Educational links belong in the "Concepts used in this study" section.
 */
export function InSimpleTerms({ children }: InSimpleTermsProps) {
  return (
    <div className="study-panel">
      <p className="snapshot-style-title mb-2">
        In simple terms
      </p>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed break-words min-w-0 [&>p]:mb-0 [&>ul]:mt-1 [&>ul]:list-inside [&>ul]:list-disc [&>li]:mb-0.5">
        {children}
      </div>
    </div>
  );
}
