"use client";

import dynamic from "next/dynamic";

/** Client-only wrapper: `ssr: false` for dynamic() must live in a Client Component (not `page.tsx`). */
export const HomePreviewSectionLazy = dynamic(
  () =>
    import("@/components/home-preview-section").then((m) => ({
      default: m.HomePreviewSection,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto h-44 max-w-[960px] animate-pulse rounded-lg bg-muted/25 dark:bg-muted/15"
        aria-hidden
      />
    ),
  }
);
