import Link from "next/link";

/**
 * Development / internal hub for timeline experiments (dots study vs band swimlane).
 */
export default function TimelinePreviewPage() {
  return (
    <div className="mx-auto min-h-[50vh] max-w-2xl px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Timeline preview</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a visualization. The “dots” view is the same interactive timeline as the public study; the “bands” view
        is a swimlane / world-history style layout for long spans and point markers.
      </p>
      <ul className="mt-8 space-y-3 text-sm">
        <li>
          <Link
            href="/studies/timeline-global-events"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Event dots (study) →
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Narrative markers, layer filters, same data as the study page.</p>
        </li>
        <li>
          <Link href="/timeline-preview/bands" className="font-medium text-primary underline-offset-4 hover:underline">
            Band swimlane →
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Horizontal bands for periods, compact markers for points; zoom and pan on time.</p>
        </li>
      </ul>
    </div>
  );
}
