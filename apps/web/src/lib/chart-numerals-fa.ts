/**
 * Persian (Eastern Arabic-Indic) numerals for chart display when ``chartLocale === "fa"``.
 * Display-only: does not change underlying values.
 */

const DIGIT_MAP: Record<string, string> = {
  "0": "۰",
  "1": "۱",
  "2": "۲",
  "3": "۳",
  "4": "۴",
  "5": "۵",
  "6": "۶",
  "7": "۷",
  "8": "۸",
  "9": "۹",
};

/** Replace ASCII digits 0–9 with Persian digits. Leaves other characters unchanged. */
export function westernDigitsToPersianDigits(input: string): string {
  if (!input) return input;
  return input.replace(/[0-9]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

const ARABIC_THOUSANDS_SEP = "\u066c"; // ٬

/** After digit conversion, turn grouping commas between digits into Arabic thousands separator. */
function persianizeGroupingCommasBetweenDigits(input: string): string {
  let out = input;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/([۰-۹]),([۰-۹])/g, `$1${ARABIC_THOUSANDS_SEP}$2`);
  }
  return out;
}

/**
 * Mask ``href="..."`` / ``href='...'`` so digit conversion never corrupts URLs, then localize.
 */
export function localizeChartNumericDisplayString(
  input: string,
  chartLocale?: "en" | "fa"
): string {
  if (!input || chartLocale !== "fa") return input;

  const hrefBlocks: string[] = [];
  let masked = input.replace(/\bhref\s*=\s*"[^"]*"/gi, (m) => {
    hrefBlocks.push(m);
    return `@@HREF_${hrefBlocks.length - 1}@@`;
  });
  masked = masked.replace(/\bhref\s*=\s*'[^']*'/gi, (m) => {
    hrefBlocks.push(m);
    return `@@HREF_${hrefBlocks.length - 1}@@`;
  });

  let out = westernDigitsToPersianDigits(masked);
  out = out.replace(/%/g, "٪");
  out = persianizeGroupingCommasBetweenDigits(out);
  out = out.replace(/@@HREF_(\d+)@@/g, (_, i) => hrefBlocks[Number(i)] ?? "");
  return out;
}

/** Same as ``localizeChartNumericDisplayString`` — alias for tooltip HTML that may contain anchors. */
export const localizeChartNumericDisplayStringSafe = localizeChartNumericDisplayString;
