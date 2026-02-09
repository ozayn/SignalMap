export default function MethodsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Methods
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exploratory-first methodology for longitudinal discourse analysis.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Exploratory-first approach
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          SignalMap privileges discovery over hypothesis testing. The platform
          is designed to surface patterns, anomalies, and temporal shifts in
          public discourse before formal hypotheses are formulated. Analyses
          are structured to support open-ended exploration rather than
          confirmatory inference.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Time-window anchoring
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          All analyses are anchored to explicit time windows. Data are
          aggregated within defined intervals (e.g., days, weeks, or months)
          to produce longitudinal signals. Time boundaries are fixed at
          analysis outset to avoid post hoc window selection and reduce
          temporal confounding.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Signals
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          In SignalMap, a signal is a time-varying measurement derived from
          observable data. Examples include subscriber counts (from archival
          sources or platform APIs), follower counts, sentiment scores, and
          hashtag frequency. Signals are not ground truth; they are
          platform-dependent, sparsely sampled, and subject to measurement
          error.
          Different platforms expose different metrics at different
          granularities, and archival coverage is uneven across time and
          source.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Confidence and missing data are treated as first-class concerns.
          When extraction is uncertain or data are absent, values are omitted
          rather than imputed. Missing values are expected and do not imply
          failure; they reflect the inherent incompleteness of available
          sources. Analysis is conducted relative to events and time windows,
          not absolute values. The emphasis is on conditional change and
          comparative patterns rather than point estimates.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Aggregation-only analysis
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Individual-level profiling is explicitly avoided. All metrics are
          computed at aggregate levels (e.g., per time window, per topic,
          per hashtag cluster). No attempt is made to attribute sentiment,
          affiliation, or behavior to identifiable persons. The focus is on
          distributional and structural patterns rather than individual
          classification.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Multilingual text handling
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Text is processed in a language-agnostic manner where possible.
          Sentiment and topic models are applied with awareness of
          multilingual contexts. No assumption is made that a single
          language or script dominates the corpus. Cross-lingual
          comparisons are treated with caution given known limitations of
          transfer and calibration.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Archival and contextual signals
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Where available, archival sources (e.g., web archives, historical
          snapshots) are used to contextualize temporal patterns. These
          sources provide supplementary signals about the state of
          discourse at given points in time. Archived material is treated
          as a lens on historical context, not as a primary corpus for
          inference.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Limitations and uncertainty
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Findings are preliminary and subject to revision. Sampling
          bias, platform-specific artifacts, and model limitations may
          affect results. No claim is made to external validity or
          generalizability beyond the defined corpus and time window.
          Uncertainty is reported where feasible; absence of uncertainty
          estimates does not imply certainty.
        </p>
      </section>
    </div>
  );
}
