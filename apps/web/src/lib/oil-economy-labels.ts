/**
 * Copy and export footers for the Iran oil-economy overview (constant / nominal USD, CPI deflator).
 * CPI base year defaults to API `OIL_ECONOMY_CPI_BASE_YEAR` (2020) when inflation metadata is missing.
 */
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";

export const OIL_ECONOMY_CPI_BASE_YEAR_FALLBACK = 2020;

export type OilEconomyInflationLike = { base_year?: number | null } | null | undefined;

export function resolveOilEconomyCpiBaseYear(inflation: OilEconomyInflationLike): number {
  const y = inflation?.base_year;
  if (typeof y === "number" && Number.isFinite(y)) {
    return Math.trunc(y);
  }
  return OIL_ECONOMY_CPI_BASE_YEAR_FALLBACK;
}

const faNum = (n: string) => localizeChartNumericDisplayString(n, "fa");

/**
 * Main chart label / export metric line: “Estimated oil revenue (constant 2020 USD)”
 * (Farsi: “درآمد تخمینی نفت (دلار ثابت ۲۰۲۰)”).
 */
export function oilEconomyRevenueTitle(isFa: boolean, real: boolean, cpiBaseYear: number): string {
  if (!real) {
    return isFa ? "درآمد تخمینی نفت (دلار جاری)" : "Estimated oil revenue (USD)";
  }
  return isFa
    ? `درآمد تخمینی نفت (دلار ثابت ${faNum(String(cpiBaseYear))})`
    : `Estimated oil revenue (constant ${cpiBaseYear} USD)`;
}

/**
 * Y-axis name: “Estimated revenue (billion USD, constant 2020)”.
 * Use with `multiSeriesYAxisNameOverrides[0]`.
 */
export function oilEconomyRevenueYAxisName(isFa: boolean, real: boolean, cpiBaseYear: number): string {
  if (!real) {
    return isFa ? "درآمد تخمینی (میلیارد دلار، جاری)" : "Estimated revenue (billion USD, nominal prices)";
  }
  return isFa
    ? `درآمد تخمینی (میلیارد دلار، ثابت ${faNum(String(cpiBaseYear))})`
    : `Estimated revenue (billion USD, constant ${cpiBaseYear})`;
}

/**
 * Series `unit` for `gdp_levels` tick formatting (must include “usd”/“current”/“constant” for macro $ rules).
 */
export function oilEconomyRevenueSeriesUnitForTicks(isFa: boolean, real: boolean, cpiBaseYear: number): string {
  if (!real) {
    return isFa ? "میلیارد دلار/سال (جاری)" : "billion current USD/yr";
  }
  return isFa
    ? `میلیارد دلار/سال (ثابت ${faNum(String(cpiBaseYear))})`
    : `billion constant ${cpiBaseYear} USD/yr`;
}

export function oilEconomyPriceYAxisName(isFa: boolean, real: boolean, cpiBaseYear: number): string {
  if (!real) {
    return isFa ? "قیمت (دلار/بشکه، جاری)" : "Global oil price (USD/bbl, nominal prices)";
  }
  return isFa
    ? `قیمت (دلار/بشکه، ثابت ${faNum(String(cpiBaseYear))})`
    : `Global oil price (USD/bbl, constant ${cpiBaseYear})`;
}

export function oilEconomyPriceSeriesLabel(isFa: boolean): string {
  return isFa ? "قیمت نفت جهانی (میانگین سالانه)" : "Global oil price (annual mean)";
}

export function oilEconomyPriceSeriesUnitForTicks(isFa: boolean, real: boolean, cpiBaseYear: number): string {
  if (!real) {
    return isFa ? "دلار/بشکه (جاری)" : "USD/bbl, nominal";
  }
  return isFa ? `دلار/بشکه، ثابت ${faNum(String(cpiBaseYear))}` : `USD/bbl, constant ${cpiBaseYear}`;
}

/** Legend line: avoid repeating “constant” on the axis. */
export function oilEconomyRevenueLineLegendLabel(isFa: boolean, real: boolean): string {
  if (isFa) {
    return real ? "درآمد تخمینی" : "درآمد تخمینی (جاری)";
  }
  return "Est. oil revenue";
}

