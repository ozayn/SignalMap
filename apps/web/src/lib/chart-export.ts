import type * as echarts from "echarts";

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

/**
 * Download the current ECharts canvas as PNG. Uses the live instance.
 * Callers should invoke after layout (e.g. double `requestAnimationFrame`) and `chart.resize()` if needed.
 */
export function downloadEchartsRaster(
  chart: echarts.ECharts,
  format: ChartRasterExportFormat,
  filenameStem: string,
  backgroundColor: string,
  opts?: DownloadEchartsRasterOptions
): void {
  if (format !== "png") return;
  const respectLegend = opts?.respectLegendSelection !== false;
  const footer = opts?.exportSourceFooter?.trim();
  const footerColor = opts?.exportSourceFooterColor ?? "#64748b";
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
}
