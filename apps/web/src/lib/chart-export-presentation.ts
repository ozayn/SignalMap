import {
  axisNameLooksPercentShare,
  computeNiceAxisBounds,
  pickNiceYStepForPercentLike,
} from "@/lib/chart-axis-nice";
import { formatYAxisTickPresentationExportFallback } from "@/lib/format-compact-decimal";
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";
import {
  type ChartAxisNumeralLocale,
  type ChartAxisYearMode,
  formatChartYearBothInlineCompact,
  getChartAxisYearDisplayParts,
} from "@/lib/chart-axis-year";

/**
 * Presentation (slide-ready) layout for PNG export.
 * Final image is 16:9 at base size × pixelRatio (e.g. 1920×1080 @2× for crisp slides).
 * Title and source are composited outside the ECharts canvas; chart height fills the remainder.
 */
export const PRESENTATION_SLIDE_BASE_WIDTH = 1920;
export const PRESENTATION_SLIDE_BASE_HEIGHT = 1080;
/** Chart canvas width always matches slide width; height is computed per export in `chart-export.ts`. */
export const PRESENTATION_EXPORT_CHART_WIDTH = PRESENTATION_SLIDE_BASE_WIDTH;
/** Sharp raster for PowerPoint / retina (higher = crisper axis text in PNG). */
export const PRESENTATION_EXPORT_PIXEL_RATIO = 3;

/** Target typography on the export chart surface (px at base slide width). Single source for all study PNG exports. */
export const PRESENTATION_EXPORT_FONTS = {
  title: 32,
  /** x/y axis value tick labels (slide legibility) */
  axisLabel: 21,
  axisName: 23,
  axisNameLineHeight: 28,
  legend: 20,
  legendPage: 18,
  markLineLabel: 20,
  tooltip: 19,
  sourceGraphic: 17,
  seriesLabel: 19,
} as const;

/** Context for slide-style PNG export: title + source are drawn on the offscreen ECharts canvas (not the outer composite). */
export type PresentationEchartsExportContext = {
  chartTitle: string;
  /** Second line under the slide title (export only), e.g. countries on + line-style hint. */
  chartSubtitle?: string;
  /** Export-only: colored dot + label row (typically countries still visible in the chart). */
  countryColorKey?: Array<{ label: string; color: string }>;
  /** Export-only: solid vs dashed metric labels drawn under the country row. */
  lineStyleKey?: { solidLabel: string; dashedLabel: string };
  sourceFooter?: string;
  direction?: "ltr" | "rtl";
  /** Matches live chart `chartLocale` (Persian digits in title/source when `fa`). */
  chartLocale?: "en" | "fa";
  /**
   * Offscreen export chart height (px). Used to place the country + line-style legend band above the source line.
   * Should match the height passed to `echarts.init` for presentation PNG export.
   */
  chartPixelHeight?: number;
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
  /** Matches live chart `chartLocale` (Persian digits in year span when `fa`). */
  chartLocale?: ChartAxisNumeralLocale;
  /** Matches live chart x-axis year mode (Gregorian / Solar Hijri / both). */
  yearAxisMode?: ChartAxisYearMode;
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

/** Strip noisy “reference” / dual-axis boilerplate so heading vs metric can be compared and merged cleanly. */
export function simplifyExportTitleText(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(/\(\s*dual-?\s*axis\s*,?\s*reference\s*\)/gi, " — dual-axis");
  t = t.replace(/\(\s*dual-?\s*axis\s*\)/gi, " — dual-axis");
  t = t.replace(/\(\s*reference\s*\)/gi, "");
  t = t.replace(/[（(]\s*مرجع\s*دو\s*محوره\s*[)）]/gu, " — دو محوره");
  t = t.replace(/[（(]\s*مرجع\s*[)）]/gu, "");
  t = t.replace(/\s*[—–]\s*dual-?\s*axis\s*,?\s*reference\s*$/i, "");
  t = t.replace(/\s*[—–]\s*نمودار\s*دو\s*محوره\s*$/u, "");
  t = t.replace(/\s*[—–]\s*dual-?\s*axis\s*$/i, "");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\s*[—–]\s*[—–]\s*/g, " — ");
  t = t.replace(/\(\s*\)/g, "").trim();
  return t.trim();
}

const EXPORT_TITLE_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "for",
  "to",
  "in",
  "on",
  "at",
  "per",
  "vs",
  "این",
  "از",
  "در",
  "به",
  "که",
  "با",
  "یا",
  "بر",
]);

