/**
 * Presentation (slide-ready) layout for PNG export.
 * Final image is 16:9 at base size × pixelRatio (e.g. 1920×1080 @2× for crisp slides).
 * Title and source are composited outside the ECharts canvas; chart height fills the remainder.
 */
export const PRESENTATION_SLIDE_BASE_WIDTH = 1920;
export const PRESENTATION_SLIDE_BASE_HEIGHT = 1080;
/** Chart canvas width always matches slide width; height is computed per export in `chart-export.ts`. */
export const PRESENTATION_EXPORT_CHART_WIDTH = PRESENTATION_SLIDE_BASE_WIDTH;
/** Sharp raster for PowerPoint / retina. */
export const PRESENTATION_EXPORT_PIXEL_RATIO = 2;

/** Target typography on the export chart surface (px at base slide width). Single source for all study PNG exports. */
export const PRESENTATION_EXPORT_FONTS = {
  title: 23,
  axisTick: 14,
  axisName: 16,
  axisNameLineHeight: 18,
  legend: 14,
  legendPage: 12,
  markLineLabel: 14,
  tooltip: 14,
  sourceGraphic: 12,
} as const;

/** Context for slide-style PNG export: title + source are drawn on the offscreen ECharts canvas (not the outer composite). */
export type PresentationEchartsExportContext = {
  chartTitle: string;
  sourceFooter?: string;
  direction?: "ltr" | "rtl";
};

/** Slide chrome in base (logical) pixels before `pixelRatio` scaling. */
export const PRESENTATION_COMPOSITE = {
  width: PRESENTATION_SLIDE_BASE_WIDTH,
  height: PRESENTATION_SLIDE_BASE_HEIGHT,
  titleTopPad: 8,
  titleFontMin: 30,
  titleFontMax: 42,
  titleToChartGap: 6,
  chartToFooterGap: 10,
  footerBottomPad: 6,
  sourceFontMin: 11,
  sourceFontMax: 13,
  horizontalPadding: 32,
  /** Minimum chart plot height so axes stay usable if titles wrap heavily. */
  chartSlotMin: 560,
  titleMaxLines: 3,
  footerMaxLines: 3,
} as const;

export type PresentationSlideLayout = {
  baseWidth: number;
  baseHeight: number;
  pixelRatio: number;
  chartSlotBaseH: number;
  padX: number;
  titleTopPad: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleLines: string[];
  titleToChartGap: number;
  chartToFooterGap: number;
  footerFontSize: number;
  footerLineHeight: number;
  footerLines: string[];
  footerBottomPad: number;
};

export type PresentationExportTitleParts = {
  /** Study / page title (e.g. localized study name). */
  studyHeading?: string;
  /** Series or panel label (chart metric). */
  metricLabel: string;
  /** Active chart range for year span in title. */
  timeRange?: [string, string];
};

/** True when study-style heading and metric label repeat the same idea (e.g. “Annual inflation…” vs “Inflation rate”). */
export function exportTitlesShareMetricRedundancy(heading: string, metric: string): boolean {
  const h = heading.trim();
  const m = metric.trim();
  if (!h || !m) return false;
  if (h === m) return true;
  const hn = h.toLowerCase();
  const mn = m.toLowerCase();
  if (hn.includes(mn) || mn.includes(hn)) return true;
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  const wh = tokenize(h);
  const wm = tokenize(m);
  if (wm.length === 0 || wh.length === 0) return false;
  const setH = new Set(wh);
  const setM = new Set(wm);
  if (wm.every((t) => setH.has(t))) return true;
  if (wh.every((t) => setM.has(t))) return true;
  return false;
}

/**
 * Shortens explicit slide titles like `Annual inflation rate — Inflation rate (1960–2026)`
 * to `Inflation rate (1960–2026)` when the em-dash parts are redundant.
 */
export function compactExportSlideTitleString(fullTitle: string): string {
  const t = fullTitle.trim();
  if (!t) return t;
  const yrMatch = t.match(/\s*(\([12]\d{3}[–-][12]\d{3}\))\s*$/);
  const yr = yrMatch ? yrMatch[1] : "";
  const body = yrMatch ? t.slice(0, yrMatch.index).trim() : t;
  const parts = body.split(/\s*[—–]\s*/);
  if (parts.length >= 2) {
    const left = parts[0]!.trim();
    const right = parts.slice(1).join(" — ").trim();
    if (left && right && exportTitlesShareMetricRedundancy(left, right)) {
      return yr ? `${right} ${yr}`.replace(/\s+/g, " ").trim() : right;
    }
  }
  return t;
}

