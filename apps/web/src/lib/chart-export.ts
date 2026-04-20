import type * as echarts from "echarts";
import * as echartsNS from "echarts";
import {
  PRESENTATION_EXPORT_CHART_WIDTH,
  PRESENTATION_EXPORT_PIXEL_RATIO,
  PRESENTATION_COMPOSITE,
  buildPresentationEchartsPatch,
  compactExportSlideTitleString,
  type PresentationSlideLayout,
} from "@/lib/chart-export-presentation";

/** Raster formats supported today; extend with `"svg"` when wiring vector export. */
export type ChartRasterExportFormat = "png";

export type ChartVectorExportFormat = "svg";

export type ChartImageExportFormat = ChartRasterExportFormat | ChartVectorExportFormat;

export function slugifyChartFilename(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "chart";
}

type LegendLike = {
  show?: boolean;
  data?: unknown[];
  selected?: Record<string, boolean>;
};

function asLegendArray(legend: unknown): LegendLike[] {
  if (legend == null) return [];
  return Array.isArray(legend) ? (legend as LegendLike[]) : [legend as LegendLike];
}

function legendEntryName(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "name" in entry && typeof (entry as { name: unknown }).name === "string") {
    return (entry as { name: string }).name;
  }
  return undefined;
}

function cloneOptionBranch<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function collectLegendControlledNames(legends: LegendLike[], selected: Record<string, boolean>): Set<string> {
  const names = new Set<string>();
  for (const key of Object.keys(selected)) {
    names.add(key);
  }
  for (const leg of legends) {
    if (!Array.isArray(leg.data)) continue;
    for (const d of leg.data) {
      const n = legendEntryName(d);
      if (n) names.add(n);
    }
  }
  return names;
}

function seriesShowSnapshot(series: unknown): { name?: string; show: boolean }[] {
  const list = Array.isArray(series) ? series : series != null ? [series] : [];
  return list.map((s) => {
    const o = s as { name?: unknown; show?: boolean };
    const name = typeof o.name === "string" ? o.name : undefined;
    return { name, show: o.show !== false };
  });
}

/**
 * Temporarily removes legend entries and line series that the user turned off via the legend,
 * so `getDataURL` matches what is visible on screen (lines + legend).
 * Returns a restore function that must be called (e.g. in `finally`).
 */
export function beginEchartsExportWithVisibleLegendSeriesOnly(chart: echarts.ECharts): () => void {
  const opt = chart.getOption() as { legend?: unknown; series?: unknown };
  const legends = asLegendArray(opt.legend).filter((l) => l.show !== false);
  if (legends.length === 0) {
    return () => {};
  }

  const selected: Record<string, boolean> = {};
  for (const leg of legends) {
    if (leg.selected && typeof leg.selected === "object") {
      Object.assign(selected, leg.selected);
    }
  }

  const controlled = collectLegendControlledNames(legends, selected);
  if (controlled.size === 0) {
    return () => {};
  }

  const hasHidden = [...controlled].some((n) => selected[n] === false);
  if (!hasHidden) {
    return () => {};
  }

  const legendBefore = cloneOptionBranch(opt.legend);
  const seriesBefore = seriesShowSnapshot(opt.series);

  const legendDataSnapshots = legends.map((leg) => (Array.isArray(leg.data) ? [...leg.data] : []));

  const seriesList = Array.isArray(opt.series) ? opt.series : opt.series != null ? [opt.series] : [];
  const seriesPatch = seriesList.flatMap((raw) => {
    const s = raw as { name?: string };
    const name = typeof s.name === "string" ? s.name : undefined;
    if (!name || !controlled.has(name)) return [];
    const visible = selected[name] !== false;
    return [{ name, show: visible }];
  });

  const legendPatch = legends.map((leg, idx) => {
    const data = legendDataSnapshots[idx] ?? [];
    const filtered = data.filter((d) => {
      const n = legendEntryName(d);
      if (!n) return true;
      return selected[n] !== false;
    });
    return { data: filtered };
  });

  chart.setOption(
    {
      series: seriesPatch,
      legend: legendPatch.length === 1 ? legendPatch[0] : legendPatch,
    },
    false
  );

  return () => {
    chart.setOption(
      {
        legend: legendBefore as never,
        series: seriesBefore
          .filter((s) => s.name != null)
          .map((s) => ({ name: s.name as string, show: s.show })),
      },
      false
    );
  };
}

