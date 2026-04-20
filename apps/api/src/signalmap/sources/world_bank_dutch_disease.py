"""World Bank WDI: multi-indicator bundle for Iran structural / resource diagnostic views."""

from __future__ import annotations

from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

# Oil dependence (World Bank definition of oil rents share of GDP)
WDI_OIL_RENTS_PCT_GDP = "NY.GDP.PETR.RT.ZS"
# Tradable-sector proxy (not exhaustive of all tradables)
WDI_MANUFACTURING_VA_PCT_GDP = "NV.IND.MANF.ZS"
# External demand / openness (imports relative to GDP)
WDI_IMPORTS_PCT_GDP = "NE.IMP.GNFS.ZS"

WDI_LABELS: dict[str, str] = {
    WDI_OIL_RENTS_PCT_GDP: "Oil rents (% of GDP)",
    WDI_MANUFACTURING_VA_PCT_GDP: "Manufacturing, value added (% of GDP)",
    WDI_IMPORTS_PCT_GDP: "Imports of goods and services (% of GDP)",
}


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
    oil = fetch_wdi_annual_indicator("IRN", WDI_OIL_RENTS_PCT_GDP)
    mfg = fetch_wdi_annual_indicator("IRN", WDI_MANUFACTURING_VA_PCT_GDP)
    imp = fetch_wdi_annual_indicator("IRN", WDI_IMPORTS_PCT_GDP)
    return {
        "series": {
            "oil_rents_pct_gdp": _rows_to_points(oil, start_year, end_year),
            "manufacturing_pct_gdp": _rows_to_points(mfg, start_year, end_year),
            "imports_pct_gdp": _rows_to_points(imp, start_year, end_year),
        },
        "indicators": {
            "oil_rents_pct_gdp": WDI_OIL_RENTS_PCT_GDP,
            "manufacturing_pct_gdp": WDI_MANUFACTURING_VA_PCT_GDP,
            "imports_pct_gdp": WDI_IMPORTS_PCT_GDP,
        },
        "indicator_labels": WDI_LABELS,
    }
