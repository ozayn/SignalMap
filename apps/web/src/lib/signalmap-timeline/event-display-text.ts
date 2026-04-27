/**
 * Titles, tooltips, cards: strip date-only `(...)` from display titles, format compact
 * non-redundant date lines (Gregorian / Solar / both; FA numerals on request).
 */

import {
  formatChartCategoryAxisYearLabel,
  getChartAxisYearDisplayParts,
  type ChartAxisYearMode,
  type ChartAxisNumeralLocale,
} from "@/lib/chart-axis-year";
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";
import { eventEndMs, parseYmdToUtcMs } from "@/lib/signalmap-timeline/viewport";
import type { BandTimelineEvent } from "@/lib/signalmap-band-timeline";
import type { SignalMapTimelineEvent } from "./types";

const PERSO = "۰۱۲۳۴۵۶۷۸۹";
const E_ARAB = "٠١٢٣٤٥٦٧٨٩";

function persianAndArabicDigitsToWestern(s: string): string {
  let o = s;
  for (let i = 0; i < PERSO.length; i++) o = o.split(PERSO[i]!).join(String(i));
  for (let i = 0; i < 10; i++) o = o.split(E_ARAB[i]!).join(String(i));
  return o;
}

function parenContentIsDateOnlyGroup(inner: string): boolean {
  const t = persianAndArabicDigitsToWestern(inner).replace(/\s/g, " ").trim();
  if (!/[\d]/.test(t)) return false;
  const rest = t
    .replace(/[\d\s,.\-–—]/g, "")
    .replace(/[a.m.A.M]/g, "")
    .trim();
  if (rest.length > 0) {
    if (/[A-Za-z]/.test(rest) || /[\u0600-\u06ff]{2,}/.test(inner)) {
      return false;
    }
  }
  const digits = t.replace(/[^\d]/g, "");
  return digits.length >= 2;
}

/** Strips trailing `(...)` when the inside is only digits, ranges, and separators. */
export function stripDateOnlyParenthesesFromTitle(title: string): string {
  let t = title.trim();
  for (let i = 0; i < 4; i++) {
    const m = t.match(
      /^(.*)[\s\u00A0\u200C]*[（(]\s*([^()（）]+?)\s*[)）][\s\u00A0\u200C]*$/
    );
    if (!m) break;
    const before = m[1] ?? "";
    const inner = m[2] ?? "";
    if (!parenContentIsDateOnlyGroup(inner)) break;
    t = before.replace(/\s+$/u, "").trim();
  }
  return t || title.trim();
}

const DAY = 86_400_000;

function isoYmd(ym: string | undefined | null): string {
  if (!ym) return "";
  const p = ym.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : "";
}

function ymdToUtcYmd(ymd: string): { y: number; m: number; d: number } {
  const p = ymd.slice(0, 10);
  const m = p.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { y: 0, m: 1, d: 1 };
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * `YYYY` range from two YYYY-MM-DD strings, calendar-aware, compact.
 */
function yearRangeLine(
  start10: string,
  end10: string,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): string {
  if (mode === "both") {
    const a = getChartAxisYearDisplayParts(start10);
    const b = getChartAxisYearDisplayParts(end10);
    if (a.gregorian && b.gregorian) {
      const gLine =
        a.gregorian === b.gregorian
          ? a.gregorian
          : `${a.gregorian}–${b.gregorian}`;
      if (a.jalali && b.jalali) {
        const pLine =
          a.jalali === b.jalali
            ? a.jalali
            : `${a.jalali}–${b.jalali}`;
        return `${localizeChartNumericDisplayString(gLine, numeralLoc)}\n${localizeChartNumericDisplayString(
          pLine,
          numeralLoc
        )}`;
      }
      return localizeChartNumericDisplayString(gLine, numeralLoc);
    }
  }
  const la = formatChartCategoryAxisYearLabel(start10, mode, numeralLoc);
  const lb = formatChartCategoryAxisYearLabel(end10, mode, numeralLoc);
  if (la === lb) {
    return la;
  }
  if (la.includes("\n") || lb.includes("\n")) {
    return [la, lb]
      .map((x) => x.replace(/\n/g, " · "))
      .join(" — ");
  }
  return `${la}–${lb}`;
}

/** One calendar day, no raw ISO: respect axis mode (G / J / G+J). */
function oneCalendarDay(
  ymd: string,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) {
    return localizeChartNumericDisplayString(ymd.slice(0, 32), numeralLoc);
  }
  if (mode === "both") {
    return formatChartCategoryAxisYearLabel(ymd.slice(0, 10), "both", numeralLoc);
  }
  if (mode === "jalali") {
    const t = ymdToUtcYmd(ymd);
    const y = t.y;
    const m = t.m - 1;
    const d = t.d;
    const base = new Date(Date.UTC(y, m, d));
    const s = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "UTC",
      calendar: "persian",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(base);
    return localizeChartNumericDisplayString(s, numeralLoc);
  }
  const t = ymdToUtcYmd(ymd);
  const y = t.y;
  const m = t.m - 1;
  const d = t.d;
  const base = new Date(Date.UTC(y, m, d));
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(base);
  return localizeChartNumericDisplayString(s, numeralLoc);
}

