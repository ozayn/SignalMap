/**
 * Display-only downsampling for dense daily FX series.
 *
 * **Strategy:** calendar-week buckets: for each week keep the point with the
 * minimum and the point with the maximum value (chronological order), so
 * short spikes within a week are not flattened to a single average. If still
 * above the cap, apply LTTB (Sveinn Steinarsson) on the result.
 *
 * Full `points` from the API are unchanged; use this only for ECharts input.
 */
export function downsampleTimeSeriesLttb(
  data: { date: string; value: number }[],
  maxPoints: number
): { date: string; value: number }[] {
  if (data.length === 0 || data.length <= maxPoints) return data;
  const xy = data.map((p) => [Date.parse(p.date), p.value] as [number, number]);
  const byWeek = bucketMinMaxByWeek(xy);
  if (byWeek.length <= maxPoints) {
    return byWeek.map(([x, y]) => ({ date: tsToYmd(x), value: y }));
  }
  const lttb = lttbCore(byWeek, maxPoints);
  return lttb.map(([x, y]) => ({ date: tsToYmd(x), value: y }));
}

function tsToYmd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

const SEVEN_D_MS = 7 * 24 * 60 * 60 * 1000;

/** 7-day buckets from first point: per bucket keep min and max y, sorted by x. */
function bucketMinMaxByWeek(data: [number, number][]): [number, number][] {
  if (data.length === 0) return data;
  const t0 = data[0]![0];
  const byKey = new Map<number, { min: [number, number]; max: [number, number] }>();
  for (const p of data) {
    const k = Math.floor((p[0] - t0) / SEVEN_D_MS);
    let b = byKey.get(k);
    if (!b) {
      b = { min: p, max: p };
      byKey.set(k, b);
    } else {
      if (p[1] < b.min[1]) b.min = p;
      if (p[1] > b.max[1]) b.max = p;
    }
  }
  const keys = [...byKey.keys()].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const k of keys) {
    const b = byKey.get(k)!;
    if (b.min[0] === b.max[0] && b.min[1] === b.max[1]) {
      out.push(b.min);
    } else if (b.min[0] < b.max[0]) {
      out.push(b.min, b.max);
    } else {
      out.push(b.max, b.min);
    }
  }
  return out;
}

/**
 * LTTB (Steinarsson), on pre-trimmed [x,y] in ms.
 * Port of the common reference implementation (prev point A, next-bucket average C, candidate P).
 */
function lttbCore(data: [number, number][], threshold: number): [number, number][] {
  const m = threshold;
  const n = data.length;
  if (m >= n || m < 3) return data;
  const out: [number, number][] = [data[0]!];
  const bucket = (n - 2) / (m - 2);
  let a = 0;
  for (let i = 0; i < m - 2; i++) {
    const rStart = Math.floor((i + 0) * bucket) + 1;
    const rEnd = Math.floor((i + 1) * bucket) + 1;
    const nStart = Math.floor((i + 1) * bucket) + 1;
    const nEnd = Math.min(n, Math.floor((i + 2) * bucket) + 1);
    let avgx = 0;
    let avgy = 0;
    let c = 0;
    for (let j = nStart; j < nEnd; j++) {
      avgx += data[j]![0];
      avgy += data[j]![1];
      c += 1;
    }
    if (c < 1) {
      avgx = data[Math.min(n - 1, nStart)]![0];
      avgy = data[Math.min(n - 1, nStart)]![1];
    } else {
      avgx /= c;
      avgy /= c;
    }
    const A = data[a]!;
    let dMax = -1;
    let b = rStart;
    for (let j = rStart; j < rEnd; j++) {
      const p = data[j]!;
      const t = 0.5 * Math.abs((A[0] - avgx) * (A[1] - p[1]) - (A[0] - p[0]) * (A[1] - avgy));
      if (t > dMax) {
        dMax = t;
        b = j;
      }
    }
    a = b;
    out.push(data[a]!);
  }
  out.push(data[n - 1]!);
  return out;
}

const DISPLAY_CAP = 2200;
const ALWAYS_FULL_BELOW = 2000;
const SPAN_DAYS_FULL_CAP = 460;

/**
 * For USD→Toman: keep full daily when the selected window is short; downsample
 * when there are many points over a long span (full history).
 */
export function downsampleFxOpenForDisplay(
  points: { date: string; value: number }[],
  timeRange: [string, string] | null
): { date: string; value: number }[] {
  if (points.length === 0) return points;
  if (points.length <= ALWAYS_FULL_BELOW) return points;
  if (timeRange) {
    const t0 = Date.parse(timeRange[0]);
    const t1 = Date.parse(timeRange[1]);
    if (Number.isFinite(t0) && Number.isFinite(t1)) {
      const span = Math.max(0, t1 - t0) / 86400000;
      if (span <= SPAN_DAYS_FULL_CAP) return points;
    }
  }
  const d = downsampleTimeSeriesLttb(points, DISPLAY_CAP);
  return ensureLatestPointOnSeries(d, points);
}

/** If downsampling dropped the true last date, append it so the line end matches open-market "latest". */
function ensureLatestPointOnSeries(
  display: { date: string; value: number }[],
  full: { date: string; value: number }[]
): { date: string; value: number }[] {
  if (full.length === 0) return display;
  const last = full[full.length - 1]!;
  if (display.length === 0) return [last];
  const dl = display[display.length - 1]!.date;
  if (dl === last.date) return display;
  if (last.date > dl) return [...display, last];
  return display;
}
