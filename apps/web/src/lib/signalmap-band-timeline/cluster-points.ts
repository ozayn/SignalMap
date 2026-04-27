import { parseYmdToUtcMs } from "@/lib/signalmap-timeline";
import type { BandTimelinePointEvent } from "./types";

const CLUSTER_PX = 22;

/**
 * When zoomed out, merge point markers in the same lane that would overlap horizontally.
 * Returns a mix of single points and clusters; each cluster is assigned a unique id.
 */
export function clusterPointsInLane(
  points: BandTimelinePointEvent[],
  lane: BandTimelinePointEvent["lane"],
  viewStart: number,
  viewEnd: number,
  contentWidth: number
): Array<
  | { kind: "one"; tMs: number; p: BandTimelinePointEvent }
  | { kind: "cluster"; id: string; centerMs: number; list: BandTimelinePointEvent[] }
> {
  const w = viewEnd - viewStart;
  if (w <= 0 || contentWidth < 1) {
    return points
      .filter((p) => p.lane === lane)
      .map((p) => ({
        kind: "one" as const,
        tMs: parseYmdToUtcMs(p.date),
        p,
      }));
  }
  const row = points
    .filter((p) => p.lane === lane)
    .map((p) => ({ p, t: parseYmdToUtcMs(p.date) }))
    .filter(({ t }) => t >= viewStart && t <= viewEnd)
    .sort((a, b) => (a.t === b.t ? a.p.id.localeCompare(b.p.id) : a.t - b.t));

  const toPx = (dMs: number) => (dMs / w) * contentWidth;
  const out: Array<
    | { kind: "one"; tMs: number; p: BandTimelinePointEvent }
    | { kind: "cluster"; id: string; centerMs: number; list: BandTimelinePointEvent[] }
  > = [];

  let i = 0;
  let clusterSeq = 0;
  while (i < row.length) {
    const { p: p0, t: t0 } = row[i]!;
    const chain: BandTimelinePointEvent[] = [p0];
    let tLast = t0;
    let j = i + 1;
    while (j < row.length) {
      const { p: p1, t: t1 } = row[j]!;
      if (toPx(t1 - tLast) < CLUSTER_PX) {
        chain.push(p1);
        tLast = t1;
        j += 1;
      } else break;
    }
    if (chain.length === 1) {
      out.push({ kind: "one", tMs: t0, p: p0 });
    } else {
      const sum = chain.reduce((a, c) => a + parseYmdToUtcMs(c.date), 0);
      out.push({
        kind: "cluster",
        id: `c-${lane}-${i}-${clusterSeq++}`,
        centerMs: sum / chain.length,
        list: chain,
      });
    }
    i = j;
  }
  return out;
}
