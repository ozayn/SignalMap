type LearnMoreLink = { label: string; url: string; type?: "video" | "article" };

type Concept = {
  title: string;
  description: string;
  learnMore?: LearnMoreLink[];
};

const CONCEPTS: Record<string, Concept[]> = {
  "Core economic ideas": [
    {
      title: "Nominal vs real prices",
      description: "Nominal prices are the money values you see at current market rates. Real prices adjust for inflation so you can compare buying power across time.",
      learnMore: [
        { label: "Real and nominal value (Wikipedia)", url: "https://en.wikipedia.org/wiki/Real_and_nominal_value" },
        { label: "Real GDP and nominal GDP (Khan Academy)", url: "https://www.youtube.com/watch?v=lBDT2w5Wl84", type: "video" },
      ],
    },
    {
      title: "Indexing and base years",
      description: "Indexing rescales a series so a chosen point (the base year) equals 100. Values above or below 100 show relative change rather than absolute levels.",
      learnMore: [
        { label: "Index (economics) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Index_(economics)" },
        { label: "CPI index (Khan Academy)", url: "https://www.youtube.com/watch?v=pRIELoITIHI", type: "video" },
      ],
    },
    {
      title: "Purchasing Power Parity (PPP)",
      description: "PPP compares what money can buy across countries by using a common basket of goods. It approximates domestic buying power better than market exchange rates.",
      learnMore: [
        { label: "Purchasing power parity (Wikipedia)", url: "https://en.wikipedia.org/wiki/Purchasing_power_parity" },
        { label: "Purchasing Power Parity Explained", url: "https://www.youtube.com/watch?v=e9Wf7TqJMkU", type: "video" },
      ],
    },
    {
      title: "Price vs quantity constraints",
      description: "Price constraints affect how much you pay; quantity constraints affect how much you can sell or buy. Under sanctions, volume limits often matter more than price.",
      learnMore: [
        { label: "Do Sanctions Work? (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA", type: "video" },
      ],
    },
    {
      title: "Inflation and exchange rates",
      description: "Inflation erodes the purchasing power of money over time. Exchange rates determine how much of one currency you get for another. Both shape how economic signals are interpreted.",
      learnMore: [
        { label: "Exchange rate (Wikipedia)", url: "https://en.wikipedia.org/wiki/Exchange_rate" },
      ],
    },
    {
      title: "Supply vs demand shocks",
      description: "A supply shock is when something suddenly changes how much can be produced or sold (e.g. war, crop failure). A demand shock is when something suddenly changes how much people want to buy. Both can move prices, often in different directions.",
      learnMore: [
        { label: "Supply shock (Wikipedia)", url: "https://en.wikipedia.org/wiki/Supply_shock" },
        { label: "Demand shock (Wikipedia)", url: "https://en.wikipedia.org/wiki/Demand_shock" },
      ],
    },
    {
      title: "Elasticity (in simple terms)",
      description: "Elasticity measures how much quantity bought or sold changes when price changes. If a small price change leads to a big change in quantity, demand or supply is elastic; if quantity barely moves, it is inelastic.",
      learnMore: [
        { label: "Elasticity (economics) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Elasticity_(economics)" },
      ],
    },
    {
      title: "Terms of trade",
      description: "Terms of trade measure how many imports a country can buy with a given amount of exports. When export prices rise relative to import prices, a country can buy more imports for the same exports.",
      learnMore: [
        { label: "Terms of trade (Wikipedia)", url: "https://en.wikipedia.org/wiki/Terms_of_trade" },
      ],
    },
  ],
  "Money & currency": [
    {
      title: "Money supply and inflation",
      description: "When more money circulates in an economy without a matching increase in goods and services, each unit of money tends to buy less. Inflation is the general rise in prices that often follows.",
      learnMore: [
        { label: "Money supply (Wikipedia)", url: "https://en.wikipedia.org/wiki/Money_supply" },
        { label: "Inflation (Wikipedia)", url: "https://en.wikipedia.org/wiki/Inflation" },
      ],
    },
    {
      title: "Parallel exchange rates",
      description: "In some countries, the official exchange rate differs from the rate at which people actually trade currency in the market. The parallel (or black market) rate often reflects what traders are willing to pay when official access is restricted.",
      learnMore: [
        { label: "Black market (Wikipedia)", url: "https://en.wikipedia.org/wiki/Black_market" },
      ],
    },
  ],
  "Oil & commodities": [
    {
      title: "What oil prices represent",
      description: "Oil prices reflect the cost of a barrel of crude oil on world markets. They are a benchmark for energy costs and often signal broader economic and geopolitical conditions.",
      learnMore: [
        { label: "Price of oil (Wikipedia)", url: "https://en.wikipedia.org/wiki/Price_of_oil" },
        { label: "Supply and demand in the global oil market", url: "https://www.youtube.com/watch?v=9eMo_UGOLZk", type: "video" },
      ],
    },
    {
      title: "Brent vs WTI",
      description: "Brent crude and West Texas Intermediate (WTI) are two benchmark oil types. Brent is widely used for international pricing; WTI is a US benchmark. Both are traded on world markets.",
      learnMore: [
        { label: "Brent Crude (Wikipedia)", url: "https://en.wikipedia.org/wiki/Brent_Crude" },
        { label: "Difference between Brent and WTI crude oil", url: "https://www.youtube.com/watch?v=k40bUKmlj9Q", type: "video" },
      ],
    },
    {
      title: "What USD/bbl means",
      description: "USD/bbl (or USD per barrel) is the price of one barrel of oil in US dollars. A barrel is about 159 litres. It is the standard unit for crude oil pricing.",
      learnMore: [
        { label: "Barrel (unit) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Barrel_(unit)" },
      ],
    },
  ],
  "Energy & resources": [
    {
      title: "Resource dependence",
      description: "When a country relies heavily on one or few commodities (e.g. oil) for revenue or exports, its economy is sensitive to that commodity's price and demand.",
      learnMore: [
        { label: "Resource curse (Wikipedia)", url: "https://en.wikipedia.org/wiki/Resource_curse" },
      ],
    },
    {
      title: "Revenue volatility",
      description: "Revenue that swings sharply from year to year—common in commodity-dependent economies—makes it harder to plan budgets and can create boom or bust cycles.",
    },
  ],
  "Sanctions & constraints": [
    {
      title: "What sanctions restrict",
      description: "Sanctions are restrictions on trade, finance, or other activities imposed by one country or group on another. They can target specific sectors, entities, or goods.",
      learnMore: [
        { label: "Economic sanctions (Wikipedia)", url: "https://en.wikipedia.org/wiki/Economic_sanctions" },
      ],
    },
    {
      title: "Why volume matters under sanctions",
      description: "When exports are constrained, how much you can sell often matters more than the price. Volume reflects the actual bottleneck—what can be exported—rather than what the world price would allow.",
      learnMore: [
        { label: "Do Sanctions Work? (Economics Explained)", url: "https://www.youtube.com/watch?v=zrK2B2yMPrA", type: "video" },
      ],
    },
  ],
  "Constraints & institutions": [
    {
      title: "Capital controls",
      description: "Capital controls are rules that limit how much money can move in or out of a country. They are used to stabilise exchange rates or protect reserves during crises.",
      learnMore: [
        { label: "Capital control (Wikipedia)", url: "https://en.wikipedia.org/wiki/Capital_control" },
      ],
    },
    {
      title: "Informal (shadow) markets",
      description: "When official rules restrict trade or access, people often create informal channels—outside official markets—to transact. These markets reflect what people are willing to pay when formal channels are unavailable.",
      learnMore: [
        { label: "Informal economy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Informal_sector" },
      ],
    },
  ],
  "How to read SignalMap charts": [
    {
      title: "Why some charts are indexed",
      description: "Indexing lets you compare different-scale series (e.g. Iran vs Turkey) on the same chart. Both start at 100; values above or below show relative change over time.",
      learnMore: [
        { label: "Index charts: making time series comparable", url: "https://www.youtube.com/watch?v=qs7h19vaqQc", type: "video" },
      ],
    },
    {
      title: "Why annual data is used",
      description: "Some data (e.g. PPP, gold) are only available annually. Annual resolution smooths short-term noise and focuses on longer-term patterns.",
      learnMore: [
        { label: "CPI index and inflation data (Khan Academy)", url: "https://www.youtube.com/watch?v=pRIELoITIHI", type: "video" },
      ],
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
  "Reading data responsibly": [
    {
      title: "Correlation vs causation",
      description: "When two things move together, they are correlated. That does not mean one causes the other. Causation requires evidence that one thing actually leads to the other.",
      learnMore: [
        { label: "Correlation does not imply causation (Wikipedia)", url: "https://en.wikipedia.org/wiki/Correlation_does_not_imply_causation" },
      ],
    },
    {
      title: "Measurement vs reality",
      description: "Economic data are estimates and approximations. They may miss informal activity, be revised, or reflect different definitions. What we measure is not always exactly what happens in reality.",
    },
  ],
};

function ConceptEntry({ concept }: { concept: Concept }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-foreground">{concept.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{concept.description}</p>
      {concept.learnMore && concept.learnMore.length > 0 && (
        <div className="pt-1 space-y-1">
          {concept.learnMore.map((link) => (
            <p key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {link.type === "video" ? `▶ Video: ${link.label}` : `Learn more: ${link.label}`}
              </a>
            </p>
          ))}
        </div>
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
