"use client";

import { useSyncExternalStore } from "react";
import { IPC_SSR_GREGORIAN_YEAR_SNAPSHOT } from "@/lib/iran-economy-period-comparison-presets";

/**
 * Calendar year that matches on server and during hydration, then follows the client clock.
 * Avoids SSR/client mismatches on `<input type="number" max={year} />` and year clamps near Jan 1.
 */
export function useHydrationSafeGregorianYear(): number {
  return useSyncExternalStore(
    () => () => {},
    () => new Date().getFullYear(),
    () => IPC_SSR_GREGORIAN_YEAR_SNAPSHOT
  );
}
