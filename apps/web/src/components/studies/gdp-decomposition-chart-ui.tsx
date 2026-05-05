"use client";

/** Muted loading placeholder sized like a study chart card. */
export function GdpDecompositionChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={[
        "rounded-md border border-border/50 bg-muted/15",
        "h-56 w-full overflow-hidden md:h-64",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-muted/45 via-muted/10 to-muted/45" />
    </div>
  );
}
