"""US living standards bundle: FRED macro series + curated reference prices."""

from __future__ import annotations

import csv
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import StringIO
from pathlib import Path
from typing import Any

import httpx

from signalmap.sources.world_bank_country_economy import (
    FRED_GRAPH_CSV,
    _fred_rows_to_points,
)
from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator_with_meta

_logger = logging.getLogger(__name__)

STUDY_ID = "us-living-standards"
FRED_GRAPH_TIMEOUT = 12.0
FRED_API_TIMEOUT = 15.0
FRED_MAX_WORKERS = 10

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
    # Phase 2 — transportation & family formation
    "gasoline_price_usd_per_gallon": ("GASREGW", "monthly_mean"),
    "cpi_new_vehicles_index": ("CUUR0000SETA01", "monthly_mean"),
    "homeownership_rate_pct": ("RHORUSQ156N", "quarterly_mean"),
    "fertility_rate_births_per_woman": ("SPDYNTFRTINUSA", "annual_level"),
}

WDI_PHASE2_INDICATORS: dict[str, str] = {
    "health_expenditure_per_capita_usd": "SH.XPD.CHEX.PC.CD",
    "life_expectancy_years": "SP.DYN.LE00.IN",
}

REFERENCE_FILENAME = "us_living_standards_reference.json"


def _reference_path_candidates() -> list[Path]:
    """Search api-root data/, then src/data/, then optional env override."""
    module = Path(__file__).resolve()
    candidates: list[Path] = [
        module.parents[3] / "data" / REFERENCE_FILENAME,
        module.parents[2] / "data" / REFERENCE_FILENAME,
    ]
    data_dir = (os.getenv("SIGNALMAP_API_DATA_DIR") or "").strip()
    if data_dir:
        candidates.insert(0, Path(data_dir) / REFERENCE_FILENAME)
    return candidates


def _find_reference_path() -> Path | None:
    for path in _reference_path_candidates():
        if path.is_file():
            return path
    return None


def _default_reference() -> dict[str, Any]:
    return {
        "sources": {},
        "hours_of_work": {
            "methodology_note": (
                "Hours-of-work estimates use historical wage proxies to approximate how many hours "
                "an average worker would need to work to cover the selected expense. The series are "
                "intended as contextual affordability signals rather than precise household budget calculations."
            ),
            "wage_fred_series": "AHETPI",
            "wage_source": "FRED AHETPI — BLS average hourly earnings of production and nonsupervisory employees, total private (1964+).",
            "wage_tradeoffs": (
                "FRED CES0500000003 (average hourly earnings of all private employees) begins in 2006. "
                "AHETPI extends to 1964 but covers production and nonsupervisory workers only."
            ),
        },
        "household_goods": {
            "methodology_note": (
                "Historical prices for some durable goods are estimated using official price indices "
                "anchored to benchmark price observations."
            ),
            "wage_fred_series": "AHETPI",
            "items": {},
        },
        "phase2": {
            "health_insurance_note": (
                "Employer-sponsored health insurance premium series are omitted when reference metadata is unavailable."
            ),
            "childcare_note": "Reliable long-run national childcare-cost series is not yet included.",
            "new_vehicle": {},
        },
        "public_tuition_annual_usd": [],
        "median_gross_rent_monthly_usd": [],
        "refrigerator_usd": [],
        "washing_machine_usd": [],
        "television_usd": [],
        "median_age_first_marriage_male": [],
        "median_age_first_marriage_female": [],
    }


def _try_load_reference() -> tuple[dict[str, Any], str | None]:
    path = _find_reference_path()
    if path is None:
        tried = ", ".join(str(p) for p in _reference_path_candidates())
        err = f"{REFERENCE_FILENAME} not found (tried: {tried})"
        _logger.error("us_living_standards reference missing study=%s err=%s", STUDY_ID, err)
        return _default_reference(), err
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        _logger.exception(
            "us_living_standards reference read failed study=%s path=%s",
            STUDY_ID,
            path,
        )
        return _default_reference(), f"{path}: {e}"


def _load_reference() -> dict[str, Any]:
    reference, _ = _try_load_reference()
    return reference


