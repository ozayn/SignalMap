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

/**
 * Download the current ECharts canvas as PNG. Uses the live instance (same option as on screen).
 * SVG can be added later via `chart.renderToSVGString()` or equivalent without changing callers much.
 */
export function downloadEchartsRaster(
  chart: echarts.ECharts,
  format: ChartRasterExportFormat,
  filenameStem: string,
  backgroundColor: string
): void {
  if (format !== "png") return;
  const dataUrl = chart.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor,
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${slugifyChartFilename(filenameStem)}.png`;
  a.rel = "noopener";
  a.click();
}
