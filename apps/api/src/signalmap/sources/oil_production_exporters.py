"""Fetch oil production for major exporters (United States, Saudi Arabia, Russia, Iran).

Returns normalized format: [{date, us, saudi_arabia, russia, iran, total_production}, ...]
Unit: million barrels per day. Annual data (YYYY-01-01).

Fetches from EIA API when EIA_API_KEY is set; falls back to FRED (if FRED_API_KEY) or static data.
"""

import os
from typing import Any

import httpx

from signalmap.data.oil_production_exporters import IRAN, RUSSIA, SAUDI_ARABIA, UNITED_STATES

EIA_INTERNATIONAL_URL = "https://api.eia.gov/v2/international/data/"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"

# EIA country codes -> our field names
EIA_COUNTRIES = {
    "USA": "us",
    "SAU": "saudi_arabia",
    "RUS": "russia",
    "IRN": "iran",
}


def fetch_eia_production(country_code: str) -> dict[int, float]:
    """
    Fetch crude oil production for one country from EIA International Data API.
    country_code: USA, SAU, RUS, or IRN.
    Returns {year: million_bbl_per_day}. EIA returns thousand bbl/day; we convert to million.
    Raises on API error or missing key.
    """
    key = (os.getenv("EIA_API_KEY") or "").strip()
    if not key:
        raise ValueError("EIA_API_KEY not configured")
    params = {
        "api_key": key,
        "frequency": "annual",
        "data[0]": "value",
        "facets[product][]": "CRUDEOIL",
        "facets[flow][]": "PRODUCTION",
        "facets[country][]": country_code,
    }
    with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(EIA_INTERNATIONAL_URL, params=params)
        r.raise_for_status()
        data = r.json()
    rows = data.get("response", {}).get("data") or []
    result: dict[int, float] = {}
    for row in rows:
        period = (row.get("period") or "").strip()
        val_str = (row.get("value") or "").strip()
        if not period or not val_str or val_str == ".":
            continue
        try:
            year = int(period[:4]) if len(period) >= 4 else int(period)
            v = float(val_str)
        except (ValueError, TypeError):
            continue
        # EIA international: thousand barrels per day -> million barrels per day
        result[year] = round(v / 1000.0, 2)
    return result


def _fetch_from_eia() -> dict[str, dict[int, float]] | None:
    """Fetch all four countries from EIA. Returns None on failure."""
    if not (os.getenv("EIA_API_KEY") or "").strip():
        return None
    out: dict[str, dict[int, float]] = {}
    try:
        for code in EIA_COUNTRIES:
            out[EIA_COUNTRIES[code]] = fetch_eia_production(code)
    except Exception:
        return None
    return out


def _fetch_from_fred() -> dict[str, dict[int, float]]:
    """Fetch Saudi, Iran, Russia from FRED. Returns {} on failure."""
    if not (os.getenv("FRED_API_KEY") or "").strip():
        return {}
    try:
        from signalmap.sources.fred_oil_production import fetch_oil_production_from_fred
        return fetch_oil_production_from_fred()
    except Exception:
        return {}


def fetch_oil_production_exporters() -> list[dict[str, Any]]:
    """
    Fetch oil production for United States, Saudi Arabia, Russia, Iran.
    Tries EIA API first (all four countries); falls back to FRED + static on failure.
    Returns [{date, us, saudi_arabia, russia, iran, total_production}, ...] sorted by date.
    Values in million barrels per day. Annual resolution.
    """
    us_fallback = UNITED_STATES
    sa_fallback = SAUDI_ARABIA
    ru_fallback = RUSSIA
    ir_fallback = IRAN

    us: dict[int, float] = {}
    sa: dict[int, float] = {}
    ru: dict[int, float] = {}
    ir: dict[int, float] = {}

    eia_data = _fetch_from_eia()
    if eia_data:
        us = eia_data.get("us") or {}
        sa = eia_data.get("saudi_arabia") or {}
        ru = eia_data.get("russia") or {}
        ir = eia_data.get("iran") or {}
        # Merge fallback for any gaps
        for year, val in us_fallback.items():
            if year not in us:
                us[year] = val
        for year, val in sa_fallback.items():
            if year not in sa:
                sa[year] = val
        for year, val in ru_fallback.items():
            if year not in ru:
                ru[year] = val
        for year, val in ir_fallback.items():
            if year not in ir:
                ir[year] = val
    else:
        fred_data = _fetch_from_fred()
        us = {**us_fallback}
        sa = {**sa_fallback}
        ru = {**ru_fallback}
        ir = {**ir_fallback}
        for year, val in (fred_data.get("saudi_arabia") or {}).items():
            sa[year] = val
        for year, val in (fred_data.get("iran") or {}).items():
            ir[year] = val
        for year, val in (fred_data.get("russia") or {}).items():
            ru[year] = val

    all_years = sorted(set(us) | set(sa) | set(ru) | set(ir))
    result: list[dict[str, Any]] = []
    for y in all_years:
        us_val = round(us[y], 2) if us.get(y) is not None else None
        sa_val = round(sa[y], 2) if sa.get(y) is not None else None
        ru_val = round(ru[y], 2) if ru.get(y) is not None else None
        ir_val = round(ir[y], 2) if ir.get(y) is not None else None
        if us_val is None and sa_val is None and ru_val is None and ir_val is None:
            continue
        total = (
            (us_val or 0) + (sa_val or 0) + (ru_val or 0) + (ir_val or 0)
            if (us_val is not None or sa_val is not None or ru_val is not None or ir_val is not None)
            else None
        )
        result.append({
            "date": f"{y}-01-01",
            "us": us_val,
            "saudi_arabia": sa_val,
            "russia": ru_val,
            "iran": ir_val,
            "total_production": round(total, 2) if total is not None else None,
        })
    return result