export type DownloadEchartsRasterOptions = {
  /**
   * When true (default), PNG export temporarily drops legend-hidden series and their legend rows
   * so the file matches the interactive chart.
   */
  respectLegendSelection?: boolean;
  /** Full line for the PNG footer (e.g. `Source: World Bank, FRED`). Not shown on the live chart. */
  exportSourceFooter?: string;
  /** Muted footer text color (CSS color); defaults to slate gray. */
  exportSourceFooterColor?: string;
  /** Slide-style title above the chart (export only). */
  exportPresentationTitle?: string;
  /** Canvas `direction` for title/source text (e.g. `rtl` for FA charts). */
  exportPresentationDirection?: "ltr" | "rtl";
  /** Title text color (CSS). */
  exportPresentationTitleColor?: string;
};

/** Dedupe and join source publisher strings for an export footer body (no `Source:` prefix). */
export function joinExportSourceNames(parts: Array<string | null | undefined>): string | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t || t === "—" || t === "–") continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  if (out.length === 0) return undefined;
  return out.join(", ");
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Chart export: failed to decode PNG"));
    img.src = src;
  });
}

function layoutFooterLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number
): string[] {
  ctx.font = `${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width <= maxWidth) {
      cur = trial;
      continue;
    }
    if (cur) {
      lines.push(cur);
      cur = w;
    } else {
      let truncated = w;
      while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      lines.push(truncated.length < w.length ? `${truncated}…` : truncated);
      cur = "";
    }
    if (lines.length >= maxLines) return lines;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function layoutTitleLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  fontWeight: number | string = 600
): string[] {
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width <= maxWidth) {
      cur = trial;
      continue;
    }
    if (cur) {
      lines.push(cur);
      cur = w;
    } else {
      let truncated = w;
      while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      lines.push(truncated.length < w.length ? `${truncated}…` : truncated);
      cur = "";
    }
    if (lines.length >= maxLines) return lines;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

/**
 * Measures title + source chrome and returns chart pixel height so the final PNG is exactly 16:9
 * with the plot filling ~78–88% of slide height (PowerPoint-friendly).
 */
function layoutPresentationSlideChrome(titleRaw: string, sourceRaw: string | undefined): PresentationSlideLayout {
  const L = PRESENTATION_COMPOSITE;
  const BW = L.width;
  const BH = L.height;
  const PR = PRESENTATION_EXPORT_PIXEL_RATIO;
  const padX = L.horizontalPadding;
  const maxTextW = BW - padX * 2;
  const titleText = titleRaw.trim() || "Chart";
  const source = sourceRaw?.trim() ?? "";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fallback = (): PresentationSlideLayout => {
    const titleLH = Math.round(L.titleFontMin * 1.34);
    const titleBlock = L.titleTopPad + titleLH;
    const footerLH = Math.round(L.sourceFontMin * 1.36);
    const footerSeg = source ? L.chartToFooterGap + footerLH + L.footerBottomPad : 0;
    const chartSlotBaseH = Math.max(400, BH - titleBlock - L.titleToChartGap - footerSeg);
    return {
      baseWidth: BW,
      baseHeight: BH,
      pixelRatio: PR,
      chartSlotBaseH,
      padX,
      titleTopPad: L.titleTopPad,
      titleFontSize: L.titleFontMin,
      titleLineHeight: titleLH,
      titleLines: [titleText.length > 110 ? `${titleText.slice(0, 107)}…` : titleText],
      titleToChartGap: L.titleToChartGap,
      chartToFooterGap: L.chartToFooterGap,
      footerFontSize: L.sourceFontMin,
      footerLineHeight: footerLH,
      footerLines: source ? [source.length > 200 ? `${source.slice(0, 197)}…` : source] : [],
      footerBottomPad: L.footerBottomPad,
    };
  };

  if (!ctx) return fallback();

  let titleFont = L.titleFontMax;
  let best: PresentationSlideLayout | null = null;

  while (titleFont >= L.titleFontMin) {
    const titleLines = layoutTitleLines(ctx, titleText, maxTextW, titleFont, L.titleMaxLines, 700);
    const titleLH = Math.round(titleFont * 1.34);
    const titleBlock = L.titleTopPad + titleLines.length * titleLH;

    if (!source) {
      const chartSlotBaseH = BH - titleBlock - L.titleToChartGap;
      if (chartSlotBaseH >= L.chartSlotMin) {
        best = {
          baseWidth: BW,
          baseHeight: BH,
          pixelRatio: PR,
          chartSlotBaseH,
          padX,
          titleTopPad: L.titleTopPad,
          titleFontSize: titleFont,
          titleLineHeight: titleLH,
          titleLines,
          titleToChartGap: L.titleToChartGap,
          chartToFooterGap: L.chartToFooterGap,
          footerFontSize: L.sourceFontMax,
          footerLineHeight: Math.round(L.sourceFontMax * 1.36),
          footerLines: [],
          footerBottomPad: L.footerBottomPad,
        };
      }
    } else {
      let footerFont = L.sourceFontMax;
      while (footerFont >= L.sourceFontMin) {
        const footerLines = layoutFooterLines(ctx, source, maxTextW, footerFont, L.footerMaxLines);
        const footerLH = Math.round(footerFont * 1.36);
        const footerSegment =
          footerLines.length > 0 ? L.chartToFooterGap + footerLines.length * footerLH + L.footerBottomPad : 0;
        const chartSlotBaseH = BH - titleBlock - L.titleToChartGap - footerSegment;
        if (chartSlotBaseH >= L.chartSlotMin && footerLines.length > 0) {
          best = {
            baseWidth: BW,
            baseHeight: BH,
            pixelRatio: PR,
            chartSlotBaseH,
            padX,
            titleTopPad: L.titleTopPad,
            titleFontSize: titleFont,
            titleLineHeight: titleLH,
            titleLines,
            titleToChartGap: L.titleToChartGap,
            chartToFooterGap: L.chartToFooterGap,
            footerFontSize: footerFont,
            footerLineHeight: footerLH,
            footerLines,
            footerBottomPad: L.footerBottomPad,
          };
          break;
        }
        footerFont -= 1;
      }
    }

    if (best) break;
    titleFont -= 1;
  }

  return best ?? fallback();
}

/**
 * Composites title + chart + optional source into one 16:9 PNG (logical slide × pixelRatio).
 */
export async function compositePresentationSlidePng(opts: {
  chartDataUrl: string;
  layout: PresentationSlideLayout;
  backgroundColor: string;
  titleColor: string;
  footerColor: string;
  direction: "ltr" | "rtl";
}): Promise<string> {
  const img = await loadImageElement(opts.chartDataUrl);
  const layout = opts.layout;
  const BW = layout.baseWidth;
  const BH = layout.baseHeight;
  const PR = layout.pixelRatio;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(BW * PR);
  canvas.height = Math.round(BH * PR);
  const ctx = canvas.getContext("2d");
  if (!ctx) return opts.chartDataUrl;

  ctx.scale(PR, PR);
  try {
    ctx.direction = opts.direction;
  } catch {
    /* older engines */
  }

  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, BW, BH);

  const titleX = opts.direction === "rtl" ? BW - layout.padX : layout.padX;
  ctx.fillStyle = opts.titleColor;
  ctx.textAlign = opts.direction === "rtl" ? "right" : "left";
  ctx.textBaseline = "top";
  ctx.font = `700 ${layout.titleFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  let ty = layout.titleTopPad;
  for (const line of layout.titleLines) {
    ctx.fillText(line, titleX, ty);
    ty += layout.titleLineHeight;
  }

  const chartY = layout.titleTopPad + layout.titleLines.length * layout.titleLineHeight + layout.titleToChartGap;
  ctx.drawImage(img, 0, chartY, layout.baseWidth, layout.chartSlotBaseH);

  if (layout.footerLines.length > 0) {
    ctx.fillStyle = opts.footerColor;
    ctx.font = `${layout.footerFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = opts.direction === "rtl" ? "right" : "left";
    let fy = chartY + layout.chartSlotBaseH + layout.chartToFooterGap;
    for (const line of layout.footerLines) {
      ctx.fillText(line, titleX, fy);
      fy += layout.footerLineHeight;
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Draws `footerText` under the chart image (presentation-style source line). Export-only compositing.
 */
export async function compositePngDataUrlWithSourceFooter(
  chartDataUrl: string,
  footerText: string,
  backgroundColor: string,
  footerColor = "#64748b"
): Promise<string> {
  const img = await loadImageElement(chartDataUrl);
  const w = img.width;
  const h = img.height;
  const paddingX = Math.round(Math.max(12, w * 0.018));
  const paddingBottom = Math.round(Math.max(10, w * 0.012));
  const footerBand = Math.round(Math.max(40, Math.min(110, h * 0.09)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h + footerBand;
  const ctx = canvas.getContext("2d");
  if (!ctx) return chartDataUrl;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  let fontSize = Math.round(Math.max(11, Math.min(15, w / 72)));
  const maxTextWidth = w - paddingX * 2;
  let lines = layoutFooterLines(ctx, footerText, maxTextWidth, fontSize, 3);
  while (lines.length > 2 && fontSize > 10) {
    fontSize -= 1;
    lines = layoutFooterLines(ctx, footerText, maxTextWidth, fontSize, 3);
  }
  const lineHeight = Math.round(fontSize * 1.38);
  let y = h + footerBand - paddingBottom;
  ctx.fillStyle = footerColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.font = `${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i]!, paddingX, y);
    y -= lineHeight;
  }

  return canvas.toDataURL("image/png");
}

