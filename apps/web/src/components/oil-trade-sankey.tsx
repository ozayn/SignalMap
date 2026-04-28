"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";
import { formatNumberCompact } from "@/lib/format-number-compact";
import { Button } from "@/components/ui/button";
import { ExportChartModal } from "@/components/export-chart-modal";
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
  /** Stable order for importers (right column). If omitted, importers keep default order. */
  importerOrder?: string[];
  /** Stable order for color assignment. Same country = same color across years. */
  nodeColorOrder?: string[];
  /** All data mode: tuned layout, tooltip with share. */
  isAllDataMode?: boolean;
  exportFileStem?: string;
  exportSourceFooter?: string;
  exportPresentationTitle?: string;
  exportPresentationStudyHeading?: string;
  chartLocale?: "en" | "fa";
};

const DEFAULT_SANKEY_EXPORT_STEM = "oil-trade-sankey";

export function OilTradeSankey({
  edges,
  year,
  exporterOrder = [],
  importerOrder = [],
  nodeColorOrder = [],
  isAllDataMode = false,
  exportFileStem = DEFAULT_SANKEY_EXPORT_STEM,
  exportSourceFooter,
  exportPresentationTitle: exportPresentationTitleProp,
  exportPresentationStudyHeading,
  chartLocale = "en",
}: OilTradeSankeyProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalDefaults, setExportModalDefaults] = useState<{
    title: string;
    fontSizes: ExportChartFontSizes;
  }>({ title: "", fontSizes: { ...DEFAULT_EXPORT_CHART_FONT_SIZES } });
  const exportFilenameCtx = useStudyChartExportFilenameContext();
  const { resolvedTheme } = useTheme();
  const labelColor = resolvedTheme === "dark" ? "#9ca3af" : "#374151";

  const buildExportPresentationTitle = useCallback(() => {
    const y = (year && String(year).slice(0, 4)) || new Date().getFullYear().toString();
    const yStart = `${y}-01-01`;
    const yEnd = `${y}-12-31`;
    return (
      exportPresentationTitleProp?.trim() ||
      buildPresentationExportTitle({
        studyHeading: exportPresentationStudyHeading ?? "Oil trade",
        metricLabel: `Sankey (${y})${isAllDataMode ? " · all data" : " · curated"}`,
        timeRange: [yStart, yEnd],
        chartLocale,
        yearAxisMode: "gregorian",
      })
    );
  }, [year, exportPresentationTitleProp, exportPresentationStudyHeading, isAllDataMode, chartLocale]);

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
          : slugifyChartFilename(exportFileStem ?? DEFAULT_SANKEY_EXPORT_STEM);
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
            /* */
          }
        });
      });
    },
    [year, exportFileStem, exportFilenameCtx, exportSourceFooter, chartLocale]
  );

  useEffect(() => {
    const el = chartRef.current;
    if (!el || edges.length === 0) return;

    const rect = el.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 800;
    const h = rect.height > 0 ? rect.height : 520;

    let chart = echarts.getInstanceByDom(el);
    if (!chart) chart = echarts.init(el);
    chartInstanceRef.current = chart;

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

    const exporterRank = new Map(exporterOrder.map((id, i) => [id, i]));
    const byExporterOrder = (a: string, b: string) => (exporterRank.get(a) ?? 9999) - (exporterRank.get(b) ?? 9999);
    const sortedExporters = exporterOrder.length > 0 ? [...exporters].sort(byExporterOrder) : exporters;

    const importerRank = new Map(importerOrder.map((id, i) => [id, i]));
    const byImporterOrder = (a: string, b: string) => (importerRank.get(a) ?? 9999) - (importerRank.get(b) ?? 9999);
    const sortedImporters = importerOrder.length > 0 ? [...importers].sort(byImporterOrder) : importers;

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
      ...sortedImporters.map((name) => ({
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

    const exporterTotals: Record<string, number> = {};
    for (const e of dagEdges) {
      exporterTotals[e.source] = (exporterTotals[e.source] ?? 0) + e.value;
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove|click",
        formatter: (params: unknown) => {
          const p = params as { data?: { value?: number; source?: string; target?: string }; value?: number };
          const v = p.data?.value ?? p.value ?? 0;
          const src = p.data?.source ?? "";
          const tgt = p.data?.target ?? "";
          if (src && tgt) {
            const share = exporterTotals[src]
              ? ((v / exporterTotals[src]!) * 100).toFixed(1)
              : "—";
            const flow = formatNumberCompact(v, {
              locale: "en",
              mode: "tooltip",
              valueScale: "absolute",
              compactTiers: false,
              decimals: 0,
            });
            return isAllDataMode
              ? `<strong>Exporter:</strong> ${src}<br/><strong>Importer:</strong> ${tgt}<br/><strong>Flow:</strong> ${flow} thousand bbl/day<br/><strong>Share of exporter total:</strong> ${share}%`
              : `<strong>${src}</strong> → <strong>${tgt}</strong><br/>${flow} thousand bbl/day`;
          }
          return `${formatNumberCompact(v, { locale: "en", mode: "tooltip", valueScale: "absolute", compactTiers: false, decimals: 0 })} thousand bbl/day`;
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
            fontWeight: 700,
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
            fontWeight: 700,
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
          nodeWidth: isAllDataMode ? 18 : 20,
          nodeGap: isAllDataMode ? 12 : 8,
          nodeAlign: isAllDataMode ? "justify" : undefined,
          layoutIterations: isAllDataMode ? 32 : 0,
          lineStyle: {
            color: "source",
            curveness: 0.5,
            opacity: isAllDataMode ? 0.6 : 0.55,
          },
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 1,
          },
          label: {
            fontSize: 11,
            color: labelColor,
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
      chartInstanceRef.current = null;
      chart.dispose();
    };
  }, [edges, year, exporterOrder, importerOrder, nodeColorOrder, labelColor, isAllDataMode]);

  if (edges.length === 0) return null;

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
        style={{ width: "100%", minHeight: 360 }}
      />
    </div>
  );
}
