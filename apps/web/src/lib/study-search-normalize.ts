/**
 * Normalizes user queries and study search index text for consistent matching
 * (English, Persian, Arabic script variants, digits, ZWNJ/diacritics).
 */

/** Combining marks often used in Arabic script (tashkīl / diacritics) — removed for search. */
const ARABIC_COMBINING_MARK =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1\u08E3-\u08FF]/g;
/** LRM, RLM, and other direction / format marks that should not affect matching. */
const BIDI_FORMAT = /[\u200e\u200f\u202a-\u202e\ufeff]/g;
/** Whitespace: collapse all runs to single ASCII space. */
const WS = /\s+/g;

/**
 * Collapses Persian/Indic-Arabic digit variants to ASCII 0–9 in the string (for id/year matching in search).
 */
function normalizeDigitsToAscii(s: string): string {
  // Persian: U+06F0–U+06F9
  const p = "۰۱۲۳۴۵۶۷۸۹";
  // Arabic-Indic: U+0660–U+0669
  const a = "٠١٢٣٤٥٦٧٨٩";
  let o = s;
  for (let i = 0; i < 10; i++) {
    const d = String(i);
    o = o.split(p[i]!).join(d);
    o = o.split(a[i]!).join(d);
  }
  return o;
}

/**
 * Unifies common Arabic vs Persian code points in user input and content (ي/ى → ی، ك → ک).
 */
function unifyPersianCodepoints(s: string): string {
  return s
    .replace(/\u064a/g, "\u06cc") // Arabic yeh
    .replace(/\u0649/g, "\u06cc") // Alef maksura–like
    .replace(/\u0643/g, "\u06a9"); // keh (Arabic kaf) → Persian kaf
}

/**
 * Use on both the search box query and the concatenated study `haystack`.
 * - Trims, collapses whitespace
 * - NFKC compatibility decomposition (includes half-width / compatibility forms)
 * - Strips ZWNJ (common in Persian compounding) so "میشود" vs "می‌شود" match
 * - Unifies ya/kaf, removes Arabic diacritics
 * - Maps Persian / Arabic-Indic digits to ASCII
 * - Lowercase (Latin, etc.)
 */
export function normalizeSearchText(input: string): string {
  if (!input) return "";
  let s = input
    .replace(BIDI_FORMAT, "")
    .replace(/[\u200c\u200d\u200b\u2060]/g, " ") // ZWNJ, ZWJ, ZWSP, WJ → space
    .replace(/[\u2009\u00a0\u202f]/g, " "); // thin/nbsp/narrow to space
  s = s.normalize("NFKC");
  s = unifyPersianCodepoints(s);
  s = s.replace(ARABIC_COMBINING_MARK, "");
  s = normalizeDigitsToAscii(s);
  s = s.toLowerCase();
  s = s.replace(WS, " ").trim();
  return s;
}