function tokenizeExportTitleWords(s: string): string[] {
  const normalized = s.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "");
  const out: string[] = [];
  for (const m of normalized.matchAll(/[\p{L}\p{M}\p{N}]+(?:[-'][\p{L}\p{M}\p{N}]+)*/gu)) {
    const w = m[0]!.toLowerCase();
    if (w.length < 2 && !/[\u0600-\u06FF]/u.test(w)) continue;
    if (EXPORT_TITLE_STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

/** Jaccard similarity on word tokens (Unicode letters); used to avoid stacking near-duplicate study + chart titles. */
export function exportTitleTokenJaccard(a: string, b: string): number {
  const A = new Set(tokenizeExportTitleWords(a));
  const B = new Set(tokenizeExportTitleWords(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter++;
  }
  return inter / (A.size + B.size - inter);
}

function headingTokensSubsetOfMetric(heading: string, metric: string): boolean {
  const M = new Set(tokenizeExportTitleWords(metric));
  const ht = tokenizeExportTitleWords(heading);
  if (ht.length === 0) return false;
  return ht.every((t) => M.has(t));
}

function metricTokensSubsetOfHeading(heading: string, metric: string): boolean {
  const H = new Set(tokenizeExportTitleWords(heading));
  const mt = tokenizeExportTitleWords(metric);
  if (mt.length === 0) return false;
  return mt.every((t) => H.has(t));
}

const EXPORT_TITLE_JACCARD_PREFER_METRIC = 0.34;
const EXPORT_TITLE_JOIN_MAX_CHARS = 92;

/**
 * Builds a single-line study export title **core** (no year span): short, avoids repeating study + chart labels,
 * and drops low-value “reference” phrasing already normalized via {@link simplifyExportTitleText}.
 */
export function mergeConciseStudyExportTitleCore(studyHeading: string, metricLabel: string): string {
  const mh = simplifyExportTitleText(studyHeading.trim());
  const mm = simplifyExportTitleText(metricLabel.trim());

  if (!mh && !mm) return "Chart";
  if (!mh) return mm || "Chart";
  if (!mm) return mh;
  if (mh === mm) return mm;
  if (exportTitlesShareMetricRedundancy(mh, mm)) return mm;

  if (headingTokensSubsetOfMetric(mh, mm)) return mm;
  if (metricTokensSubsetOfHeading(mh, mm)) return mm;

  const j = exportTitleTokenJaccard(mh, mm);
  if (j >= EXPORT_TITLE_JACCARD_PREFER_METRIC) return mm;

  const joined = `${mh} — ${mm}`.replace(/\s+/g, " ").trim();
  if (joined.length > EXPORT_TITLE_JOIN_MAX_CHARS && mm.length >= 6) return mm;

  return joined;
}

/** Last balanced `(…)` at end of string (e.g. year span in ASCII or Persian digits). */
function extractTrailingParenGroup(s: string): { before: string; paren: string } | null {
  const t = s.trimEnd();
  if (!t.endsWith(")")) return null;
  let depth = 0;
  let openIdx = -1;
  for (let j = t.length - 1; j >= 0; j--) {
    const c = t[j]!;
    if (c === ")") depth++;
    else if (c === "(") {
      depth--;
      if (depth === 0) {
        openIdx = j;
        break;
      }
    }
  }
  if (openIdx < 0) return null;
  const paren = t.slice(openIdx);
  const before = t.slice(0, openIdx).trimEnd();
  return { before, paren };
}

/** Trailing `(…)` is treated as the year span only if it looks like a range (has digits + dash), not e.g. `(CPI)`. */
function isPlausibleYearRangeParen(paren: string): boolean {
  if (!paren.startsWith("(") || !paren.endsWith(")")) return false;
  const inner = paren.slice(1, -1);
  if (!/[–-]/.test(inner)) return false;
  if (!/[0-9۰-۹]/.test(inner)) return false;
  return true;
}

function extractTrailingYearParenGroup(s: string): { before: string; paren: string } | null {
  const ext = extractTrailingParenGroup(s);
  if (!ext || !isPlausibleYearRangeParen(ext.paren)) return null;
  return ext;
}

/**
 * Shortens explicit slide titles like `Annual inflation rate — Inflation rate (1960–2026)`
 * to `Inflation rate (1960–2026)` when the em-dash parts are redundant.
 * Trailing year `(…)` uses balanced parentheses so Persian-digit ranges still compact.
 */
export function compactExportSlideTitleString(fullTitle: string): string {
  const t = fullTitle.trim();
  if (!t) return t;
  const ext = extractTrailingYearParenGroup(t);
  const yr = ext?.paren ?? "";
  const body = ext ? ext.before : t;
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

function isoStartDateForYearLabel(iso: string): string {
  const s = iso.trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}/.test(s)) return `${s.slice(0, 4)}-01-01`;
  return "";
}

/**
 * Parenthesized year span for export / slide titles, aligned with x-axis calendar mode and digit locale.
 */
export function formatExportTitleYearSpan(
  timeRange: [string, string],
  yearAxisMode: ChartAxisYearMode,
  chartLocale: ChartAxisNumeralLocale
): string {
  const loc = chartLocale ?? "en";
  const a = isoStartDateForYearLabel(timeRange[0]);
  const b = isoStartDateForYearLabel(timeRange[1]);
  if (!a || !b) return "";

  if (yearAxisMode === "both") {
    const left = formatChartYearBothInlineCompact(a, loc);
    const right = formatChartYearBothInlineCompact(b, loc);
    const raw = `(${left}–${right})`;
    return localizeChartNumericDisplayString(raw, loc);
  }
  if (yearAxisMode === "jalali") {
    const pa = getChartAxisYearDisplayParts(a);
    const pb = getChartAxisYearDisplayParts(b);
    const js = (pa.jalali ?? pa.gregorian).trim();
    const je = (pb.jalali ?? pb.gregorian).trim();
    const raw = `(${js}–${je})`;
    return localizeChartNumericDisplayString(raw, loc);
  }
  const pa = getChartAxisYearDisplayParts(a);
  const pb = getChartAxisYearDisplayParts(b);
  const raw = `(${pa.gregorian}–${pb.gregorian})`;
  return localizeChartNumericDisplayString(raw, loc);
}

/**
 * Slide export title: concise merge of study heading + chart label (see {@link mergeConciseStudyExportTitleCore}),
 * then a compact localized year span. Digits follow the live chart axis (`yearAxisMode`, `chartLocale`).
 */
export function buildPresentationExportTitle(parts: PresentationExportTitleParts): string {
  const m = parts.metricLabel.trim();
  const h = parts.studyHeading?.trim() ?? "";
  const locale = parts.chartLocale ?? "en";
  const mode = parts.yearAxisMode ?? "gregorian";
  const yrSpan =
    parts.timeRange && parts.timeRange[0] && parts.timeRange[1]
      ? formatExportTitleYearSpan(parts.timeRange, mode, locale)
      : "";
  let core: string;
  if (h && m) {
    core = mergeConciseStudyExportTitleCore(h, m);
  } else if (h) {
    core = simplifyExportTitleText(h);
  } else {
    core = simplifyExportTitleText(m) || "Chart";
  }
  core = localizeChartNumericDisplayString(core, locale);
  const built = yrSpan ? `${core} ${yrSpan}`.replace(/\s+/g, " ").trim() : core;
  return localizeChartNumericDisplayString(compactExportSlideTitleString(built), locale);
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
    const factor = PRESENTATION_EXPORT_FONTS.axisLabel / 12;
    out[k] = {
      ...o,
      fontSize: Math.round(fs * factor),
      lineHeight: Math.round(lh * factor),
    };
  }
  return out;
}

/** Grid margins (logical px @ 1920 wide): room for title, long FA axis names, dual Y, legend, and source. */
const PRESENTATION_EXPORT_GRID = {
  /** Wider for Y-axis name vs tick space (billion-scaled $ axes, Farsi). */
  left: 100,
  right: 100,
  top: 80,
  bottom: 70,
  containLabel: true as const,
};

/** Strip any existing source prefixes so we can apply a single English `Source:` label. */
function stripExportSourcePrefixes(raw: string): string {
  return raw
    .trim()
    .replace(/^\s*source\s*:\s*/i, "")
    .replace(/^منبع\s*[:：]\s*/u, "")
    .replace(/^داده‌ها\s*[:：]\s*/u, "")
    .trim();
}

/**
 * Publisher line with English **Source:** prefix for PNGs and under-chart copy.
 * Prefix is never translated; with `chartLocale === "fa"` only digits (etc.) are localized.
 */
export function formatStudyExportSourceLine(footer: string | undefined, chartLocale: "en" | "fa"): string {
  const body = stripExportSourcePrefixes(footer ?? "");
  if (!body) return "";
  return localizeChartNumericDisplayString(`Source: ${body}`, chartLocale === "fa" ? "fa" : "en");
}

function exportAuxLegendHeight(ctx: PresentationEchartsExportContext): number {
  const n = ctx.countryColorKey?.length ?? 0;
  const ls = ctx.lineStyleKey;
  if (n === 0 && !ls) return 0;
  if (n > 0) {
    return ls ? 50 + 10 + 36 : 50;
  }
  return ls ? 36 : 0;
}

/** Room below the aux legend for the corner `Source:` line + a small gap (export canvas px). */
const EXPORT_AUX_LEGEND_SOURCE_RESERVE = 52;

/**
 * Bottom-band graphics for slide export: solid/dashed metric key sits just under the plot grid;
 * country color key sits below that; both sit above the `Source:` graphic so the title stays uncluttered.
 */
function buildPresentationExportAuxGraphics(ctx: PresentationEchartsExportContext): unknown[] {
  const countries = ctx.countryColorKey ?? [];
  const ls = ctx.lineStyleKey;
  if (countries.length === 0 && !ls) return [];

  const H = ctx.chartPixelHeight ?? 800;
  const bandH = exportAuxLegendHeight(ctx);
  const bandTop = Math.max(8, H - EXPORT_AUX_LEGEND_SOURCE_RESERVE - bandH);

  const W = PRESENTATION_EXPORT_CHART_WIDTH;
  const locale = ctx.chartLocale ?? "en";
  const rtl = (ctx.direction ?? "ltr") === "rtl";
  const textFill = "#0f172a";
  const stroke = "#0f172a";
  const fontSize = Math.max(16, PRESENTATION_EXPORT_FONTS.legend - 4);
  const font = `${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const g: unknown[] = [];
  const margin = 56;
  const n = countries.length;

  /** Line-style row upper in band (near plot); country row lower (see `exportAuxLegendHeight`). */
  let rowLineTop: number;
  let dividerTop: number;
  let rowCountryTop: number;
  if (n > 0 && ls) {
    rowLineTop = bandTop + 20;
    dividerTop = bandTop + 44;
    rowCountryTop = bandTop + 62;
  } else if (n > 0) {
    rowLineTop = bandTop;
    dividerTop = bandTop;
    rowCountryTop = bandTop + Math.round(bandH / 2);
  } else {
    rowLineTop = bandTop + Math.round(bandH / 2);
    dividerTop = bandTop;
    rowCountryTop = bandTop;
  }

  if (ls) {
    const solidText = localizeChartNumericDisplayString(ls.solidLabel, locale);
    const dashText = localizeChartNumericDisplayString(ls.dashedLabel, locale);
    const center = W / 2;
    /** Two blocks centered on `center ± blockCenterOffset` so long labels (e.g. Manufacturing) do not hit the other swatch. */
    const blockCenterOffset = 200;
    const cSolid = rtl ? center + blockCenterOffset : center - blockCenterOffset;
    const cDash = rtl ? center - blockCenterOffset : center + blockCenterOffset;
    const swatchW = 40;
    const gapAfterSwatch = 10;
    const solidLineLeft = cSolid - swatchW;
    const solidTextLeft = cSolid + gapAfterSwatch;
    const dashLineLeft = cDash - swatchW;
    const dashTextLeft = cDash + gapAfterSwatch;
    g.push(
      {
        type: "line",
        left: solidLineLeft,
        top: rowLineTop,
        shape: { x1: 0, y1: 0, x2: swatchW, y2: 0 },
        style: { stroke, lineWidth: 3, lineCap: "round" as const },
        z: 300,
        silent: true,
      },
      {
        type: "text",
        left: solidTextLeft,
        top: rowLineTop - 10,
        style: {
          text: solidText,
          font,
          fill: textFill,
          textAlign: "left" as const,
          textVerticalAlign: "middle" as const,
        },
        z: 300,
        silent: true,
      },
      {
        type: "line",
        left: dashLineLeft,
        top: rowLineTop,
        shape: { x1: 0, y1: 0, x2: swatchW, y2: 0 },
        style: { stroke, lineWidth: 3, lineCap: "round" as const, lineDash: [6, 5] },
        z: 300,
        silent: true,
      },
      {
        type: "text",
        left: dashTextLeft,
        top: rowLineTop - 10,
        style: {
          text: dashText,
          font,
          fill: textFill,
          textAlign: "left" as const,
          textVerticalAlign: "middle" as const,
        },
        z: 300,
        silent: true,
      }
    );
  }

  if (ls && n > 0 && dividerTop > bandTop) {
    g.push({
      type: "line",
      left: margin,
      top: dividerTop,
      shape: { x1: 0, y1: 0, x2: W - 2 * margin, y2: 0 },
      style: { stroke: "#cbd5e1", lineWidth: 1 },
      z: 300,
      silent: true,
    });
  }

  if (n > 0) {
    const inner = W - 2 * margin;
    const step = inner / n;
    for (let i = 0; i < n; i++) {
      const vis = rtl ? n - 1 - i : i;
      const cx = margin + (vis + 0.5) * step;
      const label = localizeChartNumericDisplayString(countries[i]!.label, locale);
      g.push({
        type: "circle",
        left: cx - 5,
        top: rowCountryTop - 5,
        shape: { cx: 5, cy: 5, r: 5 },
        style: { fill: countries[i]!.color },
        z: 300,
        silent: true,
      });
      g.push({
        type: "text",
        left: cx + 8,
        top: rowCountryTop - 10,
        style: {
          text: label,
          font,
          fill: textFill,
          textAlign: "left" as const,
          textVerticalAlign: "middle" as const,
        },
        z: 300,
        silent: true,
      });
    }
  }

  return g;
}

function buildPresentationTitlePatch(opt: Record<string, unknown>, ctx: PresentationEchartsExportContext): Record<string, unknown> {
  const rawTitle = opt.title;
  const title0 = (Array.isArray(rawTitle) ? rawTitle[0] : rawTitle) as Record<string, unknown> | undefined;
  const prevTs = (title0?.textStyle ?? {}) as Record<string, unknown>;
  const displayTitle = localizeChartNumericDisplayString(ctx.chartTitle.trim(), ctx.chartLocale ?? "en");
  const fs = PRESENTATION_EXPORT_FONTS.title;
  const subRaw = ctx.chartSubtitle?.trim();
  const subtextDisplay = subRaw ? localizeChartNumericDisplayString(subRaw, ctx.chartLocale ?? "en") : "";
  const subFs = Math.max(16, Math.round(fs * 0.48));
  return {
    ...(title0 ?? {}),
    show: true,
    text: displayTitle,
    left: "center",
    top: 8,
    width: "86%",
    textStyle: {
      ...prevTs,
      fontSize: fs,
      fontWeight: 600,
      lineHeight: Math.round(fs * 1.18),
      color: typeof prevTs.color === "string" ? prevTs.color : "#0f172a",
    },
    ...(subtextDisplay
      ? {
          subtext: subtextDisplay,
          itemGap: 10,
          subtextStyle: {
            fontSize: subFs,
            fontWeight: 500,
            lineHeight: Math.round(subFs * 1.38),
            color: "#475569",
          },
        }
      : {}),
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

// --- Export-only axis auto-fit (PNG export instances + brief live-chart fallback) ---

const EXPORT_X_PAD_FRACTION = 0.015;
const EXPORT_Y_PAD_FRACTION = 0.05;
const EXPORT_Y_MIN_SPAN_RATIO = 0.06;
const EXPORT_LOG_PAD_FRACTION = 0.05;

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function parseSeriesPoint(
  pt: unknown,
  xAxisType: string,
  categoryLabels: string[] | undefined,
  dataIndex: number
): { x: number; y: number } | null {
  if (pt == null) return null;
  if (typeof pt === "number") {
    if (!isFiniteNum(pt)) return null;
    if (xAxisType === "category" && categoryLabels && categoryLabels[dataIndex] != null) {
      const lab = String(categoryLabels[dataIndex]);
      const t = Date.parse(lab.slice(0, 10));
      if (!Number.isFinite(t)) return null;
      return { x: t, y: pt };
    }
    return null;
  }
  if (Array.isArray(pt)) {
    const xv = pt[0];
    const yv = pt[1];
    if (!isFiniteNum(yv)) return null;
    if (typeof xv === "number" && Number.isFinite(xv)) {
      return { x: xv, y: yv };
    }
    if (typeof xv === "string") {
      const t = Date.parse(xv.slice(0, 10));
      if (!Number.isFinite(t)) return null;
      return { x: t, y: yv };
    }
    return null;
  }
  if (typeof pt === "object" && pt !== null && "value" in pt) {
    const v = (pt as { value: unknown }).value;
    if (Array.isArray(v) && v.length >= 2) {
      return parseSeriesPoint(v, xAxisType, categoryLabels, dataIndex);
    }
  }
  return null;
}

function yAxisUsesLog(yAxis: Record<string, unknown> | undefined): boolean {
  return yAxis?.type === "log";
}

/**
 * Builds `{ xAxis, yAxis }` overrides so the export canvas uses only the visible data window
 * (legend-hidden series excluded via `show: false` on the export instance) with small padding.
 * Returns `null` when there is no usable numeric range.
 */
export type BuildExportDataFitOptions = {
  /**
   * When true, Y bounds use `computeNiceAxisBounds` + fixed `interval` (slide export only).
   * The live chart + simple PNG fallback keep raw padded min/max from data.
   */
  presentationSlide?: boolean;
};

export function buildExportDataFitAxisPatch(
  opt: Record<string, unknown>,
  fit?: BuildExportDataFitOptions
): Record<string, unknown> | null {
  const niceSlide = fit?.presentationSlide === true;
  const seriesList = asArray(opt.series).filter((s) => s != null) as Record<string, unknown>[];
  const xAxes = asArray(opt.xAxis) as Record<string, unknown>[];
  const yAxes = asArray(opt.yAxis) as Record<string, unknown>[];
  const x0 = xAxes[0];
  const xType = typeof x0?.type === "string" ? x0.type : "category";
  const categoryData =
    xType === "category" && Array.isArray(x0?.data) ? (x0!.data as unknown[]).map((c) => String(c)) : undefined;

  let xMin = Infinity;
  let xMax = -Infinity;
  let catIdxMin = Infinity;
  let catIdxMax = -Infinity;
  const yMinByAxis = new Map<number, number>();
  const yMaxByAxis = new Map<number, number>();

  const bumpY = (axisIdx: number, y: number) => {
    const lo = yMinByAxis.get(axisIdx) ?? Infinity;
    const hi = yMaxByAxis.get(axisIdx) ?? -Infinity;
    yMinByAxis.set(axisIdx, Math.min(lo, y));
    yMaxByAxis.set(axisIdx, Math.max(hi, y));
  };

  for (const s of seriesList) {
    if (s.show === false) continue;
    const st = s.type;
    if (st !== "line" && st !== "bar" && st !== "scatter") continue;
    const yAxisIndex = typeof s.yAxisIndex === "number" && Number.isFinite(s.yAxisIndex) ? Math.floor(s.yAxisIndex) : 0;
    const data = s.data;
    if (!Array.isArray(data)) continue;

    if (xType === "category" && categoryData) {
      for (let i = 0; i < data.length; i++) {
        const p = parseSeriesPoint(data[i], xType, categoryData, i);
        if (!p) continue;
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        catIdxMin = Math.min(catIdxMin, i);
        catIdxMax = Math.max(catIdxMax, i);
        bumpY(yAxisIndex, p.y);
      }
    } else if (xType === "time" || xType === "value") {
      for (let i = 0; i < data.length; i++) {
        const p = parseSeriesPoint(data[i], "time", undefined, i);
        if (!p) continue;
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        bumpY(yAxisIndex, p.y);
      }
    }
  }

  if (yMinByAxis.size === 0) return null;

  if (xType === "category" && categoryData) {
    if (!Number.isFinite(catIdxMin) || !Number.isFinite(catIdxMax) || catIdxMax < catIdxMin) return null;
  } else {
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax < xMin) return null;
  }

  const dataAxisMax = Math.max(0, ...yMinByAxis.keys(), ...yMaxByAxis.keys());
  const axisCount = Math.max(yAxes.length, dataAxisMax + 1);
  const yPatches: Record<string, unknown>[] = [];

  for (let ai = 0; ai < axisCount; ai++) {
    const yAx = yAxes[ai];
    let lo = yMinByAxis.get(ai);
    let hi = yMaxByAxis.get(ai);
    if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) {
      yPatches.push({});
      continue;
    }
    if (hi < lo) [lo, hi] = [hi, lo];

    const logAxis = yAxisUsesLog(yAx);
    let nymin: number;
    let nymax: number;

    if (logAxis) {
      const pos = (v: number) => v > 0 && Number.isFinite(v);
      if (!pos(lo) || !pos(hi)) {
        yPatches.push({});
        continue;
      }
      const logLo = Math.log(lo);
      const logHi = Math.log(hi);
      let logSpan = logHi - logLo;
      if (logSpan <= 0 || !Number.isFinite(logSpan)) {
        logSpan = EXPORT_Y_MIN_SPAN_RATIO;
      }
      const logPad = Math.max(logSpan * EXPORT_LOG_PAD_FRACTION, 1e-6);
      nymin = Math.exp(logLo - logPad);
      nymax = Math.exp(logHi + logPad);
      if (nymin <= 0 || !Number.isFinite(nymin)) nymin = lo * 0.92;
      if (nymax <= nymin || !Number.isFinite(nymax)) nymax = hi * 1.08;
    } else {
      const span = hi - lo;
      if (span <= 0 || !Number.isFinite(span)) {
        const mid = lo;
        const absPad = Math.max(Math.abs(mid) * EXPORT_Y_MIN_SPAN_RATIO, 1e-12);
        nymin = mid - absPad;
        nymax = mid + absPad;
      } else {
        const pad = span * EXPORT_Y_PAD_FRACTION;
        nymin = lo - pad;
        nymax = hi + pad;
        const minSpan = Math.max(span * EXPORT_Y_MIN_SPAN_RATIO, 1e-12);
        if (nymax - nymin < minSpan) {
          const mid = (lo + hi) / 2;
          nymin = mid - minSpan / 2;
          nymax = mid + minSpan / 2;
        }
      }
    }

    if (!logAxis) {
      const nm = String(yAx?.name ?? "");
      if (axisNameLooksPercentShare(nm) && lo >= 0 && Number.isFinite(hi)) {
        const step = pickNiceYStepForPercentLike(hi);
        const niceMax = Math.ceil(hi / step) * step;
        yPatches.push({
          min: 0,
          max: niceMax,
          interval: step,
          scale: false,
        });
        continue;
      }
    }

    if (!logAxis && niceSlide) {
      // `nymin`/`nymax` already include `EXPORT_Y_PAD_FRACTION`; only snap to clean min/max/interval here.
      const n = computeNiceAxisBounds(nymin, nymax, { maxTicks: 6, padFraction: 0 });
      yPatches.push({
        min: n.min,
        max: n.max,
        interval: n.interval,
        scale: false,
      });
      continue;
    }

    yPatches.push({
      min: nymin,
      max: nymax,
      scale: false,
    });
  }

  const yOut = yPatches.length === 1 ? yPatches[0]! : yPatches;

  if (xType === "category" && categoryData && categoryData.length > 0) {
    const idxSpan = Math.max(catIdxMax - catIdxMin, 0);
    const idxPad = Math.max(1, Math.ceil(Math.max(idxSpan, 1) * EXPORT_X_PAD_FRACTION));
    const minIdx = Math.max(0, catIdxMin - idxPad);
    const maxIdx = Math.min(categoryData.length - 1, catIdxMax + idxPad);
    const xCatPatch = { min: minIdx, max: maxIdx, minInterval: 0 };
    if (xAxes.length <= 1) return { xAxis: xCatPatch, yAxis: yOut };
    return {
      xAxis: xAxes.map((_, i) => (i === 0 ? xCatPatch : {})),
      yAxis: yOut,
    };
  }

  const xSpan = Math.max(xMax - xMin, 1);
  const xPad = xSpan * EXPORT_X_PAD_FRACTION;
  const nxMin = xMin - xPad;
  const nxMax = xMax + xPad;
  const xTimePatch: Record<string, unknown> = {
    min: nxMin,
    max: nxMax,
    minInterval: xType === "time" ? 0 : x0?.minInterval,
  };

  if (xAxes.length <= 1) {
    return { xAxis: xTimePatch, yAxis: yOut };
  }
  return {
    xAxis: xAxes.map((_, i) => (i === 0 ? xTimePatch : {})),
    yAxis: yOut,
  };
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
  const chartLocale: "en" | "fa" = ctx.chartLocale === "fa" ? "fa" : "en";

  /**
   * `echarts` may omit `axisLabel.formatter` on `getOption()`. Y value axes get a built-in compact tick
   * that matches live `formatGdpLevels` / per-unit heuristics (and avoids 12-digit “150000000000” labels).
   */
  const patchAxis = (isY: boolean) => (ax: Record<string, unknown>): Record<string, unknown> => {
    const al = (ax.axisLabel ?? {}) as Record<string, unknown> & { formatter?: unknown };
    const nt = (ax.nameTextStyle ?? {}) as Record<string, unknown>;
    const rich = al.rich as Record<string, unknown> | undefined;
    const hasName = typeof ax.name === "string" && ax.name.trim() !== "";
    const axisType: string =
      typeof ax.type === "string" ? ax.type : isY ? "value" : "category";
    const isValueY = isY && (axisType === "value" || axisType === "log");
    const nameStr = typeof ax.name === "string" ? ax.name : "";
    const nameGapBase = isY && isValueY && hasName ? 108 : 86;
    const nameGapPatch =
      typeof ax.nameGap === "number"
        ? { nameGap: Math.max(nameGapBase, Math.round(ax.nameGap * (isY && hasName ? 1.22 : 1.1))) }
        : hasName
          ? { nameGap: nameGapBase }
          : {};
    const origFormatter = al.formatter;
    let nextFormatter: unknown;
    if (!isY || !isValueY) {
      nextFormatter = origFormatter;
    } else if (typeof origFormatter === "function") {
      nextFormatter = origFormatter;
    } else if (origFormatter != null) {
      nextFormatter = origFormatter;
    } else {
      nextFormatter = (v: string | number) => {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) return String(v);
        return formatYAxisTickPresentationExportFallback(n, nameStr, chartLocale);
      };
    }
    const margin =
      isY && isValueY
        ? typeof al.margin === "number"
          ? Math.max(al.margin, 14)
          : 14
        : typeof al.margin === "number"
          ? Math.max(al.margin, 12)
          : 12;
    const axisLabelOut: Record<string, unknown> = {
      ...al,
      fontSize: fonts.axisLabel,
      margin,
      ...(rich ? { rich: scaleRichForPresentation(rich) } : {}),
    };
    if (isY && isValueY) {
      axisLabelOut.formatter = nextFormatter;
    }
    return {
      ...ax,
      ...nameGapPatch,
      axisLabel: axisLabelOut,
      nameTextStyle: {
        ...nt,
        fontSize: fonts.axisName,
        lineHeight: fonts.axisNameLineHeight,
        padding: Array.isArray(nt.padding) ? (nt.padding as number[]).map((n) => Math.round(n * 1.15)) : nt.padding,
      },
    };
  };

  const xAxes = asArray(opt.xAxis).map((ax) => patchAxis(false)(ax as Record<string, unknown>));
  const yAxes = asArray(opt.yAxis).map((ax) => patchAxis(true)(ax as Record<string, unknown>));

  const legends = asArray(opt.legend).map((leg) => {
    const legRec = leg as Record<string, unknown>;
    const ts = (legRec.textStyle ?? {}) as Record<string, unknown>;
    const pts = (legRec.pageTextStyle ?? {}) as Record<string, unknown>;
    return {
      ...legRec,
      bottom: 28,
      itemWidth: 32,
      itemHeight: 16,
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

  const patchSeriesTextLabels = (sRec: Record<string, unknown>): Record<string, unknown> => {
    let next: Record<string, unknown> = { ...sRec };
    const lab = next.label as Record<string, unknown> | undefined;
    if (lab && lab.show !== false) {
      next = { ...next, label: { ...lab, fontSize: fonts.seriesLabel } };
    }
    const endLab = next.endLabel as Record<string, unknown> | undefined;
    if (endLab && endLab.show !== false) {
      next = { ...next, endLabel: { ...endLab, fontSize: fonts.seriesLabel } };
    }
    const emph = next.emphasis as Record<string, unknown> | undefined;
    if (emph && emph.label && typeof emph.label === "object") {
      const el = emph.label as Record<string, unknown>;
      if (el.show !== false) {
        next = {
          ...next,
          emphasis: { ...emph, label: { ...el, fontSize: fonts.seriesLabel } },
        };
      }
    }
    return next;
  };

  const series = asArray(opt.series).map((s) => {
    const sRec = s as Record<string, unknown>;
    const ml = sRec.markLine as Record<string, unknown> | undefined;
    let next: Record<string, unknown> = patchSeriesTextLabels({ ...sRec });
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
  const sourceText = formatStudyExportSourceLine(ctx.sourceFooter ?? "", chartLocale) || undefined;
  const sourceGraphic = sourceText
    ? [
        {
          type: "text" as const,
          ...(dir === "rtl" ? { left: 14 } : { right: 14 }),
          bottom: 20,
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

  const prevGraphics = asArray(opt.graphic)
    .filter((g) => g != null)
    .map((g) => {
      const gr = g as Record<string, unknown>;
      if (gr.type !== "text" || !gr.style || typeof gr.style !== "object") return g;
      const st = gr.style as Record<string, unknown>;
      const prevFs = typeof st.fontSize === "number" ? st.fontSize : 0;
      return {
        ...gr,
        style: {
          ...st,
          fontSize: Math.max(prevFs, fonts.sourceGraphic),
        },
      };
    });

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

  const gridBase =
    typeof gridPatch === "object" && gridPatch != null && !Array.isArray(gridPatch)
      ? ({ ...(gridPatch as Record<string, unknown>) } as Record<string, unknown>)
      : { ...PRESENTATION_EXPORT_GRID };
  const subtitleBump = ctx.chartSubtitle?.trim() ? 64 : 0;
  const auxBump = exportAuxLegendHeight(ctx);
  if (subtitleBump > 0) {
    const curTop = typeof gridBase.top === "number" ? gridBase.top : PRESENTATION_EXPORT_GRID.top;
    gridBase.top = curTop + subtitleBump;
  }
  if (auxBump > 0) {
    const curBot = typeof gridBase.bottom === "number" ? gridBase.bottom : PRESENTATION_EXPORT_GRID.bottom;
    gridBase.bottom = curBot + auxBump;
  }

  const auxGraphics = buildPresentationExportAuxGraphics(ctx);

  const out: Record<string, unknown> = {
    title: buildPresentationTitlePatch(opt, ctx),
    animation: false,
    grid: gridBase,
    graphic: [...prevGraphics, ...sourceGraphic, ...auxGraphics],
  };
  if (tooltipPatch) out.tooltip = tooltipPatch;
  if (xAxes.length) out.xAxis = xAxes.length === 1 ? xAxes[0] : xAxes;
  if (yAxes.length) out.yAxis = yAxes.length === 1 ? yAxes[0] : yAxes;
  if (legends.length) out.legend = legends.length === 1 ? legends[0] : legends;
  if (series.length) out.series = series;
  return out;
}
