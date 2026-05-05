/** Mirrors ``gdp_decomposition_coverage`` from ``/api/signals/wdi/iran-demand-nominal-usd`` (Gregorian years only). */
export type GdpDecompositionCoverage = {
  window: { start_gregorian: number; end_gregorian: number };
  gdp_usd: {
    first_year: number | null;
    last_year: number | null;
    years_in_window: number;
  };
  oil_rents_pct: {
    first_year: number | null;
    last_year: number | null;
    years_in_window: number;
  };
  overlap_years_count: number;
  overlap_first_year: number | null;
  overlap_last_year: number | null;
};
