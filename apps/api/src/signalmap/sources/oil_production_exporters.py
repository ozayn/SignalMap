"""Fetch oil production for major exporters (United States, Saudi Arabia, Russia, Iran).

Returns normalized format: [{date, us, saudi_arabia, russia, iran}, ...]
Unit: million barrels per day. Annual data (YYYY-01-01).
"""

from typing import Any

from signalmap.data.oil_production_exporters import IRAN, RUSSIA, SAUDI_ARABIA, UNITED_STATES


def fetch_oil_production_exporters() -> list[dict[str, Any]]:
    """
    Fetch oil production for United States, Saudi Arabia, Russia, Iran.
    Returns [{date, us, saudi_arabia, russia, iran}, ...] sorted by date.
    Values in million barrels per day. Annual resolution.
    """
    all_years = sorted(set(UNITED_STATES) | set(SAUDI_ARABIA) | set(RUSSIA) | set(IRAN))
    result: list[dict[str, Any]] = []
    for y in all_years:
        us = UNITED_STATES.get(y)
        sa = SAUDI_ARABIA.get(y)
        ru = RUSSIA.get(y)
        ir = IRAN.get(y)
        if us is None and sa is None and ru is None and ir is None:
            continue
        result.append({
            "date": f"{y}-01-01",
            "us": round(us, 2) if us is not None else None,
            "saudi_arabia": round(sa, 2) if sa is not None else None,
            "russia": round(ru, 2) if ru is not None else None,
            "iran": round(ir, 2) if ir is not None else None,
        })
    return result
