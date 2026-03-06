/**
 * Canonical exporter order for Sankey (curated-style).
 * Used for both Curated and All data so layout is consistent.
 * Countries not in this list are appended by total exports (desc).
 */
/** Map Comtrade variants to canonical name for consistent ranking. */
const EXPORTER_ALIASES: Record<string, string> = {
  USA: "United States",
  "United States of America": "United States",
};
const IMPORTER_ALIASES: Record<string, string> = {
  USA: "United States",
  "United States of America": "United States",
  "Rep. of Korea": "South Korea",
};

export const CANONICAL_EXPORTER_ORDER: string[] = [
  "Saudi Arabia",
  "Russia",
  "Iraq",
  "Iran",
  "Canada",
  "United States",
  "UAE",
  "Kuwait",
  "Nigeria",
  "Brazil",
  "Libya",
  "Kazakhstan",
  "Norway",
  "Mexico",
  "Angola",
  "Venezuela",
  "Algeria",
  "Oman",
  "Qatar",
  "Azerbaijan",
  "Colombia",
  "Ecuador",
  "Malaysia",
  "Indonesia",
  "Australia",
  "Other exporters",
];

/**
 * Canonical importer order for Sankey (curated-style).
 */
export const CANONICAL_IMPORTER_ORDER: string[] = [
  "China",
  "India",
  "EU",
  "Japan",
  "United States",
  "South Korea",
  "Singapore",
  "Iran",
  "Thailand",
  "Spain",
  "Netherlands",
  "Italy",
  "France",
  "Germany",
  "United Kingdom",
  "Turkey",
  "Türkiye",
  "Indonesia",
  "Taiwan",
  "Canada",
  "Belgium",
  "Greece",
  "Poland",
  "Portugal",
  "Other importers",
];

/** Combined order for network graph (exporters + importers, deduped). */
export const CANONICAL_NETWORK_ORDER: string[] = [
  ...CANONICAL_EXPORTER_ORDER,
  ...CANONICAL_IMPORTER_ORDER.filter((id) => !CANONICAL_EXPORTER_ORDER.includes(id)),
];

/** Country → region for aggregating minor nodes in All data network. */
export const COUNTRY_TO_REGION: Record<string, string> = {
  "United States": "North America",
  Canada: "North America",
  Mexico: "North America",
  Brazil: "South America",
  Venezuela: "South America",
  Argentina: "South America",
  Colombia: "South America",
  Ecuador: "South America",
  Chile: "South America",
  Peru: "South America",
  Germany: "Europe",
  Netherlands: "Europe",
  France: "Europe",
  Italy: "Europe",
  Spain: "Europe",
  Poland: "Europe",
  Belgium: "Europe",
  Greece: "Europe",
  "United Kingdom": "Europe",
  Norway: "Europe",
  EU: "Europe",
  Sweden: "Europe",
  Finland: "Europe",
  Portugal: "Europe",
  Romania: "Europe",
  Czechia: "Europe",
  Austria: "Europe",
  Switzerland: "Europe",
  Ireland: "Europe",
  Hungary: "Europe",
  Nigeria: "Africa",
  Angola: "Africa",
  Libya: "Africa",
  Algeria: "Africa",
  "South Africa": "Africa",
  Egypt: "Africa",
  Congo: "Africa",
  Gabon: "Africa",
  "Equatorial Guinea": "Africa",
  Ghana: "Africa",
  "Saudi Arabia": "Middle East",
  Iran: "Middle East",
  Iraq: "Middle East",
  UAE: "Middle East",
  Kuwait: "Middle East",
  Turkey: "Middle East",
  Qatar: "Middle East",
  Oman: "Middle East",
  Bahrain: "Middle East",
  Yemen: "Middle East",
  Jordan: "Middle East",
  Lebanon: "Middle East",
  Syria: "Middle East",
  Israel: "Middle East",
  Kazakhstan: "Central Asia",
  Azerbaijan: "Central Asia",
  Uzbekistan: "Central Asia",
  Turkmenistan: "Central Asia",
  China: "East Asia",
  Japan: "East Asia",
  "South Korea": "East Asia",
  Taiwan: "East Asia",
  "Hong Kong": "East Asia",
  Mongolia: "East Asia",
  India: "South Asia",
  Pakistan: "South Asia",
  Bangladesh: "South Asia",
  "Sri Lanka": "South Asia",
  Nepal: "South Asia",
  Indonesia: "Southeast Asia",
  Malaysia: "Southeast Asia",
  Singapore: "Southeast Asia",
  Thailand: "Southeast Asia",
  Vietnam: "Southeast Asia",
  Philippines: "Southeast Asia",
  Myanmar: "Southeast Asia",
  Cambodia: "Southeast Asia",
  "Brunei Darussalam": "Southeast Asia",
  Brunei: "Southeast Asia",
  Australia: "Oceania",
  "New Zealand": "Oceania",
  "Papua New Guinea": "Oceania",
};

