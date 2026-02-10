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
  | "overfitting_simple"
  | "multiple_exchange_rates"
  | "capital_controls"
  | "price_controls"
  | "measurement_vs_reality"
  | "purchasing_power"
  | "derived_series"
  | "real_wage"
  | "real_oil_price"
  | "export_capacity_proxy"
  | "fx_spread"
  | "nominal_minimum_wage"
  | "official_exchange_rate"
  | "oil_export_volume"
  | "ppp_oil_burden";

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
      "The price as quoted in current currency, without inflation adjustment. Reflects market value at the time of observation. Significance: nominal series show what was actually paid or quoted; for comparison across long periods, real (inflation-adjusted) or indexed series are often used.",
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
    title: "Brent oil price (what we plot)",
    description:
      "Oil prices reflect the cost of a barrel of crude oil on world markets. Brent is a benchmark used for international pricing. Significance: they signal energy costs and broader economic conditions; used as a context signal for commodity and macroeconomic analysis. Nominal (current) price is what we plot when showing oil alone; for long-term burden, real (inflation-adjusted) or PPP-adjusted series are used in other studies.",
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
    title: "Open market exchange rate (what we plot)",
    description:
      "The rate at which one currency trades for another in the open market (e.g. USD/toman). When official rates differ from market rates, the market rate often reflects what traders are willing to pay. Significance: used as a lived economic pressure indicator; higher rate means a weaker local currency per dollar. We plot this in FX and dual-rate studies to show how the market values the currency.",
    links: [
      { label: "Exchange rate (Wikipedia)", href: "https://en.wikipedia.org/wiki/Exchange_rate" },
    ],
  },
  gold_price: {
    title: "Gold price (what we plot)",
    description:
      "Gold price in USD per ounce. Gold is used as a macroeconomic stress indicator and store of value. Significance: gold and oil often move together during geopolitical or monetary uncertainty; long-range gold series give context for monetary and crisis periods. We plot it alongside oil in the global context study.",
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
  multiple_exchange_rates: {
    title: "Multiple exchange rates",
    description:
      "When a country maintains both an official rate (set by policy) and an open-market rate (where currency trades freely), the gap between them reflects constraints and expectations rather than a single “true” price.",
  },
  capital_controls: {
    title: "Capital controls",
    description:
      "Restrictions on moving money across borders. They can create a wedge between official and market exchange rates and give rise to informal or parallel markets.",
  },
  price_controls: {
    title: "Price controls",
    description:
      "Policy-set prices (e.g. an official exchange rate) that differ from market-clearing levels. The gap is descriptive; it does not by itself explain cause or effect.",
  },
  measurement_vs_reality: {
    title: "Measurement vs reality",
    description:
      "Reported series (official rates, indices) are measurements. They may lag, exclude informal activity, or reflect definitions that differ from lived experience. Interpretation should allow for that gap.",
  },
  purchasing_power: {
    title: "Purchasing power",
    description:
      "The amount of goods and services that a given amount of money can buy. Real wages (wages adjusted for inflation) reflect purchasing power over time; nominal wages alone do not.",
    links: [
      { label: "Purchasing power (Wikipedia)", href: "https://en.wikipedia.org/wiki/Purchasing_power" },
    ],
  },
  derived_series: {
    title: "Derived series",
    description:
      "A derived series is computed from other data using a formula, rather than measured directly. Examples: real wage = nominal wage × (CPI_base / CPI_t); real oil price = nominal price ÷ CPI × base; export capacity proxy = oil price × export volume; spread (%) = (open rate − official rate) ÷ official rate. The formula is usually shown in Sources. Derived series depend on the choice of inputs and base period.",
    links: [
      { label: "Derived quantity (Wikipedia)", href: "https://en.wikipedia.org/wiki/Derived_quantity" },
    ],
  },
  real_wage: {
    title: "Real minimum wage",
    description:
      "Real minimum wage is nominal minimum wage adjusted for inflation using a consumer price index (CPI): real wage = nominal wage × (CPI_base / CPI_t). It is expressed in constant purchasing power (e.g. base-year prices). Significance: it shows whether workers can buy more or less with their pay over time. When nominal wages rise but inflation rises faster, real wages fall—purchasing power declines. Real minimum wage is used to compare the burden or adequacy of the wage floor across years without being misled by nominal increases.",
    links: [
      { label: "Real wages (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_wages" },
    ],
  },
  real_oil_price: {
    title: "Real oil price",
    description:
      "Real oil price is nominal oil price (e.g. Brent USD/bbl) adjusted for inflation using a consumer price index: real = nominal × (CPI_base / CPI_t). It is expressed in constant dollars (e.g. 2015 USD). Significance: it allows comparison of oil’s economic burden or cost across decades. Nominal prices from the past look much lower than today’s; real prices show whether oil was relatively more or less expensive in terms of purchasing power. Used for long-term context, not for short-term market signals.",
    links: [
      { label: "Real price (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_price" },
    ],
  },
  export_capacity_proxy: {
    title: "Export capacity proxy",
    description:
      "A derived indicator: oil price × estimated export volume, often indexed to a base year (e.g. 100). It is a proxy for export earning capacity—how much revenue-like potential exists from oil exports—not realized revenue. Significance: under sanctions or constraints, volume can fall while price rises; the product of price and volume captures both. It does not equal government receipts (discounts, payment terms, non-crude exports are excluded). Used for contextual comparison over time.",
  },
  fx_spread: {
    title: "FX spread (%)",
    description:
      "The percentage gap between two exchange rates, e.g. (open-market rate − official rate) ÷ official rate × 100. A derived series when official and open rates coexist. Significance: the spread reflects the wedge between policy-set and market-clearing rates—constraints, expectations, or informal market conditions. A large or widening spread often coincides with capital controls or rationing. It is descriptive of the gap, not causal; interpretation should allow for measurement and definition differences between the two series.",
  },
  nominal_minimum_wage: {
    title: "Nominal minimum wage (what we plot)",
    description:
      "The statutory minimum wage as set in current currency (e.g. million rials per month), without inflation adjustment. It is the official floor that employers must pay. Significance: nominal minimum wage shows policy and legal levels over time; by itself it does not show whether workers can buy more or less, because inflation erodes purchasing power. We plot it alongside real (CPI-adjusted) minimum wage so both the headline number and its purchasing power are visible.",
    links: [
      { label: "Minimum wage (Wikipedia)", href: "https://en.wikipedia.org/wiki/Minimum_wage" },
    ],
  },
  official_exchange_rate: {
    title: "Official exchange rate (what we plot)",
    description:
      "The policy-set or officially reported exchange rate (e.g. USD/IRR or a proxy in toman). Often differs from the rate at which currency actually trades in the open market. Significance: we plot it in the dual-rate study alongside the open-market rate to show the gap between policy and market. The official rate reflects policy and reporting; it does not by itself indicate what people pay or receive in parallel markets.",
    links: [
      { label: "Exchange rate (Wikipedia)", href: "https://en.wikipedia.org/wiki/Exchange_rate" },
    ],
  },
  oil_export_volume: {
    title: "Oil export volume (what we plot)",
    description:
      "Estimated volume of crude oil (and sometimes condensate) exported by a country, typically in million barrels per year. Often based on tanker tracking, customs, or agency estimates. Significance: we plot it alongside oil price in the export capacity study because capacity depends on both price and how much can be sold. Under sanctions, volume constraints often matter more than price. Volume data are estimates; uncertainty is higher when exports are constrained.",
    links: [
      { label: "EIA Iran analysis", href: "https://www.eia.gov/international/content/analysis/countries_long/iran/" },
    ],
  },
  ppp_oil_burden: {
    title: "PPP-adjusted oil burden (what we plot)",
    description:
      "Oil price converted into local purchasing power using a PPP factor (e.g. nominal Brent × Iran PPP), so the burden is expressed in domestic terms—how much local currency is needed to buy the same barrel. Significance: we plot this in the Iran (and Turkey) PPP studies to compare how heavy oil is in local purchasing power over time and across countries. It is a derived series: nominal oil × PPP conversion factor.",
    links: [
      { label: "Purchasing power parity (Wikipedia)", href: "https://en.wikipedia.org/wiki/Purchasing_power_parity" },
    ],
  },
};

export function getConcepts(keys: ConceptKey[]): Concept[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean);
}
