import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="mt-6 border-border/60 bg-muted/10 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          In simple terms
        </p>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed break-words min-w-0 [&>p]:mb-0 [&>ul]:mt-1 [&>ul]:list-inside [&>ul]:list-disc [&>li]:mb-0.5">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
