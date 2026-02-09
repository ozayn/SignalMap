/**
 * Simple growth model fitting for irregular time series.
 * Converts dates to numeric (days since first) for fitting.
 * No forecasting beyond last observed point.
 */

export type Point = { date: string; value: number };

function parseDate(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getTime();
}

function daysSinceFirst(points: Point[]): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const t0 = parseDate(points[0]!.date);
  return points.map((p) => ({
    x: (parseDate(p.date) - t0) / (1000 * 60 * 60 * 24),
    y: p.value,
  }));
}

/** Linear: y = a + b*x (OLS closed form) */
export function fitLinear(points: Point[]): { a: number; b: number } | null {
  const xy = daysSinceFirst(points);
  if (xy.length < 2) return null;
  const n = xy.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (const p of xy) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return null;
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

/** Exponential: y = a * exp(b*x). Fit via log(y) = log(a) + b*x */
export function fitExponential(points: Point[]): { a: number; b: number } | null {
  const xy = daysSinceFirst(points.filter((p) => p.value > 0));
  if (xy.length < 2) return null;
  const n = xy.length;
  let sumX = 0,
    sumLogY = 0,
    sumXLogY = 0,
    sumX2 = 0;
  for (const p of xy) {
    const ly = Math.log(p.y);
    sumX += p.x;
    sumLogY += ly;
    sumXLogY += p.x * ly;
    sumX2 += p.x * p.x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return null;
  const b = (n * sumXLogY - sumX * sumLogY) / denom;
  const logA = (sumLogY - b * sumX) / n;
  return { a: Math.exp(logA), b };
}

/** Logistic: y = L / (1 + exp(-k*(x-x0))). L = max*1.2, fit k and x0 via logit transform. */
export function fitLogistic(points: Point[]): { L: number; k: number; x0: number } | null {
  const xy = daysSinceFirst(points);
  if (xy.length < 3) return null;
  const xRange =
    Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x)) || 1;
  const maxY = Math.max(...xy.map((p) => p.y));
  const L = maxY * 1.2 + 1;
  const eps = 1e-6;
  const valid = xy.filter((p) => p.y > eps && p.y < L - eps);
  if (valid.length < 2) return null;
  const n = valid.length;
  let sumX = 0,
    sumZ = 0,
    sumXZ = 0,
    sumX2 = 0;
  for (const p of valid) {
    const z = Math.log(p.y / (L - p.y));
    sumX += p.x;
    sumZ += z;
    sumXZ += p.x * z;
    sumX2 += p.x * p.x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return null;
  let k = (n * sumXZ - sumX * sumZ) / denom;
  // If k is near zero, the curve is flat (y ≈ L/2). Enforce minimum k so the S-curve
  // shows visible curvature over the data-spanning x range.
  const kMin = 2 / xRange;
  if (Math.abs(k) < kMin) {
    k = k > 0 ? kMin : -kMin;
  }
  const x0 = -(sumZ - k * sumX) / (n * k); // inflection: logit=0 => x = -intercept/k
  return { L, k, x0 };
}

/** Produce model curve points for given dates (no extrapolation beyond last). */
export function linearCurve(
  params: { a: number; b: number },
  points: Point[]
): { date: string; value: number }[] {
  if (points.length === 0) return [];
  const xy = daysSinceFirst(points);
  const xMax = Math.max(...xy.map((p) => p.x));
  return points.map((p) => {
    const x = (parseDate(p.date) - parseDate(points[0]!.date)) / (1000 * 60 * 60 * 24);
    const xClamped = Math.min(x, xMax);
    return { date: p.date, value: params.a + params.b * xClamped };
  });
}

export function exponentialCurve(
  params: { a: number; b: number },
  points: Point[]
): { date: string; value: number }[] {
  if (points.length === 0) return [];
  const xy = daysSinceFirst(points);
  const xMax = Math.max(...xy.map((p) => p.x));
  return points.map((p) => {
    const x = (parseDate(p.date) - parseDate(points[0]!.date)) / (1000 * 60 * 60 * 24);
    const xClamped = Math.min(x, xMax);
    return { date: p.date, value: params.a * Math.exp(params.b * xClamped) };
  });
}

export function logisticCurve(
  params: { L: number; k: number; x0: number },
  points: Point[]
): { date: string; value: number }[] {
  if (points.length === 0) return [];
  const xy = daysSinceFirst(points);
  const xMax = Math.max(...xy.map((p) => p.x));
  return points.map((p) => {
    const x = (parseDate(p.date) - parseDate(points[0]!.date)) / (1000 * 60 * 60 * 24);
    const xClamped = Math.min(x, xMax);
    return { date: p.date, value: params.L / (1 + Math.exp(-params.k * (xClamped - params.x0))) };
  });
}
