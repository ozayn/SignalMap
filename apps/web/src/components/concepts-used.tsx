"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getConcepts, type ConceptKey } from "@/lib/concepts";

type ConceptsUsedProps = {
  conceptKeys: ConceptKey[];
};

export function ConceptsUsed({ conceptKeys }: ConceptsUsedProps) {
  const [open, setOpen] = useState(false);
  const concepts = getConcepts(conceptKeys);
  if (concepts.length === 0) return null;

  return (
    <Card className="mt-3 border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Concepts used in this study
        </span>
        <span
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open && (
        <CardContent className="border-t border-border pt-4">
          <ul className="space-y-3">
            {concepts.map((c) => (
              <li key={c.title} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/90">{c.title}</span>
                {" — "}
                {c.description}
                {c.link && (
                  <>
                    {" "}
                    <a
                      href={c.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {c.link.label}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
