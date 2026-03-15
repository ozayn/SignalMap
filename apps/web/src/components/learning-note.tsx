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
    <div className="study-panel">
      <p className="snapshot-style-title mb-2">
        {title}
      </p>
        <div className="flex flex-col gap-6 min-w-0">
          {sections.map((section) => (
            <div key={section.heading} className="space-y-2 min-w-0 break-words">
              <p className="mt-3 text-sm font-medium text-muted-foreground">{section.heading}</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
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
    </div>
  );
}
