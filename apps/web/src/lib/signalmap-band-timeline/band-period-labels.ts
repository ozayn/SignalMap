import { toXPercent } from "@/lib/signalmap-timeline";
import { shouldShowNarrativeLabel } from "@/lib/signalmap-timeline/label-visibility";
import type { StudyLocale } from "@/lib/iran-study-fa";
import { getBandEventEndMs, getBandEventStartMs } from "./bounds";
import type { BandTimelineLane, BandTimelinePeriodEvent } from "./types";

const LABEL_PAD_PX = 10;
const LABEL_GAP_PX = 4;

function estimateTextWidthPx(text: string, lang: StudyLocale): number {
  const w = lang === "fa" ? 6.0 : 5.2;
  return text.length * w;
}

function intervalsTimeOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return !(a1 < b0 || b1 < a0);
}

function timeOverlapCount(
  p: BandTimelinePeriodEvent,
  all: readonly BandTimelinePeriodEvent[]
): number {
  const s0 = getBandEventStartMs(p);
  const s1 = getBandEventEndMs(p);
  let n = 0;
  for (const o of all) {
    if (intervalsTimeOverlap(s0, s1, getBandEventStartMs(o), getBandEventEndMs(o))) n++;
  }
  return n;
}

function labelPixelBox(
  leftPx: number,
  wPx: number,
  text: string,
  lang: StudyLocale
): { left: number; right: number } {
  const textW = Math.max(0, Math.min(estimateTextWidthPx(text, lang), wPx - 2 * LABEL_PAD_PX));
  const l = leftPx + LABEL_PAD_PX;
  const r = l + textW;
  return { left: l, right: r };
}

function rangeIntersects(a: { left: number; right: number }, b: { left: number; right: number }): boolean {
  return !(a.right + LABEL_GAP_PX < b.left || b.right + LABEL_GAP_PX < a.left);
}

type Cand = {
  p: BandTimelinePeriodEvent;
  wPx: number;
  leftPx: number;
  displayTitle: string;
  score: number;
};

export type BuildBandLabelOpts = {
  viewStart: number;
  viewEnd: number;
  trackWidth: number;
  viewPortion: number;
  hoveredId: string | null;
  selectedId: string | null;
  lang: StudyLocale;
  minLabelWidthPx: number;
  getTitle: (e: BandTimelinePeriodEvent) => string;
};

/**
 * Picks which period rows may draw in-band text: no horizontal label-box overlap
 * in the same lane. Priority: selected & hover, then importance, then narrower span,
 * then shorter title. When several periods share time, appends a compact "·N" to the
 * one label that is shown (N = overlap count in that lane).
 */
export function buildBandPeriodLabelMap(
  sortedWideToNarrow: readonly BandTimelinePeriodEvent[],
  allInLane: readonly BandTimelinePeriodEvent[],
  opts: BuildBandLabelOpts
): Map<string, { show: boolean; text: string }> {
  const {
    viewStart,
    viewEnd,
    trackWidth,
    viewPortion,
    hoveredId,
    selectedId,
    lang,
    minLabelWidthPx,
    getTitle,
  } = opts;

  const out = new Map<string, { show: boolean; text: string }>();
  const cands: Cand[] = [];
  for (const e of sortedWideToNarrow) {
    const a0 = getBandEventStartMs(e);
    const a1 = getBandEventEndMs(e);
    if (a1 < viewStart || a0 > viewEnd) {
      out.set(e.id, { show: false, text: getTitle(e) });
      continue;
    }
    const s0 = Math.max(a0, viewStart);
    const s1 = Math.min(a1, viewEnd);
    const left = toXPercent(s0, viewStart, viewEnd);
    const w = toXPercent(s1, viewStart, viewEnd) - left;
    if (w < 0.04) {
      out.set(e.id, { show: false, text: getTitle(e) });
      continue;
    }
    const wPx = (w / 100) * trackWidth;
    const leftPx = (left / 100) * trackWidth;
    const hov = hoveredId === e.id;
    const sel = selectedId === e.id;
    const narrative = shouldShowNarrativeLabel("span", e.importance, viewPortion, wPx, hov, sel);
    const displayTitle = getTitle(e);
    if (!narrative || wPx < minLabelWidthPx) {
      out.set(e.id, { show: false, text: displayTitle });
      continue;
    }
    const spanMs = Math.max(1, a1 - a0);
    const score =
      (sel ? 1e7 : 0) +
      (hov ? 1e6 : 0) +
      e.importance * 1e5 +
      1e9 / (spanMs + 1) -
      displayTitle.length * 6;
    cands.push({ p: e, wPx, leftPx, displayTitle, score });
  }

  cands.sort((A, B) => B.score - A.score);
  const placed: { left: number; right: number }[] = [];

  for (const c of cands) {
    const occ = timeOverlapCount(c.p, allInLane);
    const mark = occ > 1 ? ` ·${occ}` : "";
    const textForBox = c.displayTitle + mark;
    const box = labelPixelBox(c.leftPx, c.wPx, textForBox, lang);
    if (box.right - box.left < 18) {
      out.set(c.p.id, { show: false, text: c.displayTitle });
      continue;
    }
    const hit = placed.some((p) => rangeIntersects(p, box));
    if (hit) {
      out.set(c.p.id, { show: false, text: c.displayTitle });
      continue;
    }
    placed.push(box);
    out.set(c.p.id, { show: true, text: textForBox });
  }

  for (const e of sortedWideToNarrow) {
    if (!out.has(e.id)) {
      out.set(e.id, { show: false, text: getTitle(e) });
    }
  }
  return out;
}

/**
 * Merges label decisions for all lanes that have at least one period in `filtered`.
 */
export function buildAllBandPeriodLabelMaps(
  getSortedPeriods: (lane: BandTimelineLane) => readonly BandTimelinePeriodEvent[],
  getAllPeriods: (lane: BandTimelineLane) => readonly BandTimelinePeriodEvent[],
  activeLanes: readonly BandTimelineLane[],
  opts: BuildBandLabelOpts
): Map<string, { show: boolean; text: string }> {
  const m = new Map<string, { show: boolean; text: string }>();
  for (const lane of activeLanes) {
    const sorted = getSortedPeriods(lane);
    if (sorted.length === 0) continue;
    const all = getAllPeriods(lane);
    const piece = buildBandPeriodLabelMap(sorted, all, opts);
    piece.forEach((v, k) => m.set(k, v));
  }
  return m;
}
