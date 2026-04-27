/** UTC: inclusive calendar years for the visible [startMs, endMs) view. */

export function domainInclusiveYearBounds(
  domainStartMs: number,
  domainEndMs: number
): { minY: number; maxY: number } {
  const s = new Date(domainStartMs);
  const e = new Date(domainEndMs);
  return {
    minY: s.getUTCFullYear(),
    maxY: e.getUTCFullYear(),
  };
}

/** Jan 1 00:00:00.000 UTC of y; end is exclusive: Jan 1 of (endY+1) so endY is the last year shown. */
export function msRangeForInclusiveYears(startY: number, endY: number): { startMs: number; endMs: number } {
  const a = startY;
  const b = endY;
  const s = Date.UTC(a, 0, 1);
  const e = Date.UTC(b + 1, 0, 1);
  return { startMs: s, endMs: e };
}

/** Clamps to [minY, maxY] and ensures startY <= endY. */
export function normalizeYearPair(
  startY: number,
  endY: number,
  minY: number,
  maxY: number
): { startY: number; endY: number; wasCorrected: boolean } {
  let a = Math.round(startY);
  let b = Math.round(endY);
  let w = false;
  if (a < minY) {
    a = minY;
    w = true;
  }
  if (a > maxY) {
    a = maxY;
    w = true;
  }
  if (b < minY) {
    b = minY;
    w = true;
  }
  if (b > maxY) {
    b = maxY;
    w = true;
  }
  if (a > b) {
    w = true;
    [a, b] = [b, a] as [number, number];
  }
  if (a > b) {
    b = a;
  }
  return { startY: a, endY: b, wasCorrected: w };
}

export function startYearFromViewStart(viewStartMs: number, minY: number, maxY: number): number {
  const y = new Date(viewStartMs).getUTCFullYear();
  return Math.max(minY, Math.min(maxY, y));
}

/**
 * Inclusive "end year" of the right edge: last full UTC year with content before viewEnd (exclusive end ms).
 * If view is exactly Jan1(y+1), the last year shown is y.
 */
export function endYearFromViewEnd(
  viewStartMs: number,
  viewEndMs: number,
  minY: number,
  maxY: number
): number {
  if (viewEndMs <= viewStartMs) return startYearFromViewStart(viewStartMs, minY, maxY);
  const t = new Date(viewEndMs - 1);
  const y = t.getUTCFullYear();
  return Math.max(minY, Math.min(maxY, y));
}

const Q_START = "start";
const Q_END = "end";

/**
 * Maps inclusive calendar years to a [startMs, endMs) view window,
 * then clamps to the event/domain span (padding included).
 */
export function viewMsFromInclusiveYearsClamped(
  startY: number,
  endY: number,
  domainStartMs: number,
  domainEndMs: number
): { startMs: number; endMs: number; wasCorrected: boolean } {
  const { minY, maxY } = domainInclusiveYearBounds(domainStartMs, domainEndMs);
  const n = normalizeYearPair(startY, endY, minY, maxY);
  const { startMs, endMs } = msRangeForInclusiveYears(n.startY, n.endY);
  let a = Math.max(startMs, domainStartMs);
  let b = Math.min(endMs, domainEndMs);
  let w = n.wasCorrected;
  if (b <= a) {
    return {
      startMs: domainStartMs,
      endMs: domainEndMs,
      wasCorrected: true,
    };
  }
  const full = domainEndMs - domainStartMs;
  if (b - a >= full) {
    w = w || a > domainStartMs || b < domainEndMs;
    return {
      startMs: domainStartMs,
      endMs: domainEndMs,
      wasCorrected: w,
    };
  }
  return { startMs: a, endMs: b, wasCorrected: w };
}

export function readYearRangeFromCurrentUrl():
  | { startY: number; endY: number }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const p = new URLSearchParams(window.location.search);
    const s = p.get(Q_START);
    const e = p.get(Q_END);
    if (s == null || e == null || s === "" || e === "") return null;
    const startY = parseInt(s, 10);
    const endY = parseInt(e, 10);
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return null;
    if (String(startY).length > 4 || String(endY).length > 4) return null;
    return { startY, endY };
  } catch {
    return null;
  }
}

export function writeYearRangeToUrl(startY: number, endY: number) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.set(Q_START, String(startY));
  u.searchParams.set(Q_END, String(endY));
  window.history.replaceState({ ...window.history.state }, "", u.toString());
}

export function clearYearRangeFromUrl() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.delete(Q_START);
  u.searchParams.delete(Q_END);
  const q = u.search;
  const href = u.pathname + (q && q.length > 0 ? q : "") + (u.hash || "");
  window.history.replaceState({ ...window.history.state }, "", href);
}
