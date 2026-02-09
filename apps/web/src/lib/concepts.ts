export type ConceptKey =
  | "real_price"
  | "ppp"
  | "structural_break"
  | "log_scale"
  | "nominal_price"
  | "cpi"
  | "indexing"
  | "oil_benchmark"
  | "price_vs_quantity"
  | "fx_rate"
  | "gold_price"
  | "event_overlay"
  | "linear_vs_exponential_growth"
  | "logistic_growth_saturation"
  | "model_fitting_intuition"
  | "overfitting_simple";

export type ConceptLink = {
  label: string;
  href: string;
  type?: "video" | "article";
};

export type Concept = {
  title: string;
  description: string;
  links?: ConceptLink[];
};

export const CONCEPTS: Record<ConceptKey, Concept> = {
  real_price: {
    title: "Real price",
    description:
      "A price adjusted for inflation, typically nominal price divided by a consumer price index (CPI). Used to compare purchasing power across time.",
    links: [
      { label: "Real price (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_price" },
      { label: "Real GDP and nominal GDP (Khan Academy)", href: "https://www.youtube.com/watch?v=lBDT2w5Wl84", type: "video" },
    ],
  },
  nominal_price: {
    title: "Nominal price",
    description:
      "The price as quoted in current currency, without inflation adjustment. Reflects market value at the time of observation.",
    links: [
      { label: "Real and nominal value (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_and_nominal_value" },
      { label: "Real GDP and nominal GDP (Khan Academy)", href: "https://www.youtube.com/watch?v=lBDT2w5Wl84", type: "video" },
    ],
  },
  ppp: {
    title: "Purchasing power parity (PPP)",
    description:
      "A conversion factor that expresses how much local currency is needed to buy the same basket of goods as one unit of a reference currency. Used to compare domestic burden across countries.",
    links: [
      { label: "Purchasing power parity (Wikipedia)", href: "https://en.wikipedia.org/wiki/Purchasing_power_parity" },
      { label: "Purchasing Power Parity Explained", href: "https://www.youtube.com/watch?v=e9Wf7TqJMkU", type: "video" },
    ],
  },
  structural_break: {
    title: "Structural break",
    description:
      "A point or period when a series changes level or trend. Used descriptively, without implying causation or statistical detection.",
  },
  log_scale: {
    title: "Logarithmic scale",
    description:
      "A scale where equal vertical distances represent equal percentage changes rather than equal absolute changes. Makes early-period variation visible when later values are much larger.",
    links: [
      { label: "Logarithmic scale (Wikipedia)", href: "https://en.wikipedia.org/wiki/Logarithmic_scale" },
    ],
  },
  cpi: {
    title: "Consumer Price Index (CPI)",
    description:
      "A measure of the average change over time in prices paid by consumers for a basket of goods and services. Used to inflation-adjust nominal prices.",
    links: [
      { label: "Consumer price index (Wikipedia)", href: "https://en.wikipedia.org/wiki/Consumer_price_index" },
      { label: "CPI index (Khan Academy)", href: "https://www.youtube.com/watch?v=pRIELoITIHI", type: "video" },
    ],
  },
  indexing: {
    title: "Indexing and base years",
    description:
      "Indexing rescales a series so a chosen point (the base year) equals 100. Values above or below 100 show relative change rather than absolute levels.",
    links: [
      { label: "Index (economics) (Wikipedia)", href: "https://en.wikipedia.org/wiki/Index_(economics)" },
      { label: "Index charts: making time series comparable", href: "https://www.youtube.com/watch?v=qs7h19vaqQc", type: "video" },
    ],
  },
  oil_benchmark: {
    title: "What oil prices represent",
    description:
      "Oil prices reflect the cost of a barrel of crude oil on world markets. Brent is a benchmark used for international pricing. They signal energy costs and broader economic conditions.",
    links: [
      { label: "Brent Crude (Wikipedia)", href: "https://en.wikipedia.org/wiki/Brent_Crude" },
      { label: "Supply and demand in the global oil market", href: "https://www.youtube.com/watch?v=9eMo_UGOLZk", type: "video" },
    ],
  },
  price_vs_quantity: {
    title: "Price vs quantity constraints",
    description:
      "Price constraints affect how much you pay; quantity constraints affect how much you can sell or buy. Under sanctions, volume limits often matter more than price.",
    links: [
      { label: "Do Sanctions Work? (Economics Explained)", href: "https://www.youtube.com/watch?v=zrK2B2yMPrA", type: "video" },
    ],
  },
  fx_rate: {
    title: "Open market exchange rate",
    description:
      "The rate at which one currency trades for another in the open market. When official rates differ from market rates, the market rate often reflects what traders are willing to pay.",
    links: [
      { label: "Exchange rate (Wikipedia)", href: "https://en.wikipedia.org/wiki/Exchange_rate" },
    ],
  },
  gold_price: {
    title: "Gold price as a stress indicator",
    description:
      "Gold is used as a macroeconomic stress indicator and store of value. Gold and oil prices often move together during periods of geopolitical or monetary uncertainty.",
    links: [
      { label: "Price of gold (Wikipedia)", href: "https://en.wikipedia.org/wiki/Gold_as_an_investment" },
    ],
  },
  event_overlay: {
    title: "What event overlays mean",
    description:
      "Event markers provide context—political, economic, or geopolitical milestones. They are anchors for interpretation, not explanations of causality.",
  },
  linear_vs_exponential_growth: {
    title: "Linear vs exponential growth",
    description:
      "Linear growth adds a fixed amount per unit of time. Exponential growth multiplies by a factor—each period adds a percentage of the current value. Many natural processes start exponential but slow over time.",
    links: [
      { label: "Exponential growth (Wikipedia)", href: "https://en.wikipedia.org/wiki/Exponential_growth" },
    ],
  },
  logistic_growth_saturation: {
    title: "Logistic growth and saturation",
    description:
      "Logistic growth describes an S-curve: fast growth in the middle, slowing at both ends. It models saturation—when a quantity approaches a limit and cannot grow indefinitely.",
    links: [
      { label: "Logistic function (Wikipedia)", href: "https://en.wikipedia.org/wiki/Logistic_function" },
    ],
  },
  model_fitting_intuition: {
    title: "Model fitting (intuition only)",
    description:
      "Fitting a model means finding parameters that make the curve pass close to the observed points. Different models capture different patterns; no model is “true,” only more or less useful for description.",
    links: [
      { label: "Curve fitting (Wikipedia)", href: "https://en.wikipedia.org/wiki/Curve_fitting" },
    ],
  },
  overfitting_simple: {
    title: "Overfitting (simple explanation)",
    description:
      "Overfitting occurs when a model tracks the data too closely, including noise as if it were pattern. It can look good on past data but fails to generalize. Simpler models are often more robust.",
    links: [
      { label: "Overfitting (Wikipedia)", href: "https://en.wikipedia.org/wiki/Overfitting" },
    ],
  },
};

export function getConcepts(keys: ConceptKey[]): Concept[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean);
}
