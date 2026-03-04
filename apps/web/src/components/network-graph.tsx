"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";

export type NetworkNode = { id: string };
export type NetworkEdge = { source: string; target: string; value: number };

/** Fixed positions for stable layout across years. Normalized 0–100, scaled to pixels in use. */
const NODE_POSITIONS: Record<string, [number, number]> = {
  "Saudi Arabia": [35, 45],
  Russia: [50, 15],
  "United States": [85, 40],
  Iran: [20, 50],
  Iraq: [25, 75],
  UAE: [55, 30],
  China: [50, 85],
  India: [30, 70],
  EU: [90, 55],
  Japan: [85, 75],
  "South Korea": [80, 25],
  Singapore: [70, 55],
  Turkey: [45, 55],
  Canada: [75, 20],
};

function getNodePosition(
  id: string,
  index: number,
  total: number,
  width: number,
  height: number
): [number, number] {
  const margin = 80;
  const w = Math.max(400, width - margin * 2);
  const h = Math.max(400, height - margin * 2);
  const pos = NODE_POSITIONS[id];
  if (pos) {
    return [margin + (pos[0] / 100) * w, margin + (pos[1] / 100) * h];
  }
  const angle = (index / total) * 2 * Math.PI;
  return [width / 2 + 150 * Math.cos(angle), height / 2 + 150 * Math.sin(angle)];
}

type NetworkGraphProps = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  year?: string;
};

export function NetworkGraph({ nodes, edges, year }: NetworkGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || nodes.length === 0) return;

    const chart = echarts.init(chartRef.current);
    const rect = chartRef.current.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 720;

    // Compute trade role per node: source = exporter, target = importer
    const totalExports: Record<string, number> = {};
    const totalImports: Record<string, number> = {};
    for (const n of nodes) {
      totalExports[n.id] = 0;
      totalImports[n.id] = 0;
    }
    for (const e of edges) {
      totalExports[e.source] = (totalExports[e.source] ?? 0) + e.value;
      totalImports[e.target] = (totalImports[e.target] ?? 0) + e.value;
    }

    const graphNodes = nodes.map((n, i) => {
      const exports = totalExports[n.id] ?? 0;
      const imports = totalImports[n.id] ?? 0;
      const totalTrade = exports + imports;
      const exportRatio = totalTrade > 0 ? exports / totalTrade : 0.5;

      // Color by trade role: exporter = darker blue, importer = lighter blue, balanced = medium
      let color: string;
      if (exportRatio >= 0.6) color = "#1e40af"; // mostly exporter
      else if (exportRatio <= 0.4) color = "#60a5fa"; // mostly importer
      else color = "#3b82f6"; // balanced

      const [x, y] = getNodePosition(n.id, i, nodes.length, width, height);
      // Nodes on the right edge: place label to the left so it stays visible
      const pos = NODE_POSITIONS[n.id];
      const labelPosition = pos && pos[0] >= 80 ? ("left" as const) : ("right" as const);

      return {
        name: n.id,
        x,
        y,
        symbolSize: 18 + Math.sqrt(totalTrade),
        itemStyle: { color },
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 500,
          position: labelPosition,
          distance: 7,
        },
      };
    });

    const graphLinks = edges.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        width: Math.sqrt(e.value) / 4,
        opacity: 0.85,
        curveness: 0.35,
      },
    }));

    const option: echarts.EChartsOption = {
      series: [
        {
          type: "graph",
          layout: "none",
          roam: true,
          draggable: true,
          left: "5%",
          right: "5%",
          top: "5%",
          bottom: "5%",
          data: graphNodes,
          links: graphLinks,
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [4, 10],
          emphasis: {
            focus: "adjacency",
          },
          lineStyle: {
            color: "source",
            curveness: 0.35,
          },
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 1,
          },
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [nodes, edges]);

  if (nodes.length === 0) return null;

  return <div ref={chartRef} className="w-full" style={{ height: 720 }} />;
}
