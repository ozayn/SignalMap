export type ConceptKey =
  | "real_price"
  | "ppp"
  | "structural_break"
  | "log_scale"
  | "nominal_price"
  | "cpi";

export type Concept = {
  title: string;
  description: string;
  link?: { label: string; href: string };
};

export const CONCEPTS: Record<ConceptKey, Concept> = {
  real_price: {
    title: "Real price",
    description:
      "A price adjusted for inflation, typically nominal price divided by a consumer price index (CPI). Used to compare purchasing power across time.",
    link: { label: "Real price (Wikipedia)", href: "https://en.wikipedia.org/wiki/Real_price" },
  },
  nominal_price: {
    title: "Nominal price",
    description:
      "The price as quoted in current currency, without inflation adjustment. Reflects market value at the time of observation.",
  },
  ppp: {
    title: "Purchasing power parity (PPP)",
    description:
      "A conversion factor that expresses how much local currency is needed to buy the same basket of goods as one unit of a reference currency. Used to compare domestic burden across countries.",
    link: {
      label: "Purchasing power parity (Wikipedia)",
      href: "https://en.wikipedia.org/wiki/Purchasing_power_parity",
    },
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
    link: {
      label: "Logarithmic scale (Wikipedia)",
      href: "https://en.wikipedia.org/wiki/Logarithmic_scale",
    },
  },
  cpi: {
    title: "Consumer Price Index (CPI)",
    description:
      "A measure of the average change over time in prices paid by consumers for a basket of goods and services. Used to inflation-adjust nominal prices.",
    link: {
      label: "Consumer price index (Wikipedia)",
      href: "https://en.wikipedia.org/wiki/Consumer_price_index",
    },
  },
};

export function getConcepts(keys: ConceptKey[]): Concept[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean);
}
