"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";

/**
 * Shared Gregorian / Iranian (SH) / Both year-axis mode for Iran-focused study charts.
 * Persists in `localStorage` so PNG export and live charts match after reload.
 * Independent of EN/FA UI language: default is always Gregorian until the user changes the axis.
 */
const STORAGE_KEY = "signalmap:chart-year-axis-mode";

const LEGACY_KEYS = ["signalmap:iran-study-chart-year-axis-mode"] as const;

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function parseMode(raw: string | null): ChartAxisYearMode | null {
  if (raw === "gregorian" || raw === "jalali" || raw === "both") return raw;
  return null;
}

function readStoredMode(): ChartAxisYearMode {
  if (typeof window === "undefined") return "gregorian";
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    const parsed = parseMode(localStorage.getItem(key));
    if (parsed) {
      if (key !== STORAGE_KEY) {
        try {
          localStorage.setItem(STORAGE_KEY, parsed);
          localStorage.removeItem(key);
        } catch {
          /* quota / private mode */
        }
      }
      return parsed;
    }
  }
  return "gregorian";
}

export function useIranStudyChartYearMode(): {
  yearAxisMode: ChartAxisYearMode;
  setYearAxisMode: (next: ChartAxisYearMode) => void;
} {
  const yearAxisMode = useSyncExternalStore<ChartAxisYearMode>(
    (onStoreChange) => {
      const listener = () => onStoreChange();
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY || e.key === null) onStoreChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    readStoredMode,
    (): ChartAxisYearMode => "gregorian"
  );

  const setYearAxisMode = useCallback((next: ChartAxisYearMode) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    emit();
  }, []);

  return { yearAxisMode, setYearAxisMode };
}
