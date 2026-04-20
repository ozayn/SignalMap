"""World Bank WDI: Gini coefficient (income inequality), annual."""

from __future__ import annotations

from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

# World Development Indicators — Gini index (income inequality)
WDI_GINI_COEFFICIENT = "SI.POV.GINI"


def _normalize_gini_to_0_100(value: float) -> float:
    """WDI normally reports 0–100; if a value is clearly on a 0–1 scale, scale up."""
    if value <= 0:
        return value
    if value <= 1.0:
        return round(value * 100.0, 2)
    return round(value, 2)


def rows_to_chart_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = _normalize_gini_to_0_100(float(r["value"]))
        out.append({"date": f"{y}-01-01", "value": v})
    return out


def fetch_gini_series_for_countries(
    iso3_to_key: dict[str, str],
    start_year: int,
    end_year: int,
) -> dict[str, list[dict[str, float | str]]]:
    """Fetch SI.POV.GINI for each ISO3 code; return chart-ready point lists keyed by ``iso3_to_key`` values."""
    out: dict[str, list[dict[str, float | str]]] = {}
    for iso3, series_key in iso3_to_key.items():
        rows = fetch_wdi_annual_indicator(iso3, WDI_GINI_COEFFICIENT)
        out[series_key] = rows_to_chart_points(rows, start_year, end_year)
    return out
