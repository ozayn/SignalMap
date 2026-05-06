"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineChart, type TimelineEvent } from "@/components/timeline-chart";
import type { ChartPeriodOverlayBandInput } from "@/lib/iran-iraq-war-chart-overlay";
import { resolvePresetEndYear, type CountryFocusPreset, type CountryRangePreset } from "@/lib/country-economy-config";
import { DataObservations } from "@/components/data-observations";
import { LearningNote, type LearningNoteSection } from "@/components/learning-note";
import { ConceptsUsed } from "@/components/concepts-used";
import { SourceInfo, type SourceInfoItem } from "@/components/source-info";
import { InSimpleTerms } from "@/components/in-simple-terms";
import { StudyAiInterpretation } from "@/components/study-ai-interpretation";
import type { StudyConceptId } from "@/lib/signalmap-concepts";
import { StudyYearDisplayToggle } from "@/components/study-year-display-toggle";
import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import { SIGNAL_CONCEPT } from "@/lib/signalmap-chart-colors";

type Point = { date: string; value: number };
type DemandMode = "nominal" | "real";
type GdpMode = "nominal" | "real";
const MAX_ACTIVE_FOCUS_PERIODS = 3;

type CountryEconomyBundle = {
  series: Record<string, Point[]>;
  source?: { name?: string; publisher?: string; url?: string };
  indicator_ids?: Record<string, string>;
};

type Props = {
  countryCode: string;
  countryName: string;
  focusPresets: CountryFocusPreset[];
  rangePresets: CountryRangePreset[];
  overlays: {
    events: TimelineEvent[];
    bands: ChartPeriodOverlayBandInput[];
  };
  hasFX: boolean;
  defaultFxLog: boolean;
};

function yearKey(date: string): string {
  return date.slice(0, 4);
}

function firstAvailableYear(points: Point[]): number | null {
  let first: number | null = null;
  for (const p of points) {
    const y = Number.parseInt(yearKey(p.date), 10);
    if (!Number.isFinite(y)) continue;
    if (first == null || y < first) first = y;
  }
  return first;
}

function lastAvailableYear(points: Point[]): number | null {
  let last: number | null = null;
  for (const p of points) {
    const y = Number.parseInt(yearKey(p.date), 10);
    if (!Number.isFinite(y)) continue;
    if (last == null || y > last) last = y;
  }
  return last;
}

function deriveGdpOilSplit(gdp: Point[], oilRentsPct: Point[]) {
  const oilByYear = new Map(oilRentsPct.map((p) => [yearKey(p.date), p.value]));
  const oil: Point[] = [];
  const nonOil: Point[] = [];
  for (const p of gdp) {
    const y = yearKey(p.date);
    const share = oilByYear.get(y);
    if (share === undefined) continue;
    const oilVal = (p.value * share) / 100;
    oil.push({ date: `${y}-01-01`, value: oilVal });
    nonOil.push({ date: `${y}-01-01`, value: p.value - oilVal });
  }
  return { oil, nonOil };
}

function trimSeriesFromYear(points: Point[], startYear: number | null): Point[] {
  if (startYear == null) return points;
  return points.filter((p) => {
    const y = Number.parseInt(yearKey(p.date), 10);
    return Number.isFinite(y) && y >= startYear;
  });
}

function formatFocusYears(startYear: number, endYear: number | null): string {
  const endLabel = endYear == null ? "present" : String(endYear);
  return `${startYear}-${endLabel}`;
}

function EmptyStateHint({ text }: { text: string }) {
  return <p className="py-6 text-xs text-muted-foreground">{text}</p>;
}

