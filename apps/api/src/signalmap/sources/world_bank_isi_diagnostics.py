"""World Bank WDI: trade and industry shares for ISI-style diagnostics (multi-country, annual)."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

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


def _fetch_indicator_safe(country_iso3: str, indicator_id: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        return fetch_wdi_annual_indicator(country_iso3, indicator_id), None
    except Exception as e:
        _logger.warning("ISI WDI fetch failed %s %s: %s", country_iso3, indicator_id, e)
        return [], f"{indicator_id}: {e}"


def fetch_isi_diagnostics_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """
    For each ISI panel country, fetch annual WDI series used on the ISI diagnostics study page.

    Returns ``series[indicator_key][country_key] = [{date, value}, ...]``.
    """
    series: dict[str, dict[str, list[dict[str, float | str]]]] = {k: {} for k in ISI_INDICATORS}
    series_warnings: dict[str, str] = {}

    # 5 countries × 5 indicators — overlap HTTP via thread pool (rows still cached per iso+indicator).
    tasks: list = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        for iso3, country_key in ISI_ISO3_TO_KEY.items():
            for out_key, ind_id in ISI_INDICATORS.items():
                fut = pool.submit(_fetch_indicator_safe, iso3, ind_id)
                tasks.append((fut, country_key, out_key))

        for fut, country_key, out_key in tasks:
            rows, err = fut.result()
            series[out_key][country_key] = _rows_to_points(rows, start_year, end_year)
            if err:
                series_warnings[f"{country_key}/{out_key}"] = err

    out: dict[str, Any] = {
        "series": series,
        "indicator_ids": ISI_INDICATORS,
        "countries": list(ISI_ISO3_TO_KEY.values()),
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
