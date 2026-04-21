/**
 * Chart builders for the ISI diagnostics study (WDI multi-country panel).
 */

import type { ChartSeries } from "@/components/timeline-chart";
import { countryComparatorSeriesStyle } from "@/lib/chart-country-series-styles";
import { indexSeriesTo100, resolveCommonIndexBaseYear } from "@/lib/dutch-disease-overview-index";
import type { GdpLevelPoint } from "@/lib/gdp-levels-indexed";

export const ISI_COUNTRY_KEYS = ["brazil", "argentina", "india", "turkey", "iran"] as const;
export type IsiCountryKey = (typeof ISI_COUNTRY_KEYS)[number];

export type IsiDiagnosticsSeriesBundle = {
  imports_pct_gdp: Record<string, GdpLevelPoint[]>;
  exports_pct_gdp: Record<string, GdpLevelPoint[]>;
  manufacturing_pct_gdp: Record<string, GdpLevelPoint[]>;
  industry_pct_gdp: Record<string, GdpLevelPoint[]>;
  gdp_growth_pct: Record<string, GdpLevelPoint[]>;
};

function pick(series: Record<string, GdpLevelPoint[]> | undefined, country: string): GdpLevelPoint[] {
  if (!series) return [];
  return series[country] ?? [];
}

function countryStyle(c: IsiCountryKey) {
  return countryComparatorSeriesStyle(c) ?? { color: "#64748b", symbol: "circle" as const, legendIcon: "circle" as const };
}

/** EN/FA display names for panel countries (study page passes `L`). */
export function isiCountryLabel(c: IsiCountryKey, isFa: boolean): string {
  const t = (en: string, fa: string) => (isFa ? fa : en);
  switch (c) {
    case "brazil":
      return t("Brazil", "برزیل");
    case "argentina":
      return t("Argentina", "آرژانتین");
    case "india":
      return t("India", "هند");
    case "turkey":
      return t("Turkey", "ترکیه");
    case "iran":
      return t("Iran", "ایران");
    default:
      return c;
  }
}

/**
 * Four indexed WDI shares for one focus country (100 = value in base year, preferring 2000).
 */
export function buildIsiOverviewIndexedSeries(
  bundle: IsiDiagnosticsSeriesBundle | null,
  focus: IsiCountryKey,
  isFa: boolean
): { multiSeries: ChartSeries[]; baseYear: number } | null {
  if (!bundle) return null;
  const imp = pick(bundle.imports_pct_gdp, focus);
  const exp = pick(bundle.exports_pct_gdp, focus);
  const mfg = pick(bundle.manufacturing_pct_gdp, focus);
  const ind = pick(bundle.industry_pct_gdp, focus);
  const inputs = [
    { key: "ov_imp", points: imp },
    { key: "ov_exp", points: exp },
    { key: "ov_mfg", points: mfg },
    { key: "ov_ind", points: ind },
  ].filter((x) => x.points.length > 0);
  if (inputs.length < 2) return null;
  const baseYear = resolveCommonIndexBaseYear(inputs, 2000);
  if (baseYear == null) return null;

  const mk = (key: string, labelEn: string, labelFa: string, pts: GdpLevelPoint[], color: string, sym: ChartSeries["symbol"]): ChartSeries | null => {
    if (pts.length === 0) return null;
    const idx = indexSeriesTo100(pts, baseYear);
    if (!idx.some((p) => Number.isFinite(p.value))) return null;
    return {
      key,
      label: isFa ? labelFa : labelEn,
      yAxisIndex: 0,
      unit: "",
      points: idx,
      color,
      symbol: sym,
      showSymbol: false,
      lineWidth: 2.25,
    };
  };

  const multi: ChartSeries[] = [];
  const a = mk(
    "isi_ov_imp",
    "Imports (% of GDP), indexed",
    "واردات (٪ GDP)، شاخص‌شده",
    imp,
    "#6366f1",
    "circle"
  );
  const b = mk(
    "isi_ov_exp",
    "Exports (% of GDP), indexed",
    "صادرات (٪ GDP)، شاخص‌شده",
    exp,
    "#8b5cf6",
    "diamond"
  );
  const c = mk(
    "isi_ov_mfg",
    "Manufacturing (% of GDP), indexed",
    "تولیدات کارخانه‌ای (٪ GDP)، شاخص‌شده",
    mfg,
    "#16a34a",
    "rect"
  );
  const d = mk(
    "isi_ov_ind",
    "Industry (% of GDP), indexed",
    "صنعت (٪ GDP)، شاخص‌شده",
    ind,
    "#ca8a04",
    "triangle"
  );
  for (const x of [a, b, c, d]) if (x) multi.push(x);
  if (multi.length < 2) return null;
  return { multiSeries: multi, baseYear };
}