export function CountryEconomyStudy({
  countryCode,
  countryName,
  focusPresets,
  rangePresets,
  overlays,
  hasFX,
  defaultFxLog,
}: Props) {
  const isUsa = countryCode.toUpperCase() === "USA";
  const isTurkey = countryCode.toUpperCase() === "TUR";
  const isRussia = countryCode.toUpperCase() === "RUS";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<CountryEconomyBundle | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [rangePresetId, setRangePresetId] = useState(rangePresets[0]?.id ?? "full");
  const [focusPresetIds, setFocusPresetIds] = useState<string[]>(() => (focusPresets[0]?.id ? [focusPresets[0].id] : []));
  const [demandMode, setDemandMode] = useState<DemandMode>("real");
  const [gdpMode, setGdpMode] = useState<GdpMode>("real");
  const [fxLog, setFxLog] = useState(defaultFxLog);
  const [yearAxisMode, setYearAxisMode] = useState<ChartAxisYearMode>("gregorian");

  const selectedRange = useMemo(() => rangePresets.find((r) => r.id === rangePresetId) ?? rangePresets[0], [rangePresetId, rangePresets]);
  const rangeStartYear = selectedRange?.startYear ?? 1960;
  const rangeEndYear = resolvePresetEndYear(selectedRange?.endYear ?? null);
  const availableFocusPresets = useMemo(
    () =>
      focusPresets.filter((f) => {
        const fy0 = f.startYear;
        const fy1 = resolvePresetEndYear(f.endYear);
        return fy0 <= rangeEndYear && fy1 >= rangeStartYear;
      }),
    [focusPresets, rangeStartYear, rangeEndYear]
  );
  const selectedFocusPresets = useMemo(() => {
    const selectedById = focusPresetIds
      .map((id) => focusPresets.find((f) => f.id === id))
      .filter((f): f is CountryFocusPreset => Boolean(f));
    if (selectedById.length > 0) return selectedById.slice(0, MAX_ACTIVE_FOCUS_PERIODS);
    const fallback = availableFocusPresets[0] ?? focusPresets[0];
    return fallback ? [fallback] : [];
  }, [focusPresetIds, focusPresets, availableFocusPresets]);
  const selectedPrimaryFocus = selectedFocusPresets[0];
  const rangeStart = `${selectedRange?.startYear ?? 1960}-01-01`;
  const rangeEnd = `${resolvePresetEndYear(selectedRange?.endYear ?? null)}-12-31`;

  useEffect(() => {
    const allowed = new Set(availableFocusPresets.map((f) => f.id));
    const kept = focusPresetIds.filter((id) => allowed.has(id)).slice(0, MAX_ACTIVE_FOCUS_PERIODS);
    const uniqueKept = Array.from(new Set(kept));
    if (uniqueKept.length === 0) {
      const fallback = availableFocusPresets[0] ?? focusPresets[0];
      const next = fallback ? [fallback.id] : [];
      if (next.length !== focusPresetIds.length || next.some((id, i) => id !== focusPresetIds[i])) {
        setFocusPresetIds(next);
      }
      return;
    }
    if (
      uniqueKept.length !== focusPresetIds.length ||
      uniqueKept.some((id, i) => id !== focusPresetIds[i])
    ) {
      setFocusPresetIds(uniqueKept);
    }
  }, [focusPresetIds, availableFocusPresets, focusPresets]);

  useEffect(() => {
    const ctl = new AbortController();
    async function run() {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({
          iso3: countryCode,
          start: rangeStart,
          end: rangeEnd,
        });
        const res = await fetch(`/api/signals/wdi/country-economy-bundle?${qs.toString()}`, {
          cache: "no-store",
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CountryEconomyBundle;
        setBundle(json);
      } catch (e) {
        if (ctl.signal.aborted) return;
        setBundle(null);
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }
    void run();
    return () => ctl.abort();
  }, [countryCode, rangeStart, rangeEnd]);

  const series = bundle?.series ?? {};
  const source = bundle?.source;
  const indicatorIds = bundle?.indicator_ids ?? {};
  const inflation = series.cpi_inflation_yoy_pct ?? [];
  const gdpGrowth = series.gdp_growth_yoy_pct ?? [];
  const gdpNominal = series.gdp_current_usd ?? [];
  const gdpReal = series.gdp_constant_2015_usd ?? [];
  const consumptionNominal = series.consumption_current_usd ?? [];
  const investmentNominal = series.investment_current_usd ?? [];
  const consumptionReal = series.consumption_constant_2015_usd ?? [];
  const investmentReal = series.investment_constant_2015_usd ?? [];
  const oilRents = series.oil_rents_pct_gdp ?? [];
  const gasRents = series.natural_gas_rents_pct_gdp ?? [];
  const imports = series.imports_pct_gdp ?? [];
  const exports = series.exports_pct_gdp ?? [];
  const manufacturing = series.manufacturing_pct_gdp ?? [];
  const industry = series.industry_pct_gdp ?? [];
  const m2 = series.broad_money_growth_pct ?? [];
  const gini = series.gini ?? [];
  const povertyExtreme = series.poverty_extreme ?? [];
  const povertyLmic = series.poverty_lmic ?? [];
  const fx = series.fx_official_lcu_per_usd ?? [];
  const governmentDebtPctGdp =
    (series.us_federal_debt_pct_gdp?.length ? series.us_federal_debt_pct_gdp : series.government_debt_pct_gdp) ?? [];
  const fiscalBalancePctGdp = series.fiscal_balance_pct_gdp?.length
    ? series.fiscal_balance_pct_gdp
    : series.fiscal_balance_cash_pct_gdp ?? [];
  const federalFundsRate = series.us_federal_funds_rate_pct ?? [];
  const federalDebtUsd = series.us_federal_debt_usd ?? [];
  const policyRate = series.policy_interest_rate_pct ?? [];
  const policyRateStartYear = useMemo(() => firstAvailableYear(policyRate), [policyRate]);
  const policyRateEndYear = useMemo(() => lastAvailableYear(policyRate), [policyRate]);
  const hasTurkeyPolicyRateData = policyRate.length > 0;
  const turkeyPolicyRateIndicatorId = indicatorIds.policy_interest_rate_pct ?? "FR.INR.LEND";
  const currentAccountPctGdp = series.current_account_pct_gdp ?? [];
  const externalDebtPctGdp = series.external_debt_pct_gdp ?? [];
  const hasUsFiscalMacro = governmentDebtPctGdp.length > 0 || fiscalBalancePctGdp.length > 0 || federalFundsRate.length > 0;

  const gdpSplitNominal = useMemo(() => deriveGdpOilSplit(gdpNominal, oilRents), [gdpNominal, oilRents]);
  const gdpSplitReal = useMemo(() => deriveGdpOilSplit(gdpReal, oilRents), [gdpReal, oilRents]);
  const gdpSplitRaw = gdpMode === "real" ? gdpSplitReal : gdpSplitNominal;
  const gdpSeriesForSplit = gdpMode === "real" ? gdpReal : gdpNominal;
  const gdpStartYearForSplit = useMemo(() => firstAvailableYear(gdpSeriesForSplit), [gdpSeriesForSplit]);
  const oilRentsStartYear = useMemo(() => firstAvailableYear(oilRents), [oilRents]);
  const decompositionEffectiveStartYear = useMemo(() => {
    if (gdpStartYearForSplit == null || oilRentsStartYear == null) return null;
    return Math.max(gdpStartYearForSplit, oilRentsStartYear);
  }, [gdpStartYearForSplit, oilRentsStartYear]);
  const gdpSplit = useMemo(
    () => ({
      oil: trimSeriesFromYear(gdpSplitRaw.oil, decompositionEffectiveStartYear),
      nonOil: trimSeriesFromYear(gdpSplitRaw.nonOil, decompositionEffectiveStartYear),
    }),
    [gdpSplitRaw.oil, gdpSplitRaw.nonOil, decompositionEffectiveStartYear]
  );
  const gdpTotalForDecomposition = useMemo(
    () => trimSeriesFromYear(gdpSeriesForSplit, decompositionEffectiveStartYear),
    [gdpSeriesForSplit, decompositionEffectiveStartYear]
  );
  const decompositionUnitLabel = gdpMode === "real" ? "constant 2015 US$" : "current US$";
  const gdpDecompositionMultiSeries = useMemo(
    () => [
      {
        key: "non_oil",
        label: "Non-oil GDP proxy",
        unit: decompositionUnitLabel,
        yAxisIndex: 0 as const,
        points: gdpSplit.nonOil,
        color: SIGNAL_CONCEPT.remainder_gdp_proxy,
        stack: "gdp_decomp",
        stackedArea: true,
      },
      {
        key: "oil",
        label: "Oil GDP proxy",
        unit: decompositionUnitLabel,
        yAxisIndex: 0 as const,
        points: gdpSplit.oil,
        color: SIGNAL_CONCEPT.oil_rents,
        stack: "gdp_decomp",
        stackedArea: true,
      },
      {
        key: "gdp_total",
        label: "Total GDP",
        unit: decompositionUnitLabel,
        yAxisIndex: 0 as const,
        points: gdpTotalForDecomposition,
        color: SIGNAL_CONCEPT.gdp,
        lineStyleType: "dashed" as const,
      },
    ],
    [decompositionUnitLabel, gdpSplit.nonOil, gdpSplit.oil, gdpTotalForDecomposition]
  );
  const decompositionOilRentsCoverageNote =
    oilRentsStartYear != null &&
    gdpStartYearForSplit != null &&
    oilRentsStartYear > gdpStartYearForSplit &&
    decompositionEffectiveStartYear === oilRentsStartYear
      ? `Oil-rents decomposition begins where oil-rents data becomes available in the source dataset. Oil-rents series unavailable before ${oilRentsStartYear}.`
      : null;

  const demandSeries =
    demandMode === "real"
      ? [
          {
            key: "consumption",
            label: "Consumption",
            unit: "constant 2015 US$",
            yAxisIndex: 0 as const,
            points: consumptionReal,
          },
          {
            key: "investment",
            label: "Investment",
            unit: "constant 2015 US$",
            yAxisIndex: 0 as const,
            points: investmentReal,
          },
          { key: "gdp", label: "GDP", unit: "constant 2015 US$", yAxisIndex: 0 as const, points: gdpReal },
        ]
      : [
          { key: "consumption", label: "Consumption", unit: "current US$", yAxisIndex: 0 as const, points: consumptionNominal },
          { key: "investment", label: "Investment", unit: "current US$", yAxisIndex: 0 as const, points: investmentNominal },
          { key: "gdp", label: "GDP", unit: "current US$", yAxisIndex: 0 as const, points: gdpNominal },
        ];
  const demandUnitLabel = demandMode === "real" ? "constant 2015 US$" : "current US$";
  const demandSeriesByKey = useMemo(() => {
    const by = new Map<string, Point[]>();
    for (const s of demandSeries) by.set(s.key, s.points);
    return by;
  }, [demandSeries]);
  const demandCoverageWarning = useMemo(() => {
    const sparse = demandSeries
      .filter((s) => s.points.length < 3)
      .map((s) => `${s.label} (${s.points.length} point${s.points.length === 1 ? "" : "s"})`);
    if (sparse.length === 0) return null;
    return `Coverage note: ${sparse.join(", ")} in this range. Sparse series can look nearly flat or appear as isolated points.`;
  }, [demandSeries]);

  useEffect(() => {
    if (!isTurkey || demandMode !== "real" || process.env.NODE_ENV === "production") return;
    const sampleYears = Array.from(
      new Set(
        [
          ...((demandSeriesByKey.get("consumption") ?? []).map((p) => Number.parseInt(yearKey(p.date), 10))),
          ...((demandSeriesByKey.get("investment") ?? []).map((p) => Number.parseInt(yearKey(p.date), 10))),
          ...((demandSeriesByKey.get("gdp") ?? []).map((p) => Number.parseInt(yearKey(p.date), 10))),
        ].filter((y) => Number.isFinite(y))
      )
    )
      .sort((a, b) => a - b)
      .slice(0, 6);
    const pick = (key: string, y: number) => demandSeriesByKey.get(key)?.find((p) => Number.parseInt(yearKey(p.date), 10) === y)?.value;
    const sample = sampleYears.map((y) => ({
      year: y,
      consumption: pick("consumption", y) ?? null,
      investment: pick("investment", y) ?? null,
      gdp: pick("gdp", y) ?? null,
    }));
    const minMax = (pts: Point[]) => {
      if (!pts.length) return { count: 0, min: null as number | null, max: null as number | null };
      const vals = pts.map((p) => p.value);
      return { count: pts.length, min: Math.min(...vals), max: Math.max(...vals) };
    };
    console.info("[Turkey demand real] sample points", sample);
    console.info("[Turkey demand real] min/max", {
      consumption: minMax(demandSeriesByKey.get("consumption") ?? []),
      investment: minMax(demandSeriesByKey.get("investment") ?? []),
      gdp: minMax(demandSeriesByKey.get("gdp") ?? []),
    });
  }, [isTurkey, demandMode, demandSeriesByKey]);

  const timelineEvents = showOverlays ? overlays.events : [];
  const timelineBands = showOverlays ? overlays.bands : [];
  const selectedFocusBands = useMemo(
    () =>
      selectedFocusPresets
        .slice(1)
        .map((focus, idx): ChartPeriodOverlayBandInput | null => {
          const startYear = Math.max(focus.startYear, rangeStartYear);
          const endYear = Math.min(resolvePresetEndYear(focus.endYear), rangeEndYear);
          if (endYear < startYear) return null;
          return {
            id: `focus-${focus.id}-${idx}`,
            startYear,
            endYear,
            fill: "rgba(107, 114, 128, 0.08)",
          };
        })
        .filter((b): b is ChartPeriodOverlayBandInput => b !== null),
    [selectedFocusPresets, rangeStartYear, rangeEndYear]
  );
  const chartPeriodOverlayBands = useMemo(
    () => [...selectedFocusBands, ...timelineBands],
    [selectedFocusBands, timelineBands]
  );
  const focusSummaryLabel = selectedFocusPresets.map((f) => f.label).join(", ");
  const turkeyFocusClarification =
    "Focus periods are approximate political/economic eras used for comparison, not strict causal labels.";
  const russiaFocusClarification =
    "Focus periods are approximate political/economic eras used for comparison, not strict causal labels.";

  const conceptKeys = useMemo<StudyConceptId[]>(() => {
    const out: StudyConceptId[] = [
      "cpi",
      "inflation",
      "gdp",
      "gdp_growth_rate",
      "nominal_vs_real",
      "final_consumption_share",
      "gross_capital_formation",
      "trade_share",
      "industry_share",
      "gini_index",
      "poverty_headcount",
    ];
    if (oilRents.length > 0 || gasRents.length > 0) out.push("dutch_disease_pattern");
    if (hasFX && fx.length > 0) {
      out.push("fx");
      if (defaultFxLog) out.push("log_scale");
    }
    return Array.from(new Set(out));
  }, [oilRents.length, gasRents.length, hasFX, fx.length, defaultFxLog]);

  const observations = useMemo(() => {
    const missingSparse = [
      gini.length === 0 ? "Gini" : null,
      povertyExtreme.length === 0 && povertyLmic.length === 0 ? "poverty headcount" : null,
      hasFX && fx.length === 0 ? "FX" : null,
    ].filter(Boolean) as string[];
    const rows: string[] = isTurkey
      ? [
          `This page combines annual macro signals for Turkey in ${selectedRange?.label ?? "the selected range"}; shaded focus periods (${focusSummaryLabel || "selected presets"}) are context markers for comparison.`,
          "Indicators shown include inflation, exchange rate, GDP growth, demand aggregates, current account, external debt, trade, industry shares, money growth, inequality, poverty, and available resource-rent context.",
          "Focus overlays include the 2001 financial crisis, the 2018 currency crisis, and the 2021 FX shock to anchor major volatility episodes.",
          "Each panel is one measurement lens; stronger interpretation comes from checking whether multiple signals move together across the same years.",
          "Overlays and focus shading help anchor timing, but they do not prove that one political period caused a specific outcome.",
        ]
      : isRussia
        ? [
            `This page combines Russia macro and social indicators in ${selectedRange?.label ?? "the selected range"}, with shaded focus windows (${focusSummaryLabel || "selected presets"}) for period comparison.`,
            "Series include inflation, GDP growth, oil/non-oil GDP proxy, consumption, investment, oil and gas rents, official FX, trade, industry, money growth, inequality, and poverty coverage where available.",
            "Each chart is one signal; interpretation is stronger when related signals are compared across the same years rather than read in isolation.",
            "Event overlays and focus windows are context markers only and should not be read as causal proof.",
          ]
        : [
            `The charts use an outer window of ${selectedRange?.label ?? "the selected range"} and shaded focus periods of ${focusSummaryLabel || "the selected presets"}.`,
            "CPI inflation (red), GDP growth (blue), and resource-rent shares are plotted as annual WDI observations; gaps are left as gaps.",
            isUsa
              ? "Nominal/real demand aggregates are the main GDP-level view for the United States; focus shading always remains inside the visible range."
              : "Nominal/real demand and GDP decomposition toggles keep the same x-axis window so period comparisons stay aligned.",
          ];
    if (missingSparse.length > 0) {
      rows.push(
        `Some series are sparse or unavailable in this window (${missingSparse.join(", ")}); the page shows only published points and does not interpolate missing years.`
      );
    }
    return rows;
  }, [
    selectedRange?.label,
    focusSummaryLabel,
    isUsa,
    isTurkey,
    isRussia,
    gini.length,
    povertyExtreme.length,
    povertyLmic.length,
    hasFX,
    fx.length,
  ]);

  const learningSections = useMemo<LearningNoteSection[]>(
    () =>
      isTurkey
        ? [
            {
              heading: "How to read these charts",
              bullets: [
                "Read each chart as one signal; confidence improves when multiple signals point in a similar direction in the same period.",
                "Use focus periods as approximate eras for side-by-side comparison, not as strict causal labels.",
                "Overlay events and shaded windows are timing context only; they do not establish causality.",
                "For Turkey, use 2001, 2018, and 2021 as volatility anchor years across inflation, FX, and external-balance indicators.",
              ],
            },
            {
              heading: "Units and comparability",
              bullets: [
                "Annual percentages: inflation, GDP growth, money growth, current account, external debt, and trade/industry shares.",
                "TRY per USD: exchange-rate panel (official annual series). Log scale helps compare proportional depreciation across decades.",
                "Current US$ vs constant 2015 US$: nominal vs real demand toggles answer different questions and should not be mixed.",
              ],
            },
            {
              heading: "Concept guide used in this study",
              bullets: [
                "CPI inflation: annual change in consumer prices; higher values mean faster broad price increases.",
                "Exchange-rate depreciation: when more TRY are needed per USD; log scale helps compare proportional changes over long spans.",
                "GDP growth: annual change in real output, distinct from nominal level growth.",
                "Current account balance (% GDP): external balance of goods/services/income/transfers relative to economy size.",
                "External debt (% GDP): external liabilities scaled by GDP to compare debt burden over time.",
                "External vulnerability: persistent current-account deficits alongside FX pressure and rising external debt can indicate financing stress.",
                "Trade (% GDP): imports/exports as economy shares; broad openness context, not welfare by itself.",
                "Broad money growth: annual change in money-like balances; informative context, not a standalone inflation proof.",
                "Gini and poverty headcount: distribution and poverty signals that are often sparse and survey-dependent.",
                "Resource rents: oil/gas-rent shares as context markers for exposure, not a full growth model.",
              ],
            },
          ]
        : isRussia
          ? [
              {
                heading: "How to read these charts",
                bullets: [
                  "Treat each chart as one measurement signal; interpretation is stronger when related signals are compared across the same period.",
                  "Read inflation with money growth and exchange-rate movement, and read oil/gas rents alongside GDP/trade context.",
                  "Overlays and shaded focus periods are timing context only; they do not prove causality.",
                ],
              },
              {
                heading: "Units and comparability",
                bullets: [
                  "Annual %: inflation, GDP growth, broad money growth, trade shares, industry shares, and rents as % of GDP.",
                  "Current US$ vs constant 2015 US$: nominal and real toggles answer different questions and should not be mixed.",
                  "LCU per USD: official exchange-rate series (log scale can help compare proportional moves over long periods).",
                ],
              },
              {
                heading: "Concept guide used in this study",
                bullets: [
                  "CPI inflation: annual change in consumer prices.",
                  "GDP growth: annual real-output change.",
                  "GDP decomposition: contextual split between oil-linked proxy and non-oil proxy, not full national accounting.",
                  "Oil and natural gas rents: resource-income context relative to GDP, not total energy-sector output or fiscal revenue.",
                  "Exchange-rate depreciation: more local currency units per USD over time.",
                  "Trade and industry shares: openness and sector-weight context as % of GDP.",
                  "Broad money growth: money-like balance growth context, not standalone causal evidence.",
                  "Gini and poverty headcount: distribution indicators with shorter/sparser coverage than core macro series.",
                ],
              },
            ]
          : [
            {
              heading: "How to read these charts",
              bullets: [
                "Compare direction and timing first; treat overlays as context markers, not causal proof.",
                "Use the range selector for long-run context and focus chips for up to three leadership-window comparisons.",
                "For sparse indicators (especially Gini and poverty), blank years mean no point is available in this dataset.",
              ],
            },
            {
              heading: "Units and comparability",
              bullets: [
                "Growth and shares are annual percentages; level charts are in current or constant US$ as labeled.",
                "Nominal and real modes answer different questions; avoid mixing interpretations across them.",
                hasFX
                  ? "FX is official annual LCU per US$; log scale can help compare proportional moves across decades."
                  : "FX is intentionally hidden for this country template.",
                "Year labels follow the study default axis style.",
              ],
            },
          ],
    [hasFX, isTurkey, isRussia]
  );

  const sourceItems = useMemo<SourceInfoItem[]>(() => {
    const baseName = source?.name ?? "World Bank World Development Indicators";
    const basePublisher = source?.publisher ?? "World Bank";
    const baseCountryDetail = `${countryName} (${countryCode}) — ${basePublisher}`;
    const items: SourceInfoItem[] = [
      {
        label: "CPI inflation",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.cpi_inflation_yoy_pct ?? "FP.CPI.TOTL.ZG"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "Annual %",
      },
      {
        label: "GDP growth",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.gdp_growth_yoy_pct ?? "NY.GDP.MKTP.KD.ZG"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "Annual %",
      },
      {
        label: "Nominal and real GDP / demand aggregates",
        sourceName: baseName,
        sourceUrl: source?.url ?? "https://data.worldbank.org",
        sourceDetail: `${baseCountryDetail}; NE.CON.TOTL.CD/KD, NE.GDI.TOTL.CD/KD, NY.GDP.MKTP.CD/KD`,
        unitLabel: "Current US$ or constant 2015 US$ (as selected)",
      },
      {
        label: "Trade and industry",
        sourceName: baseName,
        sourceUrl: source?.url ?? "https://data.worldbank.org",
        sourceDetail: `${baseCountryDetail}; NE.IMP.GNFS.ZS, NE.EXP.GNFS.ZS, NV.IND.MANF.ZS, NV.IND.TOTL.ZS`,
        unitLabel: "% of GDP",
      },
      {
        label: "Money and inflation comparison",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.broad_money_growth_pct ?? "FM.LBL.BMNY.ZG"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "Annual %",
      },
      {
        label: "Inequality and poverty",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.gini ?? "SI.POV.GINI"}`,
        sourceDetail: `${baseCountryDetail}; SI.POV.GINI, SI.POV.DDAY, SI.POV.LMIC`,
        unitLabel: "Index (Gini) or % of population (poverty)",
      },
    ];
    if (oilRents.length > 0) {
      items.push({
        label: "Oil rents",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.oil_rents_pct_gdp ?? "NY.GDP.PETR.RT.ZS"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "% of GDP",
      });
    }
    if (gasRents.length > 0) {
      items.push({
        label: "Natural gas rents",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.natural_gas_rents_pct_gdp ?? "NY.GDP.NGAS.RT.ZS"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "% of GDP",
      });
    }
    if (hasFX) {
      items.push({
        label: "Official exchange rate",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.fx_official_lcu_per_usd ?? "PA.NUS.FCRF"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "LCU per US$",
      });
    }
    if (isUsa) {
      items.push({
        label: "Federal debt (% of GDP)",
        sourceName: source?.name ?? "FRED / World Bank",
        sourceUrl: "https://fred.stlouisfed.org/series/GFDEGDQ188S",
        sourceDetail: "GFDEGDQ188S (annual mean in this page) or WDI GC.DOD.TOTL.GD.ZS",
        unitLabel: "% of GDP",
      });
      items.push({
        label: "Budget deficit / surplus (% of GDP)",
        sourceName: source?.name ?? "FRED / World Bank",
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.fiscal_balance_pct_gdp ?? "GC.NLD.TOTL.GD.ZS"}`,
        sourceDetail: "WDI GC.NLD.TOTL.GD.ZS (fallback GC.BAL.CASH.GD.ZS)",
        unitLabel: "% of GDP",
      });
      items.push({
        label: "Federal funds rate",
        sourceName: source?.name ?? "FRED",
        sourceUrl: "https://fred.stlouisfed.org/series/FEDFUNDS",
        sourceDetail: "FEDFUNDS (annual mean in this page)",
        unitLabel: "%",
      });
      if (federalDebtUsd.length > 0) {
        items.push({
          label: "Federal debt (USD)",
          sourceName: source?.name ?? "FRED",
          sourceUrl: "https://fred.stlouisfed.org/series/GFDEBTN",
          sourceDetail: "GFDEBTN (annualized from quarterly levels in this page)",
          unitLabel: "US$",
        });
      }
    }
    if (isTurkey) {
      items.push({
        label: "Exchange rate (USD → TRY)",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.fx_official_lcu_per_usd ?? "PA.NUS.FCRF"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "TRY per USD (official annual average)",
      });
      if (hasTurkeyPolicyRateData) {
        items.push({
          label: "Policy interest rate",
          sourceName: baseName,
          sourceUrl: `https://data.worldbank.org/indicator/${turkeyPolicyRateIndicatorId}`,
          sourceDetail: `${baseCountryDetail}; proxy from WDI lending rate`,
          unitLabel: "%",
        });
      }
      items.push({
        label: "Current account balance",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.current_account_pct_gdp ?? "BN.CAB.XOKA.GD.ZS"}`,
        sourceDetail: baseCountryDetail,
        unitLabel: "% of GDP",
      });
      items.push({
        label: "External debt",
        sourceName: baseName,
        sourceUrl: `https://data.worldbank.org/indicator/${indicatorIds.external_debt_stocks_usd ?? "DT.DOD.DECT.CD"}`,
        sourceDetail: `${baseCountryDetail}; %GDP derived from DT.DOD.DECT.CD / NY.GDP.MKTP.CD`,
        unitLabel: "% of GDP (derived)",
      });
    }
    return items;
  }, [
    source,
    countryName,
    countryCode,
    indicatorIds,
    oilRents.length,
    gasRents.length,
    hasFX,
    isUsa,
    isTurkey,
    federalDebtUsd.length,
    hasTurkeyPolicyRateData,
    turkeyPolicyRateIndicatorId,
  ]);

  const sourceNote = isTurkey
    ? hasTurkeyPolicyRateData
      ? "Primary source family is World Bank WDI country series (plus derived external-debt-to-GDP ratio from debt stocks and nominal GDP). Units include annual %, TRY per USD, current US$, constant 2015 US$, % of GDP, Gini index, and poverty headcount %."
      : `Primary source family is World Bank WDI country series (plus derived external-debt-to-GDP ratio from debt stocks and nominal GDP). Policy-rate proxy is currently hidden because ${turkeyPolicyRateIndicatorId} has no Turkey observations in this selected range.`
    : isRussia
      ? "Primary source family is World Bank WDI country series. Units include annual %, current US$, constant 2015 US$, LCU per USD, % of GDP, Gini index, and poverty headcount %. Oil/gas rents are context indicators, not full sector accounting."
      : "Series are annual WDI observations. Missing years remain missing; no interpolation is applied.";

  const aiParagraphs = useMemo(() => {
    const focusRange = focusSummaryLabel || "selected focus periods";
    const sparseNotes: string[] = [];
    if (gini.length === 0) sparseNotes.push("Gini coverage is missing in the current window");
    if (povertyExtreme.length === 0 && povertyLmic.length === 0) sparseNotes.push("poverty headcount is sparse or unavailable");
    if (hasFX && fx.length === 0) sparseNotes.push("FX data is unavailable");
    if (isUsa && !hasUsFiscalMacro) sparseNotes.push("U.S. fiscal macro series are unavailable for this range");
    if (isTurkey && policyRate.length === 0) sparseNotes.push("policy-rate proxy is unavailable in this window");
    return isTurkey
      ? [
          `Within ${focusRange}, compare inflation, lira depreciation, growth, external-balance signals, and distribution indicators as descriptive co-movements rather than causal effects.`,
          "Use 2001, 2018, and 2021 overlays as timing anchors for major stress episodes in inflation, exchange rate, and external vulnerability indicators.",
          `Selected focus periods are clipped to ${selectedRange?.label ?? "the selected range"}, so shaded years always match the visible window.`,
          "Nominal and real toggles are complementary views: nominal includes current-price effects, while real better tracks volume over time.",
          sparseNotes.length
            ? `Data caveat: ${sparseNotes.join("; ")}. Missing years are intentionally left blank instead of being interpolated.`
            : "Data caveat: this page uses annual published observations; visible jumps can reflect data frequency and revisions, not necessarily a single structural break.",
        ]
      : isRussia
        ? [
            `Within ${focusRange}, compare inflation, growth, FX, energy-rent context, and distribution indicators as descriptive co-movements rather than causal effects.`,
            `Selected focus periods are clipped to ${selectedRange?.label ?? "the selected range"}, so shaded years match the visible window.`,
            "Nominal and real toggles are complementary views: nominal reflects current-price levels, while real helps compare volume across time.",
            "AI-assisted interpretation can summarize visible patterns, but it should not be treated as causal proof and should be checked against source notes and historical context.",
            sparseNotes.length
              ? `Data caveat: ${sparseNotes.join("; ")}. Missing years are intentionally left blank instead of being interpolated.`
              : "Data caveat: annual published observations can show large transition-era spikes that visually compress later variation on linear scales.",
          ]
        : [
            `Within ${focusRange}, compare inflation, growth, demand composition, and distribution indicators as descriptive co-movements rather than causal effects.`,
            `Selected focus periods are clipped to the active range (${selectedRange?.label ?? "selected range"}) so shaded years always match the visible window.`,
            "Interpret nominal and real toggles as two lenses on the same period: nominal reflects current-price levels, while real controls for price-level drift.",
            sparseNotes.length
              ? `Data caveat: ${sparseNotes.join("; ")}. Missing years are intentionally left blank instead of being interpolated.`
              : "Data caveat: this view uses annual published observations; apparent jumps can reflect sparse publication frequency, not necessarily sudden structural breaks.",
          ];
  }, [focusSummaryLabel, selectedRange?.label, gini.length, povertyExtreme.length, povertyLmic.length, hasFX, fx.length, isUsa, hasUsFiscalMacro, isTurkey, isRussia, policyRate.length]);

  const commonProps = {
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    chartHeight: isTurkey || isRussia ? "h-64 md:h-64" : "h-56 md:h-64",
    events: timelineEvents,
    chartPeriodOverlayBands,
    regimeArea: selectedPrimaryFocus
      ? {
          xStart: `${Math.max(selectedPrimaryFocus.startYear, rangeStartYear)}-01-01`,
          xEnd: `${Math.min(resolvePresetEndYear(selectedPrimaryFocus.endYear), rangeEndYear)}-12-31`,
          label: selectedPrimaryFocus.shortLabel ?? selectedPrimaryFocus.label,
        }
      : undefined,
    focusGregorianYearRange: selectedPrimaryFocus
      ? {
          startYear: Math.max(selectedPrimaryFocus.startYear, rangeStartYear),
          endYear: Math.min(resolvePresetEndYear(selectedPrimaryFocus.endYear), rangeEndYear),
        }
      : undefined,
    xAxisYearLabel: isUsa ? yearAxisMode : isTurkey ? ("both" as const) : ("gregorian" as const),
  };

  const toggleFocusPreset = (presetId: string) => {
    setFocusPresetIds((prev) => {
      const isActive = prev.includes(presetId);
      if (isActive) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== presetId);
      }
      if (prev.length >= MAX_ACTIVE_FOCUS_PERIODS) return prev;
      return [...prev, presetId];
    });
  };

  // TODO(country-economy-roadmap): extend indicator coverage when reliable long-run series are wired:
  // policy interest rate with broader historical coverage, FX reserves, unemployment, REER,
  // government debt (% GDP), tourism receipts, energy-import dependency,
  // manufacturing value added detail, and private-sector credit growth.
  // Russia-focused additions: oil/gas production volume, oil/gas export revenue,
  // current account balance, sanctions/event-intensity timeline overlays,
  // military expenditure (% GDP), federal budget balance, and reliable capital-flow proxies.

  return (
    <section className="space-y-4">
      {isTurkey || isRussia ? (
        <>
          <Card className="border-border bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Study framing</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
              {isTurkey ? (
                <p>
                  This study explores Turkey&apos;s economy across major political and macroeconomic periods, using indicators such as inflation, exchange rates, GDP growth, trade, debt, inequality, and poverty.
                </p>
              ) : (
                <p>
                  This study explores Russia&apos;s economy across major political and macroeconomic periods, using indicators such as inflation, GDP growth, exchange rates, oil and gas rents, trade, industry, inequality, and poverty.
                </p>
              )}
              <p>
                The goal is not to claim that one political period or event caused a specific outcome, but to compare how different signals moved over time.
              </p>
              <p>
                Event overlays and shaded periods are context markers only. They help the reader ask better questions, not prove causality.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Key patterns to look for</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {isTurkey ? (
                  <>
                    <li>Inflation is high and volatile before the early 2000s, moderates for a period, and rises sharply again after the late 2010s.</li>
                    <li>The Turkish lira depreciation is easier to read on a log scale because proportional moves are more comparable across decades.</li>
                    <li>Current account deficits, external debt, and exchange-rate pressure can be read together as external vulnerability signals.</li>
                    <li>Poverty falls strongly in available observations, while inequality tends to move more gradually.</li>
                  </>
                ) : (
                  <>
                    <li>The early 1990s show extreme inflation and contraction, so some charts may visually compress later variation.</li>
                    <li>GDP growth changes sharply across transition, commodity cycles, sanctions periods, and external shocks.</li>
                    <li>Oil and natural gas rents are context signals for Russia&apos;s exposure to energy markets.</li>
                    <li>Exchange-rate movement, inflation, and money growth are more informative when read together than separately.</li>
                    <li>Inequality and poverty series begin later than some macro indicators, so their historical coverage is shorter.</li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{countryName} economy study</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2.5 text-sm md:gap-3">
            <label className="inline-flex items-center gap-2">
              <span className="text-muted-foreground">Range</span>
              <select
                className="min-w-[9.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs sm:text-sm"
                value={rangePresetId}
                onChange={(e) => setRangePresetId(e.target.value)}
              >
                {rangePresets.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-flex items-center gap-2">
              <span className="text-muted-foreground">Focus</span>
              <div className="flex flex-wrap gap-1.5">
                {focusPresets.map((f) => {
                  const isAvailable = availableFocusPresets.some((af) => af.id === f.id);
                  const isActive = focusPresetIds.includes(f.id);
                  const atLimit = !isActive && focusPresetIds.length >= MAX_ACTIVE_FOCUS_PERIODS;
                  const periodLabel = formatFocusYears(f.startYear, f.endYear);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!isAvailable || atLimit}
                      onClick={() => toggleFocusPreset(f.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] sm:text-xs transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                      aria-pressed={isActive}
                      title={
                        !isAvailable
                          ? "Outside selected range"
                          : atLimit
                            ? "Maximum 3 focus periods"
                            : `${f.label} (${periodLabel})`
                      }
                    >
                      {isActive ? "✓ " : ""}
                      {f.shortLabel ?? f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {isUsa ? (
              <label className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">Year axis</span>
                <StudyYearDisplayToggle
                  size="compact"
                  isFa={false}
                  value={yearAxisMode}
                  onChange={setYearAxisMode}
                />
              </label>
            ) : null}
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOverlays}
                onChange={(e) => setShowOverlays(e.target.checked)}
              />
              <span>Show overlays</span>
            </label>
          </div>
          {isTurkey || isRussia ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                {isTurkey ? turkeyFocusClarification : russiaFocusClarification}
              </p>
              {isTurkey ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pre-2003 (1960-2002) · Erdogan I (2003-2013) · Erdogan II (2013-2018) · Erdogan III (2018-present)
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Yeltsin (1991-1999) · Putin I (2000-2008) · Medvedev (2008-2012) · Putin II (2012-present)
                </p>
              )}
              {isTurkey && !hasTurkeyPolicyRateData ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Policy-rate panel is hidden for now: source indicator {turkeyPolicyRateIndicatorId} currently has no Turkey observations in this selected range.
                </p>
              ) : null}
            </>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Overlays are contextual markers only and do not imply causality.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Focus presets outside the selected range are disabled; up to three selected periods are shaded with the first shown as primary.
          </p>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading data...</p> : null}
      {loadError ? <p className="text-sm text-destructive">Failed to load data: {loadError}</p> : null}

      {!loading && !loadError ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">1. CPI inflation (YoY)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {inflation.length > 0 ? (
                <TimelineChart
                  data={inflation}
                  valueKey="value"
                  label="Inflation"
                  seriesColor="#dc2626"
                  unit="%"
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
              {isRussia ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Early 1990s inflation values are extremely high, so later variation may look visually compressed on a linear scale.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {isTurkey ? (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">2. Exchange rate (USD → TRY)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={fxLog} onChange={(e) => setFxLog(e.target.checked)} />
                  Log scale
                </label>
                {fx.length > 0 ? (
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label="USD → TRY"
                    multiSeries={[
                      {
                        key: "usd_try",
                        label: "USD → TRY",
                        unit: "TRY per USD",
                        yAxisIndex: 0,
                        points: fx,
                        color: "#16a34a",
                        smooth: false,
                      },
                    ]}
                    yAxisLog={fxLog}
                    forceTimeAxis
                    {...commonProps}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground py-6">
                    Data unavailable for this window (PA.NUS.FCRF / USD→TRY annual series).
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{isTurkey ? "3. GDP growth (YoY)" : "2. GDP growth (YoY)"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {gdpGrowth.length > 0 ? (
                <TimelineChart
                  data={gdpGrowth}
                  valueKey="value"
                  label="GDP growth"
                  seriesColor="#2563eb"
                  unit="%"
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          {!isUsa && !isTurkey ? (
          <Card className="border-border md:col-span-2">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">
                {gdpMode === "real"
                  ? "3. GDP decomposition (real)"
                  : "3. GDP decomposition (nominal)"}
              </CardTitle>
              {isRussia ? (
                <>
                  <p className="text-xs text-muted-foreground">Oil rents proxy vs non-oil GDP proxy</p>
                  <p className="text-xs text-muted-foreground">
                    {gdpMode === "real"
                      ? "WDI NY.GDP.MKTP.KD with NY.GDP.PETR.RT.ZS-derived proxy components (constant 2015 US$)."
                      : "WDI NY.GDP.MKTP.CD with NY.GDP.PETR.RT.ZS-derived proxy components (current US$)."}
                  </p>
                </>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  className={`rounded px-3 py-1 text-xs ${gdpMode === "nominal" ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  onClick={() => setGdpMode("nominal")}
                >
                  Nominal
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1 text-xs ${gdpMode === "real" ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  onClick={() => setGdpMode("real")}
                >
                  Real
                </button>
              </div>
              {!isUsa ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  Nominal values are measured in current prices and can be affected by inflation and exchange-rate changes. Real values adjust for price changes and are better for comparing economic volume over time.
                </p>
              ) : null}
              {gdpSplit.oil.length > 0 && gdpSplit.nonOil.length > 0 ? (
                <>
                  <TimelineChart
                    data={[]}
                    valueKey="value"
                    label={`GDP decomposition (${gdpMode})`}
                    multiSeries={isRussia ? gdpDecompositionMultiSeries : gdpDecompositionMultiSeries.slice(0, 2)}
                    multiSeriesValueFormat="gdp_absolute"
                    multiSeriesYAxisNameOverrides={{
                      0: `GDP (${decompositionUnitLabel})`,
                    }}
                    {...commonProps}
                  />
                  {decompositionOilRentsCoverageNote ? (
                    <p className="mt-2 text-xs text-muted-foreground">{decompositionOilRentsCoverageNote}</p>
                  ) : null}
                  {isRussia ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      The oil GDP proxy is an approximation and should be read as a contextual signal, not a complete accounting of Russia&apos;s energy sector.
                    </p>
                  ) : null}
                  {isRussia ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Oil GDP proxy and non-oil GDP proxy are contextual approximations. They help compare the relative scale of resource-linked activity and the broader economy, not produce a full national-accounts decomposition.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>
          ) : null}

          <Card className="border-border md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {isUsa ? "3. GDP composition / demand aggregates" : "4. Consumption, investment, and GDP"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-3 inline-flex rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  className={`rounded px-3 py-1 text-xs ${demandMode === "nominal" ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  onClick={() => setDemandMode("nominal")}
                >
                  Nominal
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1 text-xs ${demandMode === "real" ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  onClick={() => setDemandMode("real")}
                >
                  Real
                </button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Nominal values are measured in current prices and can be affected by inflation and exchange-rate changes. Real values adjust for price changes and are better for comparing economic volume over time.
              </p>
              <p className="mb-3 text-xs text-muted-foreground">Unit: {demandUnitLabel}</p>
              {demandSeries.every((s) => s.points.length > 0) ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label={`Demand aggregates (${demandMode})`}
                  multiSeries={demandSeries.map((s) => ({ ...s, symbol: s.points.length < 3 ? "circle" : undefined }))}
                  multiSeriesValueFormat="gdp_absolute"
                  multiSeriesYAxisNameOverrides={{ 0: demandUnitLabel }}
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
              {demandCoverageWarning ? <p className="mt-2 text-xs text-muted-foreground">{demandCoverageWarning}</p> : null}
            </CardContent>
          </Card>

          {isUsa && hasUsFiscalMacro ? (
            <>
              <Card className="border-border md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">4. Federal debt (% of GDP)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {governmentDebtPctGdp.length > 0 ? (
                    <TimelineChart
                      data={[]}
                      valueKey="value"
                      label="Federal debt (% GDP)"
                      multiSeries={[
                        {
                          key: "federal_debt_pct",
                          label: "Federal debt (% GDP)",
                          unit: "% of GDP",
                          yAxisIndex: 0,
                          points: governmentDebtPctGdp,
                          smooth: false,
                        },
                      ]}
                      forceTimeAxis
                      {...commonProps}
                    />
                  ) : (
                    <EmptyStateHint text="Policy rate data is unavailable for the selected historical range. Try a more recent range, or check whether the source has coverage for this indicator." />
                  )}
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">5. Budget deficit / surplus (% of GDP)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {fiscalBalancePctGdp.length > 0 ? (
                    <TimelineChart
                      data={[]}
                      valueKey="value"
                      label="Fiscal balance (% GDP)"
                      multiSeries={[
                        {
                          key: "fiscal_balance",
                          label: "Budget deficit / surplus (% of GDP)",
                          unit: "% of GDP",
                          yAxisIndex: 0,
                          points: fiscalBalancePctGdp,
                          smooth: false,
                        },
                      ]}
                      forceTimeAxis
                      {...commonProps}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">6. Federal funds rate (%)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {federalFundsRate.length > 0 ? (
                    <TimelineChart
                      data={[]}
                      valueKey="value"
                      label="Federal funds rate (%)"
                      multiSeries={[
                        {
                          key: "fed_funds",
                          label: "Federal funds rate (%)",
                          unit: "%",
                          yAxisIndex: 0,
                          points: federalFundsRate,
                          smooth: false,
                        },
                      ]}
                      forceTimeAxis
                      {...commonProps}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                  )}
                </CardContent>
              </Card>
              {federalDebtUsd.length > 0 ? (
                <Card className="border-border md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Optional: Federal debt (USD)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TimelineChart
                      data={[]}
                      valueKey="value"
                      label="Federal debt (USD)"
                      multiSeries={[
                        {
                          key: "federal_debt_usd",
                          label: "Federal debt (USD)",
                          unit: "US$",
                          yAxisIndex: 0,
                          points: federalDebtUsd,
                          smooth: false,
                        },
                      ]}
                      multiSeriesValueFormat="gdp_absolute"
                      forceTimeAxis
                      {...commonProps}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}

          {!isUsa && !isTurkey ? (
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">5. Oil rents (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {oilRents.length > 0 ? (
                <TimelineChart
                  data={oilRents}
                  valueKey="value"
                  label="Oil rents"
                  unit="% of GDP"
                  seriesColor={SIGNAL_CONCEPT.oil_rents}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
              {isRussia ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Oil rents are shown as context signals. They approximate resource-related income relative to GDP, not government revenue, exports, or total energy-sector output.
                </p>
              ) : null}
            </CardContent>
          </Card>
          ) : null}

          {!isUsa && !isTurkey ? (
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">6. Natural gas rents (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {gasRents.length > 0 ? (
                <TimelineChart
                  data={gasRents}
                  valueKey="value"
                  label="Natural gas rents"
                  unit="% of GDP"
                  seriesColor={SIGNAL_CONCEPT.natural_gas_rents}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
              {isRussia ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Natural gas rents are shown as context signals. They approximate resource-related income relative to GDP, not government revenue, exports, or total energy-sector output.
                </p>
              ) : null}
            </CardContent>
          </Card>
          ) : null}

          {hasFX && !isTurkey ? (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isTurkey ? "Exchange rate (USD → TRY)" : "7. FX (official LCU per US$)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={fxLog} onChange={(e) => setFxLog(e.target.checked)} />
                  Log scale
                </label>
                {fx.length > 0 ? (
                  <TimelineChart
                    data={fx}
                    valueKey="value"
                    label={isTurkey ? "USD → TRY" : "Official FX"}
                    unit={isTurkey ? "TRY per USD" : "LCU per US$"}
                    seriesColor={isTurkey ? "#16a34a" : undefined}
                    yAxisLog={fxLog}
                    {...commonProps}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
          {isTurkey ? (
            <>
              {hasTurkeyPolicyRateData ? (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Policy interest rate (%)</CardTitle>
                    {policyRateStartYear != null && policyRateEndYear != null ? (
                      <p className="text-xs text-muted-foreground">
                        Coverage: {policyRateStartYear}-{policyRateEndYear} ({policyRate.length} points), source {turkeyPolicyRateIndicatorId}.
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TimelineChart
                      data={policyRate}
                      valueKey="value"
                      label="Policy interest rate"
                      unit="%"
                      forceTimeAxis
                      {...commonProps}
                    />
                  </CardContent>
                </Card>
              ) : null}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Current account (% GDP)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {currentAccountPctGdp.length > 0 ? (
                    <TimelineChart
                      data={currentAccountPctGdp}
                      valueKey="value"
                      label="Current account balance"
                      unit="% of GDP"
                      forceTimeAxis
                      {...commonProps}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">External debt (% GDP)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {externalDebtPctGdp.length > 0 ? (
                    <TimelineChart
                      data={externalDebtPctGdp}
                      valueKey="value"
                      label="External debt"
                      unit="% of GDP"
                      forceTimeAxis
                      {...commonProps}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">8. Trade (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {imports.length > 0 || exports.length > 0 ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Trade"
                  multiSeries={[
                    { key: "exports", label: "Exports", unit: "% of GDP", yAxisIndex: 0, points: exports },
                    { key: "imports", label: "Imports", unit: "% of GDP", yAxisIndex: 0, points: imports },
                  ]}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">9. Industry (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {industry.length > 0 || manufacturing.length > 0 ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Industry"
                  multiSeries={[
                    { key: "industry", label: "Industry", unit: "% of GDP", yAxisIndex: 0, points: industry },
                    {
                      key: "manufacturing",
                      label: "Manufacturing",
                      unit: "% of GDP",
                      yAxisIndex: 0,
                      points: manufacturing,
                    },
                  ]}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">10. Broad money growth vs inflation</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {m2.length > 0 || inflation.length > 0 ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Money and inflation"
                  multiSeries={[
                    { key: "m2", label: "Broad money growth", unit: "%", yAxisIndex: 0, points: m2 },
                    { key: "inflation", label: "Inflation", unit: "%", yAxisIndex: 0, points: inflation },
                  ]}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
              {isRussia ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Early transition-era spikes can dominate the vertical scale, so post-1990s variation may look compressed.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">11. Gini index</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {gini.length > 0 ? (
                <TimelineChart data={gini} valueKey="value" label="Gini" forceTimeAxis {...commonProps} />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">12. Poverty headcount</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {povertyExtreme.length > 0 || povertyLmic.length > 0 ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Poverty headcount"
                  multiSeries={[
                    {
                      key: "extreme",
                      label: "Extreme poverty ($2.15 PPP)",
                      unit: "%",
                      yAxisIndex: 0,
                      points: povertyExtreme,
                    },
                    {
                      key: "lmic",
                      label: "LMIC poverty line",
                      unit: "%",
                      yAxisIndex: 0,
                      points: povertyLmic,
                    },
                  ]}
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>
          {isUsa || isTurkey ? (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isTurkey ? "Optional: Resource rents" : "Optional: Energy/resource rents and oil-linked decomposition"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <details className="study-interpretation">
                  <summary>
                    <span>Energy/resource rents (context-only)</span>
                    <span className="study-interpretation-chevron" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="study-interpretation-body space-y-4">
                    {oilRents.length > 0 ? (
                      <TimelineChart
                        data={oilRents}
                        valueKey="value"
                        label="Oil rents"
                        unit="% of GDP"
                        seriesColor={SIGNAL_CONCEPT.oil_rents}
                        forceTimeAxis
                        {...commonProps}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Oil rents unavailable for this range.</p>
                    )}
                    {gasRents.length > 0 ? (
                      <TimelineChart
                        data={gasRents}
                        valueKey="value"
                        label="Natural gas rents"
                        unit="% of GDP"
                        seriesColor={SIGNAL_CONCEPT.natural_gas_rents}
                        forceTimeAxis
                        {...commonProps}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Natural gas rents unavailable for this range.</p>
                    )}
                    {!isTurkey && gdpSplit.oil.length > 0 && gdpSplit.nonOil.length > 0 ? (
                      <>
                        <TimelineChart
                          data={[]}
                          valueKey="value"
                          label="GDP decomposition (optional context)"
                          multiSeries={[
                            {
                              key: "oil",
                              label: "Oil GDP proxy",
                              unit: gdpMode === "real" ? "constant 2015 US$" : "current US$",
                              yAxisIndex: 0,
                              points: gdpSplit.oil,
                              color: SIGNAL_CONCEPT.oil_rents,
                            },
                            {
                              key: "non_oil",
                              label: "Non-oil GDP proxy",
                              unit: gdpMode === "real" ? "constant 2015 US$" : "current US$",
                              yAxisIndex: 0,
                              points: gdpSplit.nonOil,
                              color: SIGNAL_CONCEPT.remainder_gdp_proxy,
                            },
                          ]}
                          multiSeriesValueFormat="gdp_absolute"
                          {...commonProps}
                        />
                        {decompositionOilRentsCoverageNote ? (
                          <p className="mt-2 text-xs text-muted-foreground">{decompositionOilRentsCoverageNote}</p>
                        ) : null}
                      </>
                    ) : !isTurkey ? (
                      <p className="text-xs text-muted-foreground">Oil-linked decomposition unavailable for this range.</p>
                    ) : null}
                  </div>
                </details>
              </CardContent>
            </Card>
          ) : null}
          </div>
          <DataObservations observations={observations} />
          <LearningNote title="How to read these charts" sections={learningSections} />
          {conceptKeys.length ? <ConceptsUsed conceptKeys={conceptKeys} /> : null}
          <SourceInfo
            items={sourceItems}
            note={sourceNote}
          />
          <InSimpleTerms>
            {isTurkey ? (
              <>
                <p>
                  This page helps compare Turkey&apos;s economic signals over time. Instead of relying on one number, it lets you read inflation volatility, lira depreciation, growth, current-account stress, external debt, inequality, and poverty across the same periods.
                </p>
                <p>
                  Focus windows and overlays are context tools for period comparison, including the 2001 crisis, 2018 currency crisis, and 2021 FX shock. They are not evidence that a single political period caused any specific outcome.
                </p>
              </>
            ) : isRussia ? (
              <>
                <p>
                  This page helps compare Russia&apos;s economic signals over time. Instead of focusing on one number alone, it lets you compare inflation, growth, exchange rates, energy rents, trade, industry, inequality, and poverty across the same historical periods.
                </p>
                <p>
                  Focus windows and overlays provide context for timing and comparison. They are not evidence that a single period or event caused a specific outcome.
                </p>
              </>
            ) : (
              <>
                <p>
                  This page is a descriptive macro snapshot for {countryName}. It lets you compare long-run context (range) with a specific leadership period (focus) on the same charts.
                </p>
                <p>
                  If a line disappears in some years, it usually means the source did not publish those years for this indicator. The chart leaves those gaps visible instead of filling them in.
                </p>
              </>
            )}
          </InSimpleTerms>
          {aiParagraphs.length ? (
            <StudyAiInterpretation>
              {aiParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </StudyAiInterpretation>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
