"""World Bank WDI: national accounts shares and GDP (annual)."""

from typing import Any

import httpx

from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

WB_BASE = "https://api.worldbank.org/v2/country"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"

# In-process cache for raw WDI indicator rows (shared across signal bundles). Invalidated with
# ``invalidate_prefix("wdi_rows:")`` when the weekly WDI refresh job runs.
WDI_ROWS_TTL_SECONDS = 21600.0  # 6 hours, aligned with ``signalmap.services.signals.CACHE_TTL``

# World Development Indicators used for GDP composition studies
WDI_FINAL_CONSUMPTION_PCT_GDP = "NE.CON.TOTL.ZS"
WDI_GROSS_CAPITAL_FORMATION_PCT_GDP = "NE.GDI.TOTL.ZS"
WDI_GDP_CURRENT_USD = "NY.GDP.MKTP.CD"

# Absolute levels (prefer constant 2015 US$; swap to *_CD for current-USD-only if needed)
WDI_FINAL_CONSUMPTION_CONST_USD = "NE.CON.TOTL.KD"
WDI_GDP_CONST_USD = "NY.GDP.MKTP.KD"
WDI_GROSS_CAPITAL_FORMATION_CONST_USD = "NE.GDI.TOTL.KD"
WDI_FINAL_CONSUMPTION_CURRENT_USD = "NE.CON.TOTL.CD"
WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD = "NE.GDI.TOTL.CD"

WDI_LABELS: dict[str, str] = {
    WDI_FINAL_CONSUMPTION_PCT_GDP: "Final consumption expenditure (% of GDP)",
    WDI_GROSS_CAPITAL_FORMATION_PCT_GDP: "Gross capital formation (% of GDP)",
    WDI_GDP_CURRENT_USD: "GDP (current US$)",
    WDI_FINAL_CONSUMPTION_CONST_USD: "Final consumption expenditure (constant 2015 US$)",
    WDI_GDP_CONST_USD: "GDP (constant 2015 US$)",
    WDI_GROSS_CAPITAL_FORMATION_CONST_USD: "Gross capital formation (constant 2015 US$)",
    WDI_FINAL_CONSUMPTION_CURRENT_USD: "Final consumption expenditure (current US$)",
    WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD: "Gross capital formation (current US$)",
}

# WDI indicator ids for absolute levels (used by GDP composition ``levels_value_type``).
REAL_LEVEL_IDS: dict[str, str] = {
    "consumption": WDI_FINAL_CONSUMPTION_CONST_USD,
    "gdp": WDI_GDP_CONST_USD,
    "investment": WDI_GROSS_CAPITAL_FORMATION_CONST_USD,
}
CURRENT_USD_LEVEL_IDS: dict[str, str] = {
    "consumption": WDI_FINAL_CONSUMPTION_CURRENT_USD,
    "gdp": WDI_GDP_CURRENT_USD,
    "investment": WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD,
}