export function oilEconomyPanel1ChartLabel(
  isFa: boolean,
  real: boolean,
  cpiBaseYear: number
): string {
  if (!real) {
    return isFa ? "تولید و برنت" : "Production and Brent";
  }
  return isFa
    ? `تولید و برنت (قیمت: ثابت ${faNum(String(cpiBaseYear))} دلار/بشکه)`
    : `Production and Brent (price: constant ${cpiBaseYear} USD/bbl)`;
}

export function oilEconomyPanel1ExportTitle(
  studyTitle: string,
  isFa: boolean,
  real: boolean,
  cpiBaseYear: number
): string {
  const m = oilEconomyPanel1ChartLabel(isFa, real, cpiBaseYear);
  return `${studyTitle} — ${m}`;
}

type ExportVariant = "productionBrent" | "revenue" | "indexed";

/**
 * One-line export footer (no `Source:` prefix) with semicolons. `formatStudyExportSourceLine` adds `Source:`.
 */
export function buildOilEconomyExportSourceBody(
  isFa: boolean,
  variant: ExportVariant,
  real: boolean,
  cpiBaseYear: number
): string {
  const cpiEn = `; FRED CPIAUCSL (inflation adjustment, base year ${cpiBaseYear})`;
  const cpiFa = `؛ FRED CPIAUCSL (تعدیل تورم، سال پایه ${faNum(String(cpiBaseYear))})`;
  const cpi = real ? (isFa ? cpiFa : cpiEn) : "";

  if (isFa) {
    const brent = "Energy Institute؛ EIA/IMF (تولید)؛ FRED DCOILBRENTEU (قیمت برنت، میانگین سالانه)";
    const derived = "درآمد سالانه = تولید × قیمت (تقریبی)";
    if (variant === "revenue") {
      return `${brent}؛ ${derived}${cpi}`;
    }
    if (variant === "indexed") {
      return `${brent}؛ ${derived}؛ سه سری، شاخص ۱۰۰${cpi}`;
    }
    return `${brent}${cpi}`;
  }

  const brent = "Energy Institute; EIA/IMF (production); FRED DCOILBRENTEU (Brent, annual mean)";
  const derived = "annual revenue = production × price (est.)";
  if (variant === "revenue") {
    return `${brent}; ${derived}${cpi}`;
  }
  if (variant === "indexed") {
    return `${brent}; ${derived}; all series, indexed${cpi}`;
  }
  return `${brent}${cpi}`;
}

/** Shorter series names on the all-series index chart. */
export function oilEconomyIndexedRevenueSeriesLabel(
  isFa: boolean,
  real: boolean,
  cpiBaseYear: number
): string {
  if (!real) {
    return isFa ? "درآمد تخمینی (جاری)" : "Est. oil revenue (nominal)";
  }
  return isFa
    ? `درآمد تخمینی (دلار ثابت ${faNum(String(cpiBaseYear))})`
    : `Est. oil revenue (constant ${cpiBaseYear} USD)`;
}

export function oilEconomyIndexedPriceSeriesLabel(
  isFa: boolean,
  real: boolean,
  cpiBaseYear: number
): string {
  if (!real) {
    return isFa ? "قیمت نفت (میانگین، جاری)" : "Global oil price (annual mean, nominal)";
  }
  return isFa
    ? `قیمت نفت (دلار ثابت ${faNum(String(cpiBaseYear))}، بشکه)`
    : `Global oil price, annual mean (constant ${cpiBaseYear} USD/bbl)`;
}

export function oilEconomyIndexedExportTitle(
  studyTitle: string,
  isFa: boolean,
  real: boolean,
  indexBaseYear: number,
  cpiBaseYear: number
): string {
  const by = isFa ? faNum(String(indexBaseYear)) : String(indexBaseYear);
  if (!real) {
    return isFa
      ? `${studyTitle} — سری‌های شاخص (۱۰۰ = ${by})`
      : `${studyTitle} — All series, indexed (100 in ${indexBaseYear})`;
  }
  return isFa
    ? `${studyTitle} — شاخص‌شده (۱۰۰ = ${by}؛ قیمت و درآمد به دلار ثابت ${faNum(String(cpiBaseYear))})`
    : `${studyTitle} — All series, indexed (100 in ${indexBaseYear}; price & revenue, constant ${cpiBaseYear} USD)`;
}
