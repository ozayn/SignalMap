/**
 * Deterministic, data-grounded copy for the Iran macro dashboard “AI-assisted interpretation” block.
 * No model calls — only summaries of visible annual series and the selected focus window.
 */

export type YearValuePoint = { date: string; value: number };

export type IranMacroInterpretationInput = {
  locale: "en" | "fa";
  /** Macro bundle fetch failed */
  loadFailed: boolean;
  /** Chart outer window (Gregorian years, inclusive) */
  outer: { start: number; end: number };
  /** Shaded focus band (Gregorian years, inclusive) */
  focus: { start: number; end: number };
  /** Already localized band label (e.g. presidency name) */
  focusLabel: string;
  inflation: YearValuePoint[];
  gdp: YearValuePoint[];
};

function yearOf(p: YearValuePoint): number {
  return parseInt(p.date.slice(0, 4), 10);
}

function clipPoints(points: YearValuePoint[], y0: number, y1: number): YearValuePoint[] {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  return points
    .filter((p) => {
      const y = yearOf(p);
      return Number.isFinite(y) && y >= lo && y <= hi && Number.isFinite(p.value);
    })
    .sort((a, b) => yearOf(a) - yearOf(b));
}

type BandStats = {
  n: number;
  min: number;
  max: number;
  peakYear: number;
  firstYear: number;
  lastYear: number;
  firstVal: number;
  lastVal: number;
};

