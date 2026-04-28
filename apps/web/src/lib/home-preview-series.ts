/** Homepage preview sparklines: shared downsampling (also used by `/api/homepage/previews`). */

export type HomePreviewPoint = { date: string; value: number };

/** Target max points per series after downsampling (80–120 range). */
export const HOME_PREVIEW_MAX_POINTS = 100;

export function downsampleSeries(points: HomePreviewPoint[], maxPoints: number): HomePreviewPoint[] {
  const valid = points.filter((p) => Number.isFinite(p.value));
  const sorted = [...valid].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (sorted.length <= maxPoints) return sorted;
  const out: HomePreviewPoint[] = [];
  const n = sorted.length;
  const target = maxPoints;
  for (let i = 0; i < target; i++) {
    const idx = Math.round((i * (n - 1)) / Math.max(1, target - 1));
    out.push(sorted[idx]!);
  }
  return out;
}
