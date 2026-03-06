"""Fetch bilateral crude oil trade flows from UN Comtrade (HS 2709).

Uses reporter/partner from Comtrade API. Stores PHYSICAL quantity only (never TradeValue/USD).
Converts NetWeight (kg) to thousand barrels/day:
  metric_tons = net_weight_kg / 1000
  barrels = metric_tons * 7.33
  value_kbd = barrels / 365 / 1000
"""

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_COUNTRY_CODE_CACHE: dict[int, str] | None = None


def _get_country_code_map() -> dict[int, str]:
    """Fetch Comtrade reporter/partner reference and cache code -> name mapping."""
    global _COUNTRY_CODE_CACHE
    if _COUNTRY_CODE_CACHE is not None:
        return _COUNTRY_CODE_CACHE
    url = "https://comtradeapi.un.org/files/v1/app/reference/Reporters.json"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
        results = data.get("results", [])
        _COUNTRY_CODE_CACHE = {}
        for item in results:
            code = item.get("reporterCode")
            name = item.get("reporterDesc") or item.get("text")
            if code is not None and name:
                _COUNTRY_CODE_CACHE[int(code)] = str(name)
        return _COUNTRY_CODE_CACHE
    except Exception as e:
        logger.warning("comtrade: could not fetch country reference: %s", e)
        _COUNTRY_CODE_CACHE = {}
        return {}

# New API (comtradeapi.un.org) - legacy comtrade.un.org/api/get returns HTML
COMTRADE_BASE = os.getenv("COMTRADE_API_BASE", "https://comtradeapi.un.org/data/v1/get/C/A/HS")
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"
HS_CRUDE_OIL = "2709"
TONNES_TO_BARRELS = 7.33

# Major crude oil exporters (Comtrade numeric codes). Cannot use r=all with p=all.
MAJOR_EXPORTERS = [682, 643, 842, 364, 368, 784, 414, 48, 12, 24, 31, 578, 124, 76, 484, 634]
# 682=Saudi, 643=Russia, 842=USA, 364=Iran, 368=Iraq, 784=UAE, 414=Kuwait, 48=Bahrain,
# 12=Algeria, 24=Angola, 31=Azerbaijan, 578=Norway, 124=Canada, 76=Brazil, 484=Mexico, 634=Qatar

# Map Comtrade country names to normalized display names (match network NODE_POSITIONS)
COUNTRY_NORMALIZE: dict[str, str] = {
    "Saudi Arabia": "Saudi Arabia",
    "Russian Federation": "Russia",
    "United States of America": "United States",
    "USA": "United States",
    "China": "China",
    "India": "India",
    "Japan": "Japan",
    "Republic of Korea": "South Korea",
    "Rep. of Korea": "South Korea",
    "Iran (Islamic Republic of)": "Iran",
    "Iraq": "Iraq",
    "United Arab Emirates": "UAE",
    "European Union": "EU",
    "Germany": "Germany",
    "Netherlands": "Netherlands",
    "France": "France",
    "Italy": "Italy",
    "Spain": "Spain",
    "Poland": "Poland",
    "Belgium": "Belgium",
    "Greece": "Greece",
    "United Kingdom": "United Kingdom",
    "Kuwait": "Kuwait",
    "Nigeria": "Nigeria",
    "Angola": "Angola",
    "Norway": "Norway",
    "Canada": "Canada",
    "Brazil": "Brazil",
    "Mexico": "Mexico",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Libya": "Libya",
    "Algeria": "Algeria",
    "Kazakhstan": "Kazakhstan",
    "Azerbaijan": "Azerbaijan",
    "Indonesia": "Indonesia",
    "Malaysia": "Malaysia",
    "Singapore": "Singapore",
    "Thailand": "Thailand",
    "Viet Nam": "Vietnam",
    "Chinese Taipei": "Taiwan",
    "Hong Kong, China": "Hong Kong",
    "Australia": "Australia",
    "South Africa": "South Africa",
    "Egypt": "Egypt",
    "Turkey": "Turkey",
}


