"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  STRUCTURED_INDUSTRIAL_TOPICS,
  type LearningStructuredBlock,
} from "@/lib/learning-structured-topics";
import { getStudyById } from "@/lib/studies";
import { TRANSCRIPT_FALLACY_LEARNING_CONCEPTS } from "@/lib/transcript-fallacy-methods";

type LearnMoreLink = { label: string; url: string; type?: "video" | "article" };

type Concept = {
  title: string;
  /** One plain sentence at the top of the topic (optional only while migrating). */
  quickDefinition?: string;
  /** Stable fragment for deep links, e.g. /learning#import-substitution-industrialization */
  id?: string;
  description?: string;
  structured?: LearningStructuredBlock;
  learnMore?: LearnMoreLink[];
};

const INDUSTRIAL_POLICY_CONCEPTS: Concept[] = STRUCTURED_INDUSTRIAL_TOPICS.map((t) => ({
  id: t.id,
  title: t.title,
  structured: t.structured,
  learnMore: t.learnMore,
}));

/**
 * Learning topics aligned with SignalMap studies (`STUDIES` concepts and chart copy).
 * Sections are thematic; order moves from macro definitions → lived standards → oil/FX → how to read charts → caveats.
 */
const CONCEPTS: Record<string, Concept[]> = {
  "Macro & national accounts": [
    {
      title: "Nominal vs real values",
      quickDefinition: "Nominal is today’s price tag; real adjusts for inflation so you can compare buying power over time.",
      description:
        "Nominal values are recorded in current money units (e.g. current US dollars). Real values adjust for inflation so you can compare purchasing power across years. SignalMap uses both: nominal for market prices, real or indexed series where studies need long-run comparability.",
      learnMore: [
        { label: "Real and nominal value (Wikipedia)", url: "https://en.wikipedia.org/wiki/Real_and_nominal_value" },
        { label: "Real GDP and nominal GDP (Khan Academy)", url: "https://www.youtube.com/watch?v=lBDT2w5Wl84", type: "video" },
      ],
    },
    {
      title: "Gross domestic product (GDP)",
      quickDefinition: "The total value of finished goods and services the economy produced in a period.",
      description:
        "GDP is the total value of finished goods and services produced in an economy over a period. Studies use it as context for size (levels) and for composition (consumption, investment, oil rents) as shares of GDP.",
      learnMore: [{ label: "GDP (Wikipedia)", url: "https://en.wikipedia.org/wiki/Gross_domestic_product" }],
    },
    {
      title: "Comparing GDP across countries",
      quickDefinition: "Dollar totals mix size, prices, and exchange rates, so indexed lines help compare growth shapes.",
      description:
        "Total GDP in dollars mixes real output, prices, and exchange rates, and larger populations mechanically raise many totals. Indexed charts (base year = 100) make relative growth easier to read on one axis; they do not replace per-capita or welfare measures when you care about living standards.",
      learnMore: [{ label: "GDP (Wikipedia)", url: "https://en.wikipedia.org/wiki/Gross_domestic_product" }],
    },
    {
      title: "Consumption and investment (shares of GDP)",
      quickDefinition: "Consumption is spending on goods and services; investment is spending that builds future capacity.",
      description:
        "Final consumption is spending by households and government on goods and services. Gross capital formation is investment in capacity (equipment, construction, inventories). Charts that show each as a percent of GDP describe how the economy is split—not dollar size on the same scale as GDP in levels view.",
      learnMore: [
        { label: "Gross capital formation (Wikipedia)", url: "https://en.wikipedia.org/wiki/Gross_fixed_capital_formation" },
      ],
    },
    {
      title: "GDP levels: nominal, real, indexed, and currency views",
      quickDefinition: "Levels can be in today’s dollars, inflation-adjusted dollars, or rescaled to an index for comparison.",
      description:
        "Level charts can show current US dollars, constant-price (real) dollars, or illustrative conversions (e.g. toman using open-market FX). Indexed charts rescale each series to 100 in a base year so different units can be compared for relative change—not for reading absolute dollars on one axis.",
      learnMore: [
        { label: "Index (economics) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Index_(economics)" },
        { label: "Index charts: making time series comparable", url: "https://www.youtube.com/watch?v=qs7h19vaqQc", type: "video" },
      ],
    },
    {
      title: "Structural breaks (descriptive)",
      quickDefinition: "A visible kink in a line is a change in pattern—not automatic proof that one event caused it.",
      description:
        "A structural break is a time when a series visibly changes level or trend. On SignalMap, breaks are discussed descriptively alongside events—they are not automatic statistical tests and do not prove that an event caused the change.",
    },
  ],
  "Living standards & inequality": [
    {
      title: "Gini coefficient",
      quickDefinition: "One number summarizing how spread out incomes are—higher means more unequal.",
      description:
        "The Gini summarizes how unequal a distribution is (often income), on a 0–100 scale. Higher means more concentration; lower means more equality. Cross-country charts use the same statistical definition so lines are comparable, but definitions and surveys still differ from lived experience.",
      learnMore: [{ label: "Gini coefficient (Wikipedia)", url: "https://en.wikipedia.org/wiki/Gini_coefficient" }],
    },
    {
      title: "CPI inflation (year-on-year)",
      quickDefinition: "How much average consumer prices changed compared with the same time last year.",
      description:
        "Consumer price index (CPI) inflation as “percent change from a year ago” compares this month or year to the same period last year. It is a standard way to read how fast average consumer prices are rising.",
      learnMore: [
        { label: "Consumer price index (Wikipedia)", url: "https://en.wikipedia.org/wiki/Consumer_price_index" },
        { label: "CPI index (Khan Academy)", url: "https://www.youtube.com/watch?v=pRIELoITIHI", type: "video" },
      ],
    },
    {
      title: "Poverty headcount ratio",
      quickDefinition: "The share of people below an international poverty line in survey-based estimates.",
      description:
        "The poverty headcount is the share of the population below an international poverty line defined by the World Bank. Different indicators use different thresholds (e.g. lower-middle-income line vs. a fixed line); they are not additive and are not the same as national poverty statistics.",
      learnMore: [{ label: "Poverty threshold (Wikipedia)", url: "https://en.wikipedia.org/wiki/Poverty_threshold" }],
    },
    {
      title: "Purchasing power, real wages, and nominal wages",
      quickDefinition: "Real wages show whether a paycheck buys more or less after accounting for inflation.",
      description:
        "Nominal wages are the statutory or reported pay in current currency. Real wages adjust for inflation (e.g. with CPI) so you can see whether pay buys more or less over time. That is the same “purchasing power” idea as real prices, applied to labor income.",
      learnMore: [{ label: "Real wages (Wikipedia)", url: "https://en.wikipedia.org/wiki/Real_wages" }],
    },
  ],
  "Oil, commodities & trade": [
    {
      title: "What oil prices represent",
      quickDefinition: "Benchmark crude prices reflect stress in world energy markets, not one single cause.",
      description:
        "Oil prices are benchmarks for crude sold on world markets. They signal energy costs and broader stress; SignalMap uses them as context series, not as proof of any single cause.",
      learnMore: [
        { label: "Price of oil (Wikipedia)", url: "https://en.wikipedia.org/wiki/Price_of_oil" },
        { label: "Supply and demand in the global oil market", url: "https://www.youtube.com/watch?v=9eMo_UGOLZk", type: "video" },
      ],
    },
    {
      title: "Brent vs WTI",
      quickDefinition: "Two main oil benchmarks; SignalMap usually uses Brent for international context.",
      description:
        "Brent and West Texas Intermediate (WTI) are two benchmark crudes. Brent is common for international pricing; WTI is a US benchmark. SignalMap’s oil studies use Brent unless noted otherwise.",
      learnMore: [{ label: "Brent Crude (Wikipedia)", url: "https://en.wikipedia.org/wiki/Brent_Crude" }],
    },
    {
      title: "USD per barrel",
      quickDefinition: "The price of one standard barrel of oil in US dollars.",
      description:
        "USD/bbl is the price of one barrel of oil in US dollars. A barrel is about 159 litres—the standard unit for crude quotes.",
      learnMore: [{ label: "Barrel (unit) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Barrel_(unit)" }],
    },
    {
      title: "Real oil prices",
      quickDefinition: "Oil prices adjusted for inflation so old prices are not misleadingly “cheap.”",
      description:
        "Real oil adjusts nominal crude prices for inflation (e.g. with CPI) so long-run burden can be compared across decades. Nominal prices from the past look “cheap” in dollars; real prices show whether oil was relatively expensive in purchasing-power terms.",
      learnMore: [{ label: "Real price (Wikipedia)", url: "https://en.wikipedia.org/wiki/Real_price" }],
    },
    {
      title: "Gold alongside oil (long-range context)",
      quickDefinition: "Gold is a second long-run stress line next to oil, not one combined score.",
      description:
        "Gold (USD/oz) appears with oil in century-scale charts as a second stress indicator. Axes and frequencies differ from oil; use the pair for broad historical context, not as a single combined index.",
      learnMore: [{ label: "Gold as an investment (Wikipedia)", url: "https://en.wikipedia.org/wiki/Gold_as_an_investment" }],
    },
    {
      title: "Oil price shock markers",
      quickDefinition: "Flags unusually large day-to-day oil moves compared with recent swings.",
      description:
        "Some charts flag days when the daily oil return is large compared to recent volatility—a simple “unusual move” filter for reading the series, not a full list of causes.",
    },
    {
      title: "Purchasing power parity (PPP) and oil burden",
      quickDefinition: "Uses what money buys at home so oil cost can be compared fairly across countries.",
      description:
        "PPP converts currencies using what money buys domestically, not only market exchange rates. PPP-based “oil burden” studies multiply a world oil price by a PPP factor so the cost of a barrel is expressed in local purchasing power—useful for comparing Iran and Turkey with the same construction.",
      learnMore: [
        { label: "Purchasing power parity (Wikipedia)", url: "https://en.wikipedia.org/wiki/Purchasing_power_parity" },
        { label: "Purchasing Power Parity Explained", url: "https://www.youtube.com/watch?v=e9Wf7TqJMkU", type: "video" },
      ],
    },
    {
      title: "Oil rents, production, and exports",
      quickDefinition: "Rents are income share, production is barrels out, exports are barrels sold abroad—three different ideas.",
      description:
        "Oil rents are resource income measured as a share of GDP in national accounts. Production is how much crude is extracted (often in barrels per day). Exports are what is sold abroad—they can be far below production when domestic use or constraints bind. Studies separate these ideas on purpose.",
      learnMore: [{ label: "EIA Iran analysis", url: "https://www.eia.gov/international/analysis/country/IRN" }],
    },
    {
      title: "Price vs quantity constraints",
      quickDefinition: "High world price does not mean more oil can leave if ports or rules cap volume.",
      description:
        "A high world price does not mean a country can sell more crude. Sanctions, logistics, or quotas hit volumes. SignalMap’s export-capacity view combines price and estimated volume as a descriptive proxy—not realized government revenue.",
      learnMore: [{ label: "Do Sanctions Work? (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA", type: "video" }],
    },
    {
      title: "Resource dependence and volatile revenues",
      quickDefinition: "Relying heavily on one export makes income jumpy when that market moves.",
      description:
        "Heavy reliance on one commodity for exports or budget revenue makes growth and public finance sensitive to price swings. That volatility is a reason charts combine prices with volumes or wider macro panels—not a verdict on policy by itself.",
      learnMore: [{ label: "Resource curse (Wikipedia)", url: "https://en.wikipedia.org/wiki/Resource_curse" }],
    },
    {
      title: "Trade networks and export dependence",
      quickDefinition: "A map of who ships oil to whom—thick lines mean more flow, not who “wins.”",
      description:
        "Network charts show who trades crude with whom: nodes are countries, links are flows. They help visualize concentration and dependence; they do not rank “power” or predict crises on their own.",
    },
  ],
  "Industrial policy & resource shifts": INDUSTRIAL_POLICY_CONCEPTS,
  "Exchange rates & inflation": [
    {
      title: "Official vs open-market exchange rates",
      quickDefinition: "Many places have an official rate and a street rate people actually pay.",
      description:
        "Many economies report an official or policy-influenced rate while people trade at a market rate. SignalMap plots both where data allow so you can see the wedge—not to pick which rate is “true,” but to show that multiple prices can coexist.",
      learnMore: [{ label: "Exchange rate (Wikipedia)", url: "https://en.wikipedia.org/wiki/Exchange_rate" }],
    },
    {
      title: "FX spread (percent gap)",
      quickDefinition: "The percent gap between two rates—how wide the wedge is at a moment.",
      description:
        "A spread is a derived percentage gap between two rates, e.g. (open − official) ÷ official. It summarizes how wide the wedge is at a point in time; it is descriptive and sensitive to definitions of each series.",
    },
    {
      title: "Capital controls and parallel markets",
      quickDefinition: "Rules that limit money crossing borders often sit next to a wider unofficial exchange rate.",
      description:
        "Capital controls limit money moving across borders; they often accompany gaps between official and market FX. Parallel or informal markets reflect what people pay when formal channels are tight—measurements rarely capture every transaction.",
      learnMore: [{ label: "Capital control (Wikipedia)", url: "https://en.wikipedia.org/wiki/Capital_control" }],
    },
    {
      title: "Inflation and the exchange rate",
      quickDefinition: "Inflation is local price pressure; the exchange rate is how currency trades abroad.",
      description:
        "High inflation erodes domestic purchasing power; the exchange rate shows how local currency trades against others. Studies use CPI, FX, and spreads as separate lenses—each has limits and none alone explains the whole economy.",
      learnMore: [{ label: "Inflation (Wikipedia)", url: "https://en.wikipedia.org/wiki/Inflation" }],
    },
  ],
  "Charts & interpretation": [
    {
      title: "Dual-axis charts",
      quickDefinition: "Two different scales share one timeline for timing, not for comparing raw numbers left to right.",
      description:
        "When two series use different y-axes (e.g. oil on the left, FX on the right), the chart shows timing and co-movement. You should not compare the left numbers directly to the right numbers or infer one caused the other without separate evidence.",
    },
    {
      title: "Indexed series and cross-country comparison",
      quickDefinition: "Rescale series to 100 in a base year to compare shape, not the original units.",
      description:
        "Indexing sets a base period to 100 so series with different units can be compared for relative change. Good for “Iran vs Turkey” burden charts; you lose absolute levels on the same scale—read the study notes for what the base year means.",
      learnMore: [{ label: "Index charts: making time series comparable", url: "https://www.youtube.com/watch?v=qs7h19vaqQc", type: "video" }],
    },
    {
      title: "Logarithmic scale",
      quickDefinition: "The vertical axis stretches so similar percent moves look like similar steps.",
      description:
        "A log y-axis makes equal distances mean similar percentage moves. It helps when early years are tiny next to recent values (e.g. long-range gold or wide-ranging prices). It does not change the underlying data.",
      learnMore: [{ label: "Logarithmic scale (Wikipedia)", url: "https://en.wikipedia.org/wiki/Logarithmic_scale" }],
    },
    {
      title: "Annual vs daily data on the same story",
      quickDefinition: "Yearly and daily lines are mixed only for broad timing, not fine same-day reading.",
      description:
        "Some series are annual (PPP, many WDI panels); others are daily (spot FX or Brent). Overlaying them is for broad timing context—do not read day-to-day wiggles as if they were measured at the same frequency as annual points.",
    },
    {
      title: "Event overlays",
      quickDefinition: "Markers pin dates on the chart so you can read events next to the data.",
      description:
        "Vertical or shaded markers place events in time—wars, sanctions, political milestones. They are anchors for reading charts, not proof that an event moved the series.",
    },
    {
      title: "What SignalMap does not claim",
      quickDefinition: "Charts show context, not proof of cause and not a forecast of the future.",
      description:
        "SignalMap shows patterns and context. It does not assert causality, forecast the future, or claim that any marker explains a change in the data by itself.",
    },
  ],
  "Institutions, shocks & constraints": [
    {
      title: "What sanctions restrict",
      quickDefinition: "Sanctions block some trade or finance; they do not automatically move every line the same way.",
      description:
        "Sanctions limit trade, finance, or specific activities. They show up in studies as context layers; they are not modeled as automatic impacts on every series.",
      learnMore: [{ label: "Economic sanctions (Wikipedia)", url: "https://en.wikipedia.org/wiki/Economic_sanctions" }],
    },
    {
      title: "Why export volume matters under sanctions",
      quickDefinition: "If barrels cannot sail, the limit is often volume, not the headline world price.",
      description:
        "When shipments are constrained, the bottleneck is often how much crude can leave the country, not the headline world price. That is why capacity-style charts pair price with volume estimates.",
      learnMore: [{ label: "Do Sanctions Work? (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA", type: "video" }],
    },
    {
      title: "Informal (shadow) markets",
      quickDefinition: "When official channels are tight, activity moves off the books and gets harder to measure.",
      description:
        "When official channels are tight, transactions move outside formal measurement. Open-market rates and trade estimates can reflect that reality only partially.",
      learnMore: [{ label: "Informal economy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Informal_sector" }],
    },
    {
      title: "Supply vs demand shocks",
      quickDefinition: "Supply is how much can be sold; demand is how much buyers want—both can move prices.",
      description:
        "A supply shock changes how much can be produced or sold (war, outage, OPEC decision). A demand shock changes how much buyers want. Prices can move for either reason; overlays do not say which mechanism dominated.",
      learnMore: [
        { label: "Supply shock (Wikipedia)", url: "https://en.wikipedia.org/wiki/Supply_shock" },
        { label: "Demand shock (Wikipedia)", url: "https://en.wikipedia.org/wiki/Demand_shock" },
      ],
    },
  ],
  "Methods & caveats": [
    {
      title: "Derived series",
      quickDefinition: "Lines like spreads are built from raw inputs—small definition changes move the line.",
      description:
        "Spreads, real or indexed values, PPP burdens, and capacity proxies are computed from base data. Definitions and bases are given in each study’s sources; small changes in inputs or windows change the derived line.",
    },
    {
      title: "Correlation vs causation",
      quickDefinition: "Two lines moving together does not prove one caused the other.",
      description:
        "Two series moving together are correlated. That does not mean one caused the other. Causation needs a separate argument and usually much more than a time series.",
      learnMore: [
        {
          label: "Correlation does not imply causation (Wikipedia)",
          url: "https://en.wikipedia.org/wiki/Correlation_does_not_imply_causation",
        },
      ],
    },
    {
      title: "Measurement vs reality",
      quickDefinition: "Official numbers simplify a messy economy and can be revised or miss informal activity.",
      description:
        "Published indicators are revised, miss informal activity, and use definitions that may not match everyday experience. Treat numbers as useful approximations, not complete pictures.",
    },
  ],
  "Simple growth curves (audience study)": [
    {
      title: "Linear vs exponential growth",
      quickDefinition: "Linear adds a similar chunk each step; exponential multiplies and eventually shoots up.",
      description:
        "Linear growth adds a roughly fixed amount per time step. Exponential growth multiplies by a factor each step—early values look flat until the curve steepens. Follower-count demos use both for contrast.",
      learnMore: [{ label: "Exponential growth (Wikipedia)", url: "https://en.wikipedia.org/wiki/Exponential_growth" }],
    },
    {
      title: "Logistic (S-curve) growth",
      quickDefinition: "Rises fast, then levels off as it nears a ceiling—good for capped growth stories.",
      description:
        "Logistic growth rises quickly then levels off as it approaches a ceiling—useful when a quantity cannot grow without limit (e.g. saturation of an audience).",
      learnMore: [{ label: "Logistic function (Wikipedia)", url: "https://en.wikipedia.org/wiki/Logistic_function" }],
    },
    {
      title: "Fitting curves and overfitting",
      quickDefinition: "A curve that hugs every wiggle may have learned noise, not a simple true pattern.",
      description:
        "Fitting means choosing parameters so a curve sits close to past points. Flexible curves can hug noise (overfitting) and look worse on new data; simpler curves are often more honest for illustration.",
      learnMore: [{ label: "Overfitting (Wikipedia)", url: "https://en.wikipedia.org/wiki/Overfitting" }],
    },
  ],
  "Text & discourse (YouTube studies)": [
    {
      title: "Comments as text data",
      quickDefinition: "Comments are treated like countable text to spot common themes.",
      description:
        "Discourse studies treat comment text as data: words are counted, weighted, and grouped to summarize themes. Results depend on language, sampling, and preprocessing.",
    },
    {
      title: "TF-IDF (term importance)",
      quickDefinition: "Highlights words that stand out in one comment compared with the whole pile.",
      description:
        "TF-IDF highlights words that are frequent in one document (or comment) but uncommon in the whole collection—useful for picking distinctive terms without hand-picking every keyword.",
      learnMore: [{ label: "TF-IDF (Wikipedia)", url: "https://en.wikipedia.org/wiki/Tf%E2%80%93idf" }],
    },
    {
      title: "Dimensionality reduction (PCA and UMAP)",
      quickDefinition: "Squashes many text scores into a flat chart for clusters—exploratory, not ground truth.",
      description:
        "High-dimensional vectors (e.g. from text) are projected to 2D for visualization. PCA stresses global spread; UMAP stresses local neighborhoods and clusters. Both are exploratory, not ground truth about “topics.”",
      learnMore: [
        { label: "Principal component analysis (Wikipedia)", url: "https://en.wikipedia.org/wiki/Principal_component_analysis" },
        { label: "UMAP", url: "https://en.wikipedia.org/wiki/Nonlinear_dimensionality_reduction#UMAP" },
      ],
    },
  ],
  "Transcript fallacy analysis": TRANSCRIPT_FALLACY_LEARNING_CONCEPTS.map((c) => ({
    title: c.title,
    quickDefinition: c.quickDefinition,
    description: c.description,
  })),
};