def _log_series_warning(section: str, indicator: str, source: str, err: str) -> None:
    _logger.warning(
        "us_living_standards fetch failed study=%s section=%s indicator=%s source=%s err=%s",
        STUDY_ID,
        section,
        indicator,
        source,
        err,
    )


def _fetch_fred_graph_csv_rows_timed(series_id: str, timeout: float = FRED_GRAPH_TIMEOUT) -> list[tuple[int, float]]:
    try:
        with httpx.Client(timeout=timeout, headers={"User-Agent": FRED_USER_AGENT}) as client:
            r = client.get(FRED_GRAPH_CSV, params={"id": series_id})
            r.raise_for_status()
    except Exception as e:
        raise ValueError(f"FRED {series_id} graph fetch failed: {e}") from e

    rows: list[tuple[int, float]] = []
    reader = csv.DictReader(StringIO(r.text))
    value_col = series_id
    for rec in reader:
        ds = (rec.get("DATE") or rec.get("date") or rec.get("observation_date") or "").strip()
        vs = (rec.get(value_col) or rec.get("VALUE") or "").strip()
        if not ds or vs in ("", ".", "NaN"):
            continue
        try:
            rows.append((int(ds[:4]), float(vs)))
        except ValueError:
            continue
    return rows


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
    with httpx.Client(timeout=FRED_API_TIMEOUT, headers={"User-Agent": FRED_USER_AGENT}) as client:
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


def _fetch_fred_raw_rows(series_id: str) -> tuple[list[tuple[int, float]] | None, str | None]:
    try:
        return _fetch_fred_graph_csv_rows_timed(series_id), None
    except Exception as graph_err:
        api_key = (os.getenv("FRED_API_KEY") or "").strip()
        if not api_key:
            return None, f"FRED {series_id} graph failed ({graph_err}); FRED_API_KEY not configured"
        try:
            return _fetch_fred_api_rows(series_id), None
        except Exception as api_err:
            return None, f"FRED {series_id} unavailable (graph: {graph_err}; api: {api_err})"


def _fetch_fred_annual_points_safe(
    series_id: str, start_year: int, end_year: int, mode: str = "monthly_mean"
) -> tuple[list[dict[str, float | str]], str | None]:
    rows, err = _fetch_fred_raw_rows(series_id)
    if err or rows is None:
        return [], err
    return _fred_rows_to_points(rows, start_year, end_year, mode), None


def _fetch_fred_series_parallel(
    start_year: int, end_year: int, series_warnings: dict[str, str]
) -> dict[str, list[dict[str, float | str]]]:
    series: dict[str, list[dict[str, float | str]]] = {}

    def _worker(key: str, series_id: str, mode: str) -> tuple[str, list[dict[str, float | str]], str | None]:
        rows, err = _fetch_fred_raw_rows(series_id)
        if err or rows is None:
            _log_series_warning("fred", key, "FRED", err or "unknown")
            return key, [], err
        return key, _fred_rows_to_points(rows, start_year, end_year, mode), None

    with ThreadPoolExecutor(max_workers=FRED_MAX_WORKERS) as pool:
        futures = [
            pool.submit(_worker, key, series_id, mode)
            for key, (series_id, mode) in FRED_SERIES.items()
        ]
        for fut in as_completed(futures):
            key, points, err = fut.result()
            series[key] = points
            if err:
                series_warnings[key] = err
    return series


def _collect_household_goods_cpi_requests(
    reference: dict[str, Any], start_year: int
) -> dict[str, int]:
    requests: dict[str, int] = {}
    items_cfg: dict[str, Any] = reference.get("household_goods", {}).get("items", {})
    for item_cfg in items_cfg.values():
        cpi_id = str(item_cfg["cpi_fred_series"])
        cpi_start = int(item_cfg.get("cpi_start_year", start_year))
        requests[cpi_id] = min(requests.get(cpi_id, cpi_start), cpi_start)
        continuation_id = item_cfg.get("cpi_continuation_series")
        continuation_from = item_cfg.get("cpi_continuation_from_year")
        if continuation_id and continuation_from:
            cont_id = str(continuation_id)
            cont_start = int(continuation_from) - 1
            requests[cont_id] = min(requests.get(cont_id, cont_start), cont_start)
    return requests


