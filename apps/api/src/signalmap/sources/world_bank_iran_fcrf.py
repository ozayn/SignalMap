"""
World Bank WDI: official exchange rate Iran (PA.NUS.FCRF), LCU per U.S. dollar, period average.

`PA.NUS.FCRF` — *Official exchange rate (LCU per US$, period average)*.
For Iran, the local currency unit in WDI is the **rial**; 1 toman = 10 rials.
Output for SignalMap charts: **toman per 1 USD** = (rial per USD) / 10.

Data through the latest WDI update (some trailing years can be `null` until the Bank republishes).
We do not interpolate missing future years; callers may layer other annual sources for gaps.
"""

from __future__ import annotations

from typing import Any

import httpx

from signalmap.sources.fred_iran_fx import fetch_iran_fx_series

WB_BASE = "https://api.worldbank.org/v2/country/IRN/indicator/PA.NUS.FCRF"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"


def _fetch_fcrf_rows() -> list[dict[str, Any]]:
    with httpx.Client(timeout=60.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(
            f"{WB_BASE}",
            params={"format": "json", "per_page": 2000, "date": "1960:2035"},
        )
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
        raise ValueError("Invalid World Bank API response for PA.NUS.FCRF (IRN)")
    return data[1]


def fetch_iran_wdi_official_fx_toman_points() -> list[dict[str, Any]]:
    """
    Return [{date, value}, ...] sorted, annual at YYYY-01-01, **toman per 1 USD**.

    Picks non-null FCRF rows only. Does not fill gaps: see ``build_iran_official_annual_toman_merged`` for
    FRED (Penn World Table) backfill when WDI is missing a year.
    """
    raw = _fetch_fcrf_rows()
    out: list[dict[str, Any]] = []
    for rec in raw:
        if not isinstance(rec, dict):
            continue
        date_str = rec.get("date")
        val = rec.get("value")
        if not date_str or val is None:
            continue
        try:
            year = int(str(date_str).strip()[:4])
            rial_per_usd = float(val)
        except (TypeError, ValueError):
            continue
        toman = round(rial_per_usd / 10.0, 2)
        out.append({"date": f"{year}-01-01", "value": toman})
    return sorted(out, key=lambda p: p["date"])


def build_iran_official_annual_toman_merged() -> list[dict[str, Any]]:
    """
    **Official** annual toman/USD: World Bank FCRF where published; for calendar years
    in the WDI gap, **FRED** ``XRNCUSIRA618NRUG`` (Penn World Table via St. Louis Fed), same
    toman definition (rials/10), used only for years with no WDI value.

    If the WDI request fails, falls back to FRED-only for the available span.
    """
    wdi_by_year: dict[int, float] = {}
    try:
        wdi = fetch_iran_wdi_official_fx_toman_points()
        wdi_by_year = {int(p["date"][:4]): float(p["value"]) for p in wdi}
    except Exception:
        wdi_by_year = {}
    fred: list[dict[str, Any]] = []
    try:
        fred = fetch_iran_fx_series()
    except Exception:
        pass
    fred_by_year: dict[int, float] = {int(p["date"][:4]): float(p["value"]) for p in fred}

    years = sorted(set(wdi_by_year) | set(fred_by_year))
    merged: list[dict[str, Any]] = []
    for y in years:
        v = wdi_by_year.get(y)
        if v is not None and v > 0:
            merged.append({"date": f"{y}-01-01", "value": round(v, 2)})
            continue
        fv = fred_by_year.get(y)
        if fv is not None and fv > 0:
            merged.append({"date": f"{y}-01-01", "value": round(fv, 2)})
    return sorted(merged, key=lambda p: p["date"])


OFFICIAL_FX_WDI_FCRF_SOURCE: dict[str, str] = {
    "name": "World Bank WDI PA.NUS.FCRF (IRN) — with FRED PWT (XRNCUSIRA618NRUG) fill for missing years",
    "publisher": "World Bank; Federal Reserve Bank of St. Louis (FRED) where WDI is null for that year",
    "type": "official",
    "url": "https://data.worldbank.org/indicator/PA.NUS.FCRF?locations=IR",
    "notes": (
        "LCU/USD from WDI, converted: toman/USD = (rials/USD) ÷ 10 (1 toman = 10 rials). "
        "Annual, period average. FRED is used only to fill a calendar year with no WDI value; WDI always wins"
        " when both exist. Trailing WDI may be null until a new release; no imputed flat extension."
    ),
}
