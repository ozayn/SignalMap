/**
 * Indexed overlay for oil economy overview (production, Brent price, stylized revenue).
 */
import type { ChartSeries } from "@/components/timeline-chart";
import { indexSeriesTo100, resolveCommonIndexBaseYear, type DutchOverviewSeriesInput } from "@/lib/dutch-disease-overview-index";
import type { GdpLevelPoint } from "@/lib/gdp-levels-indexed";
import {
  OIL_ECONOMY_COLOR_PRODUCTION,
  OIL_ECONOMY_COLOR_PRICE,
  OIL_ECONOMY_COLOR_REVENUE,
} from "@/lib/signalmap-chart-colors";

export { OIL_ECONOMY_COLOR_PRODUCTION, OIL_ECONOMY_COLOR_PRICE, OIL_ECONOMY_COLOR_REVENUE };

export function buildOilEconomyIndexedMultiSeries(
  production: GdpLevelPoint[],
  price: GdpLevelPoint[],
  revenue: GdpLevelPoint[],
  labels: { production: string; price: string; revenue: string }
): { multiSeries: ChartSeries[]; baseYear: number } | null {
  const inputs: DutchOverviewSeriesInput[] = [
    { key: "prod", points: production },
    { key: "price", points: price },
    { key: "rev", points: revenue },
  ].filter((s) => s.points.length > 0);
  if (inputs.length < 2) return null;
  const baseYear = resolveCommonIndexBaseYear(inputs, 2000);
  if (baseYear == null) return null;

  const mk = (pts: GdpLevelPoint[], key: string, label: string, col: string, sym: ChartSeries["symbol"]): ChartSeries | null => {
    if (pts.length === 0) return null;
    const idx = indexSeriesTo100(pts, baseYear);
    if (!idx.some((p) => Number.isFinite(p.value))) return null;
    return {
      key,
      label,
      yAxisIndex: 0,
      unit: "",
      points: idx,
      color: col,
      symbol: sym,
      showSymbol: false,
      lineWidth: 2.25,
    };
  };
  const multi: ChartSeries[] = [];
  const a = mk(production, "oe_idx_prod", labels.production, OIL_ECONOMY_COLOR_PRODUCTION, "circle");
  const b = mk(price, "oe_idx_price", labels.price, OIL_ECONOMY_COLOR_PRICE, "triangle");
  const c = mk(revenue, "oe_idx_rev", labels.revenue, OIL_ECONOMY_COLOR_REVENUE, "diamond");
  for (const x of [a, b, c]) if (x) multi.push(x);
  if (multi.length < 2) return null;
  return { multiSeries: multi, baseYear };
}
