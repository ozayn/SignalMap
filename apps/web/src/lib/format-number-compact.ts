/**
 * Shared compact number display (SignalMap charts, PNG export, and study stats).
 *
 * - EN **axis** (absolute scale): k, M, B, T — max 1 decimal, half-up, trim `.0`, no `,` groupings
 *   (e.g. 950 → 950, 1200 → 1.2k, 1,250,000 → 1.3M, 1.2e9 → 1.2B).
 * - **FA** axis: Persian digits + `هزار` / `میلیون` / `میلیارد` / `تریلیون` (no Latin M/B in FA by default)
 * - **Tooltip** (`mode: "tooltip"`) uses spelled scales ("million" / "billion") and optional
 *   "… billion USD" / `… میلیارد دلار` for macro $ when `currency` and `valueScale: "billions"` apply
 *
 * When a series `unit` already means “values in billions of USD” (`unitSuggestsValuesAreInBillionsOfMajorUnit`),
 * **axis** ticks are plain (50, 100) and the “billion” is not repeated in the number string — align with
 * a y-axis name like “constant 2015 US$, billions”.
 */

import { westernDigitsToPersianDigits } from "./chart-numerals-fa";

export type NumberCompactLocale = "en" | "fa";

export type FormatNumberCompactMode = "axis" | "tooltip";

export type FormatNumberCompactOptions = {
  locale: NumberCompactLocale;
  /** @deprecated use `context` in new code; both mean axis vs tooltip */
  mode?: FormatNumberCompactMode;
  context?: FormatNumberCompactMode;
  /** @default 1 for axis; can be 1–2 for tooltip */
  decimals?: number;
  /**
   * - `absolute`: |v| is raw; use k–T for |v| ≥ 1_000.
   * - `billions`: |v| is already in billions; axis shows plain mantissa; tooltip says “N billion …”.
   * @default "absolute"
   */
  valueScale?: "absolute" | "billions";
  /**
   * Only for `mode: "tooltip"`. `none` = spelled scale only (e.g. “1.2 million”).
   * @default "none"
   */
  currency?: "none" | "USD" | "toman";
  /**
   * When false, never add k/M/B (or fa words) from magnitude tiers.
   * @default true
   */
  compactTiers?: boolean;
};

const TIERS = [
  { min: 1e12, absDiv: 1e12, enA: "T" as const, enLong: "trillion" as const, fa: "تریلیون" as const },
  { min: 1e9, absDiv: 1e9, enA: "B" as const, enLong: "billion" as const, fa: "میلیارد" as const },
  { min: 1e6, absDiv: 1e6, enA: "M" as const, enLong: "million" as const, fa: "میلیون" as const },
  { min: 1e3, absDiv: 1e3, enA: "k" as const, enLong: "thousand" as const, fa: "هزار" as const },
] as const;

function fin(v: number): boolean {
  return Number.isFinite(v);
}

function trimExtraZeros(n: string): string {
  if (n.includes(".")) {
    n = n.replace(/\.0+$/, "");
    n = n.replace(/(\.\d)0$/, "$1");
  }
  return n;
}

/**
 * One decimal, half away from zero (1.25 → 1.3) for tier-scaled display (e.g. 1,250,000 → 1.3M).
 */
function halfUpOneDecimal(v: number): string {
  if (!fin(v) || v === 0) return "0";
  const a = Math.abs(v);
  const s = v < 0 ? -1 : 1;
  const n = s * (Math.floor(a * 10 + 0.5 + 1e-9) / 10);
  if (Object.is(n, 0) || n === 0) return "0";
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-7) {
    return String(Math.round(n));
  }
  return trimExtraZeros(n.toFixed(1));
}

function formatMantissaAbs(v: number, maxDecimals: number): string {
  if (!fin(v)) return "—";
  if (v === 0) return "0";
  if (maxDecimals === 0) {
    return String(Math.round(v));
  }
  if (maxDecimals === 1) {
    return halfUpOneDecimal(v);
  }
  const r = Math.round(v * 100) / 100;
  if (Math.abs(r - Math.round(r)) < 1e-7) {
    return String(Math.round(r));
  }
  return trimExtraZeros(r.toFixed(2));
}

function formatPlainAbs(v: number, maxDec: number): string {
  if (!fin(v)) return "—";
  if (v === 0) return "0";
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-9) {
    return String(Math.round(v));
  }
  const a = Math.abs(v);
  const dec = a >= 10 ? 1 : Math.min(2, maxDec);
  const r = dec === 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  if (Math.abs(r - Math.round(r)) < 1e-7) {
    return String(Math.round(r));
  }
  return trimExtraZeros(r.toFixed(dec));
}

