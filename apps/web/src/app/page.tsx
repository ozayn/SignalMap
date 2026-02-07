import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 space-y-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          SignalMap
        </h1>
        <p className="text-lg text-muted-foreground">
          Longitudinal studies of emotion, language, and interaction in public discourse.
        </p>
      </div>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>
          SignalMap privileges discovery over hypothesis testing. The platform
          supports exploratory studies first, surfacing patterns and temporal
          shifts in public discourse before formal hypotheses are formulated.
        </p>
        <p>
          All analyses are anchored to explicit time windows. Data are aggregated
          within fixed intervals to produce longitudinal signals, reducing
          temporal confounding and post hoc window selection.
        </p>
        <p>
          Individual-level profiling is avoided. Metrics are computed at
          aggregate levels only—per time window, per topic, per hashtag
          cluster—with no attribution to identifiable persons.
        </p>
      </div>

      <div>
        <Link
          href="/studies"
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-4 py-2 inline-block transition"
        >
          Browse Studies
        </Link>
      </div>
    </div>
  );
}
