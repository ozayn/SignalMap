"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";

export type SankeyEdge = { source: string; target: string; value: number };

/** Remove cycles by keeping only edges from net exporters to net importers (left-to-right flow). */
function edgesToDag(edges: SankeyEdge[]): SankeyEdge[] {
  const exports: Record<string, number> = {};
  const imports: Record<string, number> = {};
  for (const e of edges) {
    exports[e.source] = (exports[e.source] ?? 0) + e.value;
    imports[e.target] = (imports[e.target] ?? 0) + e.value;
  }
  const net = (id: string) => (exports[id] ?? 0) - (imports[id] ?? 0);
  return edges.filter((e) => net(e.source) > net(e.target));
}

export const OIL_TRADE_NODE_COLOR_PALETTE = [
  "#1e40af", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2",
  "#65a30d", "#db2777", "#0d9488", "#ea580c", "#4f46e5", "#ca8a04",
  "#2563eb", "#c2410c", "#047857", "#7e22ce", "#0f766e", "#b91c1c",
  "#9333ea", "#15803d",
];

type OilTradeSankeyProps = {
  edges: SankeyEdge[];
  year?: string;
  /** Stable order for exporters (left column). From all years, e.g. by total exports. */
  exporterOrder?: string[];
  /** Stable order for color assignment. Same country = same color across years. */
  nodeColorOrder?: string[];
};

export function OilTradeSankey({ edges, year, exporterOrder = [], nodeColorOrder = [] }: OilTradeSankeyProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const labelColor = resolvedTheme === "dark" ? "#9ca3af" : "#374151";

  useEffect(() => {
    const el = chartRef.current;
    if (!el || edges.length === 0) return;

    const rect = el.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 800;
    const h = rect.height > 0 ? rect.height : 520;

    let chart = echarts.getInstanceByDom(el);
    if (!chart) chart = echarts.init(el);

    const validEdges = edges.filter((e) => Number.isFinite(e.value) && e.value > 0);
    const dagEdges = edgesToDag(validEdges);
    const exports: Record<string, number> = {};
    const imports: Record<string, number> = {};
    for (const e of dagEdges) {
      exports[e.source] = (exports[e.source] ?? 0) + e.value;
      imports[e.target] = (imports[e.target] ?? 0) + e.value;
    }
    const net = (id: string) => (exports[id] ?? 0) - (imports[id] ?? 0);
    const allIds = [...new Set(dagEdges.flatMap((e) => [e.source, e.target]))];
    const exporters = allIds.filter((id) => net(id) > 0);
    const importers = allIds.filter((id) => net(id) <= 0);

    const orderRank = new Map(exporterOrder.map((id, i) => [id, i]));
    const byExporterOrder = (a: string, b: string) => (orderRank.get(a) ?? 9999) - (orderRank.get(b) ?? 9999);
    const sortedExporters = exporterOrder.length > 0 ? [...exporters].sort(byExporterOrder) : exporters;

    const colorRank = new Map(nodeColorOrder.map((id, i) => [id, i]));
    const getColor = (name: string) =>
      OIL_TRADE_NODE_COLOR_PALETTE[(colorRank.get(name) ?? 9999) % OIL_TRADE_NODE_COLOR_PALETTE.length];
    const hexToRgba = (hex: string, alpha: number) => {
      const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!m) return hex;
      return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    };

    const nodes: Array<{ name: string; depth?: number; itemStyle?: { color: string } }> = [
      ...sortedExporters.map((name) => ({
        name,
        depth: 0,
        ...(nodeColorOrder.length > 0 && { itemStyle: { color: getColor(name) } }),
      })),
      ...importers.map((name) => ({
        name,
        depth: 1,
        ...(nodeColorOrder.length > 0 && { itemStyle: { color: hexToRgba(getColor(name), 0.6) } }),
      })),
    ];
    const links = dagEdges.map((e) => ({ source: e.source, target: e.target, value: e.value }));
    if (links.length === 0) {
      chart.dispose();
      return;
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        formatter: (params: unknown) => {
          const p = params as { data?: { value?: number; source?: string; target?: string }; value?: number };
          const v = p.data?.value ?? p.value ?? 0;
          const src = p.data?.source ?? "";
          const tgt = p.data?.target ?? "";
          if (src && tgt) {
            return `<strong>${src}</strong> → <strong>${tgt}</strong><br/>${v.toLocaleString()} thousand bbl/day`;
          }
          return `${v.toLocaleString()} thousand bbl/day`;
        },
      },
      graphic: [
        {
          type: "text",
          left: "5%",
          top: "1%",
          style: {
            text: "Exporters",
            fontSize: 12,
            fontWeight: 500,
            fill: labelColor,
          },
          z: 10,
        },
        {
          type: "text",
          right: "15%",
          top: "1%",
          style: {
            text: "Importers",
            fontSize: 12,
            fontWeight: 500,
            fill: labelColor,
          },
          z: 10,
        },
      ],
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          data: nodes,
          links,
          left: "5%",
          right: "15%",
          top: "5%",
          bottom: "5%",
          nodeWidth: 20,
          nodeGap: 8,
          layoutIterations: 0,
          lineStyle: {
            color: "source",
            curveness: 0.5,
          },
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 1,
          },
          label: {
            fontSize: 11,
            color: "#374151",
          },
        },
      ],
    };

    chart.resize({ width: w, height: h });
    chart.setOption(option, { notMerge: true });

    const resize = () => {
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) chart.resize({ width: r.width, height: r.height });
      }
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [edges, year, exporterOrder, nodeColorOrder, labelColor]);

  if (edges.length === 0) return null;

  return (
    <div
      ref={chartRef}
      className="w-full h-[70vh] md:h-[520px]"
      style={{ width: "100%", minHeight: 360 }}
    />
  );
}
