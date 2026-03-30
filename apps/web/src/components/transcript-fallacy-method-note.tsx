"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  FALLACY_METHOD_SHORT_NOTES,
  type FallacyMethodKey,
} from "@/lib/transcript-fallacy-methods";

type TranscriptFallacyMethodNoteProps = {
  method: FallacyMethodKey;
  /** Link to Learning section (default: anchor on /learning). */
  learnMoreHref?: string;
  className?: string;
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Short educational note for the selected fallacy method.
 * Collapsed row is a light toggle; expanded body uses `study-panel` for LearningNote-adjacent styling.
 */
export function TranscriptFallacyMethodNote({
  method,
  learnMoreHref = "/learning#transcript-fallacy-analysis",
  className,
}: TranscriptFallacyMethodNoteProps) {
  const resolved: FallacyMethodKey = method === "classifier" ? "heuristic" : method;
  const note = FALLACY_METHOD_SHORT_NOTES[resolved];
  const [open, setOpen] = useState(false);
  const uid = useId();
  const bodyId = `transcript-fallacy-method-note-body-${uid}`;
  const toggleId = `transcript-fallacy-method-note-toggle-${uid}`;

  return (
    <div className={cn("mt-3 text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        id={toggleId}
        className={cn(
          "group flex w-full min-w-0 items-center gap-2 rounded-lg border border-border/25 bg-muted/10 px-2.5 py-1.5 text-left",
          "dark:border-border/20 dark:bg-muted/[0.08]",
          "transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "motion-reduce:transition-none"
        )}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">
          <span className="font-semibold text-muted-foreground/90">About this method</span>
          <span className="text-muted-foreground/80"> — </span>
          <span className="font-semibold text-foreground/90">{note.title}</span>
        </span>
        <ChevronIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 ease-out group-hover:text-muted-foreground",
            open && "rotate-180",
            "motion-reduce:transition-none"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div
            id={bodyId}
            role="region"
            aria-labelledby={toggleId}
            aria-hidden={!open}
            className={cn("study-panel !mt-2", !open && "pointer-events-none")}
          >
            <p className="mb-2 text-[13px] font-medium text-foreground/90">{note.title}</p>
            <ul className="list-inside list-disc space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {note.bullets.map((line, i) => (
                <li key={i} className="break-words pl-0.5 marker:text-muted-foreground/80">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              <Link
                href={learnMoreHref}
                className="underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Learn more in Learning
              </Link>
              {" — "}longer notes on each method, limitations, and comparing results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
