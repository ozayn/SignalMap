"use client";

import { useRef, useEffect, useState } from "react";
import * as echarts from "echarts";

export type NetworkNode = { id: string };
export type NetworkEdge = { source: string; target: string; value: number };

/** Major nodes: always show labels on mobile to reduce clutter. */
const MAJOR_NODES = new Set(["China", "India", "Russia", "Saudi Arabia", "United States", "EU"]);

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
  graphLeft: number,
  graphTop: number,
  graphSize: number
): [number, number] {
  const pos = NODE_POSITIONS[id];
  if (pos) {
    return [
      graphLeft + (pos[0] / 100) * graphSize,
      graphTop + (pos[1] / 100) * graphSize,
    ];
  }
  const angle = (index / total) * 2 * Math.PI;
  const cx = graphLeft + graphSize / 2;
  const cy = graphTop + graphSize / 2;
  return [cx + (graphSize / 4) * Math.cos(angle), cy + (graphSize / 4) * Math.sin(angle)];
}

type NetworkGraphProps = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  year?: string;
};

export function NetworkGraph({ nodes, edges, year }: NetworkGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 720 });

  useEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width || 800, height: rect.height || 720 });
    });
    observer.observe(el);
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width || 800, height: rect.height || 720 });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartRef.current || nodes.length === 0) return;

    const chart = echarts.init(chartRef.current);
    const { width, height } = containerSize;
    const isMobile = width < 768;
    const nodeSizeScale = isMobile ? 0.6 : 1;
    const graphSize = Math.max(300, Math.min(width - 80, height - 80));
    const graphLeft = (width - graphSize) / 2;
    const graphTop = (height - graphSize) / 2;

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

      const [x, y] = getNodePosition(n.id, i, nodes.length, graphLeft, graphTop, graphSize);
      // Nodes on the right edge: place label to the left so it stays visible
      const pos = NODE_POSITIONS[n.id];
      const labelPosition = pos && pos[0] >= 80 ? ("left" as const) : ("right" as const);

      const nodeSize = 18 + Math.sqrt(totalTrade);
      const showLabel = isMobile ? MAJOR_NODES.has(n.id) : true;

      return {
        name: n.id,
        x,
        y,
        symbol: "circle",
        symbolSize: nodeSize * nodeSizeScale,
        itemStyle: { color },
        label: {
          show: showLabel,
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
          position: labelPosition,
          distance: 6,
          backgroundColor: "rgba(255,255,255,0.8)",
          padding: [2, 4],
        },
        emphasis: {
          label: { show: true },
        },
      };
    });

    const lineWidthScale = isMobile ? 0.7 : 1;
    const graphLinks = edges.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        width: (Math.sqrt(e.value) / 4) * 0.8 * lineWidthScale,
        color: "rgba(59, 130, 246, 0.45)",
        curveness: 0.35,
      },
    }));

    const graphRight = (width - graphSize) / 2;
    const graphBottom = (height - graphSize) / 2;

    const option: echarts.EChartsOption = {
      series: [
        {
          type: "graph",
          layout: "none",
          roam: true,
          draggable: true,
          scaleLimit: { min: 0.5, max: 2.5 },
          symbol: "circle",
          left: graphLeft,
          right: graphRight,
          top: graphTop,
          bottom: graphBottom,
          data: graphNodes,
          links: graphLinks,
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [0, 6],
          emphasis: {
            focus: "adjacency",
          },
          lineStyle: {
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

    const resizeChart = () => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          chart.resize({ width: rect.width, height: rect.height });
        }
      }
    };
    resizeChart();
    window.addEventListener("resize", resizeChart);

    return () => {
      window.removeEventListener("resize", resizeChart);
      chart.dispose();
    };
  }, [nodes, edges, containerSize]);

  if (nodes.length === 0) return null;

  return (
    <div
      ref={chartRef}
      className="w-full h-[70vh] md:h-[520px]"
      style={{
        width: "100%",
        minHeight: 360,
      }}
    />
  );
}
