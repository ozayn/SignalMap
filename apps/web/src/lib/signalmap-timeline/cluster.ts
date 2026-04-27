import { getEventImportance } from "./importance";
import type { SignalMapTimelineEvent } from "./types";
import { eventEndMs, parseYmdToUtcMs } from "./viewport";

const DAY = 86_400_000;
/** Min horizontal gap (px) between “occupied” intervals in the same lane. */
const LANE_GAP_PX = 2;
const CLUSTER_PX = 20;

type PreLaneNode =
  | { kind: "event"; event: SignalMapTimelineEvent; startMs: number; endMs: number }
  | { kind: "cluster"; id: string; centerMs: number; count: number; events: SignalMapTimelineEvent[] };

export type TimelineNode =
  | { kind: "event"; event: SignalMapTimelineEvent; startMs: number; endMs: number; lane: number }
  | {
      kind: "cluster";
      id: string;
      centerMs: number;
      count: number;
      events: SignalMapTimelineEvent[];
      lane: number;
    };

export type BuildNodesOpts = {
  domainStartMs: number;
  domainEndMs: number;
  minImportance: 1 | 2 | 3;
  /** (viewEnd - viewStart) / (domainEnd - domainStart). 1 = full span visible (most zoomed out). */
  viewPortion: number;
};

/**
 * Place markers into horizontal lanes to reduce visual pile-up.
 * Greedy: sort by left edge; for each, pick the first lane with free space + gap.
 */
function assignNodeLanes(
  out: PreLaneNode[],
  viewStart: number,
  viewEnd: number,
  contentWidthPx: number
): { nodes: TimelineNode[]; maxLane: number } {
  const w = viewEnd - viewStart;
  if (w <= 0 || contentWidthPx < 1) {
    const allLane0: TimelineNode[] = out.map((n) => {
      if (n.kind === "event") return { ...n, lane: 0 };
      return { ...n, lane: 0 };
    });
    return { nodes: allLane0, maxLane: 0 };
  }
  const toPx = (t: number) => ((t - viewStart) / w) * contentWidthPx;

  type It = { left: number; right: number; k: number };
  const its: It[] = [];
  for (let k = 0; k < out.length; k++) {
    const n: PreLaneNode = out[k]!;
    if (n.kind === "event") {
      const s = toPx(n.startMs);
      const e0 = toPx(n.endMs);
      const wSeg = e0 - s;
      if (wSeg < 1.2) {
        const hw = 5;
        its.push({ left: s - hw, right: s + hw, k });
      } else {
        its.push({ left: s, right: Math.max(s + 8, e0), k });
      }
    } else {
      const c = toPx(n.centerMs);
      const hw = CLUSTER_PX / 2;
      its.push({ left: c - hw, right: c + hw, k });
    }
  }
  its.sort((a, b) => a.left - b.left);

  const endAt: number[] = [];
  const laneByIndex = new Map<number, number>();

  for (const it of its) {
    let L = 0;
    for (; L < 800; L++) {
      if (L >= endAt.length) {
        endAt.push(-1e6);
      }
      const endPrev = endAt[L] ?? -1e6;
      if (it.left > endPrev + LANE_GAP_PX) break;
    }
    if (L >= 800) L = 0;
    endAt[L] = it.right;
    laneByIndex.set(it.k, L);
  }

  const maxLane = endAt.length > 0 ? endAt.length - 1 : 0;
  const nodes: TimelineNode[] = out.map((n, k) => {
    const lane = laneByIndex.get(k) ?? 0;
    if (n.kind === "event") {
      return { kind: "event", event: n.event, startMs: n.startMs, endMs: n.endMs, lane };
    }
    return {
      kind: "cluster",
      id: n.id,
      centerMs: n.centerMs,
      count: n.count,
      events: n.events,
      lane,
    };
  });
  return { nodes, maxLane };
}

/**
 * Visible window + importance filter + time bucketing when zoomed out, then lane assignment.
 */
export function buildTimelineNodes(
  events: SignalMapTimelineEvent[],
  viewStartMs: number,
  viewEndMs: number,
  contentWidthPx: number,
  opts: BuildNodesOpts
): { nodes: TimelineNode[]; maxLane: number } {
  const w = viewEndMs - viewStartMs;
  if (w <= 0 || contentWidthPx < 1) {
    return { nodes: [], maxLane: 0 };
  }

  const raw: PreLaneNode[] = [];

  const filtered = events.filter((e) => getEventImportance(e) >= opts.minImportance);
  const inView: { ev: SignalMapTimelineEvent; s: number; e: number }[] = [];
  for (const ev of filtered) {
    const s = parseYmdToUtcMs(ev.date_start);
    const e = eventEndMs(ev.date_start, ev.date_end);
    if (e < viewStartMs || s > viewEndMs) continue;
    inView.push({ ev, s, e: Math.max(e, s) });
  }
  inView.sort((a, b) => a.s - b.s);
  if (inView.length === 0) {
    return { nodes: [], maxLane: 0 };
  }

  const vp = Math.min(1, Math.max(0.0001, opts.viewPortion));
  // Zoomed out: fewer individual markers, merge into clusters sooner.
  // Tight year ranges: allow more “solo” markers (labels resolve overlap separately).
  const maxSolo = vp > 0.5 ? 6 : vp > 0.2 ? 18 : vp > 0.1 ? 36 : vp < 0.12 ? 96 : 64;
  const msPerPx = w / contentWidthPx;
  const pxPerMarker = vp > 0.5 ? 12 : vp > 0.2 ? 9 : vp > 0.1 ? 7.5 : 5.5;
  const bucketMs = Math.max(3 * DAY, Math.max(10 * DAY, msPerPx * pxPerMarker));
  if (inView.length <= maxSolo) {
    for (const x of inView) {
      raw.push({ kind: "event", event: x.ev, startMs: x.s, endMs: x.e });
    }
  } else {
    const bucketKey = (ms: number) => Math.floor((ms - viewStartMs) / bucketMs);
    const map = new Map<number, { events: SignalMapTimelineEvent[]; sMin: number; eMax: number }>();
    for (const row of inView) {
      const k0 = bucketKey((row.s + row.e) / 2);
      const cur = map.get(k0);
      if (!cur) {
        map.set(k0, { events: [row.ev], sMin: row.s, eMax: row.e });
      } else {
        cur.events.push(row.ev);
        cur.sMin = Math.min(cur.sMin, row.s);
        cur.eMax = Math.max(cur.eMax, row.e);
      }
    }
    const keys = [...map.keys()].sort((a, b) => a - b);
    for (const k0 of keys) {
      const c = map.get(k0)!;
      if (c.events.length === 1) {
        const ev = c.events[0]!;
        raw.push({ kind: "event", event: ev, startMs: c.sMin, endMs: c.eMax });
      } else {
        raw.push({
          kind: "cluster",
          id: `cluster-${k0}`,
          centerMs: (c.sMin + c.eMax) / 2,
          count: c.events.length,
          events: c.events,
        });
      }
    }
  }

  return assignNodeLanes(raw, viewStartMs, viewEndMs, contentWidthPx);
}

export function toXPercent(tMs: number, viewStartMs: number, viewEndMs: number): number {
  const wv = viewEndMs - viewStartMs;
  if (wv <= 0) return 0;
  return ((tMs - viewStartMs) / wv) * 100;
}