function sectionDomId(sectionTitle: string): string | undefined {
  if (sectionTitle === "Transcript fallacy analysis") return "transcript-fallacy-analysis";
  if (sectionTitle === "Industrial policy & resource shifts") return "industrial-policy-resource-shifts";
  return undefined;
}

function conceptSearchHaystack(concept: Concept): string {
  const parts = [concept.title, concept.quickDefinition ?? "", concept.id ?? "", concept.description ?? ""];
  if (concept.learnMore?.length) {
    for (const l of concept.learnMore) {
      parts.push(l.label);
    }
  }
  if (concept.structured) {
    const s = concept.structured;
    parts.push(
      s.quickDefinition,
      s.definition,
      s.keyIdea,
      ...s.detectionBullets,
      ...s.chartPatterns,
      s.studyId,
      getStudyById(s.studyId)?.title ?? ""
    );
  }
  return parts.join(" ").toLowerCase();
}

/** Case-insensitive highlight for search matches (whole substring). */
function highlightNeedleInText(text: string, needle: string, markKeyPrefix: string): ReactNode {
  const t = needle.trim();
  if (t.length < 2) return text;
  const lower = text.toLowerCase();
  const n = t.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const j = lower.indexOf(n, i);
    if (j === -1) {
      out.push(text.slice(i));
      break;
    }
    if (j > i) out.push(text.slice(i, j));
    out.push(
      <mark className="learning-search-mark" key={`${markKeyPrefix}-${k++}`}>
        {text.slice(j, j + n.length)}
      </mark>
    );
    i = j + n.length;
  }
  return <>{out}</>;
}