/**
 * Slide title: prefer `Metric (years)` when heading is redundant with the metric; otherwise `Heading — Metric (years)`.
 */
export function buildPresentationExportTitle(parts: PresentationExportTitleParts): string {
  const m = parts.metricLabel.trim();
  const h = parts.studyHeading?.trim() ?? "";
  const a = parts.timeRange?.[0]?.trim().slice(0, 4);
  const b = parts.timeRange?.[1]?.trim().slice(0, 4);
  const yr = a && b && a.length === 4 && b.length === 4 ? `(${a}–${b})` : "";
  let core: string;
  if (h && m && h !== m) {
    core = exportTitlesShareMetricRedundancy(h, m) ? m : `${h} — ${m}`;
  } else if (h) {
    core = h;
  } else {
    core = m || "Chart";
  }
  const built = yr ? `${core} ${yr}`.replace(/\s+/g, " ").trim() : core;
  return compactExportSlideTitleString(built);
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function scaleRichForPresentation(rich: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!rich || typeof rich !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rich)) {
    if (!v || typeof v !== "object") {
      out[k] = v;
      continue;
    }
    const o = v as Record<string, unknown>;
    const fs = typeof o.fontSize === "number" ? o.fontSize : 12;
    const lh = typeof o.lineHeight === "number" ? o.lineHeight : Math.round(fs * 1.25);
    const factor = PRESENTATION_EXPORT_FONTS.axisTick / 12;
    out[k] = {
      ...o,
      fontSize: Math.round(fs * factor),
      lineHeight: Math.round(lh * factor),
    };
  }
  return out;
}

/** Grid margins (logical px @ 1920 wide): room for larger title, axis names, legend, and corner source without clipping. */
const PRESENTATION_EXPORT_GRID = {
  left: 70,
  right: 50,
  top: 70,
  bottom: 70,
  containLabel: true as const,
};

function formatExportSourceGraphicText(footer?: string): string | undefined {
  const t = footer?.trim();
  if (!t) return undefined;
  return t.toLowerCase().startsWith("source") ? t : `Source: ${t}`;
}

function buildPresentationTitlePatch(opt: Record<string, unknown>, chartTitle: string): Record<string, unknown> {
  const rawTitle = opt.title;
  const title0 = (Array.isArray(rawTitle) ? rawTitle[0] : rawTitle) as Record<string, unknown> | undefined;
  const prevTs = (title0?.textStyle ?? {}) as Record<string, unknown>;
  return {
    ...(title0 ?? {}),
    show: true,
    text: chartTitle,
    left: "center",
    top: 10,
    textStyle: {
      ...prevTs,
      fontSize: PRESENTATION_EXPORT_FONTS.title,
      fontWeight: 600,
      color: typeof prevTs.color === "string" ? prevTs.color : "#0f172a",
    },
  };
}

function normalizePresentationGridPatch(opt: Record<string, unknown>): unknown {
  const raw = opt.grid;
  const tight = { ...PRESENTATION_EXPORT_GRID };
  if (raw == null) return tight;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return tight;
    if (raw.length === 1) return tight;
    return raw.map(() => ({ ...tight }));
  }
  return tight;
}

/**
 * ECharts option patch for the offscreen export instance only (slide width × chart slot height).
 * Title + source are on the ECharts canvas; grid and typography are forced for consistent slide PNGs across studies.
 */
