"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";
import { Button } from "@/components/ui/button";
import { ExportChartModal } from "@/components/export-chart-modal";
import { OIL_TRADE_NODE_COLOR_PALETTE } from "@/components/oil-trade-sankey";
import { useStudyChartExportFilenameContext } from "@/components/study-chart-export-filename-context";
import { downloadEchartsRaster, slugifyChartFilename, type DownloadEchartsRasterOptions } from "@/lib/chart-export";
import { buildStudyChartExportFilenameStem } from "@/lib/chart-export-filename";
import {
  buildPresentationExportTitle,
  DEFAULT_EXPORT_CHART_FONT_SIZES,
  type ExportChartFontSizes,
  type ExportChartSettings,
} from "@/lib/chart-export-presentation";
import { cssHsl } from "@/lib/utils";

export type NetworkNode = { id: string };
export type NetworkEdge = { source: string; target: string; value: number };

/** Major nodes: always show labels on mobile to reduce clutter. */
const MAJOR_NODES = new Set(["China", "India", "Iran", "Russia", "Saudi Arabia", "United States", "EU"]);

/** Fixed positions for stable layout across years. Normalized 5–95 to keep nodes inside graph. */
const NODE_POSITIONS: Record<string, [number, number]> = {
  "Saudi Arabia": [35, 45],
  Russia: [50, 18],
  "United States": [82, 42],
  Iran: [22, 52],
  Iraq: [28, 72],
  UAE: [55, 32],
  China: [50, 82],
  India: [32, 68],
  EU: [85, 55],
  Japan: [82, 72],
  "South Korea": [78, 28],
  Singapore: [68, 55],
  Turkey: [45, 55],
  "Türkiye": [45, 55],
  Canada: [72, 22],
  Brazil: [42, 78],
  Nigeria: [45, 38],
  Kuwait: [42, 55],
  Mexico: [28, 48],
  Norway: [55, 12],
  Algeria: [42, 52],
  Libya: [45, 48],
  Kazakhstan: [58, 28],
  Angola: [44, 58],
  Venezuela: [38, 72],
  Oman: [55, 55],
  Qatar: [52, 52],
  Colombia: [32, 72],
  Ecuador: [30, 75],
  Malaysia: [70, 68],
  Indonesia: [72, 62],
  Australia: [85, 82],
  Spain: [55, 52],
  Netherlands: [58, 50],
  Italy: [52, 50],
  France: [50, 48],
  Germany: [56, 45],
  "United Kingdom": [48, 40],
  Thailand: [70, 70],
  "Other exporters": [20, 35],
  "Other importers": [78, 75],
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
  onNodeClick?: (country: string) => void;
  /** Stable order for color assignment. Same country = same color as Sankey. */
  nodeColorOrder?: string[];
  /** Stable order for node positions. Same order = same location when switching years. */
  nodeOrder?: string[];
  /** All data mode: force layout, reduced clutter, top labels only. */
  isAllDataMode?: boolean;
  /** PNG export (ECharts) — same pipeline as time-series studies. */
  exportFileStem?: string;
  exportSourceFooter?: string;
  /** Override presentation title; defaults to `studyHeading` + network + year. */
  exportPresentationTitle?: string;
  exportPresentationStudyHeading?: string;
  chartLocale?: "en" | "fa";
};

const DEFAULT_EXPORT_STEM = "oil-trade-network";

const MIN_NODE_SIZE = 6;
const MAX_NODE_SIZE = 42;
const TOP_LABELS_COUNT = 15;