def _prefetch_household_goods_cpi_parallel(
    cpi_requests: dict[str, int],
    end_year: int,
    series_warnings: dict[str, str],
) -> dict[str, list[dict[str, float | str]]]:
    cpi_cache: dict[str, list[dict[str, float | str]]] = {}

    def _worker(series_id: str, cpi_start: int) -> tuple[str, list[dict[str, float | str]], str | None]:
        points, err = _fetch_fred_annual_points_safe(series_id, cpi_start, end_year)
        if err:
            _log_series_warning("household_goods", series_id, "FRED", err)
        return series_id, points, err

    with ThreadPoolExecutor(max_workers=FRED_MAX_WORKERS) as pool:
        futures = {
            pool.submit(_worker, series_id, cpi_start): series_id
            for series_id, cpi_start in cpi_requests.items()
        }
        for fut in as_completed(futures):
            series_id, points, err = fut.result()
            cpi_cache[series_id] = points
            if err:
                series_warnings[f"cpi_{series_id}"] = err
    return cpi_cache


def _wdi_rows_to_points(
    rows: list[dict[str, Any]], start_year: int, end_year: int
) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        out.append({"date": f"{y}-01-01", "value": round(float(r["value"]), 3)})
    return out


def _fetch_wdi_phase2_parallel(
    start_year: int, end_year: int, series_warnings: dict[str, str]
) -> dict[str, list[dict[str, float | str]]]:
    series: dict[str, list[dict[str, float | str]]] = {}

    def _worker(key: str, indicator_id: str) -> tuple[str, list[dict[str, float | str]], str | None]:
        try:
            rows, stale = fetch_wdi_annual_indicator_with_meta("USA", indicator_id)
            if stale:
                _log_series_warning("wdi", key, "World Bank WDI", "stale cache fallback used")
            return key, _wdi_rows_to_points(rows, start_year, end_year), None
        except Exception as e:
            _log_series_warning("wdi", key, "World Bank WDI", str(e))
            return key, [], str(e)

    with ThreadPoolExecutor(max_workers=len(WDI_PHASE2_INDICATORS)) as pool:
        futures = [
            pool.submit(_worker, key, indicator_id)
            for key, indicator_id in WDI_PHASE2_INDICATORS.items()
        ]
        for fut in as_completed(futures):
            key, points, err = fut.result()
            series[key] = points
            if err:
                series_warnings[key] = err
    return series


def _build_new_vehicle_price_series(
    reference: dict[str, Any],
    start_year: int,
    end_year: int,
    cpi_points: list[dict[str, float | str]],
) -> list[dict[str, float | str]]:
    cfg = reference.get("phase2", {}).get("new_vehicle", {})
    if not cfg:
        return []
    return _cpi_anchored_price_series(
        cpi_points,
        int(cfg["benchmark_year"]),
        float(cfg["benchmark_price_usd"]),
        int(cfg.get("cpi_start_year", start_year)),
        end_year,
    )


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
) -> list[dict[str, float | str]]:
    cpi_series_id = str(item_cfg["cpi_fred_series"])
    benchmark_year = int(item_cfg["benchmark_year"])
    benchmark_price = float(item_cfg["benchmark_price_usd"])
    cpi_start = int(item_cfg.get("cpi_start_year", start_year))

    cpi_points = cpi_cache.get(cpi_series_id, [])
    price = _cpi_anchored_price_series(cpi_points, benchmark_year, benchmark_price, cpi_start, end_year)

    continuation_id = item_cfg.get("cpi_continuation_series")
    continuation_from = item_cfg.get("cpi_continuation_from_year")
    if continuation_id and continuation_from:
        cont_id = str(continuation_id)
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


