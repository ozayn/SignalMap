/**
 * Proleptic integer years (BCE = negative) for URL ?start= & ?end= on the dynasties view.
 * View is always clamped to the dataset+present data domain.
 */

function parseProlepticYearParam(s: string | null): number | null {
  if (s == null || s.trim() === "") return null;
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function clampProlepticView(
  startY: number,
  endY: number,
  domainMin: number,
  domainMax: number
): { tMin: number; tMax: number } {
  let a = startY;
  let b = endY;
  if (a > b) [a, b] = [b, a];
  a = Math.max(domainMin, Math.min(a, domainMax));
  b = Math.max(domainMin, Math.min(b, domainMax));
  if (a > b) b = a;
  return { tMin: a, tMax: b };
}

/**
 * `start` / `end` are optional. If both missing, full [domainMin, domainMax].
 * If one missing, the missing bound is taken as the data domain end (or start) so
 * a single param can still be interpreted (partial URL).
 */
export function resolveProlepticViewFromSearchParams(
  sp: Pick<URLSearchParams, "get">,
  domainMin: number,
  domainMax: number
): { tMin: number; tMax: number } {
  const start = parseProlepticYearParam(sp.get("start"));
  const end = parseProlepticYearParam(sp.get("end"));
  if (start == null && end == null) {
    return { tMin: domainMin, tMax: domainMax };
  }
  const s = start ?? domainMin;
  const e = end ?? domainMax;
  return clampProlepticView(s, e, domainMin, domainMax);
}

export function isFullDataSpan(tMin: number, tMax: number, domainMin: number, domainMax: number): boolean {
  return tMin === domainMin && tMax === domainMax;
}

/** Returns query string (no `?`); start/end removed when the view equals the data domain. */
export function setViewInSearchParams(
  base: URLSearchParams,
  tMin: number,
  tMax: number,
  domainMin: number,
  domainMax: number
): string {
  const next = new URLSearchParams(base.toString());
  if (isFullDataSpan(tMin, tMax, domainMin, domainMax)) {
    next.delete("start");
    next.delete("end");
  } else {
    next.set("start", String(tMin));
    next.set("end", String(tMax));
  }
  return next.toString();
}
