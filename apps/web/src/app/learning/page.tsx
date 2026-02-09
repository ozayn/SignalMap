import Link from "next/link";

type Concept = {
  title: string;
  description: string;
  learnMore?: { label: string; url: string };
};

const CONCEPTS: Record<string, Concept[]> = {
  "Core economic ideas": [
    {
      title: "Nominal vs real prices",
      description: "Nominal prices are the money values you see at current market rates. Real prices adjust for inflation so you can compare buying power across time.",
      learnMore: { label: "Real and nominal value (Wikipedia)", url: "https://en.wikipedia.org/wiki/Real_and_nominal_value" },
    },
    {
      title: "Indexing and base years",
      description: "Indexing rescales a series so a chosen point (the base year) equals 100. Values above or below 100 show relative change rather than absolute levels.",
      learnMore: { label: "Index (economics) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Index_(economics)" },
    },
    {
      title: "Purchasing Power Parity (PPP)",
      description: "PPP compares what money can buy across countries by using a common basket of goods. It approximates domestic buying power better than market exchange rates.",
      learnMore: { label: "Purchasing power parity (Wikipedia)", url: "https://en.wikipedia.org/wiki/Purchasing_power_parity" },
    },
    {
      title: "Price vs quantity constraints",
      description: "Price constraints affect how much you pay; quantity constraints affect how much you can sell or buy. Under sanctions, volume limits often matter more than price.",
      learnMore: { label: "Do Sanctions Work? (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA" },
    },
    {
      title: "Inflation and exchange rates",
      description: "Inflation erodes the purchasing power of money over time. Exchange rates determine how much of one currency you get for another. Both shape how economic signals are interpreted.",
      learnMore: { label: "Exchange rate (Wikipedia)", url: "https://en.wikipedia.org/wiki/Exchange_rate" },
    },
  ],
  "Oil & commodities": [
    {
      title: "What oil prices represent",
      description: "Oil prices reflect the cost of a barrel of crude oil on world markets. They are a benchmark for energy costs and often signal broader economic and geopolitical conditions.",
      learnMore: { label: "Oil price (Wikipedia)", url: "https://en.wikipedia.org/wiki/Price_of_oil" },
    },
    {
      title: "Brent vs WTI",
      description: "Brent crude and West Texas Intermediate (WTI) are two benchmark oil types. Brent is widely used for international pricing; WTI is a US benchmark. Both are traded on world markets.",
      learnMore: { label: "Brent Crude (Wikipedia)", url: "https://en.wikipedia.org/wiki/Brent_Crude" },
    },
    {
      title: "What USD/bbl means",
      description: "USD/bbl (or USD per barrel) is the price of one barrel of oil in US dollars. A barrel is about 159 litres. It is the standard unit for crude oil pricing.",
      learnMore: { label: "Barrel (unit) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Barrel_(unit)" },
    },
  ],
  "Sanctions & constraints": [
    {
      title: "What sanctions restrict",
      description: "Sanctions are restrictions on trade, finance, or other activities imposed by one country or group on another. They can target specific sectors, entities, or goods.",
      learnMore: { label: "Economic sanctions (Wikipedia)", url: "https://en.wikipedia.org/wiki/Economic_sanctions" },
    },
    {
      title: "Why volume matters under sanctions",
      description: "When exports are constrained, how much you can sell often matters more than the price. Volume reflects the actual bottleneck—what can be exported—rather than what the world price would allow.",
      learnMore: { label: "Why quantity constraints matter (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA" },
    },
  ],
  "How to read SignalMap charts": [
    {
      title: "Why some charts are indexed",
      description: "Indexing lets you compare different-scale series (e.g. Iran vs Turkey) on the same chart. Both start at 100; values above or below show relative change over time.",
    },
    {
      title: "Why annual data is used",
      description: "Some data (e.g. PPP, gold) are only available annually. Annual resolution smooths short-term noise and focuses on longer-term patterns.",
    },
    {
      title: "What event overlays mean",
      description: "Event markers provide context—political, economic, or geopolitical milestones. They are anchors for interpretation, not explanations of causality.",
    },
    {
      title: "What SignalMap does not claim",
      description: "SignalMap displays patterns and context. It does not assert causality, predict outcomes, or claim that any event caused any observed change in the data.",
    },
  ],
};

function ConceptEntry({ concept }: { concept: Concept }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-foreground">{concept.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{concept.description}</p>
      {concept.learnMore && (
        <p className="pt-1">
          <a
            href={concept.learnMore.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Learn more: {concept.learnMore.label}
          </a>
        </p>
      )}
    </div>
  );
}

export default function LearningPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Learning resources
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Concepts and explanations used throughout SignalMap.
        </p>
      </div>

      {Object.entries(CONCEPTS).map(([sectionTitle, concepts]) => (
        <section key={sectionTitle} className="space-y-6">
          <h2 className="text-lg font-medium text-foreground border-b border-border pb-2">
            {sectionTitle}
          </h2>
          <div className="space-y-6">
            {concepts.map((concept) => (
              <ConceptEntry key={concept.title} concept={concept} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
