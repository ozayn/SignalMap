import { Card, CardContent } from "@/components/ui/card";

type InSimpleTermsProps = {
  children: React.ReactNode;
  /** Optional link to an educational video or resource. Renders as a small subsection at the bottom. */
  learnMore?: { label: string; url: string };
};

/**
 * Plain-language explainer for study pages. Light styling, smaller text.
 * Use for intuition and meaning—no jargon, no causal claims, no equations.
 */
export function InSimpleTerms({ children, learnMore }: InSimpleTermsProps) {
  return (
    <Card className="mt-6 border-border/60 bg-muted/10 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          In simple terms
        </p>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed break-words min-w-0 [&>p]:mb-0 [&>ul]:mt-1 [&>ul]:list-inside [&>ul]:list-disc [&>li]:mb-0.5">
          {children}
        </div>
        {learnMore && (
          <p className="mt-4 pt-3 border-t border-border/40 text-sm text-muted-foreground">
            <a
              href={learnMore.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              ▶ Short video: {learnMore.label}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
