"""World Bank WDI: Iran broad money (M2) growth, extended post-2016 with CBI liquidity–derived YoY."""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any

from signalmap.sources.world_bank_cpi_inflation import WDI_CPI_INFLATION_ANNUAL_PCT, rows_to_chart_points
from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

log = logging.getLogger(__name__)

# Broad money growth (annual %); IMF IFS via World Bank WDI
WDI_BROAD_MONEY_GROWTH_PCT = "FM.LBL.BMNY.ZG"

# WDI Iran FM.LBL.BMNY.ZG in our pipeline ends in 2016; we extend with CBI liquidity levels.
WDI_M2_GROWTH_LAST_OBS_YEAR = 2016

# Persian year s, YoY to L(s)/L(s-1) → same calendar year label as common domestic CBI yoy: G=621+s.
# First extension: s=1396, G=2017.
GREGORIAN_FROM_SOLAR = 621

# Used on chart PNG/exports and the study’s source footer (must stay aligned with the methodology note in the app).
CITATION_EN = (
    "Source: World Bank WDI FM.LBL.BMNY.ZG; IMF IFS; CBI-style liquidity levels, derived YoY growth from 2017 onward."
)
CITATION_FA = (
    "منبع: WDI بانک جهانی FM.LBL.BMNY.ZG؛ IFS (IMF)؛ سطوح نقدینگی به‌سبک بانک مرکزی—٪رشد "
    "سال‌به‌سال از ۲۰۱۷ به‌بعد (مشتق در SignalMap)."
)

_LIQUIDITY_JSON = Path(__file__).resolve().parent.parent / "data" / "iran_cbi_liquidity_levels_solar.json"


def _read_liquidity_levels() -> dict[int, float]:
    with open(_LIQUIDITY_JSON, encoding="utf-8") as f:
        raw = json.load(f)
    levels: dict[int, float] = {}
    for k, v in (raw.get("levels") or {}).items():
        levels[int(k)] = float(v)
    return levels


def _solar_yoy_pct(s: int, levels: dict[int, float]) -> float | None:
    prev, cur = levels.get(s - 1), levels.get(s)
    if prev is None or cur is None or prev <= 0.0 or not math.isfinite(cur):
        return None
    return round((cur / prev - 1.0) * 100.0, 3)


def _wdi_m2_value_by_year(rows: list[dict[str, Any]]) -> dict[int, float]:
    return {int(r["year"]): float(r["value"]) for r in rows if r.get("value") is not None}


def _build_overlap_rows(wdi_by: dict[int, float], levels: dict[int, float]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for g in (2014, 2015, 2016):
        s = g - GREGORIAN_FROM_SOLAR
        cbi = _solar_yoy_pct(s, levels)
        wv = wdi_by.get(g)
        if cbi is None or wv is None:
            continue
        d = abs(cbi - wv)
        out.append(
            {
                "gregorian_year": g,
                "solar_to_year_s": s,
                "wdi_m2_yoy_pct": round(wv, 3),
                "cbi_liquidity_yoy_pct": cbi,
                "abs_diff_pp": round(d, 3),
            }
        )
        (log.info if d <= 8.0 else log.warning)(
            "M2 WDI %s = %s; CBI(621+s) s=%s = %s; |diff|=%.2f",
            g,
            wv,
            s,
            cbi,
            d,
        )
    return out


def _year_bounds(m2: list[dict[str, str | float]]) -> dict[str, int] | None:
    if not m2:
        return None
    years = [int(p["date"][:4]) for p in m2]
    return {"first_year": min(years), "last_year": max(years)}


def build_iran_money_supply_m2_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    m2_rows = fetch_wdi_annual_indicator("IRN", WDI_BROAD_MONEY_GROWTH_PCT)
    cpi_rows = fetch_wdi_annual_indicator("IRN", WDI_CPI_INFLATION_ANNUAL_PCT)

    wdi_only_rows = [r for r in m2_rows if int(r["year"]) <= WDI_M2_GROWTH_LAST_OBS_YEAR]
    wdi_m2_clipped: list[dict[str, Any]] = [
        r
        for r in wdi_only_rows
        if r.get("value") is not None
        and start_year <= int(r["year"]) <= min(end_year, WDI_M2_GROWTH_LAST_OBS_YEAR)
    ]
    m2_wdi_points = rows_to_chart_points(
        wdi_m2_clipped, start_year, min(end_year, WDI_M2_GROWTH_LAST_OBS_YEAR)
    )
    cpi_points = rows_to_chart_points(cpi_rows, start_year, end_year)

    levels = _read_liquidity_levels()
    wdi_by = _wdi_m2_value_by_year(m2_rows)
    overlap = _build_overlap_rows(wdi_by, levels)
    s_max = max(levels) if levels else 0
    cbi_m2: list[dict[str, str | float]] = []
    if s_max and end_year > WDI_M2_GROWTH_LAST_OBS_YEAR:
        for s in range(1396, s_max + 1):
            g = s + GREGORIAN_FROM_SOLAR
            if g < WDI_M2_GROWTH_LAST_OBS_YEAR + 1 or g < start_year or g > end_year:
                continue
            y = _solar_yoy_pct(s, levels)
            if y is None:
                continue
            cbi_m2.append({"date": f"{g}-01-01", "value": y})

    by_y: dict[int, dict[str, str | float]] = {}
    for p in m2_wdi_points:
        by_y[int(p["date"][:4])] = p
    for p in cbi_m2:
        by_y[int(p["date"][:4])] = p
    m2_merged = sorted((by_y[y] for y in sorted(by_y) if start_year <= y <= end_year), key=lambda x: x["date"])

    cbi_cov = _year_bounds(cbi_m2)
    wdi_rows_m2 = [
        r
        for r in m2_rows
        if r.get("value") is not None and int(r["year"]) <= WDI_M2_GROWTH_LAST_OBS_YEAR
    ]
    wdi_cov = _coverage_bounds(wdi_rows_m2)

    return {
        "series": {
            "broad_money_growth_pct": m2_merged,
            "cpi_inflation_yoy_iran_pct": cpi_points,
        },
        "indicator_ids": {
            "broad_money_growth": WDI_BROAD_MONEY_GROWTH_PCT,
            "cpi_inflation_yoy_iran": WDI_CPI_INFLATION_ANNUAL_PCT,
        },
        "coverage": {
            "broad_money": _year_bounds(m2_merged),
            "broad_money_wdi": wdi_cov,
            "broad_money_cbi_liquidity_yoy": cbi_cov,
            "cpi_inflation_iran": _coverage_bounds(cpi_rows),
        },
        "broad_money_extension": {
            "wdi_published_thru_year": WDI_M2_GROWTH_LAST_OBS_YEAR,
            "post_wdi_growth": "cumulative YoY on end-of-solar-year broad liquidity; G=621+s; static JSON, manual refresh",
            "liquidity_table_solar_range": f"{min(levels)}–{max(levels)}" if levels else None,
        },
        "citation": {"en": CITATION_EN, "fa": CITATION_FA},
        "wdi_cbi_m2_validation": overlap,
    }


def _coverage_bounds(raw_rows: list[dict[str, Any]]) -> dict[str, int] | None:
    if not raw_rows:
        return None
    years = [int(r["year"]) for r in raw_rows]
    return {"first_year": min(years), "last_year": max(years)}