export function getRegion(country: string): string {
  return COUNTRY_TO_REGION[country] ?? "Other";
}

/** Merge actual IDs with canonical order. IDs in canonical appear first (in that order); rest sorted by total (desc). */
export function orderWithCanonical(
  actualIds: string[],
  canonicalOrder: string[],
  totalByValue: Record<string, number>,
  aliases?: Record<string, string>
): string[] {
  const toCanonical = (id: string) => (aliases && aliases[id]) ?? id;
  const canonicalSet = new Set(canonicalOrder);
  const inCanonical = actualIds.filter((id) => canonicalSet.has(toCanonical(id)));
  const notInCanonical = actualIds.filter((id) => !canonicalSet.has(toCanonical(id)));
  const rank = new Map(canonicalOrder.map((id, i) => [id, i]));
  inCanonical.sort((a, b) => (rank.get(toCanonical(a)) ?? 9999) - (rank.get(toCanonical(b)) ?? 9999));
  notInCanonical.sort((a, b) => (totalByValue[b] ?? 0) - (totalByValue[a] ?? 0));
  return [...inCanonical, ...notInCanonical];
}

/** Deterministic order for color assignment. Canonical first; rest alphabetically. Same country = same color across Curated/All. */
export function orderForColors(
  actualIds: string[],
  canonicalOrder: string[],
  aliases?: Record<string, string>
): string[] {
  const toCanonical = (id: string) => (aliases && aliases[id]) ?? id;
  const canonicalSet = new Set(canonicalOrder);
  const inCanonical = actualIds.filter((id) => canonicalSet.has(toCanonical(id)));
  const notInCanonical = actualIds.filter((id) => !canonicalSet.has(toCanonical(id)));
  const rank = new Map(canonicalOrder.map((id, i) => [id, i]));
  inCanonical.sort((a, b) => (rank.get(toCanonical(a)) ?? 9999) - (rank.get(toCanonical(b)) ?? 9999));
  notInCanonical.sort((a, b) => a.localeCompare(b));
  return [...inCanonical, ...notInCanonical];
}

/** Map API/Comtrade variants to display names for consistent labels across all four plots. */
const DISPLAY_ALIASES: Record<string, string> = {
  ...EXPORTER_ALIASES,
  ...IMPORTER_ALIASES,
  // Comtrade variants (match backend COUNTRY_NORMALIZE)
  "Russian Federation": "Russia",
  "Republic of Korea": "South Korea",
  "Iran (Islamic Republic of)": "Iran",
  "United Arab Emirates": "UAE",
  "European Union": "EU",
  "Venezuela (Bolivarian Republic of)": "Venezuela",
  "Viet Nam": "Vietnam",
  "Chinese Taipei": "Taiwan",
  "Hong Kong, China": "Hong Kong",
  Türkiye: "Turkey",
};

export function toDisplayName(id: string): string {
  return DISPLAY_ALIASES[id] ?? id;
}

export { EXPORTER_ALIASES, IMPORTER_ALIASES };