def resolve_national_account_levels_rows(iso: str, gdp_current_usd_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Return absolute-level series rows for consumption, GDP, and investment.

    Preference order (easy to extend): constant 2015 US$ (WDI *KD), else current US$ (*CD / NY.GDP.MKTP.CD).
    ``gdp_current_usd_rows`` avoids a duplicate fetch when falling back to current US$ for GDP.
    """
    cons_kd = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_CONST_USD)
    gdp_kd = fetch_wdi_annual_indicator(iso, WDI_GDP_CONST_USD)
    inv_kd = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_CONST_USD)
    if cons_kd and gdp_kd and inv_kd:
        return {
            "price_basis": "constant_2015_usd",
            "unit": "constant 2015 US$",
            "rows": {"consumption": cons_kd, "gdp": gdp_kd, "investment": inv_kd},
            "ids": {
                "consumption": WDI_FINAL_CONSUMPTION_CONST_USD,
                "gdp": WDI_GDP_CONST_USD,
                "investment": WDI_GROSS_CAPITAL_FORMATION_CONST_USD,
            },
        }

    cons_cd = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_CURRENT_USD)
    inv_cd = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD)
    return {
        "price_basis": "current_usd",
        "unit": "current US$",
        "rows": {"consumption": cons_cd, "gdp": gdp_current_usd_rows, "investment": inv_cd},
        "ids": {
            "consumption": WDI_FINAL_CONSUMPTION_CURRENT_USD,
            "gdp": WDI_GDP_CURRENT_USD,
            "investment": WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD,
        },
    }


def fetch_wdi_annual_indicator(country_iso3: str, indicator_id: str) -> list[dict[str, Any]]:
    """
    Fetch one WDI indicator for a country. Returns [{year: int, value: float}, ...] sorted by year.
    Paginates until all rows are read. Results are cached in-process (``wdi_rows:…``) to avoid
    repeated HTTP for the same (iso, indicator) when building multiple study bundles.
    """
    iso = country_iso3.strip().upper()
    iid = indicator_id.strip()
    ck = f"wdi_rows:{iso}:{iid}"
    hit = cache_get(ck)
    if hit is not None:
        return hit  # type: ignore[return-value]

    url = f"{WB_BASE}/{iso}/indicator/{iid}"
    rows: list[dict[str, Any]] = []
    page = 1
    with httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
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
    cache_set(ck, rows, WDI_ROWS_TTL_SECONDS)
    return rows


def build_wdi_levels_pack(
    natural_start: int,
    natural_end: int,
    cons_rows: list[dict[str, Any]],
    gdp_rows: list[dict[str, Any]],
    inv_rows: list[dict[str, Any]],
    ids: dict[str, str],
    price_basis: str,
    unit: str,
) -> dict[str, Any] | None:
    """
    Build the ``levels.indicators`` block for consumption, GDP, and investment.

    Returns None if any of the three row lists is empty (caller decides fallback).
    """
    if not cons_rows or not gdp_rows or not inv_rows:
        return None
    cons_pts = points_for_chart(cons_rows, natural_start, natural_end)
    gdp_pts = points_for_chart(gdp_rows, natural_start, natural_end)
    inv_pts = points_for_chart(inv_rows, natural_start, natural_end)
    return {
        "price_basis": price_basis,
        "unit": unit,
        "indicators": {
            "consumption": {
                "id": ids["consumption"],
                "label": WDI_LABELS.get(ids["consumption"], ids["consumption"]),
                "display_label": "Consumption",
                "underlying_label": "Final consumption expenditure",
                "unit": unit,
                "points": cons_pts,
            },
            "gdp": {
                "id": ids["gdp"],
                "label": WDI_LABELS.get(ids["gdp"], ids["gdp"]),
                "display_label": "GDP",
                "underlying_label": "Gross domestic product",
                "unit": unit,
                "points": gdp_pts,
            },
            "investment": {
                "id": ids["investment"],
                "label": WDI_LABELS.get(ids["investment"], ids["investment"]),
                "display_label": "Investment",
                "underlying_label": "Gross capital formation",
                "unit": unit,
                "points": inv_pts,
            },
        },
    }


def points_for_chart(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, Any]]:
    """Convert WDI rows to [{date: YYYY-01-01, value}, ...] filtered by year range."""
    out: list[dict[str, Any]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = r["value"]
        out.append({"date": f"{y}-01-01", "value": round(float(v), 4 if v < 1000 else 2)})
    return out


def series_first_last_year(rows: list[dict[str, Any]]) -> tuple[int | None, int | None]:
    """First and last calendar year in sorted WDI rows (rows must be non-empty and sorted)."""
    if not rows:
        return None, None
    return int(rows[0]["year"]), int(rows[-1]["year"])


def combined_span_from_series(
    named_rows: list[tuple[str, list[dict[str, Any]]]],
) -> tuple[int | None, int | None, dict[str, dict[str, int | None]]]:
    """
    Earliest year where any series has data, latest year where any series has data,
    plus per-series first/last years for metadata (series may start at different years).
    """
    per: dict[str, dict[str, int | None]] = {}
    first_years: list[int] = []
    last_years: list[int] = []
    for key, rows in named_rows:
        fy, ly = series_first_last_year(rows)
        per[key] = {"first_year": fy, "last_year": ly}
        if fy is not None:
            first_years.append(fy)
        if ly is not None:
            last_years.append(ly)
    if not first_years or not last_years:
        return None, None, per
    return min(first_years), max(last_years), per
