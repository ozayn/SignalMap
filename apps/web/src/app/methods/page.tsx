import { SUPPORT_LINK_ARIA, supportMethodsCopy } from "@/lib/site-support";
import { resolveSignalMapSupportHref } from "@/lib/site-support-href";

/** Same as root layout: resolve support URL at request time (runtime env on Railway). */
export const dynamic = "force-dynamic";

export default function MethodsPage() {
  const supportHref = resolveSignalMapSupportHref();
  return (
    <div className="page-container">
      <h1>Methods</h1>
      <p className="page-subtitle">
        Exploratory-first methodology for longitudinal discourse analysis.
      </p>

      <section>
        <h2>Exploratory-first approach</h2>
        <p>
          SignalMap privileges discovery over hypothesis testing. The platform
          is designed to surface patterns, anomalies, and temporal shifts in
          public discourse before formal hypotheses are formulated. Analyses
          are structured to support open-ended exploration rather than
          confirmatory inference.
        </p>
      </section>

      <section>
        <h2>Data science workflow</h2>
        <p>
          SignalMap uses a lightweight exploratory data science workflow that
          keeps methods visible without turning the interface into a technical dashboard.
        </p>
        <ul className="max-w-[780px] list-disc space-y-2 pl-5 text-[15px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]">
          <li>
            <strong>Data sources:</strong> public statistical databases, market data,
            and archival snapshots with source notes attached to studies.
          </li>
          <li>
            <strong>Data cleaning:</strong> date normalization, unit checks, and schema
            harmonization across series before charting.
          </li>
          <li>
            <strong>Caching and reproducibility:</strong> versioned API routes, cached fetch
            windows, and deterministic transformations for stable reruns.
          </li>
          <li>
            <strong>Derived metrics:</strong> comparable indexes, real-vs-nominal adjustments,
            shares, spreads, and residual decompositions when meaningful.
          </li>
          <li>
            <strong>Missing-data handling:</strong> explicit gaps and omissions instead of
            silent interpolation when observations are unavailable.
          </li>
          <li>
            <strong>Visualization choices:</strong> minimal interactive charts, restrained
            annotations, and scale choices aligned with the data frequency.
          </li>
          <li>
            <strong>Interpretation limits:</strong> descriptive pattern reading over causal claims,
            with uncertainty and source limits treated as first-class context.
          </li>
        </ul>
      </section>

      <section>
        <h2>Time-window anchoring</h2>
        <p>
          All analyses are anchored to explicit time windows. Data are
          aggregated within defined intervals (e.g., days, weeks, or months)
          to produce longitudinal signals. Time boundaries are fixed at
          analysis outset to avoid post hoc window selection and reduce
          temporal confounding.
        </p>
      </section>

      <section>
        <h2>Signals</h2>
        <p>
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
        <p>
          Confidence and missing data are treated as first-class concerns.
          When extraction is uncertain or data are absent, values are omitted
          rather than imputed. Missing values are expected and do not imply
          failure; they reflect the inherent incompleteness of available
          sources. Analysis is conducted relative to events and time windows,
          not absolute values. The emphasis is on conditional change and
          comparative patterns rather than point estimates.
        </p>
        <p>
          Where relevant, exogenous macroeconomic signals (e.g., Brent crude oil price from FRED—Brent is a benchmark oil type traded on world markets) are used to contextualize discourse patterns.
          These signals are treated as external context, not as dependent
          variables, and are sourced from the Federal Reserve Economic Data
          (FRED) series DCOILBRENTEU.
        </p>
      </section>

      <section>
        <h2>Aggregation-only analysis</h2>
        <p>
          Individual-level profiling is explicitly avoided. All metrics are
          computed at aggregate levels (e.g., per time window, per topic,
          per hashtag cluster). No attempt is made to attribute sentiment,
          affiliation, or behavior to identifiable persons. The focus is on
          distributional and structural patterns rather than individual
          classification.
        </p>
      </section>

      <section>
        <h2>Multilingual text handling</h2>
        <p>
          Text is processed in a language-agnostic manner where possible.
          Sentiment and topic models are applied with awareness of
          multilingual contexts. No assumption is made that a single
          language or script dominates the corpus. Cross-lingual
          comparisons are treated with caution given known limitations of
          transfer and calibration.
        </p>
      </section>

      <section>
        <h2>Archival and contextual signals</h2>
        <p>
          Where available, archival sources (e.g., web archives, historical
          snapshots) are used to contextualize temporal patterns. These
          sources provide supplementary signals about the state of
          discourse at given points in time. Archived material is treated
          as a lens on historical context, not as a primary corpus for
          inference.
        </p>
      </section>

      <section>
        <h2>Limitations and uncertainty</h2>
        <p>
          Findings are preliminary and subject to revision. Sampling
          bias, platform-specific artifacts, and model limitations may
          affect results. No claim is made to external validity or
          generalizability beyond the defined corpus and time window.
          Uncertainty is reported where feasible; absence of uncertainty
          estimates does not imply certainty.
        </p>
      </section>

      <section lang="en">
        <h2>{supportMethodsCopy.title}</h2>
        <p>
          {supportMethodsCopy.body}{" "}
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            aria-label={SUPPORT_LINK_ARIA}
          >
            {supportMethodsCopy.linkText}
          </a>
        </p>
      </section>
    </div>
  );
}
