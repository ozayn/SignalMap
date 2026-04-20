"use client";

import { useState } from "react";
import type { ConceptKey } from "@/lib/concepts";
import { getLocalizedConcept } from "@/lib/concepts-fa";

type ConceptsUsedProps = {
  conceptKeys: ConceptKey[];
  locale?: "en" | "fa";
};

export function ConceptsUsed({ conceptKeys, locale = "en" }: ConceptsUsedProps) {
  const [open, setOpen] = useState(false);
  const isFa = locale === "fa";
  const concepts = conceptKeys.map((k) => getLocalizedConcept(k, isFa));
  if (concepts.length === 0) return null;

  return (
    <div className="mt-[0.875rem] rounded-lg border border-border/55 bg-muted/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left rounded-lg px-[0.55rem] py-[0.55rem] text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span>{isFa ? "مفاهیم به‌کاررفته در این مطالعه" : "Concepts used in this study"}</span>
        <span
          className={`study-interpretation-chevron text-[0.6rem] opacity-55 transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-border/45 px-[0.85rem] pb-3 pt-2 sm:px-4">
          <ul className="space-y-3 break-words min-w-0">
            {conceptKeys.map((key) => {
              const c = getLocalizedConcept(key, isFa);
              return (
              <li key={key} className="text-sm text-muted-foreground space-y-1">
                <span className="font-medium text-foreground/90">{c.title}</span>
                {" — "}
                {c.description}
                {c.inSimpleTerms && (
                  <p className="mt-1.5 pl-3 border-l-2 border-muted-foreground/30 italic text-muted-foreground/90">
                    {isFa ? "به زبان ساده: " : "In simple terms: "}
                    {c.inSimpleTerms}
                  </p>
                )}
                {c.links && c.links.length > 0 && (
                  <span className="mt-1 block">
                    {c.links.map((link) => (
                      <span key={link.href} className="mr-3">
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {link.type === "video" ? `▶ Video: ${link.label}` : link.label}
                        </a>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
