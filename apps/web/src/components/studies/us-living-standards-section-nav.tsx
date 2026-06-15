"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const US_LIVING_STANDARDS_SECTIONS = [
  { id: "income", label: "Income" },
  { id: "housing", label: "Housing" },
  { id: "higher-education", label: "Higher education" },
  { id: "healthcare", label: "Healthcare" },
  { id: "transportation", label: "Transportation" },
  { id: "family-formation", label: "Family" },
  { id: "hours-of-work", label: "Hours of work" },
] as const;

export type UsLivingStandardsSectionId = (typeof US_LIVING_STANDARDS_SECTIONS)[number]["id"];

/** Offset anchored sections below the sticky section nav. */
export const US_LS_SECTION_ANCHOR_CLASS = "scroll-mt-14";

function isSectionId(value: string): value is UsLivingStandardsSectionId {
  return US_LIVING_STANDARDS_SECTIONS.some((section) => section.id === value);
}

type UsLivingStandardsSectionNavProps = {
  /** When false, hash sync and scroll-spy wait until chart sections are mounted. */
  sectionsReady?: boolean;
};

export function UsLivingStandardsSectionNav({ sectionsReady = false }: UsLivingStandardsSectionNavProps) {
  const [activeId, setActiveId] = useState<UsLivingStandardsSectionId | null>(null);

  const scrollToSection = useCallback((id: UsLivingStandardsSectionId) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const nextHash = `#${id}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    setActiveId(id);
  }, []);

  useEffect(() => {
    if (!sectionsReady) return;

    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!isSectionId(hash)) return;
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(hash);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [sectionsReady]);

  useEffect(() => {
    if (!sectionsReady) return;

    const sectionEls = US_LIVING_STANDARDS_SECTIONS.map((section) =>
      document.getElementById(section.id)
    ).filter((el): el is HTMLElement => el != null);
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top && isSectionId(top)) {
          setActiveId(top);
        }
      },
      { rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.5] }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionsReady]);

  return (
    <nav
      aria-label="Study sections"
      className="sticky top-0 z-10 border-y border-border/60 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="flex flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {US_LIVING_STANDARDS_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => {
              event.preventDefault();
              if (sectionsReady) {
                scrollToSection(section.id);
              }
            }}
            aria-current={activeId === section.id ? "true" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] leading-snug transition-colors",
              activeId === section.id
                ? "border-border bg-muted/70 text-foreground"
                : "border-transparent bg-muted/25 text-muted-foreground hover:border-border/60 hover:text-foreground"
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