function triggerChartDownload(href: string, filenameStem: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = `${slugifyChartFilename(filenameStem)}.png`;
  a.rel = "noopener";
  a.click();
}

async function exportPresentationPngFromLiveChart(
  liveChart: echarts.ECharts,
  backgroundColor: string,
  opts: DownloadEchartsRasterOptions
): Promise<string> {
  const compactTitle = compactExportSlideTitleString((opts.exportPresentationTitle ?? "").trim() || "Chart");
  const layout = layoutPresentationSlideChrome(compactTitle, opts.exportSourceFooter?.trim());

  const hidden = document.createElement("div");
  hidden.setAttribute("aria-hidden", "true");
  hidden.style.cssText = `position:fixed;left:-9999px;top:0;width:${PRESENTATION_EXPORT_CHART_WIDTH}px;height:${layout.chartSlotBaseH}px;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(hidden);
  let exportChart: echartsNS.ECharts | null = null;
  try {
    exportChart = echartsNS.init(hidden, undefined, {
      width: PRESENTATION_EXPORT_CHART_WIDTH,
      height: layout.chartSlotBaseH,
      renderer: "canvas",
    });
    const baseOpt = liveChart.getOption() as Record<string, unknown>;
    exportChart.setOption(baseOpt as never, { notMerge: true });
    const merged = exportChart.getOption() as Record<string, unknown>;
    exportChart.setOption(buildPresentationEchartsPatch(merged) as never, false);
    exportChart.resize({
      width: PRESENTATION_EXPORT_CHART_WIDTH,
      height: layout.chartSlotBaseH,
    });

    const respectLegend = opts.respectLegendSelection !== false;
    let restore: (() => void) | null = null;
    let chartPng: string;
    try {
      if (respectLegend) {
        restore = beginEchartsExportWithVisibleLegendSeriesOnly(exportChart);
      }
      chartPng = exportChart.getDataURL({
        type: "png",
        pixelRatio: PRESENTATION_EXPORT_PIXEL_RATIO,
        backgroundColor,
      });
    } finally {
      restore?.();
    }

    const titleColor = opts.exportPresentationTitleColor ?? "#0f172a";
    const footerColor = opts.exportSourceFooterColor ?? "#64748b";

    return await compositePresentationSlidePng({
      chartDataUrl: chartPng,
      layout,
      backgroundColor,
      titleColor,
      footerColor,
      direction: opts.exportPresentationDirection ?? "ltr",
    });
  } finally {
    try {
      exportChart?.dispose();
    } catch {
      /* ignore */
    }
    hidden.remove();
  }
}

/**
 * Download PNG: 1920×1080 (× pixelRatio) slide with compact title + source and a tall offscreen ECharts render.
 * Reflects the live chart option (range, legend selection, locale, year labels); on-page UI is not captured.
 */
export function downloadEchartsRaster(
  chart: echarts.ECharts,
  format: ChartRasterExportFormat,
  filenameStem: string,
  backgroundColor: string,
  opts?: DownloadEchartsRasterOptions
): void {
  if (format !== "png") return;
  const footerColor = opts?.exportSourceFooterColor ?? "#64748b";
  const titleColor = opts?.exportPresentationTitleColor ?? "#0f172a";
  const mergedOpts: DownloadEchartsRasterOptions = {
    ...opts,
    exportSourceFooterColor: footerColor,
    exportPresentationTitleColor: titleColor,
  };

  void exportPresentationPngFromLiveChart(chart, backgroundColor, mergedOpts)
    .then((href) => triggerChartDownload(href, filenameStem))
    .catch(() => {
      const respectLegend = opts?.respectLegendSelection !== false;
      const footer = opts?.exportSourceFooter?.trim();
      let dataUrl = "";
      let restore: (() => void) | null = null;
      try {
        if (respectLegend) {
          restore = beginEchartsExportWithVisibleLegendSeriesOnly(chart);
        }
        dataUrl = chart.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor,
        });
      } finally {
        restore?.();
      }
      if (!footer) {
        triggerChartDownload(dataUrl, filenameStem);
        return;
      }
      void compositePngDataUrlWithSourceFooter(dataUrl, footer, backgroundColor, footerColor)
        .then((out) => triggerChartDownload(out, filenameStem))
        .catch(() => triggerChartDownload(dataUrl, filenameStem));
    });
}
