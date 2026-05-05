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
# Oil rents as % of GDP (World Bank definition) — used only with nominal GDP for a levels proxy split.
WDI_OIL_RENTS_PCT_GDP = "NY.GDP.PETR.RT.ZS"
# Both series use ``fetch_wdi_annual_indicator`` → in-process ``wdi_rows:IRN:<indicator>`` cache (6h TTL),
# shared with other WDI bundles. Full nominal bundle also cached at ``signal:iran_demand_nominal_usd:v5:…``.

# Real (constant 2015 US$)
WDI_FINAL_CONSUMPTION_KD = "NE.CON.TOTL.KD"
WDI_GROSS_CAPITAL_FORMATION_KD = "NE.GDI.TOTL.KD"
WDI_GDP_KD = "NY.GDP.MKTP.KD"

WDI_LABELS: dict[str, str] = {
    WDI_FINAL_CONSUMPTION_CD: "Final consumption expenditure (current US$)",
    WDI_GROSS_CAPITAL_FORMATION_CD: "Gross capital formation (current US$)",
    WDI_GDP_CD: "GDP (current US$)",
    WDI_OIL_RENTS_PCT_GDP: "Oil rents (% of GDP)",
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


def _build_gdp_oil_decomposition_usd_points(
    gdp_points: list[dict[str, float | str]],
    oil_pct_rows: list[dict[str, Any]],
    start_year: int,
    end_year: int,
) -> tuple[list[dict[str, float | str]], list[dict[str, float | str]], dict[str, Any]]:
    """
    Proxy levels (current US$): oil_value = GDP × (oil rents % / 100), non_oil = GDP − oil_value.

    Join keys are **Gregorian integer years** only (WDI ``year`` / ``YYYY`` from point dates), never Solar Hijri
    display years. Years missing oil-rent % are omitted from the decomposition lists (GDP total line may still exist).
    """
    pct_by_year: dict[int, float] = {}
    for r in oil_pct_rows:
        try:
            y = int(r["year"])
            if y < start_year or y > end_year:
                continue
            pct_by_year[y] = float(r["value"])
        except (TypeError, ValueError, KeyError):
            continue

    gdp_by_year: dict[int, tuple[str, float]] = {}
    for p in gdp_points:
        ds = str(p["date"])
        try:
            y = int(ds[:4])
            g = float(p["value"])
        except (TypeError, ValueError):
            continue
        if y < start_year or y > end_year:
            continue
        gdp_by_year[y] = (ds, g)

    overlap_years = sorted(set(gdp_by_year) & set(pct_by_year))
    non_oil_out: list[dict[str, float | str]] = []
    oil_out: list[dict[str, float | str]] = []
    for y in overlap_years:
        ds, g = gdp_by_year[y]
        pct = pct_by_year[y]
        pct_clamped = min(100.0, max(0.0, pct))
        oil_v = g * pct_clamped / 100.0
        if oil_v > g:
            oil_v = g
        non_v = g - oil_v
        non_oil_out.append({"date": ds, "value": round(non_v, 0)})
        oil_out.append({"date": ds, "value": round(oil_v, 0)})

    gdp_years = sorted(gdp_by_year)
    oil_years = sorted(pct_by_year)
    coverage: dict[str, Any] = {
        "window": {"start_gregorian": start_year, "end_gregorian": end_year},
        "gdp_usd": {
            "first_year": gdp_years[0] if gdp_years else None,
            "last_year": gdp_years[-1] if gdp_years else None,
            "years_in_window": len(gdp_years),
        },
        "oil_rents_pct": {
            "first_year": oil_years[0] if oil_years else None,
            "last_year": oil_years[-1] if oil_years else None,
            "years_in_window": len(oil_years),
        },
        "overlap_years_count": len(overlap_years),
        "overlap_first_year": overlap_years[0] if overlap_years else None,
        "overlap_last_year": overlap_years[-1] if overlap_years else None,
    }
    _logger.info(
        "iran_demand_nominal gdp_oil_decomposition window=%s–%s gdp_years=%s oil_pct_years=%s overlap=%s (%s…%s)",
        start_year,
        end_year,
        coverage["gdp_usd"]["years_in_window"],
        coverage["oil_rents_pct"]["years_in_window"],
        coverage["overlap_years_count"],
        coverage["overlap_first_year"],
        coverage["overlap_last_year"],
    )
    return non_oil_out, oil_out, coverage


def fetch_iran_demand_nominal_usd_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """Annual WDI nominal + real national-accounts aggregates for Iran (IRN), chart-ready ``{date, value}`` lists."""
    with ThreadPoolExecutor(max_workers=7) as pool:
        f_cc = pool.submit(_fetch_indicator_safe, "IRN", WDI_FINAL_CONSUMPTION_CD)
        f_ic = pool.submit(_fetch_indicator_safe, "IRN", WDI_GROSS_CAPITAL_FORMATION_CD)
        f_gc = pool.submit(_fetch_indicator_safe, "IRN", WDI_GDP_CD)
        f_petr = pool.submit(_fetch_indicator_safe, "IRN", WDI_OIL_RENTS_PCT_GDP)
        f_ck = pool.submit(_fetch_indicator_safe, "IRN", WDI_FINAL_CONSUMPTION_KD)
        f_ik = pool.submit(_fetch_indicator_safe, "IRN", WDI_GROSS_CAPITAL_FORMATION_KD)
        f_gk = pool.submit(_fetch_indicator_safe, "IRN", WDI_GDP_KD)
        cons_c, err_cc = f_cc.result()
        inv_c, err_ic = f_ic.result()
        gdp_c, err_gc = f_gc.result()
        petr_rows, err_petr = f_petr.result()
        cons_k, err_ck = f_ck.result()
        inv_k, err_ik = f_ik.result()
        gdp_k, err_gk = f_gk.result()

    series_warnings: dict[str, str] = {}
    for key, err in (
        ("consumption_usd", err_cc),
        ("investment_usd", err_ic),
        ("gdp_usd", err_gc),
        ("oil_rents_pct_gdp", err_petr),
        ("consumption_kd", err_ck),
        ("investment_kd", err_ik),
        ("gdp_kd", err_gk),
    ):
        if err:
            series_warnings[key] = err

    gdp_usd_pts = _rows_to_points(gdp_c, start_year, end_year)
    gdp_non_oil_proxy_usd, gdp_oil_proxy_usd, gdp_decomposition_coverage = _build_gdp_oil_decomposition_usd_points(
        gdp_usd_pts, petr_rows, start_year, end_year
    )

    out: dict[str, Any] = {
        "series": {
            "consumption_usd": _rows_to_points(cons_c, start_year, end_year),
            "investment_usd": _rows_to_points(inv_c, start_year, end_year),
            "gdp_usd": gdp_usd_pts,
            "gdp_non_oil_proxy_usd": gdp_non_oil_proxy_usd,
            "gdp_oil_proxy_usd": gdp_oil_proxy_usd,
            "consumption_kd": _rows_to_points(cons_k, start_year, end_year),
            "investment_kd": _rows_to_points(inv_k, start_year, end_year),
            "gdp_kd": _rows_to_points(gdp_k, start_year, end_year),
        },
        "indicator_ids": {
            "consumption_usd": WDI_FINAL_CONSUMPTION_CD,
            "investment_usd": WDI_GROSS_CAPITAL_FORMATION_CD,
            "gdp_usd": WDI_GDP_CD,
            "oil_rents_pct_gdp": WDI_OIL_RENTS_PCT_GDP,
            "gdp_non_oil_proxy_usd": "derived:NY.GDP.MKTP.CD−(NY.GDP.MKTP.CD×NY.GDP.PETR.RT.ZS/100)",
            "gdp_oil_proxy_usd": "derived:NY.GDP.MKTP.CD×NY.GDP.PETR.RT.ZS/100",
            "consumption_kd": WDI_FINAL_CONSUMPTION_KD,
            "investment_kd": WDI_GROSS_CAPITAL_FORMATION_KD,
            "gdp_kd": WDI_GDP_KD,
        },
        "indicator_labels": WDI_LABELS,
        "gdp_decomposition_coverage": gdp_decomposition_coverage,
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
