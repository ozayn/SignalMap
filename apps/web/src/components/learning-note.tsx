import { learningNoteTitle, localizeLearningSections } from "@/lib/iran-study-fa-learning-headings";

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
  /** When ``fa``, section headings (and matching main titles) use Persian; bullets stay English unless supplied in FA. */
  locale?: "en" | "fa";
};

export function LearningNote({
  title = "How to read this chart",
  sections,
  links = [],
  locale = "en",
}: LearningNoteProps) {
  const isFa = locale === "fa";
  const displayTitle = learningNoteTitle(isFa, title);
  const displaySections = localizeLearningSections(isFa, sections);
  return (
    <details className="study-interpretation">
      <summary>
        <span>{displayTitle}</span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body">
        <div className="flex flex-col gap-5 min-w-0">
          {displaySections.map((section) => (
            <div key={section.heading} className="space-y-2 min-w-0 break-words">
              <p className="text-sm font-medium text-muted-foreground">
                {section.heading}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                {section.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {links.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground break-words">
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
    </details>
  );
}
