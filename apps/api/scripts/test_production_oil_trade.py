#!/usr/bin/env python3
"""
Test whether production oil trade API returns new data (NetWeight/barrels) or old (TradeValue/USD).

Usage (from repo root):
  python3 apps/api/scripts/test_production_oil_trade.py
  API_URL=https://your-api.up.railway.app python3 apps/api/scripts/test_production_oil_trade.py

From apps/api:
  python3 scripts/test_production_oil_trade.py

Checks:
  - Top exporters for latest year
  - Max flow value (thousands = barrels, millions/billions = USD)
  - Ecuador/Guyana in top 5 = old data
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

app_dir = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(app_dir / ".env")
except ImportError:
    pass

API_BASE = os.getenv("API_URL", "http://localhost:8000").rstrip("/")


def main() -> int:
    url = f"{API_BASE}/api/networks/oil-trade?{urlencode({'start_year': 2023, 'end_year': 2023, 'source': 'db'})}"
    print(f"Fetching: {url}")
    print()

    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
    except HTTPError as e:
        print(f"HTTP {e.code}: {e.reason}")
        if e.fp:
            try:
                body = e.fp.read().decode()
                print(body[:500])
            except Exception:
                pass
        return 1
    except URLError as e:
        print(f"Request failed: {e.reason}")
        return 1

    years = data.get("years", {})
    edges = years.get("2023", [])

    if not edges:
        print("No edges for 2023. Production DB may be empty.")
        print("Run: PYTHONPATH=src python scripts/sync_oil_trade_to_production.py")
        return 1

    # Aggregate by exporter
    total_by_exporter: dict[str, float] = {}
    for e in edges:
        src = e.get("source", "")
        val = float(e.get("value", 0))
        total_by_exporter[src] = total_by_exporter.get(src, 0) + val

    top_exporters = sorted(total_by_exporter.items(), key=lambda x: -x[1])[:10]
    max_edge = max(edges, key=lambda e: float(e.get("value", 0)))
    max_val = float(max_edge.get("value", 0))

    print("Top 10 exporters (2023):")
    for name, total in top_exporters:
        print(f"  {name}: {total:,.1f}")
    print()
    print(f"Max flow: {max_val:,.1f} ({max_edge.get('source')} → {max_edge.get('target')})")
    print()

    # Sanity checks
    looks_like_usd = max_val > 1_000_000
    top5_names = [n for n, _ in top_exporters[:5]]
    has_ecuador_guyana = "Ecuador" in top5_names or "Guyana" in top5_names
    expected_tops = {"Saudi Arabia", "Russia", "United States", "USA", "Iraq", "Canada"}

    print("=" * 60)
    if looks_like_usd:
        print("FAIL: Values in millions/billions → likely TradeValue (USD).")
        print("      Run sync_oil_trade_to_production.py to push corrected data.")
        return 1
    if has_ecuador_guyana:
        print("FAIL: Ecuador or Guyana in top 5 → likely old TradeValue data.")
        print("      Run sync_oil_trade_to_production.py to push corrected data.")
        return 1
    if not any(t in top5_names for t in expected_tops):
        print("WARN: Expected Saudi/Russia/USA/Iraq/Canada in top 5.")
        print("      Data may be partial (rate limits).")
    else:
        print("PASS: Values in thousands (thousand bbl/day). Top exporters look correct.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