def _empty_bundle_skeleton(start_year: int, end_year: int) -> dict[str, Any]:
    reference = _default_reference()
    household_goods_cfg = reference.get("household_goods", {})
    hours_of_work_cfg = reference.get("hours_of_work", {})
    phase2_cfg = reference.get("phase2", {})
    return {
        "series": {},
        "reference_sources": dict(reference.get("sources", {})),
        "fred_series": {k: v[0] for k, v in FRED_SERIES.items()},
        "wdi_indicators": dict(WDI_PHASE2_INDICATORS),
        "real_base_year": 2022,
        "productivity_compensation_base_year": 1979,
        "household_goods": {
            "methodology_note": household_goods_cfg.get("methodology_note", ""),
            "wage_fred_series": household_goods_cfg.get("wage_fred_series", "AHETPI"),
            "items": {},
        },
        "hours_of_work": {
            "methodology_note": hours_of_work_cfg.get("methodology_note", ""),
            "wage_fred_series": hours_of_work_cfg.get("wage_fred_series", "AHETPI"),
            "wage_source": hours_of_work_cfg.get("wage_source", ""),
            "wage_tradeoffs": hours_of_work_cfg.get("wage_tradeoffs", ""),
        },
        "phase2": {
            "health_insurance_note": phase2_cfg.get("health_insurance_note", ""),
            "childcare_note": phase2_cfg.get("childcare_note", ""),
            "new_vehicle": phase2_cfg.get("new_vehicle", {}),
        },
        "country_iso3": "USA",
        "partial": True,
    }