/** In-Gregorian-year day span, avoid ISO. */
function shortSpanInSameGYear(
  s10: string,
  e10: string,
  numeralLoc: ChartAxisNumeralLocale
): string {
  const t0 = parseYmdToUtcMs(s10);
  const t1 = parseYmdToUtcMs(e10);
  const a = new Date(t0);
  const b = new Date(t1);
  if (
    a.getUTCFullYear() !== b.getUTCFullYear() ||
    a.getUTCFullYear() < 1 ||
    b.getUTCFullYear() < 1
  ) {
    return "";
  }
  const y0 = a.getUTCFullYear();
  const s1 = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(a);
  const s2 = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(b);
  const tail = " " + String(y0);
  const out = s1 + " – " + s2 + tail;
  return localizeChartNumericDisplayString(out, numeralLoc);
}

/**
 * Display title for list / axis / tooltips: raw localized title, date bits removed
 * when they were in `(YYYY–YY)`-style parens.
 */
export function eventDisplayTitle(rawTitle: string): string {
  return stripDateOnlyParenthesesFromTitle(rawTitle);
}

export function formatSignalMapDotEventDateLine(
  e: SignalMapTimelineEvent,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): string {
  const s0 = (isoYmd(e.date_start) || e.date_start).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s0)) {
    return e.date_start;
  }
  const tStart = parseYmdToUtcMs(s0);
  const tEnd = eventEndMs(s0, e.date_end);
  if (!e.date_end) {
    return oneCalendarDay(s0, mode, numeralLoc);
  }
  const e0 = (isoYmd(e.date_end) || e.date_end).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(e0)) {
    return `${e.date_start} — ${e.date_end}`;
  }
  if (e0 === s0 || tEnd <= tStart) {
    return oneCalendarDay(s0, mode, numeralLoc);
  }
  if (tEnd < tStart + DAY) {
    return oneCalendarDay(s0, mode, numeralLoc);
  }
  const ay = ymdToUtcYmd(s0).y;
  const by = ymdToUtcYmd(e0).y;
  if (ay !== by) {
    return yearRangeLine(s0, e0, mode, numeralLoc);
  }
  if (tEnd - tStart < 200 * DAY) {
    return shortSpanInSameGYear(s0, e0, numeralLoc) || oneCalendarDay(s0, mode, numeralLoc);
  }
  return yearRangeLine(s0, e0, mode, numeralLoc);
}

export function formatSignalMapBandEventDateLine(
  e: BandTimelineEvent,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): string {
  if (e.kind === "point") {
    return oneCalendarDay(e.date, mode, numeralLoc);
  }
  const a = isoYmd(e.start_date) || e.start_date.slice(0, 10);
  const b = isoYmd(e.end_date) || e.end_date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(a) || !/^\d{4}-\d{2}-\d{2}/.test(b)) {
    return `${e.start_date} — ${e.end_date}`;
  }
  return yearRangeLine(a, b, mode, numeralLoc);
}

function isRedundantDateLine(
  displayTitle: string,
  line: string
): boolean {
  const a = displayTitle.replace(/\s+/g, " ").trim();
  const b = line.replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) && b.length >= 4) return true;
  if (b.includes(a) && a.length >= 4) return true;
  return false;
}

export function signalMapDotEventTooltipText(
  rawTitle: string,
  e: SignalMapTimelineEvent,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): { displayTitle: string; dateLine: string | null } {
  const displayTitle = eventDisplayTitle(rawTitle);
  const line = formatSignalMapDotEventDateLine(e, mode, numeralLoc);
  if (!line.trim()) {
    return { displayTitle, dateLine: null };
  }
  if (isRedundantDateLine(displayTitle, line)) {
    return { displayTitle, dateLine: null };
  }
  return { displayTitle, dateLine: line };
}

export function signalMapBandEventTooltipText(
  rawTitle: string,
  e: BandTimelineEvent,
  mode: ChartAxisYearMode,
  numeralLoc: ChartAxisNumeralLocale
): { displayTitle: string; dateLine: string | null } {
  const displayTitle = eventDisplayTitle(rawTitle);
  const line = formatSignalMapBandEventDateLine(e, mode, numeralLoc);
  if (!line.trim()) {
    return { displayTitle, dateLine: null };
  }
  if (isRedundantDateLine(displayTitle, line)) {
    return { displayTitle, dateLine: null };
  }
  return { displayTitle, dateLine: line };
}
