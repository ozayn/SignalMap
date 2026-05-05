export type PovertyHeadcountPoint = { date: string; value: number };

function sparseDataNoteForYear(lastYear: number): { en: string; fa: string } {
  return {
    en: `Data available only through ${lastYear}; later years in the selected period have no published values.`,
    fa: `داده‌های این شاخص فقط تا سال ${lastYear} در دسترس است و برای سال‌های بعد داده‌ای منتشر نشده است.`,
  };
}

/** Latest calendar year with a finite observation (no interpolation). */
export function povertyHeadcountMaxYear(points: PovertyHeadcountPoint[]): number | null {
  let best: number | null = null;
  for (const p of points) {
    if (typeof p.value !== "number" || Number.isNaN(p.value)) continue;
    const y = parseInt(p.date.slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    best = best == null ? y : Math.max(best, y);
  }
  return best;
}

function axisEndYear(timeRange: [string, string]): number {
  return parseInt(timeRange[1].slice(0, 4), 10);
}

export type PovertyCoverageLine = { en: string; fa: string };

export type PovertyHeadcountCoverageExtras = {
  lines: PovertyCoverageLine[];
  /** Muted band after last published year (x-axis still runs to ``timeRange`` end). */
  gapMarkArea?: { xStart: string; xEnd: string };
  /** Vertical rule at last year with any headcount observation. */
  lastMarkLineX?: string;
};

/**
 * Footnotes + optional chart overlays when WDI poverty headcount ends before the chart’s outer window.
 *
 * @param focusPeriodEndYear Inclusive end of the highlighted comparison period (e.g. presidency), for copy
 *   about “later years in the selected period”.
 */
export function buildPovertyHeadcountCoverageExtras(
  dday: PovertyHeadcountPoint[],
  lmic: PovertyHeadcountPoint[],
  timeRange: [string, string],
  focusPeriodEndYear: number
): PovertyHeadcountCoverageExtras {
  const endY = axisEndYear(timeRange);
  if (!Number.isFinite(endY) || !Number.isFinite(focusPeriodEndYear)) return { lines: [] };

  const yD = povertyHeadcountMaxYear(dday);
  const yL = povertyHeadcountMaxYear(lmic);
  const lines: PovertyCoverageLine[] = [];

  if (yD != null && yL != null && yD === yL && yD < focusPeriodEndYear) {
    lines.push(sparseDataNoteForYear(yD));
  } else {
    if (yD != null && yD < focusPeriodEndYear) {
      lines.push(sparseDataNoteForYear(yD));
    }
    if (yL != null && yL < focusPeriodEndYear) {
      lines.push(sparseDataNoteForYear(yL));
    }
  }

  const yMax = Math.max(yD ?? -Infinity, yL ?? -Infinity);
  if (!Number.isFinite(yMax) || yMax >= endY) {
    return { lines };
  }

  const gapStart = `${yMax + 1}-01-01`;
  const gapEnd = timeRange[1].length === 4 ? `${timeRange[1]}-12-31` : timeRange[1].slice(0, 10);
  const lastMarkLineX = `${yMax}-01-01`;

  if (gapStart >= gapEnd) {
    return { lines, lastMarkLineX };
  }

  return {
    lines,
    gapMarkArea: { xStart: gapStart, xEnd: gapEnd },
    lastMarkLineX,
  };
}

/** Same shape as poverty coverage: one sparse WDI line (e.g. SI.POV.GINI for Iran). */
export function buildSparseWdiLineCoverageExtras(
  points: PovertyHeadcountPoint[],
  timeRange: [string, string],
  focusPeriodEndYear: number
): PovertyHeadcountCoverageExtras {
  const endY = axisEndYear(timeRange);
  if (!Number.isFinite(endY) || !Number.isFinite(focusPeriodEndYear)) return { lines: [] };

  const yMax = povertyHeadcountMaxYear(points);
  const lines: PovertyCoverageLine[] = [];
  if (yMax != null && yMax < focusPeriodEndYear) {
    lines.push(sparseDataNoteForYear(yMax));
  }
  if (yMax == null || !Number.isFinite(yMax) || yMax >= endY) {
    return { lines };
  }

  const gapStart = `${yMax + 1}-01-01`;
  const gapEnd = timeRange[1].length === 4 ? `${timeRange[1]}-12-31` : timeRange[1].slice(0, 10);
  const lastMarkLineX = `${yMax}-01-01`;

  if (gapStart >= gapEnd) {
    return { lines, lastMarkLineX };
  }

  return {
    lines,
    gapMarkArea: { xStart: gapStart, xEnd: gapEnd },
    lastMarkLineX,
  };
}
