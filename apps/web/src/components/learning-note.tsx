import { Card, CardContent } from "@/components/ui/card";

export type LearningNoteSection = {
  heading: string;
  bullets: string[];
};

export type LearningNoteLink = {
  label: string;
  href: string;
};

type LearningNoteProps = {
  title?: string;
  sections: LearningNoteSection[];
  links?: LearningNoteLink[];
};

export function LearningNote({
  title = "How to read this chart",
  sections,
  links = [],
}: LearningNoteProps) {
  return (
    <Card className="mt-3 border-border bg-muted/30 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="grid gap-4 md:grid-cols-2 min-w-0">
          {sections.map((section) => (
            <div key={section.heading} className="space-y-1.5 min-w-0 break-words">
              <p className="text-sm font-medium text-foreground/90">{section.heading}</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground break-words">
                {section.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {links.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground break-words">
            {links.map((link, i) => (
              <span key={link.href}>
                {i > 0 && " · "}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
