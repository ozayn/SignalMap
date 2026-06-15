"""US living standards bundle: FRED macro series + curated reference prices."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from signalmap.sources.world_bank_country_economy import (
    _fetch_fred_graph_csv_rows,
    _fred_rows_to_points,
)

_logger = logging.getLogger(__name__)

FRED_SERIES: dict[str, tuple[str, str]] = {
    "median_household_income_real_usd": ("MEHOINUSA672N", "annual_level"),
    "median_home_price_usd": ("MSPUS", "quarterly_mean"),
    "productivity_index": ("OPHNFB", "quarterly_mean"),
    "hourly_compensation_index": ("COMPNFB", "quarterly_mean"),
    "average_hourly_earnings_usd": ("CES0500000003", "monthly_mean"),
    "cpi_all_items_index": ("CPIAUCSL", "monthly_mean"),
}

REFERENCE_PATH = Path(__file__).resolve().parents[3] / "data" / "us_living_standards_reference.json"


def _load_reference() -> dict[str, Any]:
    with REFERENCE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _interpolate_annual(anchors: list[dict[str, float | int]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    if not anchors:
        return []
    sorted_anchors = sorted({int(a["year"]): float(a["value"]) for a in anchors}.items())
    years = [y for y, _ in sorted_anchors]
    values = [v for _, v in sorted_anchors]
    out: list[dict[str, float | str]] = []
    for y in range(start_year, end_year + 1):
        if y < years[0] or y > years[-1]:
            continue
        if y in years:
            idx = years.index(y)
            val = values[idx]
        else:
            hi = next(i for i, yr in enumerate(years) if yr > y)
            lo = hi - 1
            span = years[hi] - years[lo]
            if span <= 0:
                continue
            weight = (y - years[lo]) / span
            val = values[lo] + weight * (values[hi] - values[lo])
        out.append({"date": f"{y}-01-01", "value": round(val, 2)})
    return out


def _points_by_year(points: list[dict[str, float | str]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for p in points:
        y = int(str(p["date"])[:4])
        out[y] = float(p["value"])
    return out


def _derive_ratio(numerator: list[dict[str, float | str]], denominator: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
    num = _points_by_year(numerator)
    den = _points_by_year(denominator)
    out: list[dict[str, float | str]] = []
    for y in sorted(set(num) & set(den)):
        d = den[y]
        if d <= 0:
            continue
        out.append({"date": f"{y}-01-01", "value": round(num[y] / d, 3)})
    return out


def _deflate_with_cpi(
    nominal: list[dict[str, float | str]], cpi: list[dict[str, float | str]], base_year: int
) -> list[dict[str, float | str]]:
    nom = _points_by_year(nominal)
    cpi_by_year = _points_by_year(cpi)
    base_cpi = cpi_by_year.get(base_year)
    if base_cpi is None or base_cpi <= 0:
        return []
    out: list[dict[str, float | str]] = []
    for y in sorted(set(nom) & set(cpi_by_year)):
        c = cpi_by_year[y]
        if c <= 0:
            continue
        out.append({"date": f"{y}-01-01", "value": round(nom[y] * (base_cpi / c), 2)})
    return out


def _reindex(points: list[dict[str, float | str]], base_year: int) -> list[dict[str, float | str]]:
    by_year = _points_by_year(points)
    base = by_year.get(base_year)
    if base is None or base <= 0:
        return []
    out: list[dict[str, float | str]] = []
    for y in sorted(by_year):
        out.append({"date": f"{y}-01-01", "value": round((by_year[y] / base) * 100.0, 2)})
    return out


def _hours_to_afford(price: list[dict[str, float | str]], hourly_wage: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
    price_by_year = _points_by_year(price)
    wage_by_year = _points_by_year(hourly_wage)
    out: list[dict[str, float | str]] = []
    for y in sorted(set(price_by_year) & set(wage_by_year)):
        wage = wage_by_year[y]
        if wage <= 0:
            continue
        out.append({"date": f"{y}-01-01", "value": round(price_by_year[y] / wage, 1)})
    return out


def fetch_us_living_standards_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    series: dict[str, list[dict[str, float | str]]] = {}
    series_warnings: dict[str, str] = {}
    reference = _load_reference()
    reference_sources = reference.get("sources", {})

    for key, (series_id, mode) in FRED_SERIES.items():
        try:
            fred_rows = _fetch_fred_graph_csv_rows(series_id)
            series[key] = _fred_rows_to_points(fred_rows, start_year, end_year, mode)
        except Exception as e:
            series[key] = []
            series_warnings[key] = str(e)

    for ref_key in (
        "public_tuition_annual_usd",
        "median_gross_rent_monthly_usd",
        "refrigerator_usd",
        "washing_machine_usd",
        "television_usd",
    ):
        series[ref_key] = _interpolate_annual(reference.get(ref_key, []), start_year, end_year)

    real_base_year = 2022
    series["public_tuition_real_usd"] = _deflate_with_cpi(
        series["public_tuition_annual_usd"], series["cpi_all_items_index"], real_base_year
    )
    series["house_price_to_income_ratio"] = _derive_ratio(
        series["median_home_price_usd"], series["median_household_income_real_usd"]
    )
    series["tuition_to_income_ratio"] = _derive_ratio(
        series["public_tuition_annual_usd"], series["median_household_income_real_usd"]
    )

    prod_base = 1979
    series["productivity_reindexed"] = _reindex(series["productivity_index"], prod_base)
    series["compensation_reindexed"] = _reindex(series["hourly_compensation_index"], prod_base)

    series["hours_for_month_rent"] = _hours_to_afford(
        series["median_gross_rent_monthly_usd"], series["average_hourly_earnings_usd"]
    )
    series["hours_for_year_tuition"] = _hours_to_afford(
        series["public_tuition_annual_usd"], series["average_hourly_earnings_usd"]
    )
    series["hours_for_refrigerator"] = _hours_to_afford(
        series["refrigerator_usd"], series["average_hourly_earnings_usd"]
    )
    series["hours_for_washing_machine"] = _hours_to_afford(
        series["washing_machine_usd"], series["average_hourly_earnings_usd"]
    )
    series["hours_for_television"] = _hours_to_afford(
        series["television_usd"], series["average_hourly_earnings_usd"]
    )

    out: dict[str, Any] = {
        "series": series,
        "reference_sources": reference_sources,
        "fred_series": {k: v[0] for k, v in FRED_SERIES.items()},
        "real_base_year": real_base_year,
        "productivity_compensation_base_year": prod_base,
        "country_iso3": "USA",
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