def _normalize_country(name: str | None) -> str:
    if not name or not name.strip():
        return ""
    n = name.strip()
    return COUNTRY_NORMALIZE.get(n, n)


def _kg_to_thousand_barrels_per_day(net_kg: float | None) -> float:
    """Convert net weight (kg) to thousand barrels per day. 1 tonne crude ≈ 7.33 bbl."""
    if net_kg is None or net_kg <= 0:
        return 0.0
    metric_tons = net_kg / 1000.0
    barrels = metric_tons * TONNES_TO_BARRELS
    barrels_per_day = barrels / 365.0
    return round(barrels_per_day / 1000.0, 2)


def _extract_net_weight_kg(rec: dict[str, Any]) -> float | None:
    """
    Extract net weight in kg from Comtrade record. NEVER use TradeValue or primaryValue (USD).
    Tries: netWgt, NetWgt, netWgtKg. Skips records that only have value fields.
    """
    for key in ("netWgt", "NetWgt", "netWgtKg", "NetWeight"):
        val = rec.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
    return None


def _fetch_comtrade_year_reporter(
    year: int,
    reporter: int,
    max_records: int = 5000,
) -> list[dict[str, Any]]:
    """Fetch Comtrade exports for one year and one reporter. Uses comtradeapi.un.org v1 API."""
    key = (os.getenv("COMTRADE_API_KEY") or os.getenv("COMTRADE_SUBSCRIPTION_KEY") or "").strip()
    if not key:
        raise ValueError("COMTRADE_API_KEY or COMTRADE_SUBSCRIPTION_KEY required")
    params: dict[str, str | int] = {
        "cmdCode": HS_CRUDE_OIL,
        "flowCode": "X",
        "period": year,
        "maxRecords": max_records,
        "reporterCode": reporter,
    }
    headers = {"User-Agent": USER_AGENT, "Ocp-Apim-Subscription-Key": key}

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        for attempt in range(4):
            r = client.get(COMTRADE_BASE, params=params, headers=headers)
            if r.status_code == 429:
                delay = (2 ** attempt) * 3
                logger.warning("comtrade 429 rate limit, retry in %ss", delay)
                time.sleep(delay)
                continue
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            if "json" not in ct:
                raise ValueError(f"Comtrade returned non-JSON: {ct[:50]}")
            data = r.json()
            break
        else:
            r.raise_for_status()
    if isinstance(data, dict) and "data" in data:
        return data["data"] or []
    if isinstance(data, list):
        return data
    return []


def fetch_comtrade_oil_trade(
    start_year: int = 2010,
    end_year: int | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch bilateral crude oil trade flows from UN Comtrade (HS 2709).
    Returns rows: { exporter, importer, year, value }.
    value = thousand barrels per day.
    Iterates over major exporters (API does not allow r=all with p=all).
    """
    if end_year is None:
        end_year = start_year
    rows: list[dict[str, Any]] = []
    for year in range(start_year, end_year + 1):
        for reporter in MAJOR_EXPORTERS:
            try:
                raw = _fetch_comtrade_year_reporter(year, reporter)
                time.sleep(2.5)
            except Exception as e:
                logger.warning("comtrade year=%s reporter=%s: %s", year, reporter, e)
                continue
            code_map = _get_country_code_map()
            for rec in raw:
                exporter = _normalize_country(
                    rec.get("reporterDesc") or code_map.get(rec.get("reporterCode") or 0)
                )
                importer = _normalize_country(
                    rec.get("partnerDesc") or code_map.get(rec.get("partnerCode") or 0)
                )
                if not exporter or not importer or importer in ("World", ""):
                    continue
                net_kg = _extract_net_weight_kg(rec)
                if net_kg is None:
                    continue
                value = _kg_to_thousand_barrels_per_day(net_kg)
                if value <= 0:
                    continue
                rows.append({
                    "exporter": exporter,
                    "importer": importer,
                    "year": year,
                    "value": value,
                })
    return rows
