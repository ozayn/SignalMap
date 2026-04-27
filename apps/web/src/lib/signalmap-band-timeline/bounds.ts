import { parseYmdToUtcMs } from "@/lib/signalmap-timeline";
import type { BandTimelineEvent } from "./types";

const DAY = 86_400_000;
const Y100 = 100 * 365.25 * DAY;

/**
 * [domainStartMs, domainEndMs] with padding, derived from all period spans and point dates.
 */
export function getBandTimelineDomain(events: BandTimelineEvent[], padFraction = 0.04): [number, number] {
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const e of events) {
    if (e.kind === "period") {
      const a = parseYmdToUtcMs(e.start_date);
      const b = parseYmdToUtcMs(e.end_date);
      tMin = Math.min(tMin, a, b);
      tMax = Math.max(tMax, a, b);
    } else {
      const t = parseYmdToUtcMs(e.date);
      tMin = Math.min(tMin, t);
      tMax = Math.max(tMax, t);
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin > tMax) {
    const n = Date.now();
    return [n - Y100, n + 30 * DAY];
  }
  const span = Math.max(DAY, tMax - tMin);
  const pad = span * padFraction;
  return [tMin - pad, tMax + pad];
}

export function getBandEventStartMs(e: BandTimelineEvent): number {
  return e.kind === "period" ? parseYmdToUtcMs(e.start_date) : parseYmdToUtcMs(e.date);
}

export function getBandEventEndMs(e: BandTimelineEvent): number {
  return e.kind === "period" ? parseYmdToUtcMs(e.end_date) : parseYmdToUtcMs(e.date);
}
