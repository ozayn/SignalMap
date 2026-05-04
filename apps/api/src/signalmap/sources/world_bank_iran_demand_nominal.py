"""World Bank WDI: Iran demand-side aggregates — nominal (current US$) and real (constant 2015 US$)."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

# Nominal (current US$)
WDI_FINAL_CONSUMPTION_CD = "NE.CON.TOTL.CD"
WDI_GROSS_CAPITAL_FORMATION_CD = "NE.GDI.TOTL.CD"
WDI_GDP_CD = "NY.GDP.MKTP.CD"

# Real (constant 2015 US$)
WDI_FINAL_CONSUMPTION_KD = "NE.CON.TOTL.KD"
WDI_GROSS_CAPITAL_FORMATION_KD = "NE.GDI.TOTL.KD"
WDI_GDP_KD = "NY.GDP.MKTP.KD"

WDI_LABELS: dict[str, str] = {
    WDI_FINAL_CONSUMPTION_CD: "Final consumption expenditure (current US$)",
    WDI_GROSS_CAPITAL_FORMATION_CD: "Gross capital formation (current US$)",
    WDI_GDP_CD: "GDP (current US$)",
    WDI_FINAL_CONSUMPTION_KD: "Final consumption expenditure (constant 2015 US$)",
    WDI_GROSS_CAPITAL_FORMATION_KD: "Gross capital formation (constant 2015 US$)",
    WDI_GDP_KD: "GDP (constant 2015 US$)",
}


def _fetch_indicator_safe(country_iso3: str, indicator_id: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        return fetch_wdi_annual_indicator(country_iso3, indicator_id), None
    except Exception as e:
        _logger.warning("WDI fetch failed %s %s: %s", country_iso3, indicator_id, e)
        return [], f"{indicator_id}: {e}"


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
        out.append({"date": f"{y}-01-01", "value": round(v, 0)})
    return out


def fetch_iran_demand_nominal_usd_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """Annual WDI nominal + real national-accounts aggregates for Iran (IRN), chart-ready ``{date, value}`` lists."""
    with ThreadPoolExecutor(max_workers=6) as pool:
        f_cc = pool.submit(_fetch_indicator_safe, "IRN", WDI_FINAL_CONSUMPTION_CD)
        f_ic = pool.submit(_fetch_indicator_safe, "IRN", WDI_GROSS_CAPITAL_FORMATION_CD)
        f_gc = pool.submit(_fetch_indicator_safe, "IRN", WDI_GDP_CD)
        f_ck = pool.submit(_fetch_indicator_safe, "IRN", WDI_FINAL_CONSUMPTION_KD)
        f_ik = pool.submit(_fetch_indicator_safe, "IRN", WDI_GROSS_CAPITAL_FORMATION_KD)
        f_gk = pool.submit(_fetch_indicator_safe, "IRN", WDI_GDP_KD)
        cons_c, err_cc = f_cc.result()
        inv_c, err_ic = f_ic.result()
        gdp_c, err_gc = f_gc.result()
        cons_k, err_ck = f_ck.result()
        inv_k, err_ik = f_ik.result()
        gdp_k, err_gk = f_gk.result()

    series_warnings: dict[str, str] = {}
    for key, err in (
        ("consumption_usd", err_cc),
        ("investment_usd", err_ic),
        ("gdp_usd", err_gc),
        ("consumption_kd", err_ck),
        ("investment_kd", err_ik),
        ("gdp_kd", err_gk),
    ):
        if err:
            series_warnings[key] = err

    out: dict[str, Any] = {
        "series": {
            "consumption_usd": _rows_to_points(cons_c, start_year, end_year),
            "investment_usd": _rows_to_points(inv_c, start_year, end_year),
            "gdp_usd": _rows_to_points(gdp_c, start_year, end_year),
            "consumption_kd": _rows_to_points(cons_k, start_year, end_year),
            "investment_kd": _rows_to_points(inv_k, start_year, end_year),
            "gdp_kd": _rows_to_points(gdp_k, start_year, end_year),
        },
        "indicator_ids": {
            "consumption_usd": WDI_FINAL_CONSUMPTION_CD,
            "investment_usd": WDI_GROSS_CAPITAL_FORMATION_CD,
            "gdp_usd": WDI_GDP_CD,
            "consumption_kd": WDI_FINAL_CONSUMPTION_KD,
            "investment_kd": WDI_GROSS_CAPITAL_FORMATION_KD,
            "gdp_kd": WDI_GDP_KD,
        },
        "indicator_labels": WDI_LABELS,
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
