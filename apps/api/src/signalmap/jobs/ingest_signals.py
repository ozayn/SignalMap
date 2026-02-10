#!/usr/bin/env python3
"""
Ingest external signals into the DB. Safe to run repeatedly (idempotent upsert).

Run from repo root:
  python3 apps/api/src/signalmap/jobs/ingest_signals.py --signal usd_toman --days 3650

Or from apps/api with PYTHONPATH set:
  cd apps/api && PYTHONPATH=src python3 -m signalmap.jobs.ingest_signals --signal usd_toman --days 3650
"""

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure apps/api/src on path so "signalmap" and "db" are findable (works when run by path or -m from apps/api)
_api_root = Path(__file__).resolve().parent.parent.parent.parent
_src = _api_root / "src"
for p in (_src, _api_root):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)

try:
    from dotenv import load_dotenv
    load_dotenv(_api_root / ".env")
    load_dotenv(_api_root / ".env.local")
except ImportError:
    pass  # optional: .env not loaded if python-dotenv not installed


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest signal data into DB")
    parser.add_argument(
        "--signal",
        choices=["brent", "usd_toman"],
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
        help="Number of days to ingest (default: 7). For usd_toman, use large value (e.g. 3650) for full history.",
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

    from signalmap.store.signals_repo import _has_db, upsert_points

    if not _has_db():
        print("DATABASE_URL not set. Cannot ingest.", file=sys.stderr)
        return 1

    if args.signal == "brent":
        from signalmap.sources.fred_brent import fetch_brent_series

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

    if args.signal == "usd_toman":
        from signalmap.services.signals import fetch_usd_toman_merged

        merged = fetch_usd_toman_merged()
        points = [p for p in merged if start_str <= p["date"] <= end_str]
        count = upsert_points(
            "usd_toman_open_market",
            points,
            source="bonbast_archive_fred",
            metadata={"ingested_by": "ingest_signals"},
        )
        print(f"Ingested {count} points for usd_toman_open_market ({start_str} to {end_str})")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
