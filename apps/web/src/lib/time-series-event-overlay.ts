/**
 * Master "Event overlay" control for time-series `TimelineChart`s: when off, no markers
 * (and PNG export should match; charts receive an empty `events` array).
 */
export function withTimeSeriesEventOverlay<T>(showOverlay: boolean, events: readonly T[] | null | undefined): T[] {
  if (!showOverlay) return [];
  if (!events?.length) return [];
  return events.slice() as T[];
}
