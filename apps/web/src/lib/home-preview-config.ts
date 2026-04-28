/** Static metadata for homepage preview cards (titles / links). Points come from `/api/homepage/previews`. */

export const HOME_PREVIEW_CARDS_META = [
  {
    id: "usd-toman",
    title: "USD → Toman",
    href: "/studies/iran-fx-regime",
    subtitle: "Open-market rate over time.",
  },
  {
    id: "inflation-cpi",
    title: "Inflation (CPI)",
    href: "/studies/inflation-rate",
    subtitle: "Annual CPI inflation (% YoY), Iran.",
  },
  {
    id: "brent",
    title: "Brent (USD/bbl)",
    href: "/studies/iran",
    subtitle: "Nominal Brent crude benchmark.",
  },
] as const;
