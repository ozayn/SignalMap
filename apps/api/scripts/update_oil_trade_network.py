#!/usr/bin/env python3
"""
Manual ingestion script for oil trade network data.
Fetches bilateral crude oil flows (HS 2709) from UN Comtrade and populates oil_trade_edges.
Uses NetWeight (kg) only - never TradeValue. Converts to thousand barrels/day.

Run: python scripts/update_oil_trade_network.py [--force]
  --force  Clear existing data and re-fetch all years (use after fixing value metric)
Requires: COMTRADE_API_KEY or COMTRADE_SUBSCRIPTION_KEY in .env, DATABASE_URL for storage.
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Ensure apps/api is cwd and on path (for db and signalmap imports)
app_dir = Path(__file__).resolve().parent.parent
os.chdir(app_dir)
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(app_dir / "src"))

try:
    from dotenv import load_dotenv
    load_dotenv(app_dir / ".env")
except ImportError:
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest oil trade data from UN Comtrade")
    parser.add_argument("--force", action="store_true", help="Clear DB and re-fetch all years")
    parser.add_argument("--start", type=int, default=2010, help="Start year")
    parser.add_argument("--end", type=int, default=2023, help="End year")
    args = parser.parse_args()

    if not os.getenv("COMTRADE_API_KEY") and not os.getenv("COMTRADE_SUBSCRIPTION_KEY"):
        print("Error: COMTRADE_API_KEY or COMTRADE_SUBSCRIPTION_KEY required.")
        sys.exit(1)
    if not os.getenv("DATABASE_URL"):
        print("Warning: DATABASE_URL not set. Data will be fetched but not stored.")

    from signalmap.services.oil_trade_network import ingest_missing_years_from_comtrade

    result = ingest_missing_years_from_comtrade(
        start_year=args.start,
        end_year=args.end,
        force_reingest=args.force,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
