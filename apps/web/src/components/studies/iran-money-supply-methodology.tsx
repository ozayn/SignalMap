"use client";

import { L } from "@/lib/iran-study-fa";

/**
 * L(isFa, en, fa) — English second, Farsi third.
 * Fraction-style YoY growth: growth_t = (L_t / L_{t-1} − 1) × 100; HTML for subscripts, no <code> pill.
 */
function MoneySupplyYoyFormula({ isFa }: { isFa: boolean }) {
  return (
    <div
      className="my-2 rounded-md border border-border/45 bg-muted/20 px-3 py-2.5 text-foreground/95"
      dir="ltr"
      role="math"
      aria-label={
        isFa
          ? "رشد برابر است با نسبت سطح نقدینگی فعلی به سطح سال قبل، منهای یک، در ۱۰۰"
          : "Year-over-year growth as ratio of L sub t to L sub t minus 1, minus 1, times 100"
      }
    >
      {isFa ? (
        <p className="text-center text-[0.95em] leading-7 m-0">
          <span className="ms-0.5">رشد</span>
          <sub className="ms-px align-baseline text-[0.7em]">t</sub>
          <span> = ( </span>
          <span>
            <span className="italic">L</span>
            <sub className="text-[0.7em]">t</sub>
          </span>
          <span> / </span>
          <span>
            <span className="italic">L</span>
            <sub className="text-[0.7em]">
              t<span className="text-[0.9em]">−</span>1
            </sub>
          </span>
          <span> − 1 ) × 100</span>
        </p>
      ) : (
        <p className="text-center text-[0.95em] leading-7 m-0">
          <span>growth</span>
          <sub className="ms-px align-baseline text-[0.7em]">t</sub>
          <span> = ( </span>
          <span>
            <span className="italic">L</span>
            <sub className="text-[0.7em]">t</sub>
          </span>
          <span> / </span>
          <span>
            <span className="italic">L</span>
            <sub className="text-[0.7em]">
              t<span className="text-[0.9em]">−</span>1
            </sub>
          </span>
          <span> − 1 ) × 100</span>
        </p>
      )}
    </div>
  );
}

/**
 * Collapsible M2 post-2016 stitch explanation (EN/FA). Placed under the first M2 chart only.
 * Copy: apps/web (this file); study page wires `isFa` from the study locale.
 */
export function IranMoneySupplyMethodology({ isFa }: { isFa: boolean }) {
  return (
    <details className="study-interpretation mt-4 max-w-3xl">
      <summary>
        <span>
          {L(isFa, "Methodology (Post-2016 Extension)", "روش‌شناسی (بخش بعد از ۲۰۱۶)")}
        </span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body text-sm text-muted-foreground space-y-3 break-words">
        {isFa ? (
          <>
            <p>تا سال ۲۰۱۶ از داده‌های بانک جهانی (WDI) برای «رشد نقدینگی» استفاده شده است.</p>
            <p>از سال ۲۰۱۷ به بعد، نرخ رشد از روی سطوح نقدینگی (گزارش‌های به سبک بانک مرکزی) محاسبه شده است.</p>
            <p className="mb-1">فرمول محاسبه:</p>
            <MoneySupplyYoyFormula isFa />
            <p>
              <var>L</var>
              <sub>t</sub> نشان‌دهنده نقدینگی پایان سال (اسفند) است که به سال میلادی متناظر نگاشت شده است.
            </p>
            <p>
              به دلیل تفاوت در تعاریف، این بخش صرفاً به‌عنوان <strong>ادامه‌ی تقریبی سری</strong> در نظر گرفته می‌شود.
            </p>
          </>
        ) : (
          <>
            <p>
              Through 2016, the series uses World Bank WDI <strong>“Broad money growth (annual %)”</strong>{" "}
              (FM.LBL.BMNY.ZG), sourced from IMF International Financial Statistics.
            </p>
            <p>
              From 2017 onward, growth is <strong>derived</strong> from year-end liquidity (نقدینگی) levels reported
              in Central Bank of Iran–style tables.
            </p>
            <p className="mb-1">Year-over-year growth is computed as:</p>
            <MoneySupplyYoyFormula isFa={false} />
            <p>
              where <var>L</var>
              <sub>t</sub> is end-of-year liquidity.
            </p>
            <p>These levels are aligned to Persian year-end (Esfand) and mapped to the corresponding Gregorian year.</p>
            <p>
              Because definitions differ slightly between IMF broad money and CBI liquidity aggregates, the post-2016
              segment should be interpreted as a <strong>continuity-oriented estimate</strong>, not a perfectly
              identical series.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
