/**
 * Concise markLine captions for curated ``global_macro_oil`` anchors (GDP / oil studies).
 * Full titles remain on the event for tooltips.
 */

export type GlobalMacroOilLabelEvent = { id: string; title: string };

const GLOBAL_MACRO_OIL_SHORT_BY_ID: Record<string, string> = {
  "gmo-1973-arab-oil-embargo": "Embargo",
  "gmo-1979-iran-revolution": "1979 Iran",
  "gmo-1990-gulf-war": "Gulf War",
  "gmo-1997-asian-financial-crisis": "Asian crisis",
  "gmo-1999-opec-cuts": "OPEC cuts",
  "gmo-2005-china-oil-demand": "China demand",
  "gmo-2008-lehman-gfc": "Lehman",
};

export function globalMacroOilMarkLineShortLabel(ev: GlobalMacroOilLabelEvent): string {
  const mapped = GLOBAL_MACRO_OIL_SHORT_BY_ID[ev.id];
  if (mapped) return mapped;
  const t = ev.title.trim();
  if (t.length <= 14) return t;
  return `${t.slice(0, 12)}…`;
}
