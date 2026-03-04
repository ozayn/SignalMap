"""Fetch oil production for major exporters (United States, Saudi Arabia, Russia, Iran).

Returns normalized format: [{date, us, saudi_arabia, russia, iran, total_production}, ...]
Unit: million barrels per day. Annual data (YYYY-01-01).

EIA API is primary source; static dataset is fallback when API fails.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from signalmap.data.oil_production_exporters import IRAN, RUSSIA, SAUDI_ARABIA, UNITED_STATES

logger = logging.getLogger(__name__)

EIA_API_KEY = os.getenv("EIA_API_KEY")
EIA_INTERNATIONAL_URL = "https://api.eia.gov/v2/international/data/"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"

# EIA country codes -> our field names
EIA_COUNTRIES = {
    "USA": "us",
    "SAU": "saudi_arabia",
    "RUS": "russia",
    "IRN": "iran",
}


def fetch_eia_oil_production() -> list[dict[str, Any]]:
    """
    Fetch crude oil production for USA, SAU, RUS, IRN from EIA International Data API v2.
    Single request with all four countries. Returns normalized rows.
    EIA returns thousand bbl/day; we convert to million.
    Raises on API error or missing key.
    """
    key = (EIA_API_KEY or "").strip()
    if not key:
        raise ValueError("EIA_API_KEY not configured")
    params: list[tuple[str, str]] = [
        ("api_key", key),
        ("frequency", "annual"),
        ("data[0]", "value"),
        ("facets[product][]", "CRUDEOIL"),
        ("facets[flow][]", "PRODUCTION"),
    ]
    for code in ("USA", "SAU", "RUS", "IRN"):
        params.append(("facets[country][]", code))
    with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(EIA_INTERNATIONAL_URL, params=params)
        r.raise_for_status()
        data = r.json()
    rows = data.get("response", {}).get("data") or []
    # EIA may return one row per (period, country) or per period; pivot by year
    by_year: dict[int, dict[str, float]] = {}
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
        mbpd = round(v / 1000.0, 2)
        country = (
            row.get("country") or row.get("countryId") or row.get("country_id") or ""
        ).strip().upper()
        if country and country in EIA_COUNTRIES:
            by_year.setdefault(year, {})[EIA_COUNTRIES[country]] = mbpd
        else:
            # Single-country response: no country field; assume one country per request
            # Multi-country returns country; if missing, fall back to per-country fetch
            pass
    if not by_year and rows:
        # Response has rows but no country field - fetch per country
        return _fetch_eia_per_country()
    if not by_year:
        return []
    result: list[dict[str, Any]] = []
    for y in sorted(by_year):
        row_data = by_year[y]
        us_val = row_data.get("us")
        sa_val = row_data.get("saudi_arabia")
        ru_val = row_data.get("russia")
        ir_val = row_data.get("iran")
        if us_val is None and sa_val is None and ru_val is None and ir_val is None:
            continue
        total = (
            (us_val or 0) + (sa_val or 0) + (ru_val or 0) + (ir_val or 0)
            if any(v is not None for v in (us_val, sa_val, ru_val, ir_val))
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
    return _extend_to_current_year(result)


def _extend_to_current_year(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """When data ends before current year, add a row for current year (last values repeated)."""
    if not rows:
        return rows
    current_year = datetime.now(timezone.utc).year
    last = rows[-1]
    last_year = int(last["date"][:4])
    if current_year <= last_year:
        return rows
    extended = {**last, "date": f"{current_year}-01-01"}
    return rows + [extended]


def _fetch_eia_per_country() -> list[dict[str, Any]]:
    """Fallback: fetch each country separately and merge."""
    us_data: dict[int, float] = {}
    sa_data: dict[int, float] = {}
    ru_data: dict[int, float] = {}
    ir_data: dict[int, float] = {}
    for code, field in EIA_COUNTRIES.items():
        params = [
            ("api_key", (EIA_API_KEY or "").strip()),
            ("frequency", "annual"),
            ("data[0]", "value"),
            ("facets[product][]", "CRUDEOIL"),
            ("facets[flow][]", "PRODUCTION"),
            ("facets[country][]", code),
        ]
        try:
            with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
                r = client.get(EIA_INTERNATIONAL_URL, params=params)
                r.raise_for_status()
                data = r.json()
            for row in data.get("response", {}).get("data") or []:
                period = (row.get("period") or "").strip()
                val_str = (row.get("value") or "").strip()
                if not period or not val_str or val_str == ".":
                    continue
                try:
                    year = int(period[:4]) if len(period) >= 4 else int(period)
                    v = round(float(val_str) / 1000.0, 2)
                except (ValueError, TypeError):
                    continue
                if field == "us":
                    us_data[year] = v
                elif field == "saudi_arabia":
                    sa_data[year] = v
                elif field == "russia":
                    ru_data[year] = v
                else:
                    ir_data[year] = v
        except Exception:
            pass
    all_years = sorted(set(us_data) | set(sa_data) | set(ru_data) | set(ir_data))
    result: list[dict[str, Any]] = []
    for y in all_years:
        us_val = us_data.get(y)
        sa_val = sa_data.get(y)
        ru_val = ru_data.get(y)
        ir_val = ir_data.get(y)
        if us_val is None and sa_val is None and ru_val is None and ir_val is None:
            continue
        total = (
            (us_val or 0) + (sa_val or 0) + (ru_val or 0) + (ir_val or 0)
            if any(v is not None for v in (us_val, sa_val, ru_val, ir_val))
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
    return _extend_to_current_year(result)


def _load_static_dataset() -> list[dict[str, Any]]:
    """Load static oil production data from signalmap.data.oil_production_exporters."""
    us = UNITED_STATES
    sa = SAUDI_ARABIA
    ru = RUSSIA
    ir = IRAN
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
            if any(v is not None for v in (us_val, sa_val, ru_val, ir_val))
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


def fetch_oil_production_exporters() -> list[dict[str, Any]]:
    """
    Fetch oil production for United States, Saudi Arabia, Russia, Iran.
    EIA API is primary; static dataset is fallback when API fails or key not set.
    Returns [{date, us, saudi_arabia, russia, iran, total_production}, ...] sorted by date.
    Values in million barrels per day. Annual resolution.
    """
    if (EIA_API_KEY or "").strip():
        try:
            data = fetch_eia_oil_production()
            if data:
                return data
            logger.warning("EIA oil production returned no data, using static fallback")
        except Exception as e:
            logger.warning("EIA oil production fetch failed, using static fallback: %s", e)
    return _load_static_dataset()
