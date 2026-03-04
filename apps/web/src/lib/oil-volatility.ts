/**
 * Oil price shock detector based on Brent daily returns.
 * Highlights days when price movements exceed normal volatility.
 */

export type OilPointWithVolatility = {
  date: string;
  value: number;
  daily_return: number | null;
  rolling_volatility: number | null;
  is_shock: boolean;
};

const ROLLING_WINDOW = 30;
const SHOCK_THRESHOLD_MULTIPLIER = 2;

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance =
    arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute daily returns as percentages.
 * daily_return = (price_today - price_yesterday) / price_yesterday * 100
 */
export function computeDailyReturns(
  points: { date: string; value: number }[]
): Map<string, number> {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const sorted = [...byDate.keys()].sort();
  const result = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const today = sorted[i]!;
    const yesterday = sorted[i - 1]!;
    const priceToday = byDate.get(today);
    const priceYesterday = byDate.get(yesterday);
    if (
      priceToday != null &&
      priceYesterday != null &&
      priceYesterday > 0
    ) {
      const ret =
        ((priceToday - priceYesterday) / priceYesterday) * 100;
      result.set(today, ret);
    }
  }
  return result;
}

/**
 * Compute rolling standard deviation over last ROLLING_WINDOW observations.
 */
export function computeRollingVolatility(
  points: { date: string; value: number }[],
  dailyReturns: Map<string, number>
): Map<string, number> {
  const sorted = [...dailyReturns.keys()].sort();
  const result = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const window: number[] = [];
    for (let j = Math.max(0, i - ROLLING_WINDOW + 1); j <= i; j++) {
      const ret = dailyReturns.get(sorted[j]!);
      if (ret != null) window.push(ret);
    }
    result.set(sorted[i]!, std(window));
  }
  return result;
}

/**
 * Enrich oil points with daily_return, rolling_volatility, is_shock.
 * shock_day = abs(daily_return) > 2 * rolling_volatility
 */
export function enrichOilPointsWithVolatility(
  points: { date: string; value: number }[]
): OilPointWithVolatility[] {
  if (points.length === 0) return [];

  const dailyReturns = computeDailyReturns(points);
  const rollingVol = computeRollingVolatility(points, dailyReturns);

  return points.map((p) => {
    const ret = dailyReturns.get(p.date) ?? null;
    const vol = rollingVol.get(p.date) ?? null;
    const isShock =
      ret != null &&
      vol != null &&
      vol > 0 &&
      Math.abs(ret) > SHOCK_THRESHOLD_MULTIPLIER * vol;

    return {
      date: p.date,
      value: p.value,
      daily_return: ret,
      rolling_volatility: vol,
      is_shock: isShock,
    };
  });
}
