"""World Bank WDI: multi-indicator bundle for Iran structural / resource diagnostic views."""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from signalmap.sources.world_bank_national_accounts import WB_BASE, USER_AGENT, fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

# Oil dependence (World Bank definition of oil rents share of GDP)
WDI_OIL_RENTS_PCT_GDP = "NY.GDP.PETR.RT.ZS"
# Natural gas dependence (resource rents share of GDP)
WDI_NATURAL_GAS_RENTS_PCT_GDP = "NY.GDP.NGAS.RT.ZS"
# Total natural resource rents share of GDP (context)
WDI_TOTAL_NATURAL_RESOURCE_RENTS_PCT_GDP = "NY.GDP.TOTL.RT.ZS"
# Tradable-sector proxy (not exhaustive of all tradables)
WDI_MANUFACTURING_VA_PCT_GDP = "NV.IND.MANF.ZS"
# External demand / openness (imports relative to GDP)
WDI_IMPORTS_PCT_GDP = "NE.IMP.GNFS.ZS"

WDI_LABELS: dict[str, str] = {
    WDI_OIL_RENTS_PCT_GDP: "Oil rents (% of GDP)",
    WDI_NATURAL_GAS_RENTS_PCT_GDP: "Natural gas rents (% of GDP)",
    WDI_TOTAL_NATURAL_RESOURCE_RENTS_PCT_GDP: "Total natural resources rents (% of GDP)",
    WDI_MANUFACTURING_VA_PCT_GDP: "Manufacturing, value added (% of GDP)",
    WDI_IMPORTS_PCT_GDP: "Imports of goods and services (% of GDP)",
}


def _fetch_indicator_safe(country_iso3: str, indicator_id: str) -> tuple[list[dict[str, Any]], str | None]:
    """Return rows or empty list with a short error message (never raises)."""
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            return fetch_wdi_annual_indicator(country_iso3, indicator_id), None
        except Exception as e:
            last_err = e
            if attempt == 0:
                _logger.warning("WDI fetch retrying %s %s after error: %s", country_iso3, indicator_id, e)
                time.sleep(0.35)
                continue
            _logger.warning("WDI fetch failed %s %s: %s", country_iso3, indicator_id, e)
    # Fallback path for intermittent timeout on the shared helper/client: retry once
    # with a longer direct HTTP timeout for this specific indicator call.
    if last_err and "timed out" in str(last_err).lower():
        try:
            return _fetch_wdi_annual_indicator_long_timeout(country_iso3, indicator_id), None
        except Exception as e:
            _logger.warning(
                "WDI long-timeout fallback failed %s %s: %s",
                country_iso3,
                indicator_id,
                e,
            )
            last_err = e
    return [], f"{indicator_id}: {last_err}"


def _fetch_wdi_annual_indicator_long_timeout(country_iso3: str, indicator_id: str) -> list[dict[str, Any]]:
    """Direct WDI fetch with longer timeout for flaky indicators."""
    iso = country_iso3.strip().upper()
    iid = indicator_id.strip()
    url = f"{WB_BASE}/{iso}/indicator/{iid}"
    rows: list[dict[str, Any]] = []
    page = 1
    with httpx.Client(timeout=90.0, headers={"User-Agent": USER_AGENT}) as client:
        while True:
            r = client.get(url, params={"format": "json", "per_page": 1000, "page": page})
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list) or len(data) < 2:
                break
            meta = data[0] if isinstance(data[0], dict) else {}
            records = data[1]
            if not isinstance(records, list):
                break
            for rec in records:
                if not isinstance(rec, dict):
                    continue
                date_str = rec.get("date")
                val = rec.get("value")
                if not date_str or val is None:
                    continue
                try:
                    year = int(date_str)
                    value = float(val)
                except (ValueError, TypeError):
                    continue
                rows.append({"year": year, "value": value})
            total_pages = int(meta.get("pages", 1) or 1)
            if page >= total_pages:
                break
            page += 1
    rows.sort(key=lambda r: r["year"])
    return rows


def _rows_to_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        out.append({"date": f"{y}-01-01", "value": round(float(r["value"]), 3)})
    return out


def fetch_iran_dutch_disease_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """Annual WDI series for Iran (IRN), chart-ready ``{date, value}`` lists."""
    # Five indicators × paginated World Bank HTTP — overlap wall time via thread pool (rows still cached per indicator).
    with ThreadPoolExecutor(max_workers=5) as pool:
        f_oil = pool.submit(_fetch_indicator_safe, "IRN", WDI_OIL_RENTS_PCT_GDP)
        f_gas = pool.submit(_fetch_indicator_safe, "IRN", WDI_NATURAL_GAS_RENTS_PCT_GDP)
        f_total_rents = pool.submit(_fetch_indicator_safe, "IRN", WDI_TOTAL_NATURAL_RESOURCE_RENTS_PCT_GDP)
        f_mfg = pool.submit(_fetch_indicator_safe, "IRN", WDI_MANUFACTURING_VA_PCT_GDP)
        f_imp = pool.submit(_fetch_indicator_safe, "IRN", WDI_IMPORTS_PCT_GDP)
        oil, err_oil = f_oil.result()
        gas, err_gas = f_gas.result()
        total_rents, err_total_rents = f_total_rents.result()
        mfg, err_mfg = f_mfg.result()
        imp, err_imp = f_imp.result()

    series_warnings: dict[str, str] = {}
    if err_oil:
        series_warnings["oil_rents_pct_gdp"] = err_oil
    if err_gas:
        series_warnings["natural_gas_rents_pct_gdp"] = err_gas
    if err_total_rents:
        series_warnings["total_natural_resource_rents_pct_gdp"] = err_total_rents
    if err_mfg:
        series_warnings["manufacturing_pct_gdp"] = err_mfg
    if err_imp:
        series_warnings["imports_pct_gdp"] = err_imp

    out: dict[str, Any] = {
        "series": {
            "oil_rents_pct_gdp": _rows_to_points(oil, start_year, end_year),
            "natural_gas_rents_pct_gdp": _rows_to_points(gas, start_year, end_year),
            "total_natural_resource_rents_pct_gdp": _rows_to_points(total_rents, start_year, end_year),
            "manufacturing_pct_gdp": _rows_to_points(mfg, start_year, end_year),
            "imports_pct_gdp": _rows_to_points(imp, start_year, end_year),
        },
        "indicators": {
            "oil_rents_pct_gdp": WDI_OIL_RENTS_PCT_GDP,
            "natural_gas_rents_pct_gdp": WDI_NATURAL_GAS_RENTS_PCT_GDP,
            "total_natural_resource_rents_pct_gdp": WDI_TOTAL_NATURAL_RESOURCE_RENTS_PCT_GDP,
            "manufacturing_pct_gdp": WDI_MANUFACTURING_VA_PCT_GDP,
            "imports_pct_gdp": WDI_IMPORTS_PCT_GDP,
        },
        "indicator_labels": WDI_LABELS,
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