function QuickDefinitionBlock({
  text,
  highlight,
  markPrefix,
}: {
  text: string;
  highlight: string;
  markPrefix: string;
}) {
  return (
    <div className="learning-quick-definition">
      <span className="learning-quick-definition-eyebrow">Quick definition</span>
      <p className="learning-quick-definition-text">{highlightNeedleInText(text, highlight, `${markPrefix}-qd`)}</p>
    </div>
  );
}

function ConceptEntry({ concept, highlightNeedle }: { concept: Concept; highlightNeedle: string }) {
  const markPrefix = useId().replace(/:/g, "");
  const hl = (s: string) => highlightNeedleInText(s, highlightNeedle, markPrefix);
  if (concept.structured) {
    const s = concept.structured;
    const study = getStudyById(s.studyId);
    return (
      <div className="learning-item" id={concept.id}>
        <strong>{hl(concept.title)}</strong>
        <QuickDefinitionBlock text={s.quickDefinition} highlight={highlightNeedle} markPrefix={markPrefix} />
        <p>
          <span className="learning-structured-lead">Definition.</span> {hl(s.definition)}
        </p>
        <p>
          <span className="learning-structured-lead">Key idea.</span> {hl(s.keyIdea)}
        </p>
        <p className="learning-structured-label">How to detect it in data</p>
        <ul className="learning-structured-list">
          {s.detectionBullets.map((line, i) => (
            <li key={`${concept.id}-det-${i}`}>{hl(line)}</li>
          ))}
        </ul>
        <p className="learning-structured-label">What to look for in charts</p>
        <ul className="learning-structured-list">
          {s.chartPatterns.map((line, i) => (
            <li key={`${concept.id}-pat-${i}`}>{hl(line)}</li>
          ))}
        </ul>
        <p className="learning-study-link-wrap">
          <span className="learning-structured-lead">Related study.</span>{" "}
          <Link href={`/studies/${s.studyId}`} className="learning-study-link">
            {study?.title ? hl(study.title) : s.studyId}
          </Link>
        </p>
        {concept.learnMore && concept.learnMore.length > 0 ? (
          <div className="pt-1 space-y-1">
            {concept.learnMore.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={link.type === "video" ? "video-link" : undefined}
              >
                {link.type === "video" ? link.label : `Learn more: ${link.label}`}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="learning-item" id={concept.id}>
      <strong>{hl(concept.title)}</strong>
      {concept.quickDefinition ? (
        <QuickDefinitionBlock text={concept.quickDefinition} highlight={highlightNeedle} markPrefix={markPrefix} />
      ) : null}
      {concept.description ? <p>{hl(concept.description)}</p> : null}
      {concept.learnMore && concept.learnMore.length > 0 && (
        <div className="pt-1 space-y-1">
          {concept.learnMore.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={link.type === "video" ? "video-link" : undefined}
            >
              {link.type === "video" ? link.label : `Learn more: ${link.label}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

type FlatEntry = { sectionTitle: string; concept: Concept };

function LearningPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(qFromUrl);
  const [debouncedQuery, setDebouncedQuery] = useState(qFromUrl);
  const [viewMode, setViewMode] = useState<"list" | "slides">("list");
  const [slideIndex, setSlideIndex] = useState(0);

  useLayoutEffect(() => {
    if (typeof document !== "undefined" && document.activeElement === inputRef.current) {
      return;
    }
    setInputValue(qFromUrl);
    setDebouncedQuery(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 280);
    return () => window.clearTimeout(id);
  }, [inputValue]);

  useEffect(() => {
    const next = debouncedQuery.trim();
    const urlTrim = (searchParams.get("q") ?? "").trim();
    if (urlTrim === next) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedQuery, pathname, router, searchParams]);

  const filterNeedle = debouncedQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    const q = filterNeedle;
    return Object.entries(CONCEPTS)
      .map(([sectionTitle, concepts]) => {
        const list = q ? concepts.filter((c) => conceptSearchHaystack(c).includes(q)) : concepts;
        return { sectionTitle, concepts: list };
      })
      .filter((s) => s.concepts.length > 0);
  }, [filterNeedle]);

  const flatFiltered = useMemo((): FlatEntry[] => {
    return filteredSections.flatMap((s) => s.concepts.map((concept) => ({ sectionTitle: s.sectionTitle, concept })));
  }, [filteredSections]);

  const showNoResults = filterNeedle.length > 0 && filteredSections.length === 0;
  const highlightNeedle = debouncedQuery.trim();
  const slideTotal = flatFiltered.length;
  const slide = flatFiltered[slideIndex] ?? null;

  useEffect(() => {
    setSlideIndex(0);
  }, [filterNeedle, viewMode]);

  useEffect(() => {
    if (viewMode !== "slides" || showNoResults || slideTotal <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlideIndex((i) => Math.min(slideTotal - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, showNoResults, slideTotal]);

  return (
    <div className="learning-container">
      <div className="learning-content">
        <h1>Learning resources</h1>
        <p>
          Short explanations of ideas that appear across SignalMap studies—macro, oil and FX, inequality, charts, and
          methods. Wording stays close to how studies describe their own limits.
        </p>

        <div className="learning-search-toolbar">
          <div className="learning-search-field">
            <label className="learning-search-label" htmlFor="learning-search">
              Search topics
            </label>
            <input
              ref={inputRef}
              id="learning-search"
              name="learning_search"
              type="search"
              className="learning-search-input"
              placeholder="Search topics..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="learning-view-toggle" role="group" aria-label="Result layout">
            <button
              type="button"
              className={`learning-view-toggle-btn${viewMode === "list" ? " learning-view-toggle-btn-active" : ""}`}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`learning-view-toggle-btn${viewMode === "slides" ? " learning-view-toggle-btn-active" : ""}`}
              aria-pressed={viewMode === "slides"}
              onClick={() => setViewMode("slides")}
            >
              Slides
            </button>
          </div>
        </div>

        {showNoResults ? <p className="learning-search-empty">No results.</p> : null}

        {!showNoResults && viewMode === "list"
          ? filteredSections.map(({ sectionTitle, concepts }, secIdx) => (
              <section key={sectionTitle} id={sectionDomId(sectionTitle)}>
                <h2>{highlightNeedleInText(sectionTitle, highlightNeedle, `h2-${secIdx}`)}</h2>
                <div>
                  {concepts.map((concept) => (
                    <ConceptEntry
                      key={concept.id ?? concept.title}
                      concept={concept}
                      highlightNeedle={highlightNeedle}
                    />
                  ))}
                </div>
              </section>
            ))
          : null}

        {!showNoResults && viewMode === "slides" && slide ? (
          <div className="learning-slides">
            <p className="learning-slides-meta">
              <span className="learning-slides-section">{slide.sectionTitle}</span>
              <span className="learning-slides-counter">
                {" "}
                ({slideIndex + 1} / {slideTotal})
              </span>
            </p>
            <ConceptEntry concept={slide.concept} highlightNeedle={highlightNeedle} />
            <div className="learning-slides-nav">
              <button
                type="button"
                className="learning-slides-nav-btn"
                disabled={slideIndex <= 0}
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="learning-slides-nav-btn"
                disabled={slideIndex >= slideTotal - 1}
                onClick={() => setSlideIndex((i) => Math.min(slideTotal - 1, i + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LearningPage() {
  return (
    <Suspense
      fallback={
        <div className="learning-container">
          <div className="learning-content">
            <h1>Learning resources</h1>
            <p className="learning-search-empty">Loading…</p>
          </div>
        </div>
      }
    >
      <LearningPageInner />
    </Suspense>
  );
}
