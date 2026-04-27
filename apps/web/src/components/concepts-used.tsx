"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StudyConceptId } from "@/lib/signalmap-concepts";
import { resolveStudyConcepts, type ResolvedStudyConcept } from "@/lib/signalmap-concepts";

type ConceptsUsedProps = {
  conceptKeys: readonly StudyConceptId[];
  locale?: "en" | "fa";
};

function ConceptDetail({ c, isFa }: { c: ResolvedStudyConcept; isFa: boolean }) {
  return (
    <div className="min-w-0 space-y-2.5 text-[0.8125rem]">
      <p className="leading-relaxed text-muted-foreground text-pretty">{c.short}</p>
      {c.example?.trim() ? (
        <div
          className="rounded-md border border-border/40 bg-muted/15 px-2.5 py-2"
          dir={isFa ? "rtl" : "ltr"}
        >
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/85">
            {isFa ? "نمونه" : "Example"}
          </p>
          <p className="mt-1 leading-relaxed text-foreground/90 text-pretty">{c.example}</p>
        </div>
      ) : null}
      {c.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1" aria-hidden>
          {c.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-muted/50 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground/90"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {c.links && c.links.length > 0 ? (
        <ul className="list-none space-y-1.5 pl-0">
          {c.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                dir="ltr"
              >
                {link.type === "video" ? (isFa ? "▶ ویدیو: " : "▶ Video: ") : ""}
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ConceptsUsed({ conceptKeys, locale = "en" }: ConceptsUsedProps) {
  const isFa = locale === "fa";
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const concepts = resolveStudyConcepts(
    Array.isArray(conceptKeys) ? conceptKeys : [],
    isFa
  );
  if (concepts.length === 0) return null;

  const expanded = expandedId ? concepts.find((c) => c.id === expandedId) ?? null : null;

  return (
    <div
      className="mt-[0.875rem] overflow-hidden rounded-lg border border-border/55 bg-muted/10"
      dir={isFa ? "rtl" : "ltr"}
    >
      <button
        type="button"
        onClick={() => setSectionOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-[0.55rem] py-[0.55rem] text-left text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        aria-expanded={sectionOpen}
      >
        <span>{isFa ? "مفاهیم به‌کاررفته در این مطالعه" : "Concepts used in this study"}</span>
        <span
          className={cn(
            "study-interpretation-chevron text-[0.6rem] opacity-55 transition-transform",
            sectionOpen ? "rotate-180" : isFa ? "rotate-90" : "-rotate-90"
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {sectionOpen && (
        <div className="space-y-3 border-t border-border/45 px-[0.75rem] pb-3 pt-2.5 sm:px-3.5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={isFa ? "مفاهیم" : "Concepts"}>
            {concepts.map((c) => {
              const active = expandedId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setExpandedId((x) => (x === c.id ? null : c.id));
                  }}
                  className={cn(
                    "max-w-full rounded-full border px-2.5 py-1 text-left text-[0.75rem] font-medium leading-snug transition-colors",
                    active
                      ? "border-foreground/25 bg-muted/50 text-foreground"
                      : "border-border/60 bg-background/30 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
          {expanded ? (
            <div
              className="rounded-md border border-border/35 bg-background/40 px-2.5 py-2.5"
              role="tabpanel"
            >
              <p className="mb-2 text-[0.8rem] font-semibold text-foreground">{expanded.title}</p>
              <ConceptDetail c={expanded} isFa={isFa} />
            </div>
          ) : (
            <p className="text-[0.7rem] text-muted-foreground/80">
              {isFa
                ? "یک مفهوم را برای دیدن تعریف و نمونه بزنید."
                : "Select a term to read the definition and example."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
