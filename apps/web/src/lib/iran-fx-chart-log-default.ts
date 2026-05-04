/** Positive FX rate samples for default log vs linear axis. */
export type IranFxRatePoint = { date: string; value: number };

function clipFxPointsByRange<T extends { date: string }>(
  points: readonly T[],
  range: readonly [string, string] | undefined
): T[] {
  if (!range?.[0] || !range?.[1]) return [...points];
  const lo = (range[0].length === 4 ? `${range[0]}-01-01` : range[0]).slice(0, 10);
  const hi = (range[1].length === 4 ? `${range[1]}-12-31` : range[1]).slice(0, 10);
  return points.filter((p) => {
    const d = p.date.slice(0, 10);
    return d >= lo && d <= hi;
  });
}

function positiveFxValues(official: readonly IranFxRatePoint[], open: readonly IranFxRatePoint[]): number[] {
  const out: number[] = [];
  for (const p of official) {
    if (typeof p.value === "number" && Number.isFinite(p.value) && p.value > 0) out.push(p.value);
  }
  for (const p of open) {
    if (typeof p.value === "number" && Number.isFinite(p.value) && p.value > 0) out.push(p.value);
  }
  return out;
}

/**
 * Long-run Iran economy dashboards: prefer log when the combined positive sample
 * spans a wide multiple (several effective orders of magnitude).
 * Short reconstruction window (1368–1376): stay linear unless the range is extreme.
 */
export function iranFxLevelsSuggestLogDefault(
  official: readonly IranFxRatePoint[],
  open: readonly IranFxRatePoint[],
  variant: "long_run" | "short_reconstruction"
): boolean {
  const vals = positiveFxValues(official, open);
  if (vals.length === 0) return false;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min <= 0) return false;
  const ratio = max / min;
  if (variant === "long_run") return ratio >= 40;
  return ratio >= 150;
}

/** Same as {@link iranFxLevelsSuggestLogDefault} but only considers points inside ``range`` (inclusive). */
export function iranFxLevelsSuggestLogDefaultInRange(
  official: readonly IranFxRatePoint[],
  open: readonly IranFxRatePoint[],
  range: readonly [string, string] | undefined,
  variant: "long_run" | "short_reconstruction"
): boolean {
  return iranFxLevelsSuggestLogDefault(
    clipFxPointsByRange(official, range),
    clipFxPointsByRange(open, range),
    variant
  );
}

export function iranFxLevelsHasNonPositiveValues(
  official: readonly IranFxRatePoint[],
  open: readonly IranFxRatePoint[]
): boolean {
  for (const p of [...official, ...open]) {
    if (typeof p.value === "number" && Number.isFinite(p.value) && p.value <= 0) return true;
  }
  return false;
}

export function iranFxLevelsHasNonPositiveValuesInRange(
  official: readonly IranFxRatePoint[],
  open: readonly IranFxRatePoint[],
  range: readonly [string, string] | undefined
): boolean {
  return iranFxLevelsHasNonPositiveValues(
    clipFxPointsByRange(official, range),
    clipFxPointsByRange(open, range)
  );
}
