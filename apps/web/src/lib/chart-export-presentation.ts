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

/** Target typography on the export chart surface (px at base slide width). */
export const PRESENTATION_EXPORT_FONTS = {
  axisTick: 15,
  axisName: 18,
  axisNameLineHeight: 22,
  legend: 16,
  legendPage: 13,
  markLineLabel: 13,
} as const;

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

function parsePercent(s: unknown): number | null {
  if (s == null || typeof s !== "string") return null;
  const m = s.match(/^([\d.]+)%$/);
  return m ? parseFloat(m[1]) : null;
}

function bumpPercent(s: unknown, add: number, fallbackPct = 8, cap = 42): string {
  const p = parsePercent(s) ?? fallbackPct;
  return `${Math.min(cap, p + add)}%`;
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

/**
 * ECharts option patch applied only on the offscreen export instance (slide width × computed chart height).
 * Grid bumps stay small so the plot uses most of the export canvas (presentation-first).
 */
export function buildPresentationEchartsPatch(opt: Record<string, unknown>): Record<string, unknown> {
  const fonts = PRESENTATION_EXPORT_FONTS;
  const rawGrid = opt.grid;
  const grid0 = (
    Array.isArray(rawGrid) ? (rawGrid[0] as Record<string, unknown> | undefined) : (rawGrid as Record<string, unknown> | undefined)
  ) ?? {};
  const gridPatch = {
    ...grid0,
    left: bumpPercent(grid0.left, 1, 8, 16),
    right: bumpPercent(grid0.right, 1, 8, 34),
    top: bumpPercent(grid0.top, 1, 10, 20),
    bottom: bumpPercent(grid0.bottom, 2, 10, 28),
    containLabel: grid0.containLabel !== false,
  };

  const patchAxis = (ax: Record<string, unknown>): Record<string, unknown> => {
    const al = (ax.axisLabel ?? {}) as Record<string, unknown>;
    const nt = (ax.nameTextStyle ?? {}) as Record<string, unknown>;
    const rich = al.rich as Record<string, unknown> | undefined;
    const nameGapPatch =
      typeof ax.nameGap === "number"
        ? { nameGap: Math.round(ax.nameGap * 1.15) }
        : typeof ax.name === "string" && ax.name.trim() !== ""
          ? { nameGap: 58 }
          : {};
    return {
      ...ax,
      ...nameGapPatch,
      axisLabel: {
        ...al,
        fontSize: fonts.axisTick,
        margin: typeof al.margin === "number" ? Math.max(al.margin, 14) : 14,
        ...(rich ? { rich: scaleRichForPresentation(rich) } : {}),
      },
      nameTextStyle: {
        ...nt,
        fontSize: fonts.axisName,
        lineHeight: fonts.axisNameLineHeight,
        padding: Array.isArray(nt.padding) ? (nt.padding as number[]).map((n) => Math.round(n * 1.2)) : nt.padding,
      },
    };
  };

  const xAxes = asArray(opt.xAxis).map((ax) => patchAxis(ax as Record<string, unknown>));
  const yAxes = asArray(opt.yAxis).map((ax) => patchAxis(ax as Record<string, unknown>));

  const legends = asArray(opt.legend).map((leg) => {
    const legRec = leg as Record<string, unknown>;
    const ts = (legRec.textStyle ?? {}) as Record<string, unknown>;
    const pts = (legRec.pageTextStyle ?? {}) as Record<string, unknown>;
    const iw = typeof legRec.itemWidth === "number" ? legRec.itemWidth : 26;
    const ih = typeof legRec.itemHeight === "number" ? legRec.itemHeight : 10;
    return {
      ...legRec,
      bottom: typeof legRec.bottom === "number" ? Math.max(legRec.bottom, 6) : legRec.bottom ?? 8,
      itemWidth: Math.round(iw * 1.2),
      itemHeight: Math.round(ih * 1.12),
      itemGap: typeof legRec.itemGap === "number" ? Math.round(legRec.itemGap * 1.08) : 18,
      textStyle: { ...ts, fontSize: fonts.legend },
      pageTextStyle: { ...pts, fontSize: fonts.legendPage },
      pageIconSize: Array.isArray(legRec.pageIconSize)
        ? (legRec.pageIconSize as number[]).map((n) => Math.round(n * 1.2))
        : typeof legRec.pageIconSize === "number"
          ? Math.round(legRec.pageIconSize * 1.2)
          : 14,
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
    if (!ml || !Array.isArray(ml.data)) return sRec;
    const data = (ml.data as unknown[]).map(patchMarkLineEntry);
    return { ...sRec, markLine: { ...ml, data } };
  });

  const out: Record<string, unknown> = {
    title: { show: false },
    animation: false,
    grid: gridPatch,
  };
  if (xAxes.length) out.xAxis = xAxes.length === 1 ? xAxes[0] : xAxes;
  if (yAxes.length) out.yAxis = yAxes.length === 1 ? yAxes[0] : yAxes;
  if (legends.length) out.legend = legends.length === 1 ? legends[0] : legends;
  if (series.length) out.series = series;
  return out;
}