function bandStats(points: YearValuePoint[]): BandStats | null {
  if (points.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let peakYear = yearOf(points[0]);
  for (const p of points) {
    const y = yearOf(p);
    const v = p.value;
    if (v < min) min = v;
    if (v > max) {
      max = v;
      peakYear = y;
    }
  }
  const first = points[0];
  const last = points[points.length - 1];
  return {
    n: points.length,
    min,
    max,
    peakYear,
    firstYear: yearOf(first),
    lastYear: yearOf(last),
    firstVal: first.value,
    lastVal: last.value,
  };
}

function fmtPct(v: number): string {
  return `${Math.round(v * 10) / 10}%`.replace(".0%", "%");
}

type Trend = "up" | "down" | "flat" | "sparse";

function focusTrend(points: YearValuePoint[], threshold: number): Trend {
  if (points.length < 2) return "sparse";
  const d = points[points.length - 1].value - points[0].value;
  if (d > threshold) return "up";
  if (d < -threshold) return "down";
  return "flat";
}

function volatilityNote(stats: BandStats | null, isFa: boolean): string | null {
  if (!stats || stats.n < 2) return null;
  const span = stats.max - stats.min;
  if (span >= 18) {
    return isFa
      ? "در همین بازه، نوسان سطح تورم سالانه نسبتاً زیاد به‌نظر می‌رسد."
      : "Across this window, annual inflation looks comparatively volatile.";
  }
  if (span >= 10) {
    return isFa
      ? "نوسان تورم در این بازه متوسط تا بالا است."
      : "Inflation shows moderate-to-high volatility across this window.";
  }
  return null;
}

export function buildIranMacroDashboardInterpretation(input: IranMacroInterpretationInput): string[] {
  const isFa = input.locale === "fa";
  const { outer, focus, focusLabel } = input;

  const caution = isFa
    ? "همهٔ سری‌ها سالانه‌اند؛ سال‌های بدون مقدار در نمودار خالی می‌مانند و مقدار ساختگی نیست. هم‌زمانی در زمان را صرفاً زمینهٔ توصیفی ببینید — شواهدی برای علیت مکانیکی یک شاخص نسبت به دیگری نیست."
    : "All series are annual; years without a published value show as gaps, not interpolated points. Treat timing overlap as descriptive context—not evidence that one indicator mechanically caused another.";

  if (input.loadFailed) {
    return [
      isFa
        ? "بارگذاری بستهٔ دادهٔ کلان ناموفق بود؛ بدون همان سری‌ها نمی‌توان اینجا جمع‌بندی داده‌محور ارائه کرد."
        : "The macro data bundle did not load, so this section cannot summarize the visible series.",
      caution,
    ];
  }

  const infOuter = clipPoints(input.inflation, outer.start, outer.end);
  const gdpOuter = clipPoints(input.gdp, outer.start, outer.end);
  const infFocus = clipPoints(input.inflation, focus.start, focus.end);
  const gdpFocus = clipPoints(input.gdp, focus.start, focus.end);

  if (infOuter.length === 0 && gdpOuter.length === 0) {
    return [
      isFa
        ? "در بازهٔ بیرونی انتخاب‌شده، برای تورم و رشد GDP دادهٔ سالانه‌ای روی نمودار نیست؛ پس از بارگذاری یا گسترش بازه، این بخش دوباره محاسبه می‌شود."
        : "There are no annual inflation or GDP-growth points in the selected outer window yet; widen the window or wait for data to load to see a summary here.",
      caution,
    ];
  }

  const infS = bandStats(infOuter);
  const gdpS = bandStats(gdpOuter);
  const infTr = focusTrend(infFocus, 1.25);
  const gdpTr = focusTrend(gdpFocus, 0.45);
  const vol = volatilityNote(infS, isFa);

  const parts: string[] = [];

  if (isFa) {
    const o0 = outer.start;
    const o1 = outer.end;
    const f0 = focus.start;
    const f1 = focus.end;
    if (infS) {
      parts.push(
        `در کل پنجرهٔ نمودار (${o0}–${o1})، تورم مصرف‌کننده (٪ سالانه) از حدود ${fmtPct(infS.min)} تا ${fmtPct(
          infS.max
        )} دیده می‌شود؛ بالاترین مقدار در حدود سال ${infS.peakYear} است. ${vol ? vol + " " : ""}این‌ها فقط الگوی زمانی هستند، نه علت‌تک‌خانه.`.trim()
      );
    }
    if (gdpS) {
      if (infS) {
        parts.push(
          `رشد تولید ناخالص داخلی (٪ سالانه) در همان پنجره تقریباً از ${fmtPct(gdpS.min)} تا ${fmtPct(
            gdpS.max
          )} متغیر است.`
        );
      } else {
        parts.push(
          `در کل پنجرهٔ نمودار (${o0}–${o1})، رشد تولید ناخالص داخلی (٪ سالانه) تقریباً از ${fmtPct(
            gdpS.min
          )} تا ${fmtPct(gdpS.max)} دیده می‌شود؛ این فقط زمینهٔ زمانی است، نه علت‌تک‌خانه.`
        );
      }
    }
    let focusSentence = `در دورهٔ مشخص‌شده (${focusLabel}، ${f0}–${f1})، `;
    const bits: string[] = [];
    if (infFocus.length >= 2) {
      if (infTr === "up") bits.push("تورم در ابتدا و انتهای این باند، افزایش خالص را نشان می‌دهد");
      else if (infTr === "down") bits.push("تورم در ابتدا و انتهای این باند، کاهش خالص را نشان می‌دهد");
      else if (infTr === "flat") bits.push("تورم در این باند نوسان دارد اما تغییر خالص کم است");
      else bits.push("برای تورم در این باند نقاط سالانه کافی نیست");
    }
    if (gdpFocus.length >= 2) {
      if (gdpTr === "up") bits.push("رشد GDP در ابتدا و انتهای باند بالاتر می‌رود");
      else if (gdpTr === "down") bits.push("رشد GDP در ابتدا و انتهای باند پایین‌تر می‌رود");
      else if (gdpTr === "flat") bits.push("رشد GDP در این باند نسبتاً ثابت می‌ماند");
      else bits.push("برای رشد GDP در این باند نقاط کافی نیست");
    }
    if (bits.length === 0) {
      focusSentence +=
        "نقاط سالانه در باند تمرکز برای جمع‌بندی خیلی کم است؛ جملات بالا را با احتیاط بخوانید.";
    } else {
      focusSentence += bits.join("؛ ") + ". ";
      focusSentence += "این جمله‌ها با دادهٔ همان سال‌ها سازگارند، نه حکم علّی.";
    }
    parts.push(focusSentence);
  } else {
    const o0 = outer.start;
    const o1 = outer.end;
    const f0 = focus.start;
    const f1 = focus.end;
    if (infS) {
      parts.push(
        `Over the full chart window (${o0}–${o1}), CPI inflation (annual %) ranges from about ${fmtPct(infS.min)} to ${fmtPct(
          infS.max
        )}, with the highest annual observation around ${infS.peakYear}. ${vol ? vol + " " : ""}Read that as broad timing, not a single causal driver.`.trim()
      );
    }
    if (gdpS) {
      if (infS) {
        parts.push(
          `GDP growth (annual %) in the same window moves roughly between ${fmtPct(gdpS.min)} and ${fmtPct(gdpS.max)}.`
        );
      } else {
        parts.push(
          `Over the full chart window (${o0}–${o1}), GDP growth (annual %) ranges from about ${fmtPct(
            gdpS.min
          )} to ${fmtPct(gdpS.max)}—coarse historical context only, not a causal story by itself.`
        );
      }
    }
    let focusSentence = `During the highlighted period (${focusLabel}, ${f0}–${f1}), `;
    const bits: string[] = [];
    if (infFocus.length >= 2) {
      if (infTr === "up") bits.push("inflation is higher at the end of the band than at the start");
      else if (infTr === "down") bits.push("inflation is lower at the end of the band than at the start");
      else if (infTr === "flat") bits.push("inflation moves within the band with little net change");
      else bits.push("inflation has too few annual points in the band to infer a slope");
    }
    if (gdpFocus.length >= 2) {
      if (gdpTr === "up") bits.push("GDP growth ends the band above where it started");
      else if (gdpTr === "down") bits.push("GDP growth ends the band below where it started");
      else if (gdpTr === "flat") bits.push("GDP growth stays in a relatively tight range");
      else bits.push("GDP growth has too few annual points in the band");
    }
    if (bits.length === 0) {
      focusSentence +=
        "there are not enough annual observations inside the focus band to add a reliable band-specific comparison—treat the window-level sentences above cautiously.";
    } else {
      focusSentence += bits.join("; ") + ". ";
      focusSentence += "That wording is consistent with the plotted annual values, not a claim that one series caused the other.";
    }
    parts.push(focusSentence);
  }

  const body = parts.join(" ");
  const para1 = body;
  return [para1, caution];
}