export function buildPresentationEchartsPatch(
  opt: Record<string, unknown>,
  ctx: PresentationEchartsExportContext
): Record<string, unknown> {
  const fonts = PRESENTATION_EXPORT_FONTS;
  const gridPatch = normalizePresentationGridPatch(opt);

  const patchAxis = (ax: Record<string, unknown>): Record<string, unknown> => {
    const al = (ax.axisLabel ?? {}) as Record<string, unknown>;
    const nt = (ax.nameTextStyle ?? {}) as Record<string, unknown>;
    const rich = al.rich as Record<string, unknown> | undefined;
    const hasName = typeof ax.name === "string" && ax.name.trim() !== "";
    const nameGapPatch =
      typeof ax.nameGap === "number"
        ? { nameGap: Math.max(52, Math.round(ax.nameGap * 1.05)) }
        : hasName
          ? { nameGap: 52 }
          : {};
    return {
      ...ax,
      ...nameGapPatch,
      axisLabel: {
        ...al,
        fontSize: fonts.axisTick,
        margin: typeof al.margin === "number" ? Math.max(al.margin, 12) : 12,
        ...(rich ? { rich: scaleRichForPresentation(rich) } : {}),
      },
      nameTextStyle: {
        ...nt,
        fontSize: fonts.axisName,
        lineHeight: fonts.axisNameLineHeight,
        padding: Array.isArray(nt.padding) ? (nt.padding as number[]).map((n) => Math.round(n * 1.15)) : nt.padding,
      },
    };
  };

  const xAxes = asArray(opt.xAxis).map((ax) => patchAxis(ax as Record<string, unknown>));
  const yAxes = asArray(opt.yAxis).map((ax) => patchAxis(ax as Record<string, unknown>));

  const legends = asArray(opt.legend).map((leg) => {
    const legRec = leg as Record<string, unknown>;
    const ts = (legRec.textStyle ?? {}) as Record<string, unknown>;
    const pts = (legRec.pageTextStyle ?? {}) as Record<string, unknown>;
    return {
      ...legRec,
      bottom: 12,
      itemWidth: 20,
      itemHeight: 10,
      textStyle: { ...ts, fontSize: fonts.legend },
      pageTextStyle: { ...pts, fontSize: fonts.legendPage },
    };
  });

  const patchMarkLineEntry = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(patchMarkLineEntry);
    if (!item || typeof item !== "object") return item;
    const row = item as Record<string, unknown>;
    const label = row.label as Record<string, unknown> | undefined;
    if (!label || label.show === false) return item;
    return {
      ...row,
      label: {
        ...label,
        fontSize: fonts.markLineLabel,
      },
    };
  };

  const series = asArray(opt.series).map((s) => {
    const sRec = s as Record<string, unknown>;
    const ml = sRec.markLine as Record<string, unknown> | undefined;
    let next: Record<string, unknown> = { ...sRec };
    if (ml && Array.isArray(ml.data)) {
      next = { ...next, markLine: { ...ml, data: (ml.data as unknown[]).map(patchMarkLineEntry) } };
    }
    const t = next.type;
    if (t != null && t !== "line") return next;
    const ls = (next.lineStyle ?? {}) as Record<string, unknown>;
    return {
      ...next,
      symbolSize: 4,
      lineStyle: { ...ls, width: 2 },
    };
  });

  const dir = ctx.direction ?? "ltr";
  const sourceText = formatExportSourceGraphicText(ctx.sourceFooter);
  const sourceGraphic = sourceText
    ? [
        {
          type: "text" as const,
          ...(dir === "rtl" ? { left: 10 } : { right: 10 }),
          bottom: 10,
          style: {
            text: sourceText,
            fontSize: fonts.sourceGraphic,
            fill: "#666666",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            textAlign: dir === "rtl" ? "right" : "left",
          },
          z: 200,
        },
      ]
    : [];

  const prevGraphics = asArray(opt.graphic).filter((g) => g != null);

  const rawTooltip = opt.tooltip;
  const tooltip0 = (Array.isArray(rawTooltip) ? rawTooltip[0] : rawTooltip) as Record<string, unknown> | undefined;
  const tooltipPatch =
    tooltip0 != null && typeof tooltip0 === "object"
      ? (() => {
          const tts = (tooltip0.textStyle ?? {}) as Record<string, unknown>;
          return {
            ...tooltip0,
            textStyle: { ...tts, fontSize: fonts.tooltip },
          };
        })()
      : null;

  const out: Record<string, unknown> = {
    title: buildPresentationTitlePatch(opt, ctx.chartTitle),
    animation: false,
    grid: gridPatch,
    graphic: [...prevGraphics, ...sourceGraphic],
  };
  if (tooltipPatch) out.tooltip = tooltipPatch;
  if (xAxes.length) out.xAxis = xAxes.length === 1 ? xAxes[0] : xAxes;
  if (yAxes.length) out.yAxis = yAxes.length === 1 ? yAxes[0] : yAxes;
  if (legends.length) out.legend = legends.length === 1 ? legends[0] : legends;
  if (series.length) out.series = series;
  return out;
}