function toFa(n: string): string {
  return westernDigitsToPersianDigits(n);
}

/**
 * Primary API: one consistent formatter for SignalMap chart surfaces.
 */
export function formatNumberCompact(value: number, options: FormatNumberCompactOptions): string {
  if (!fin(value)) return "—";
  const {
    locale,
    mode: modeOpt,
    context,
    decimals = 1,
    valueScale = "absolute",
    currency = "none",
    compactTiers = true,
  } = options;

  const mode: FormatNumberCompactMode = (context ?? modeOpt ?? "axis") as FormatNumberCompactMode;
  const sign = value < 0;
  const v = Math.abs(value);
  const maxD = mode === "axis" ? 1 : Math.max(0, Math.min(2, decimals));

  if (valueScale === "billions") {
    const m = formatMantissaAbs(v, maxD);
    if (mode === "axis") {
      return locale === "fa" ? (sign ? "−" : "") + toFa(m) : (sign ? "-" : "") + m;
    }
    if (locale === "en" && currency === "USD") {
      return `${sign ? "-" : ""}${m} billion USD`;
    }
    if (locale === "fa" && currency === "USD") {
      return `${sign ? "−" : ""}${toFa(m)} میلیارد دلار`;
    }
    if (locale === "en" && currency === "toman") {
      return `${sign ? "-" : ""}${m} billion tomans (approx.)`;
    }
    if (locale === "fa" && currency === "toman") {
      return `${sign ? "−" : ""}${toFa(m)} میلیارد تومان (تقریبی)`;
    }
    if (mode === "tooltip" && currency === "none") {
      if (locale === "en") {
        return `${sign ? "-" : ""}${m} billion`;
      }
      return `${sign ? "−" : ""}${toFa(m)} میلیارد`;
    }
  }

  if (!compactTiers) {
    const s = (sign ? "-" : "") + formatPlainAbs(v, maxD);
    return locale === "fa" ? toFa(s) : s;
  }

  if (v < 1_000 && valueScale === "absolute") {
    const s = (sign ? "-" : "") + formatPlainAbs(v, 2);
    return locale === "fa" ? toFa(s) : s;
  }

  for (const t of TIERS) {
    if (v >= t.min) {
      const scaled = v / t.absDiv;
      const m = formatMantissaAbs(scaled, maxD);
      if (mode === "axis" && locale === "en") {
        return (sign ? "-" : "") + m + t.enA;
      }
      if (mode === "axis" && locale === "fa") {
        return (sign ? "−" : "") + toFa(m) + " " + t.fa;
      }
      if (mode === "tooltip" && locale === "en") {
        if (currency === "USD") {
          if (t.min === 1e3) {
            return (sign ? "-" : "") + m + " thousand USD";
          }
          return (sign ? "-" : "") + m + " " + t.enLong + " USD";
        }
        if (currency === "toman") {
          return (sign ? "-" : "") + m + " " + t.enLong + " tomans (approx.)";
        }
        return (sign ? "-" : "") + m + " " + t.enLong;
      }
      if (mode === "tooltip" && locale === "fa") {
        if (currency === "USD") {
          if (t.min === 1e3) {
            return (sign ? "−" : "") + toFa(m) + " هزار دلار";
          }
          return (sign ? "−" : "") + toFa(m) + " " + t.fa + " دلار";
        }
        if (currency === "toman") {
          return (sign ? "−" : "") + toFa(m) + " " + t.fa + " تومان (تقریبی)";
        }
        return (sign ? "−" : "") + toFa(m) + " " + t.fa;
      }
    }
  }

  const s = (sign ? "-" : "") + formatPlainAbs(v, 2);
  return locale === "fa" ? toFa(s) : s;
}

export function unitSuggestsValuesAreInBillionsOfMajorUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  const hasBillionToken = u.includes("billion") || /میلیارد/.test(unit);
  if (!hasBillionToken) return false;
  return u.includes("usd") || u.includes("us$") || u.includes("dollar") || /دلار/.test(unit);
}

export function unitSuggestsValuesInBillionsOfToman(unit: string): boolean {
  const u = unit.toLowerCase();
  return u.includes("billion") && (u.includes("toman") || u.includes("تومان"));
}

export function unitSuggestsThousandsAlreadyInUnitName(unit: string): boolean {
  return /\bthousand\b/i.test(unit) || /هزار/.test(unit);
}