/** Chart 1: imports vs exports (% GDP), all countries. */
export function buildIsiTradeStructureMultiSeries(bundle: IsiDiagnosticsSeriesBundle | null, isFa: boolean): ChartSeries[] {
  if (!bundle) return [];
  const out: ChartSeries[] = [];
  for (const c of ISI_COUNTRY_KEYS) {
    const st = countryStyle(c);
    const lab = isiCountryLabel(c, isFa);
    const imp = pick(bundle.imports_pct_gdp, c);
    const exp = pick(bundle.exports_pct_gdp, c);
    if (imp.length > 0) {
      out.push({
        key: `${c}_imports_trade`,
        label: isFa ? `${lab} — واردات` : `${lab} — imports`,
        legendGroup: lab,
        legendMetric: isFa ? "واردات" : "Imports",
        yAxisIndex: 0,
        unit: "%",
        points: imp,
        color: st.color,
        symbol: st.symbol,
        showSymbol: false,
        lineWidth: 2,
      });
    }
    if (exp.length > 0) {
      const altSym: ChartSeries["symbol"] =
        st.symbol === "circle"
          ? "diamond"
          : st.symbol === "rect"
            ? "circle"
            : st.symbol === "diamond"
              ? "rect"
              : st.symbol === "roundRect"
                ? "triangle"
                : "circle";
      out.push({
        key: `${c}_exports_trade`,
        label: isFa ? `${lab} — صادرات` : `${lab} — exports`,
        legendGroup: lab,
        legendMetric: isFa ? "صادرات" : "Exports",
        yAxisIndex: 0,
        unit: "%",
        points: exp,
        color: st.color,
        symbol: altSym,
        showSymbol: false,
        lineWidth: 2,
        linePattern: "dashed",
      });
    }
  }
  return out;
}

/** Chart 2: manufacturing + industry (% GDP). */
export function buildIsiIndustrialMultiSeries(bundle: IsiDiagnosticsSeriesBundle | null, isFa: boolean): ChartSeries[] {
  if (!bundle) return [];
  const out: ChartSeries[] = [];
  for (const c of ISI_COUNTRY_KEYS) {
    const st = countryStyle(c);
    const lab = isiCountryLabel(c, isFa);
    const mfg = pick(bundle.manufacturing_pct_gdp, c);
    const ind = pick(bundle.industry_pct_gdp, c);
    if (mfg.length > 0) {
      out.push({
        key: `${c}_mfg`,
        label: isFa ? `${lab} — تولیدات کارخانه‌ای` : `${lab} — manufacturing`,
        legendGroup: lab,
        legendMetric: isFa ? "تولیدات کارخانه‌ای" : "Manufacturing",
        yAxisIndex: 0,
        unit: "%",
        points: mfg,
        color: st.color,
        symbol: st.symbol,
        showSymbol: false,
        lineWidth: 2,
      });
    }
    if (ind.length > 0) {
      const altSym: ChartSeries["symbol"] =
        st.symbol === "circle"
          ? "rect"
          : st.symbol === "rect"
            ? "diamond"
            : st.symbol === "diamond"
              ? "roundRect"
              : st.symbol === "roundRect"
                ? "triangle"
                : "circle";
      out.push({
        key: `${c}_industry`,
        label: isFa ? `${lab} — صنعت` : `${lab} — industry`,
        legendGroup: lab,
        legendMetric: isFa ? "صنعت" : "Industry",
        yAxisIndex: 0,
        unit: "%",
        points: ind,
        color: st.color,
        symbol: altSym,
        showSymbol: false,
        lineWidth: 2,
        linePattern: "dashed",
      });
    }
  }
  return out;
}

/** Chart 3: annual GDP growth (%), NY.GDP.MKTP.KD.ZG. */
export function buildIsiGdpGrowthMultiSeries(bundle: IsiDiagnosticsSeriesBundle | null, isFa: boolean): ChartSeries[] {
  if (!bundle) return [];
  const out: ChartSeries[] = [];
  for (const c of ISI_COUNTRY_KEYS) {
    const st = countryStyle(c);
    const pts = pick(bundle.gdp_growth_pct, c);
    if (pts.length === 0) continue;
    out.push({
      key: `${c}_gdp_growth`,
      label: isiCountryLabel(c, isFa),
      yAxisIndex: 0,
      unit: "%",
      points: pts,
      color: st.color,
      symbol: st.symbol,
      showSymbol: false,
      lineWidth: 2,
    });
  }
  return out;
}
