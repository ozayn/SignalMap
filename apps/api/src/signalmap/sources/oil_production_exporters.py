"""Fetch oil production for major exporters (United States, Saudi Arabia, Russia, Iran).

Returns normalized format: [{date, us, saudi_arabia, russia, iran, total_production}, ...]
Unit: million barrels per day. Annual data (YYYY-01-01).

Fetches from FRED (IMF REO) when FRED_API_KEY is set; uses hardcoded dicts as fallback.
"""

import os
from typing import Any

from signalmap.data.oil_production_exporters import IRAN, RUSSIA, SAUDI_ARABIA, UNITED_STATES


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
    Tries FRED first (Saudi, Iran, Russia); US and gaps use hardcoded fallback.
    Returns [{date, us, saudi_arabia, russia, iran, total_production}, ...] sorted by date.
    Values in million barrels per day. Annual resolution.
    """
    fred_data = _fetch_from_fred()
    us_fallback = UNITED_STATES
    sa_fallback = SAUDI_ARABIA
    ru_fallback = RUSSIA
    ir_fallback = IRAN

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
