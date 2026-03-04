"""Fetch bilateral crude oil trade flows from UN Comtrade (HS 2709).

Uses reporter/partner from Comtrade API. Converts net weight (kg) to thousand barrels/day.
1 tonne crude ≈ 7.33 barrels; barrels/day = (netWgt_kg/1000)*7.33/365.
"""

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

COMTRADE_BASE = os.getenv("COMTRADE_API_BASE", "https://comtrade.un.org/api/get")
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
    "China": "China",
    "India": "India",
    "Japan": "Japan",
    "Republic of Korea": "South Korea",
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
    tonnes = net_kg / 1000.0
    barrels_per_year = tonnes * TONNES_TO_BARRELS
    barrels_per_day = barrels_per_year / 365.0
    return round(barrels_per_day / 1000.0, 2)


def _fetch_comtrade_year_reporter(
    year: int,
    reporter: int,
    max_records: int = 5000,
) -> list[dict[str, Any]]:
    """Fetch Comtrade exports for one year and one reporter. p=0 = all partners."""
    key = (os.getenv("COMTRADE_SUBSCRIPTION_KEY") or "").strip()
    params: dict[str, str | int] = {
        "maxRecords": max_records,
        "type": "C",
        "freq": "A",
        "px": "HS",
        "ps": year,
        "r": reporter,
        "p": "0",
        "rg": "2",
        "cc": HS_CRUDE_OIL,
        "fmt": "json",
    }
    if key:
        params["subscription-key"] = key

    with httpx.Client(
        timeout=60.0,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        r = client.get(COMTRADE_BASE, params=params)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if "json" not in ct:
            raise ValueError(f"Comtrade returned non-JSON: {ct[:50]}")
        data = r.json()
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
                time.sleep(1.1)
            except Exception as e:
                logger.warning("comtrade year=%s reporter=%s: %s", year, reporter, e)
                continue
            for rec in raw:
                exporter = _normalize_country(rec.get("reporterDesc"))
                importer = _normalize_country(rec.get("partnerDesc"))
                if not exporter or not importer or importer in ("World", ""):
                    continue
                net_kg = rec.get("netWgt")
                if net_kg is None:
                    net_kg = rec.get("qty")
                if net_kg is None:
                    continue
                try:
                    net_kg = float(net_kg)
                except (TypeError, ValueError):
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
