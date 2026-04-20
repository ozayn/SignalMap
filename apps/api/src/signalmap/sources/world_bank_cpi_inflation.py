"""World Bank WDI: consumer price inflation (annual %)."""

from __future__ import annotations

from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

# Inflation, consumer prices (annual %)
WDI_CPI_INFLATION_ANNUAL_PCT = "FP.CPI.TOTL.ZG"


def rows_to_chart_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = float(r["value"])
        out.append({"date": f"{y}-01-01", "value": round(v, 2)})
    return out


def fetch_cpi_inflation_yoy_for_countries(
    iso3_to_key: dict[str, str],
    start_year: int,
    end_year: int,
) -> dict[str, list[dict[str, float | str]]]:
    out: dict[str, list[dict[str, float | str]]] = {}
    for iso3, series_key in iso3_to_key.items():
        rows = fetch_wdi_annual_indicator(iso3, WDI_CPI_INFLATION_ANNUAL_PCT)
        out[series_key] = rows_to_chart_points(rows, start_year, end_year)
    return out
