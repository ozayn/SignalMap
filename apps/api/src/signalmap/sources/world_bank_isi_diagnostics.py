"""World Bank WDI: trade and industry shares for ISI-style diagnostics (multi-country, annual)."""

from __future__ import annotations

from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

# Trade and industry structure (% of GDP)
WDI_IMPORTS_PCT_GDP = "NE.IMP.GNFS.ZS"
WDI_EXPORTS_PCT_GDP = "NE.EXP.GNFS.ZS"
WDI_MANUFACTURING_PCT_GDP = "NV.IND.MANF.ZS"
WDI_INDUSTRY_PCT_GDP = "NV.IND.TOTL.ZS"
# Outcome: annual GDP growth (constant-price series basis)
WDI_GDP_GROWTH_ANNUAL_PCT = "NY.GDP.MKTP.KD.ZG"

ISI_ISO3_TO_KEY: dict[str, str] = {
    "BRA": "brazil",
    "ARG": "argentina",
    "IND": "india",
    "TUR": "turkey",
    "IRN": "iran",
}

ISI_INDICATORS: dict[str, str] = {
    "imports_pct_gdp": WDI_IMPORTS_PCT_GDP,
    "exports_pct_gdp": WDI_EXPORTS_PCT_GDP,
    "manufacturing_pct_gdp": WDI_MANUFACTURING_PCT_GDP,
    "industry_pct_gdp": WDI_INDUSTRY_PCT_GDP,
    "gdp_growth_pct": WDI_GDP_GROWTH_ANNUAL_PCT,
}


def _rows_to_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        try:
            v = float(r["value"])
        except (TypeError, ValueError):
            continue
        out.append({"date": f"{y}-01-01", "value": round(v, 4)})
    return out


def fetch_isi_diagnostics_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """
    For each ISI panel country, fetch annual WDI series used on the ISI diagnostics study page.

    Returns ``series[indicator_key][country_key] = [{date, value}, ...]``.
    """
    series: dict[str, dict[str, list[dict[str, float | str]]]] = {k: {} for k in ISI_INDICATORS}
    for iso3, country_key in ISI_ISO3_TO_KEY.items():
        for out_key, ind_id in ISI_INDICATORS.items():
            rows = fetch_wdi_annual_indicator(iso3, ind_id)
            series[out_key][country_key] = _rows_to_points(rows, start_year, end_year)
    return {
        "series": series,
        "indicator_ids": ISI_INDICATORS,
        "countries": list(ISI_ISO3_TO_KEY.values()),
    }
