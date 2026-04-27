import { getEventImportance } from "./importance";
import type { SignalMapTimelineEvent } from "./types";

/** Min horizontal distance between *visible* event title centers (px). */
export const LABEL_MIN_SEP_PX = 100;

/** Min on-screen width to draw text inside a span (band) segment (px). */
export const SPAN_LABEL_MIN_WIDTH_PX = 80;

/**
 * In-chart point labels: only at strong zoom. Hover/selection use the floating tooltip or card, not
 * inline text (avoids duplicating the same title on the track).
 */
export const POINT_NARRATIVE_ATREST_I3_MAX_VIEW = 0.04;
export const POINT_NARRATIVE_ATREST_I2_MAX_VIEW = 0.03;

/** @deprecated use POINT_NARRATIVE_ATREST_I3_MAX_VIEW */
export const POINT_INLINE_ZOOM_I3 = POINT_NARRATIVE_ATREST_I3_MAX_VIEW;

/** @deprecated use POINT_NARRATIVE_ATREST_I2_MAX_VIEW */
export const POINT_INLINE_ZOOM_I2 = POINT_NARRATIVE_ATREST_I2_MAX_VIEW;

const SPAN_I2_MAX_VIEW = 0.25;

type Kind = "point" | "span";

/**
 * Eligibility for a persistent in-chart **label** (spans: on-segment text; points: only at very
 * strong zoom, never on hover/selection so the track stays dot + tooltip / card only).
 * - I3: spans (if wide enough). Points: at-rest only when `viewPortion` is very small.
 * - I2: spans when zoomed; points when even more zoomed in.
 * - I1: never for points; spans if wide enough and zoomed.
 */
export function shouldShowNarrativeLabel(
  kind: Kind,
  importance: 1 | 2 | 3,
  viewPortion: number,
  spanWidthPx: number | null,
  isHovered: boolean,
  isSelected: boolean
): boolean {
  if (kind === "point" && (isHovered || isSelected)) {
    return false;
  }
  if (isHovered || isSelected) {
    if (kind === "span" && (spanWidthPx == null || spanWidthPx < 20)) return false;
    return true;
  }
  if (kind === "span") {
    if (spanWidthPx == null || spanWidthPx < SPAN_LABEL_MIN_WIDTH_PX) return false;
    if (importance <= 1) return false;
    if (importance === 2) return viewPortion < SPAN_I2_MAX_VIEW;
    return true;
  }
  if (importance <= 1) return false;
  if (importance === 2) return viewPortion < POINT_NARRATIVE_ATREST_I2_MAX_VIEW;
  return viewPortion < POINT_NARRATIVE_ATREST_I3_MAX_VIEW;
}

export function shouldShowNarrativeLabelForEvent(
  ev: SignalMapTimelineEvent,
  isSpan: boolean,
  spanWidthPx: number | null,
  viewPortion: number,
  isHovered: boolean,
  isSelected: boolean
): boolean {
  return shouldShowNarrativeLabel(
    isSpan ? "span" : "point",
    getEventImportance(ev),
    viewPortion,
    spanWidthPx,
    isHovered,
    isSelected
  );
}

export type LabelSpacingCandidate = {
  id: string;
  xCenterPx: number;
  importance: 1 | 2 | 3;
};

/**
 * Picks a non-overlapping subset: higher importance is considered first, then by x. Min gap ``LABEL_MIN_SEP_PX`` on x.
 */
export function resolveSpacedNarrativeLabelIds(candidates: LabelSpacingCandidate[]): Set<string> {
  if (candidates.length === 0) return new Set();
  const sorted = [...candidates].sort(
    (a, b) => b.importance - a.importance || a.xCenterPx - b.xCenterPx
  );
  const placed: number[] = [];
  const out = new Set<string>();
  for (const c of sorted) {
    if (placed.every((px) => Math.abs(c.xCenterPx - px) >= LABEL_MIN_SEP_PX)) {
      placed.push(c.xCenterPx);
      out.add(c.id);
    }
  }
  return out;
}

/**
 * Sub-pixel vertical jitter (0, 1, 2) within a row to separate tight stacks (deterministic, no RNG).
 */
export function verticalJitterPx(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 3) * 2;
}
