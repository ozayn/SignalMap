"""Fetch USD→Toman from rial-exchange-rates-archive (GitHub).

Daily Bonbast archive from 2012-10-09 to present. Values in toman.
https://github.com/SamadiPour/rial-exchange-rates-archive
"""

from typing import Any

import httpx

ARCHIVE_URL = "https://raw.githubusercontent.com/SamadiPour/rial-exchange-rates-archive/data/gregorian_imp.min.json"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"
TIMEOUT = 15.0


def fetch_archive_usd_toman_series() -> list[dict[str, Any]]:
    """
    Fetch full USD→Toman series from rial-exchange-rates-archive.
    Returns [{date, value}, ...] sorted by date ascending.
    Uses average of sell/buy when both present, else sell.
    Date format: YYYY-MM-DD (archive uses YYYY/MM/DD).
    """
    with httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(ARCHIVE_URL)
        r.raise_for_status()
        raw = r.json()

    points = []
    for key, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        usd = entry.get("usd")
        if not usd or not isinstance(usd, dict):
            continue
        sell = usd.get("sell")
        buy = usd.get("buy")
        if sell is None:
            continue
        try:
            s = float(sell)
            b = float(buy) if buy is not None else s
            val = round((s + b) / 2, 2)
        except (TypeError, ValueError):
            continue
        if val < 1000 or val > 999999:
            continue
        date_str = key.replace("/", "-")
        points.append({"date": date_str, "value": val})

    return sorted(points, key=lambda p: p["date"])