export function NetworkGraph({
  nodes,
  edges,
  year,
  onNodeClick,
  nodeColorOrder = [],
  nodeOrder = [],
  isAllDataMode = false,
  exportFileStem = DEFAULT_EXPORT_STEM,
  exportSourceFooter,
  exportPresentationTitle: exportPresentationTitleProp,
  exportPresentationStudyHeading,
  chartLocale = "en",
}: NetworkGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const exportFilenameCtx = useStudyChartExportFilenameContext();
  const { resolvedTheme } = useTheme();
  const [containerSize, setContainerSize] = useState({ width: 800, height: 720 });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalDefaults, setExportModalDefaults] = useState<{
    title: string;
    fontSizes: ExportChartFontSizes;
  }>({ title: "", fontSizes: { ...DEFAULT_EXPORT_CHART_FONT_SIZES } });
  const exporterBorderColor = resolvedTheme === "dark" ? "#fff" : "#374151";

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

  const buildExportPresentationTitle = useCallback(() => {
    const y = (year && String(year).slice(0, 4)) || new Date().getFullYear().toString();
    const yStart = `${y}-01-01`;
    const yEnd = `${y}-12-31`;
    return (
      exportPresentationTitleProp?.trim() ||
      buildPresentationExportTitle({
        studyHeading: exportPresentationStudyHeading ?? "Oil trade",
        metricLabel: `Network (${y})${isAllDataMode ? " · all data" : " · curated"}`,
        timeRange: [yStart, yEnd],
        chartLocale,
        yearAxisMode: "gregorian",
      })
    );
  }, [
    year,
    exportPresentationTitleProp,
    exportPresentationStudyHeading,
    isAllDataMode,
    chartLocale,
  ]);

  const openExportModal = useCallback(() => {
    setExportModalDefaults({
      title: buildExportPresentationTitle(),
      fontSizes: { ...DEFAULT_EXPORT_CHART_FONT_SIZES },
    });
    setExportModalOpen(true);
  }, [buildExportPresentationTitle]);

  const handleExportDownload = useCallback(
    (settings: ExportChartSettings) => {
      setExportModalOpen(false);
      const inst = chartInstanceRef.current;
      if (!inst) return;
      const y = (year && String(year).slice(0, 4)) || new Date().getFullYear().toString();
      const yStart = `${y}-01-01`;
      const yEnd = `${y}-12-31`;
      const backgroundColor = cssHsl("--background", "hsl(0, 0%, 100%)");
      const footerColor = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
      const titleColor = cssHsl("--foreground", "hsl(240, 10%, 3.9%)");
      const stem =
        exportFilenameCtx && exportFileStem
          ? buildStudyChartExportFilenameStem({
              studySlug: exportFilenameCtx.studySlug,
              chartFileStem: exportFileStem,
              locale: exportFilenameCtx.locale,
              yearAxisMode: "gregorian",
              selectedStart: yStart,
              selectedEnd: yEnd,
              defaultStart: yStart,
              defaultEnd: yEnd,
              rangeGranularity: "year",
            })
          : slugifyChartFilename(exportFileStem ?? DEFAULT_EXPORT_STEM);
      const titleForExport = settings.titleText.trim();
      const exportOpts: DownloadEchartsRasterOptions = {
        exportSourceFooter: exportSourceFooter?.trim(),
        exportSourceFooterColor: footerColor,
        exportPresentationTitle: titleForExport,
        exportPresentationAllowEmptyTitle: true,
        exportPresentationFontSizes: settings.fontSizes,
        exportPresentationDirection: chartLocale === "fa" ? "rtl" : "ltr",
        exportPresentationLocale: chartLocale === "fa" ? "fa" : "en",
        exportPresentationTitleColor: titleColor,
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            downloadEchartsRaster(inst, "png", stem, backgroundColor, exportOpts);
          } catch {
            /* instance disposed */
          }
        });
      });
    },
    [year, exportFileStem, exportFilenameCtx, exportSourceFooter, chartLocale]
  );

  useEffect(() => {
    if (!chartRef.current || nodes.length === 0) return;

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;
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

    const colorRank = new Map(nodeColorOrder.map((id, i) => [id, i]));
    const getColor = (id: string) =>
      OIL_TRADE_NODE_COLOR_PALETTE[(colorRank.get(id) ?? 9999) % OIL_TRADE_NODE_COLOR_PALETTE.length];
    const hexToRgba = (hex: string, alpha: number) => {
      const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!m) return `rgba(59, 130, 246, ${alpha})`;
      return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    };

    const totalTrade = (id: string) => (totalExports[id] ?? 0) + (totalImports[id] ?? 0);
    const tradeValues = nodes.map((n) => totalTrade(n.id)).filter((v) => v > 0);
    const minT = tradeValues.length > 0 ? Math.min(...tradeValues) : 0;
    const maxT = tradeValues.length > 0 ? Math.max(...tradeValues) : 1;
    const scaleSize = (v: number) => {
      if (maxT <= minT) return (MIN_NODE_SIZE + MAX_NODE_SIZE) / 2;
      const t = Math.max(0, Math.min(1, (v - minT) / (maxT - minT)));
      return MIN_NODE_SIZE + t * (MAX_NODE_SIZE - MIN_NODE_SIZE);
    };

    const orderedNodes =
      nodeOrder.length > 0
        ? [...nodes].sort((a, b) => {
            const ra = nodeOrder.indexOf(a.id);
            const rb = nodeOrder.indexOf(b.id);
            if (ra >= 0 && rb >= 0) return ra - rb;
            if (ra >= 0) return -1;
            if (rb >= 0) return 1;
            return totalTrade(b.id) - totalTrade(a.id);
          })
        : nodes;

    const sortedByTrade = [...orderedNodes]
      .map((n) => ({ n, t: totalTrade(n.id) }))
      .sort((a, b) => b.t - a.t);
    const topIds = new Set(sortedByTrade.slice(0, TOP_LABELS_COUNT).map((x) => x.n.id));

    const graphNodes = orderedNodes.map((n, i) => {
      const exports = totalExports[n.id] ?? 0;
      const imports = totalImports[n.id] ?? 0;
      const total = exports + imports;
      const exportRatio = total > 0 ? exports / total : 0.5;

      const color =
        nodeColorOrder.length > 0
          ? getColor(n.id)
          : exportRatio >= 0.6
            ? "#1e40af"
            : exportRatio <= 0.4
              ? "#60a5fa"
              : "#3b82f6";

      const isImporter = exportRatio <= 0.4;
      const itemStyle =
        nodeColorOrder.length > 0
          ? isImporter
            ? { color: hexToRgba(color, 0.5), borderWidth: 0 }
            : { color, borderColor: exporterBorderColor, borderWidth: 1.5 }
          : { color };

      const nodeSize = isAllDataMode
        ? scaleSize(total) * nodeSizeScale
        : (18 + Math.sqrt(total)) * nodeSizeScale;

      const showLabel = isAllDataMode
        ? topIds.has(n.id)
        : isMobile
          ? MAJOR_NODES.has(n.id)
          : true;

      const pos = NODE_POSITIONS[n.id];
      const labelPosition = pos && pos[0] >= 80 ? ("left" as const) : ("right" as const);

      const base: Record<string, unknown> = {
        name: n.id,
        symbol: "circle",
        symbolSize: nodeSize,
        itemStyle,
        label: {
          show: showLabel,
          fontSize: isAllDataMode ? 11 : 13,
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

      if (isAllDataMode) {
        const pos = NODE_POSITIONS[n.id];
        if (pos) {
          (base as Record<string, unknown>).x = graphLeft + (pos[0] / 100) * graphSize;
          (base as Record<string, unknown>).y = graphTop + (pos[1] / 100) * graphSize;
        } else {
          const cx = graphLeft + graphSize / 2;
          const cy = graphTop + graphSize / 2;
          const rank = nodeOrder.length > 0 ? nodeOrder.indexOf(n.id) : sortedByTrade.findIndex((x) => x.n.id === n.id);
          const idx = rank >= 0 ? rank : i;
          const total = orderedNodes.length;
          const angle = (idx / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
          const r = graphSize * 0.38;
          (base as Record<string, unknown>).x = cx + r * Math.cos(angle);
          (base as Record<string, unknown>).y = cy + r * Math.sin(angle);
        }
      } else {
        const [x, y] = getNodePosition(n.id, i, orderedNodes.length, graphLeft, graphTop, graphSize);
        (base as Record<string, unknown>).x = x;
        (base as Record<string, unknown>).y = y;
      }

      return base;
    });

    const linkHexToRgba = (hex: string, alpha: number) => {
      const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!m) return "rgba(59, 130, 246, 0.45)";
      return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    };
    const lineWidthScale = isMobile ? 0.7 : 1;
    const edgeOpacity = isAllDataMode ? 0.25 : 0.45;
    const edgeCurveness = isAllDataMode ? 0.18 : 0.35;
    const graphLinks = edges.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        width: (Math.sqrt(e.value) / 4) * 0.8 * lineWidthScale,
        color:
          nodeColorOrder.length > 0 ? linkHexToRgba(getColor(e.source), edgeOpacity) : `rgba(59, 130, 246, ${edgeOpacity})`,
        curveness: edgeCurveness,
      },
      ...(isAllDataMode && {
        emphasis: { lineStyle: { opacity: 0.9 } },
      }),
    }));

    const graphRight = (width - graphSize) / 2;
    const graphBottom = (height - graphSize) / 2;

    const seriesConfig: Record<string, unknown> = {
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
        curveness: edgeCurveness,
      },
      itemStyle: {
        borderColor: "#fff",
        borderWidth: 1,
      },
    };

    if (isAllDataMode) {
      (seriesConfig as Record<string, unknown>).emphasis = {
        focus: "adjacency",
        lineStyle: { opacity: 0.9 },
      };
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove|click",
        confine: true,
      },
      series: [seriesConfig],
    };

    chart.setOption(option, { notMerge: true });

    if (onNodeClick) {
      chart.on("click", (params) => {
        if (params.componentType === "series" && params.dataType === "node") {
          const name = params.data && typeof params.data === "object" && "name" in params.data ? params.data.name : null;
          if (typeof name === "string") onNodeClick(name);
        }
      });
    }

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
      chartInstanceRef.current = null;
      chart.off("click");
      window.removeEventListener("resize", resizeChart);
      chart.dispose();
    };
  }, [nodes, edges, containerSize, onNodeClick, nodeColorOrder, nodeOrder, exporterBorderColor, isAllDataMode]);

  if (nodes.length === 0) return null;

  return (
    <div className="w-full min-w-0">
      <ExportChartModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultTitle={exportModalDefaults.title}
        defaultFontSizes={exportModalDefaults.fontSizes}
        onExport={handleExportDownload}
        titleDir={chartLocale === "fa" ? "rtl" : "ltr"}
      />
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-md px-2.5 text-xs font-normal leading-none"
          onClick={openExportModal}
        >
          Export PNG
        </Button>
      </div>
      <div
        ref={chartRef}
        className="w-full h-[70vh] md:h-[520px]"
        style={{
          width: "100%",
          minHeight: 360,
        }}
      />
    </div>
  );
}
