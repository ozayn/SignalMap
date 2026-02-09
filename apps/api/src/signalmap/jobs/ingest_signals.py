#!/usr/bin/env python3
"""
Ingest external signals into the DB. Safe to run repeatedly (idempotent upsert).
Run from apps/api: python -m signalmap.jobs.ingest_signals --signal brent [--date YYYY-MM-DD] [--days N]
"""

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure apps/api and apps/api/src on path (for db and signalmap)
_api_root = Path(__file__).resolve().parent.parent.parent.parent
_src = _api_root / "src"
for p in (_api_root, _src):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from dotenv import load_dotenv

load_dotenv(_api_root / ".env")
load_dotenv(_api_root / ".env.local")


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest signal data into DB")
    parser.add_argument(
        "--signal",
        choices=["brent"],
        required=True,
        help="Signal to ingest",
    )
    parser.add_argument(
        "--date",
        type=str,
        help="End date (YYYY-MM-DD). Default: today",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days to ingest (default: 7)",
    )
    args = parser.parse_args()

    if args.date:
        try:
            end_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print(f"Invalid --date: {args.date}", file=sys.stderr)
            return 1
    else:
        end_date = datetime.now().date()
    start_date = end_date - timedelta(days=args.days)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    if args.signal == "brent":
        from signalmap.sources.fred_brent import fetch_brent_series
        from signalmap.store.signals_repo import upsert_points, _has_db

        if not _has_db():
            print("DATABASE_URL not set. Cannot ingest.", file=sys.stderr)
            return 1
        full = fetch_brent_series()
        points = [p for p in full if start_str <= p["date"] <= end_str]
        count = upsert_points(
            "brent_oil_price",
            points,
            source="FRED:DCOILBRENTEU",
            metadata={"ingested_by": "ingest_signals"},
        )
        print(f"Ingested {count} points for brent_oil_price ({start_str} to {end_str})")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
