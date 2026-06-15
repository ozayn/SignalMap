"""US living standards bundle: FRED macro series + curated reference prices."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx

from signalmap.sources.world_bank_country_economy import (
    _fetch_fred_graph_csv_rows,
    _fred_rows_to_points,
)

_logger = logging.getLogger(__name__)

FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"

FRED_SERIES: dict[str, tuple[str, str]] = {
    "median_household_income_real_usd": ("MEHOINUSA672N", "annual_level"),
    "median_home_price_usd": ("MSPUS", "quarterly_mean"),
    "productivity_index": ("OPHNFB", "quarterly_mean"),
    "hourly_compensation_index": ("COMPNFB", "quarterly_mean"),
    "average_hourly_earnings_usd": ("CES0500000003", "monthly_mean"),
    "average_hourly_earnings_household_goods_usd": ("AHETPI", "monthly_mean"),
    "cpi_all_items_index": ("CPIAUCSL", "monthly_mean"),
}

REFERENCE_PATH = Path(__file__).resolve().parents[3] / "data" / "us_living_standards_reference.json"


def _load_reference() -> dict[str, Any]:
    with REFERENCE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _fetch_fred_api_rows(series_id: str, observation_start: str = "1940-01-01") -> list[tuple[int, float]]:
    api_key = (os.getenv("FRED_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("FRED_API_KEY not configured")
    params: dict[str, str] = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": observation_start,
    }
    with httpx.Client(timeout=30.0, headers={"User-Agent": FRED_USER_AGENT}) as client:
        r = client.get(FRED_OBSERVATIONS_URL, params=params)
        r.raise_for_status()
        data = r.json()
    rows: list[tuple[int, float]] = []
    for obs in data.get("observations") or []:
        val = (obs.get("value") or "").strip()
        if not val or val == ".":
            continue
        date = (obs.get("date") or "").strip()
        if not date:
            continue
        try:
            rows.append((int(date[:4]), float(val)))
        except ValueError:
            continue
    return rows


def _fetch_fred_annual_points(
    series_id: str, start_year: int, end_year: int, mode: str = "monthly_mean"
) -> list[dict[str, float | str]]:
    rows: list[tuple[int, float]] | None = None
    try:
        rows = _fetch_fred_graph_csv_rows(series_id)
    except Exception as graph_err:
        try:
            rows = _fetch_fred_api_rows(series_id)
        except Exception as api_err:
            raise ValueError(
                f"FRED {series_id} unavailable (graph: {graph_err}; api: {api_err})"
            ) from api_err
    return _fred_rows_to_points(rows, start_year, end_year, mode)


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


def _points_from_year_map(by_year: dict[int, float]) -> list[dict[str, float | str]]:
    return [{"date": f"{y}-01-01", "value": round(v, 2)} for y, v in sorted(by_year.items())]


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


def _resolve_common_index_base_year(
    series_list: list[list[dict[str, float | str]]], preferred_year: int = 2000
) -> int | None:
    maps = [_points_by_year(s) for s in series_list if s]
    if not maps:
        return None
    years = sorted({y for mp in maps for y in mp})
    try_order = [preferred_year, *[y for y in years if y != preferred_year]] if preferred_year in years else years
    for y in try_order:
        if all(
            (v := mp.get(y)) is not None and v != 0 and v == v  # finite, non-zero
            for mp in maps
        ):
            return y
    return None


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


def _cpi_anchored_price_series(
    cpi_points: list[dict[str, float | str]],
    benchmark_year: int,
    benchmark_price: float,
    start_year: int,
    end_year: int,
) -> list[dict[str, float | str]]:
    cpi_by_year = _points_by_year(cpi_points)
    base_cpi = cpi_by_year.get(benchmark_year)
    if base_cpi is None or base_cpi <= 0:
        return []
    out: list[dict[str, float | str]] = []
    for y in range(start_year, end_year + 1):
        c = cpi_by_year.get(y)
        if c is None or c <= 0:
            continue
        out.append({"date": f"{y}-01-01", "value": round(benchmark_price * (c / base_cpi), 2)})
    return out


def _splice_ppi_price_series(
    primary_points: list[dict[str, float | str]],
    continuation_points: list[dict[str, float | str]],
    splice_year: int,
) -> list[dict[str, float | str]]:
    primary = _points_by_year(primary_points)
    continuation = _points_by_year(continuation_points)
    if splice_year not in primary or splice_year not in continuation:
        return _points_from_year_map(primary)
    primary_val = primary[splice_year]
    cont_val = continuation[splice_year]
    if cont_val <= 0:
        return _points_from_year_map(primary)
    merged = {y: v for y, v in primary.items() if y <= splice_year}
    for y, idx in continuation.items():
        if y <= splice_year:
            continue
        merged[y] = round(primary_val * (idx / cont_val), 2)
    return _points_from_year_map(merged)


def _merge_price_series(*series_list: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
    merged: dict[int, float] = {}
    for series in series_list:
        for y, v in _points_by_year(series).items():
            merged[y] = v
    return _points_from_year_map(merged)


def _build_household_good_price_series(
    item_cfg: dict[str, Any],
    reference: dict[str, Any],
    start_year: int,
    end_year: int,
    cpi_cache: dict[str, list[dict[str, float | str]]],
    series_warnings: dict[str, str],
) -> list[dict[str, float | str]]:
    cpi_series_id = str(item_cfg["cpi_fred_series"])
    benchmark_year = int(item_cfg["benchmark_year"])
    benchmark_price = float(item_cfg["benchmark_price_usd"])
    cpi_start = int(item_cfg.get("cpi_start_year", start_year))

    if cpi_series_id not in cpi_cache:
        try:
            cpi_cache[cpi_series_id] = _fetch_fred_annual_points(cpi_series_id, cpi_start, end_year)
        except Exception as e:
            cpi_cache[cpi_series_id] = []
            series_warnings[f"cpi_{cpi_series_id}"] = str(e)

    cpi_points = cpi_cache.get(cpi_series_id, [])
    price = _cpi_anchored_price_series(cpi_points, benchmark_year, benchmark_price, cpi_start, end_year)

    continuation_id = item_cfg.get("cpi_continuation_series")
    continuation_from = item_cfg.get("cpi_continuation_from_year")
    if continuation_id and continuation_from:
        cont_id = str(continuation_id)
        if cont_id not in cpi_cache:
            try:
                cpi_cache[cont_id] = _fetch_fred_annual_points(cont_id, int(continuation_from) - 1, end_year)
            except Exception as e:
                cpi_cache[cont_id] = []
                series_warnings[f"cpi_{cont_id}"] = str(e)
        splice_year = int(continuation_from) - 1
        price = _splice_ppi_price_series(price, cpi_cache.get(cont_id, []), splice_year)

    hist_key = item_cfg.get("historical_anchor_key")
    hist_end = item_cfg.get("historical_end_year")
    if hist_key and hist_end is not None:
        anchors = reference.get(str(hist_key), [])
        hist_end_year = int(hist_end)
        historical = _interpolate_annual(anchors, start_year, min(end_year, hist_end_year))
        price = _merge_price_series(historical, price)

    return price


def fetch_us_living_standards_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    series: dict[str, list[dict[str, float | str]]] = {}
    series_warnings: dict[str, str] = {}
    reference = _load_reference()
    reference_sources = dict(reference.get("sources", {}))
    household_goods_cfg = reference.get("household_goods", {})
    household_goods_meta: dict[str, Any] = {
        "methodology_note": household_goods_cfg.get("methodology_note", ""),
        "wage_fred_series": household_goods_cfg.get("wage_fred_series", "AHETPI"),
        "items": {},
    }

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

    cpi_cache: dict[str, list[dict[str, float | str]]] = {}
    items_cfg: dict[str, Any] = household_goods_cfg.get("items", {})
    hours_key_by_item = {
        "refrigerator": "hours_for_refrigerator",
        "washing_machine": "hours_for_washing_machine",
        "television": "hours_for_television",
        "vacuum_cleaner": "hours_for_vacuum_cleaner",
    }
    wage_household = series.get("average_hourly_earnings_household_goods_usd", [])

    for item_key, item_cfg in items_cfg.items():
        price_series = _build_household_good_price_series(
            item_cfg, reference, start_year, end_year, cpi_cache, series_warnings
        )
        price_series_key = f"{item_key}_estimated_price_usd"
        series[price_series_key] = price_series
        hours_key = hours_key_by_item.get(item_key, f"hours_for_{item_key}")
        series[hours_key] = _hours_to_afford(price_series, wage_household)
        start_years = [int(str(p["date"])[:4]) for p in series[hours_key]]
        household_goods_meta["items"][item_key] = {
            "label": item_cfg.get("label", item_key.replace("_", " ").title()),
            "benchmark_year": item_cfg.get("benchmark_year"),
            "benchmark_price_usd": item_cfg.get("benchmark_price_usd"),
            "cpi_fred_series": item_cfg.get("cpi_fred_series"),
            "cpi_continuation_series": item_cfg.get("cpi_continuation_series"),
            "cpi_source": item_cfg.get("cpi_source"),
            "cpi_start_year": item_cfg.get("cpi_start_year"),
            "hours_start_year": min(start_years) if start_years else None,
            "hours_end_year": max(start_years) if start_years else None,
        }

    real_base_year = 2022
    series["median_home_price_real_usd"] = _deflate_with_cpi(
        series["median_home_price_usd"], series["cpi_all_items_index"], real_base_year
    )
    series["public_tuition_real_usd"] = _deflate_with_cpi(
        series["public_tuition_annual_usd"], series["cpi_all_items_index"], real_base_year
    )
    series["house_price_to_income_ratio"] = _derive_ratio(
        series["median_home_price_usd"], series["median_household_income_real_usd"]
    )
    series["tuition_to_income_ratio"] = _derive_ratio(
        series["public_tuition_annual_usd"], series["median_household_income_real_usd"]
    )

    prod_base = _resolve_common_index_base_year(
        [series["productivity_index"], series["hourly_compensation_index"]], preferred_year=2000
    )
    if prod_base is None:
        prod_base = 1979
    series["productivity_reindexed"] = _reindex(series["productivity_index"], prod_base)
    series["compensation_reindexed"] = _reindex(series["hourly_compensation_index"], prod_base)

    series["hours_for_month_rent"] = _hours_to_afford(
        series["median_gross_rent_monthly_usd"], series["average_hourly_earnings_usd"]
    )
    series["hours_for_year_tuition"] = _hours_to_afford(
        series["public_tuition_annual_usd"], series["average_hourly_earnings_usd"]
    )

    out: dict[str, Any] = {
        "series": series,
        "reference_sources": reference_sources,
        "fred_series": {k: v[0] for k, v in FRED_SERIES.items()},
        "real_base_year": real_base_year,
        "productivity_compensation_base_year": prod_base,
        "household_goods": household_goods_meta,
        "country_iso3": "USA",
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
