#!/usr/bin/env python3
"""
Local test script for UN Comtrade API.
Verifies that COMTRADE_API_KEY works and crude oil trade data (HS 2709) can be retrieved.

Run: python scripts/test_comtrade_api.py
Uses urllib (stdlib). Optional: pip install httpx or requests for cleaner API.
"""

import json
import os
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Load .env from apps/api if present
try:
    from pathlib import Path
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)
except ImportError:
    pass

API_KEY = os.getenv("COMTRADE_API_KEY", "").strip()
if not API_KEY:
    print("Error: COMTRADE_API_KEY environment variable is not set.")
    print("Set it in .env or export COMTRADE_API_KEY=your_key")
    sys.exit(1)

BASE_URL = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
PARAMS = {
    "cmdCode": "2709",
    "flowCode": "X",
    "period": "2023",
    "typeCode": "C",
    "freqCode": "A",
    "clCode": "HS",
    "maxRecords": "20",
}
# Azure API Management (Comtrade portal) typically uses Ocp-Apim-Subscription-Key
HEADERS = {
    "Ocp-Apim-Subscription-Key": API_KEY,
    "User-Agent": "SignalMap/1.0 (test; +https://github.com/ozayn/SignalMap)",
}

# 1 barrel ≈ 136 kg (per user spec)
KG_PER_BARREL = 136


def kg_to_barrels_per_day(qty_kg: float | None) -> float:
    """Convert quantity (kg) to barrels per day."""
    if qty_kg is None or qty_kg <= 0:
        return 0.0
    barrels = qty_kg / KG_PER_BARREL
    return barrels / 365


def main() -> int:
    print("=" * 60)
    print("UN Comtrade API Test (HS 2709 Crude Oil)")
    print("=" * 60)
    print(f"Endpoint: {BASE_URL}")
    print(f"Params: {PARAMS}")
    print()

    url = f"{BASE_URL}?{urlencode(PARAMS)}"
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=30) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
    except HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8") if e.fp else str(e)
    except URLError as e:
        print(f"Request failed: {e.reason}")
        return 1

    print(f"HTTP status code: {status}")

    if status != 200:
        print(f"Response body (first 500 chars): {body[:500]}")
        return 1

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        print("Response is not valid JSON")
        print(body[:500])
        return 1

    # Handle both { "data": [...] } and direct array
    records = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(records, list):
        records = []

    print(f"Number of records returned: {len(records)}")
    print()

    if not records:
        print("No records returned. Check API key and parameters.")
        return 1

    # Debug: first few rows with key fields
    print("--- Sample raw records (first 3) ---")
    for i, rec in enumerate(records[:3]):
        print(f"\nRecord {i + 1}:")
        for field in ["period", "reporterDesc", "partnerDesc", "flowDesc", "qty", "qtyUnit"]:
            print(f"  {field}: {rec.get(field, 'N/A')}")
    print()

    # Convert first 5 to edges and compute barrels/day
    print("--- Sample edges (first 5) ---")
    edges = []
    for rec in records[:5]:
        qty = rec.get("qty")
        try:
            qty_kg = float(qty) if qty is not None else 0
        except (TypeError, ValueError):
            qty_kg = 0
        bpd = kg_to_barrels_per_day(qty_kg)
        edge = {
            "source": rec.get("reporterDesc", ""),
            "target": rec.get("partnerDesc", ""),
            "year": rec.get("period", ""),
            "value_barrels_per_day": round(bpd, 2),
        }
        edges.append(edge)
        print(f"  {edge['source']} → {edge['target']} ({edge['year']}): {edge['value_barrels_per_day']:,.0f} bbl/day")

    print()
    print("--- Pretty-printed edges (JSON) ---")
    print(json.dumps(edges, indent=2))

    print()
    print("=" * 60)
    print("✓ Test passed: API key works, data retrieved, conversion applied.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
