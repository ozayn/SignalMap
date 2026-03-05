#!/usr/bin/env python3
"""
Verify oil trade ingestion: check that values look like physical barrels, not USD.

Run after update_oil_trade_network.py to confirm:
  - Top exporters are Saudi Arabia, Russia, USA, Iraq, Canada (not Ecuador, Guyana)
  - Values are in reasonable range for thousand barrels/day (hundreds to thousands, not billions)

Usage:
  cd apps/api && .venv/bin/python scripts/verify_oil_trade_ingest.py
"""

import os
import sys
from pathlib import Path

app_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(app_dir / "src"))
try:
    from dotenv import load_dotenv
    load_dotenv(app_dir / ".env")
except ImportError:
    pass


def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("Error: DATABASE_URL not set.")
        return 1

    from db import cursor

    print("=" * 60)
    print("Oil trade ingestion verification")
    print("=" * 60)

    with cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM oil_trade_edges")
        total = cur.fetchone()["n"]
        print(f"\nTotal rows: {total}")

        cur.execute("SELECT DISTINCT year FROM oil_trade_edges ORDER BY year")
        years = [r["year"] for r in cur.fetchall()]
        print(f"Years: {years[0]}–{years[-1]}" if years else "Years: (none)")

        # Top exporters for latest year
        cur.execute(
            """
            SELECT exporter, SUM(value) AS total
            FROM oil_trade_edges
            WHERE year = (SELECT MAX(year) FROM oil_trade_edges)
            GROUP BY exporter
            ORDER BY total DESC
            LIMIT 10
            """
        )
        rows = cur.fetchall()

    if not rows:
        print("\nNo data. Run: python scripts/update_oil_trade_network.py --force")
        return 1

    print("\nTop 10 exporters (latest year):")
    for r in rows:
        print(f"  {r['exporter']}: {r['total']:,.1f} thousand bbl/day")

    # Sanity: if Ecuador or Guyana in top 3 with values > 1e6, likely still TradeValue (USD)
    top3 = [r["exporter"] for r in rows[:3]]
    top_val = rows[0]["total"] if rows else 0

    print("\n" + "=" * 60)
    if top_val > 1_000_000:
        print("WARNING: Values look like USD (billions). Re-ingest with NetWeight.")
        print("  Run: python scripts/update_oil_trade_network.py --force")
        return 1
    elif "Ecuador" in top3 or "Guyana" in top3:
        print("WARNING: Ecuador/Guyana in top 3 suggests TradeValue data.")
        print("  Expected top: Saudi Arabia, Russia, United States, Iraq, Canada")
        return 1
    else:
        print("OK: Values in thousand bbl/day range. Top exporters look correct.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
