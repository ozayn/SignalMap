/**
 * Build human-readable source URLs and linkify chart footer / source-note text.
 * Live UI only — PNG export keeps plain text via `formatStudyExportSourceLine`.
 */

export type SourceFooterSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

/** World Bank `locations=` uses ISO 3166-1 alpha-2; map common ISO3 codes from study footers. */
const ISO3_TO_WB_LOCATION: Record<string, string> = {
  USA: "US",
  RUS: "RU",
  TUR: "TR",
  IRN: "IR",
  SAU: "SA",
  TJK: "TJ",
  CHN: "CN",
  KOR: "KR",
  DEU: "DE",
  GBR: "GB",
  JPN: "JP",
  IND: "IN",
  BRA: "BR",
  ARG: "AR",
  FRA: "FR",
  ITA: "IT",
  MEX: "MX",
  CAN: "CA",
  AUS: "AU",
};

/** WDI indicator codes (dotted). */
const WDI_INDICATOR_RE = /\b[A-Z]{1,3}\.[A-Z0-9]+(?:\.[A-Z0-9]+)*\b/g;

/** FRED series ids (no dots); applied only in FRED-context footers. */
const FRED_SERIES_RE = /\b[A-Z][A-Z0-9]{2,24}\b/g;

const FRED_TOKEN_BLOCKLIST = new Set([
  "UNITED",
  "STATES",
  "WORLD",
  "BANK",
  "FRED",
  "WDI",
  "SOURCE",
  "RUSSIA",
  "TURKEY",
  "SAUDI",
  "CHINA",
  "KOREA",
  "INDIA",
  "DERIVED",
  "NOMINAL",
  "REAL",
  "ANNUAL",
  "INDEX",
  "USA",
  "RUS",
  "TUR",
  "IRN",
  "SAU",
  "TJK",
  "CHN",
  "KOR",
  "DEU",
]);

export const SOURCE_FOOTER_LINK_CLASS =
  "text-inherit underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none";

export function buildFredSeriesUrl(code: string): string {
  return `https://fred.stlouisfed.org/series/${encodeURIComponent(code)}`;
}

export function buildWdiIndicatorUrl(indicator: string, iso3?: string | null): string {
  const id = encodeURIComponent(indicator);
  const loc = iso3 ? ISO3_TO_WB_LOCATION[iso3.toUpperCase()] : undefined;
  if (loc) {
    return `https://data.worldbank.org/indicator/${id}?locations=${encodeURIComponent(loc)}`;
  }
  return `https://data.worldbank.org/indicator/${id}`;
}

export function extractCountryIso3FromSourceText(text: string): string | null {
  const match = text.match(/\(([A-Z]{3})\)/);
  return match?.[1] ?? null;
}

function isFredContext(text: string): boolean {
  return /\bFRED\b/i.test(text);
}

type LinkSpan = { start: number; end: number; text: string; href: string };

function mergeLinkSpans(spans: LinkSpan[]): LinkSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: LinkSpan[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span.start < last.end) continue;
    out.push(span);
  }
  return out;
}

function collectLinkSpans(text: string, contextText?: string): LinkSpan[] {
  const spans: LinkSpan[] = [];
  const iso3 =
    extractCountryIso3FromSourceText(text) ??
    (contextText ? extractCountryIso3FromSourceText(contextText) : null);

  for (const match of text.matchAll(WDI_INDICATOR_RE)) {
    const code = match[0];
    const start = match.index ?? 0;
    spans.push({
      start,
      end: start + code.length,
      text: code,
      href: buildWdiIndicatorUrl(code, iso3),
    });
  }

  if (isFredContext(text) || (contextText ? isFredContext(contextText) : false)) {
    for (const match of text.matchAll(FRED_SERIES_RE)) {
      const code = match[0];
      if (code.includes(".")) continue;
      if (FRED_TOKEN_BLOCKLIST.has(code)) continue;
      const start = match.index ?? 0;
      if (spans.some((s) => start >= s.start && start < s.end)) continue;
      spans.push({
        start,
        end: start + code.length,
        text: code,
        href: buildFredSeriesUrl(code),
      });
    }
  }

  return mergeLinkSpans(spans);
}

/** Split a source footer / unit line into plain text and link segments. */
export function linkifySourceFooter(text: string, contextText?: string): SourceFooterSegment[] {
  if (!text.trim()) return [];

  const spans = collectLinkSpans(text, contextText);
  if (spans.length === 0) {
    return [{ type: "text", text }];
  }

  const segments: SourceFooterSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, span.start) });
    }
    segments.push({ type: "link", text: span.text, href: span.href });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }
  return segments;
}