def fetch_us_living_standards_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    series_warnings: dict[str, str] = {}
    reference, ref_err = _try_load_reference()
    if ref_err:
        series_warnings["reference"] = ref_err

    reference_sources = dict(reference.get("sources", {}))
    household_goods_cfg = reference.get("household_goods", {})
    hours_of_work_cfg = reference.get("hours_of_work", {})
    phase2_cfg = reference.get("phase2", {})
    household_goods_meta: dict[str, Any] = {
        "methodology_note": household_goods_cfg.get("methodology_note", ""),
        "wage_fred_series": household_goods_cfg.get("wage_fred_series", "AHETPI"),
        "items": {},
    }
    hours_of_work_meta: dict[str, Any] = {
        "methodology_note": hours_of_work_cfg.get("methodology_note", ""),
        "wage_fred_series": hours_of_work_cfg.get("wage_fred_series", "AHETPI"),
        "wage_source": hours_of_work_cfg.get("wage_source", ""),
        "wage_tradeoffs": hours_of_work_cfg.get("wage_tradeoffs", ""),
    }

    series = _fetch_fred_series_parallel(start_year, end_year, series_warnings)
    wdi_series = _fetch_wdi_phase2_parallel(start_year, end_year, series_warnings)
    series.update(wdi_series)

    for ref_key in (
        "public_tuition_annual_usd",
        "median_gross_rent_monthly_usd",
        "refrigerator_usd",
        "washing_machine_usd",
        "television_usd",
        "median_age_first_marriage_male",
        "median_age_first_marriage_female",
    ):
        series[ref_key] = _interpolate_annual(reference.get(ref_key, []), start_year, end_year)

    cpi_requests = _collect_household_goods_cpi_requests(reference, start_year)
    cpi_cache = _prefetch_household_goods_cpi_parallel(cpi_requests, end_year, series_warnings)
    items_cfg: dict[str, Any] = household_goods_cfg.get("items", {})
    hours_key_by_item = {
        "refrigerator": "hours_for_refrigerator",
        "washing_machine": "hours_for_washing_machine",
        "television": "hours_for_television",
        "vacuum_cleaner": "hours_for_vacuum_cleaner",
    }
    wage_household = series.get("average_hourly_earnings_household_goods_usd", [])
    wage_hours = wage_household

    for item_key, item_cfg in items_cfg.items():
        price_series = _build_household_good_price_series(
            item_cfg, reference, start_year, end_year, cpi_cache
        )
        price_series_key = f"{item_key}_estimated_price_usd"
        series[price_series_key] = price_series
        hours_key = hours_key_by_item.get(item_key, f"hours_for_{item_key}")
        series[hours_key] = _hours_to_afford(price_series, wage_hours)
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
        series.get("median_home_price_usd", []), series.get("cpi_all_items_index", []), real_base_year
    )
    series["public_tuition_real_usd"] = _deflate_with_cpi(
        series.get("public_tuition_annual_usd", []), series.get("cpi_all_items_index", []), real_base_year
    )
    series["house_price_to_income_ratio"] = _derive_ratio(
        series.get("median_home_price_usd", []), series.get("median_household_income_real_usd", [])
    )
    series["tuition_to_income_ratio"] = _derive_ratio(
        series.get("public_tuition_annual_usd", []), series.get("median_household_income_real_usd", [])
    )

    prod_base = _resolve_common_index_base_year(
        [series.get("productivity_index", []), series.get("hourly_compensation_index", [])],
        preferred_year=2000,
    )
    if prod_base is None:
        prod_base = 1979
    series["productivity_reindexed"] = _reindex(series.get("productivity_index", []), prod_base)
    series["compensation_reindexed"] = _reindex(series.get("hourly_compensation_index", []), prod_base)

    series["hours_for_month_rent"] = _hours_to_afford(
        series.get("median_gross_rent_monthly_usd", []), wage_hours
    )
    series["hours_for_year_tuition"] = _hours_to_afford(
        series.get("public_tuition_annual_usd", []), wage_hours
    )

    for meta_key, hours_key in (
        ("rent", "hours_for_month_rent"),
        ("tuition", "hours_for_year_tuition"),
    ):
        pts = series.get(hours_key, [])
        years = [int(str(p["date"])[:4]) for p in pts]
        hours_of_work_meta[f"{meta_key}_hours_start_year"] = min(years) if years else None
        hours_of_work_meta[f"{meta_key}_hours_end_year"] = max(years) if years else None

    # Phase 2 derived series
    series["gasoline_price_real_usd_per_gallon"] = _deflate_with_cpi(
        series.get("gasoline_price_usd_per_gallon", []),
        series.get("cpi_all_items_index", []),
        real_base_year,
    )
    new_vehicle_price = _build_new_vehicle_price_series(
        reference,
        start_year,
        end_year,
        series.get("cpi_new_vehicles_index", []),
    )
    series["new_vehicle_estimated_price_usd"] = new_vehicle_price
    series["new_vehicle_to_income_ratio"] = _derive_ratio(
        new_vehicle_price, series.get("median_household_income_real_usd", [])
    )
    series["hours_for_new_vehicle"] = _hours_to_afford(new_vehicle_price, wage_hours)
    series["health_expenditure_per_capita_real_usd"] = _deflate_with_cpi(
        series.get("health_expenditure_per_capita_usd", []),
        series.get("cpi_all_items_index", []),
        real_base_year,
    )

    vehicle_hours_years = [int(str(p["date"])[:4]) for p in series.get("hours_for_new_vehicle", [])]
    phase2_meta: dict[str, Any] = {
        "health_insurance_note": phase2_cfg.get("health_insurance_note", ""),
        "childcare_note": phase2_cfg.get("childcare_note", ""),
        "new_vehicle": phase2_cfg.get("new_vehicle", {}),
        "health_expenditure_start_year": min(
            (int(str(p["date"])[:4]) for p in series.get("health_expenditure_per_capita_usd", [])),
            default=None,
        ),
        "health_expenditure_end_year": max(
            (int(str(p["date"])[:4]) for p in series.get("health_expenditure_per_capita_usd", [])),
            default=None,
        ),
        "vehicle_hours_start_year": min(vehicle_hours_years) if vehicle_hours_years else None,
        "vehicle_hours_end_year": max(vehicle_hours_years) if vehicle_hours_years else None,
    }

    out: dict[str, Any] = {
        "series": series,
        "reference_sources": reference_sources,
        "fred_series": {k: v[0] for k, v in FRED_SERIES.items()},
        "wdi_indicators": dict(WDI_PHASE2_INDICATORS),
        "real_base_year": real_base_year,
        "productivity_compensation_base_year": prod_base,
        "household_goods": household_goods_meta,
        "hours_of_work": hours_of_work_meta,
        "phase2": phase2_meta,
        "country_iso3": "USA",
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
