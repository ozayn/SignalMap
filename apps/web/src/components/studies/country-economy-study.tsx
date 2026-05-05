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

type Point = { date: string; value: number };
type DemandMode = "nominal" | "real";
type GdpMode = "nominal" | "real";

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

export function CountryEconomyStudy({
  countryCode,
  countryName,
  focusPresets,
  rangePresets,
  overlays,
  hasFX,
  defaultFxLog,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<CountryEconomyBundle | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [rangePresetId, setRangePresetId] = useState(rangePresets[0]?.id ?? "full");
  const [focusPresetId, setFocusPresetId] = useState(focusPresets[0]?.id ?? "");
  const [demandMode, setDemandMode] = useState<DemandMode>("nominal");
  const [gdpMode, setGdpMode] = useState<GdpMode>("nominal");
  const [fxLog, setFxLog] = useState(defaultFxLog);

  const selectedRange = useMemo(
    () => rangePresets.find((r) => r.id === rangePresetId) ?? rangePresets[0],
    [rangePresetId, rangePresets]
  );
  const selectedFocus = useMemo(
    () => focusPresets.find((f) => f.id === focusPresetId) ?? focusPresets[0],
    [focusPresetId, focusPresets]
  );
  const rangeStart = `${selectedRange?.startYear ?? 1960}-01-01`;
  const rangeEnd = `${resolvePresetEndYear(selectedRange?.endYear ?? null)}-12-31`;
  const focusStart = `${selectedFocus?.startYear ?? 1960}-01-01`;
  const focusEnd = `${resolvePresetEndYear(selectedFocus?.endYear ?? null)}-12-31`;

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

  const gdpSplitNominal = useMemo(() => deriveGdpOilSplit(gdpNominal, oilRents), [gdpNominal, oilRents]);
  const gdpSplitReal = useMemo(() => deriveGdpOilSplit(gdpReal, oilRents), [gdpReal, oilRents]);
  const gdpSplit = gdpMode === "real" ? gdpSplitReal : gdpSplitNominal;

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

  const timelineEvents = showOverlays ? overlays.events : [];
  const timelineBands = showOverlays ? overlays.bands : [];

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
    const rows: string[] = [
      `The charts use an outer window of ${selectedRange?.label ?? "the selected range"} and a shaded focus period of ${selectedFocus?.label ?? "the selected preset"}.`,
      "CPI inflation (red), GDP growth (blue), and resource-rent shares are plotted as annual WDI observations; gaps are left as gaps.",
      "Nominal/real demand and GDP decomposition toggles keep the same x-axis window so period comparisons stay aligned.",
    ];
    if (missingSparse.length > 0) {
      rows.push(
        `Some series are sparse or unavailable in this window (${missingSparse.join(", ")}); the page shows only published points and does not interpolate missing years.`
      );
    }
    return rows;
  }, [
    selectedRange?.label,
    selectedFocus?.label,
    gini.length,
    povertyExtreme.length,
    povertyLmic.length,
    hasFX,
    fx.length,
  ]);

  const learningSections = useMemo<LearningNoteSection[]>(
    () => [
      {
        heading: "How to read these charts",
        bullets: [
          "Compare direction and timing first; treat overlays as context markers, not causal proof.",
          "Use the range selector for long-run context and the focus selector for leadership-window comparisons.",
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
        ],
      },
    ],
    [hasFX]
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
    return items;
  }, [source, countryName, countryCode, indicatorIds, oilRents.length, gasRents.length, hasFX]);

  const aiParagraphs = useMemo(() => {
    const focusRange = `${selectedFocus?.label ?? "selected focus period"}`;
    const sparseNotes: string[] = [];
    if (gini.length === 0) sparseNotes.push("Gini coverage is missing in the current window");
    if (povertyExtreme.length === 0 && povertyLmic.length === 0) sparseNotes.push("poverty headcount is sparse or unavailable");
    if (hasFX && fx.length === 0) sparseNotes.push("FX data is unavailable");
    return [
      `Within ${focusRange}, compare inflation, growth, demand composition, and distribution indicators as descriptive co-movements rather than causal effects.`,
      "Interpret nominal and real toggles as two lenses on the same period: nominal reflects current-price levels, while real controls for price-level drift.",
      sparseNotes.length
        ? `Data caveat: ${sparseNotes.join("; ")}. Missing years are intentionally left blank instead of being interpolated.`
        : "Data caveat: this view uses annual published observations; apparent jumps can reflect sparse publication frequency, not necessarily sudden structural breaks.",
    ];
  }, [selectedFocus?.label, gini.length, povertyExtreme.length, povertyLmic.length, hasFX, fx.length]);

  const commonProps = {
    timeRange: [rangeStart, rangeEnd] as [string, string],
    chartRangeGranularity: "year" as const,
    showChartControls: true,
    chartHeight: "h-56 md:h-64",
    events: timelineEvents,
    chartPeriodOverlayBands: timelineBands,
    regimeArea: {
      xStart: focusStart,
      xEnd: focusEnd,
      label: selectedFocus?.shortLabel ?? selectedFocus?.label ?? "Focus period",
    },
    focusGregorianYearRange: {
      startYear: selectedFocus?.startYear ?? 1960,
      endYear: resolvePresetEndYear(selectedFocus?.endYear ?? null),
    },
    forceTimeRangeAxis: true as const,
  };

  return (
    <section className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{countryName} economy study</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <span className="text-muted-foreground">Range</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1"
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
            <label className="inline-flex items-center gap-2">
              <span className="text-muted-foreground">Focus</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1"
                value={focusPresetId}
                onChange={(e) => setFocusPresetId(e.target.value)}
              >
                {focusPresets.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOverlays}
                onChange={(e) => setShowOverlays(e.target.checked)}
              />
              <span>Show overlays</span>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Overlays are contextual markers only and do not imply causality.
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
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">2. GDP growth (YoY)</CardTitle></CardHeader>
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

          <Card className="border-border md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3. GDP decomposition (oil vs non-oil)</CardTitle>
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
              {gdpSplit.oil.length > 0 && gdpSplit.nonOil.length > 0 ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="GDP decomposition"
                  multiSeries={[
                    {
                      key: "oil",
                      label: "Oil GDP proxy",
                      unit: gdpMode === "real" ? "constant 2015 US$" : "current US$",
                      yAxisIndex: 0,
                      points: gdpSplit.oil,
                    },
                    {
                      key: "non_oil",
                      label: "Non-oil GDP proxy",
                      unit: gdpMode === "real" ? "constant 2015 US$" : "current US$",
                      yAxisIndex: 0,
                      points: gdpSplit.nonOil,
                    },
                  ]}
                  multiSeriesValueFormat="gdp_absolute"
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">4. Consumption, investment, and GDP</CardTitle>
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
              {demandSeries.every((s) => s.points.length > 0) ? (
                <TimelineChart
                  data={[]}
                  valueKey="value"
                  label="Demand aggregates"
                  multiSeries={demandSeries}
                  multiSeriesValueFormat="gdp_absolute"
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">5. Oil rents (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {oilRents.length > 0 ? (
                <TimelineChart
                  data={oilRents}
                  valueKey="value"
                  label="Oil rents"
                  unit="% of GDP"
                  seriesColor="#f97316"
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">6. Natural gas rents (% of GDP)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {gasRents.length > 0 ? (
                <TimelineChart
                  data={gasRents}
                  valueKey="value"
                  label="Natural gas rents"
                  unit="% of GDP"
                  forceTimeAxis
                  {...commonProps}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
              )}
            </CardContent>
          </Card>

          {hasFX ? (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">7. FX (official LCU per US$)</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={fxLog} onChange={(e) => setFxLog(e.target.checked)} />
                  Log scale
                </label>
                {fx.length > 0 ? (
                  <TimelineChart
                    data={fx}
                    valueKey="value"
                    label="Official FX"
                    unit="LCU per US$"
                    yAxisLog={fxLog}
                    {...commonProps}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground py-6">Data unavailable for this window.</p>
                )}
              </CardContent>
            </Card>
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
                      label: "Extreme poverty ($2.15/day, PPP)",
                      unit: "%",
                      yAxisIndex: 0,
                      points: povertyExtreme,
                    },
                    {
                      key: "lmic",
                      label: "Lower-middle poverty line",
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
          </div>
          <DataObservations observations={observations} />
          <LearningNote title="How to read these charts" sections={learningSections} />
          {conceptKeys.length ? <ConceptsUsed conceptKeys={conceptKeys} /> : null}
          <SourceInfo
            items={sourceItems}
            note="Series are annual WDI observations. Missing years remain missing; no interpolation is applied."
          />
          <InSimpleTerms>
            <p>
              This page is a descriptive macro snapshot for {countryName}. It lets you compare long-run context (range) with a specific leadership period (focus) on the same charts.
            </p>
            <p>
              If a line disappears in some years, it usually means the source did not publish those years for this indicator. The chart leaves those gaps visible instead of filling them in.
            </p>
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
