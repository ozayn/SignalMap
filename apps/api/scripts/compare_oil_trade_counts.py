#!/usr/bin/env python3
"""Compare oil_trade_edges row counts: local vs production.

Usage:
  cd apps/api && PYTHONPATH=src python scripts/compare_oil_trade_counts.py
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

import psycopg2
from psycopg2.extras import RealDictCursor


def get_counts(url: str) -> tuple[int, list[dict]]:
    url = url.replace("postgres://", "postgresql://", 1)
    conn = psycopg2.connect(url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM oil_trade_edges")
            total = cur.fetchone()["n"]
            cur.execute(
                "SELECT year, COUNT(*) AS c FROM oil_trade_edges GROUP BY year ORDER BY year"
            )
            by_year = cur.fetchall()
        return total, by_year
    finally:
        conn.close()


def main() -> int:
    local_url = os.getenv("DATABASE_URL", "")
    prod_url = os.getenv("DATABASE_URL_PROD", "")

    if not local_url or "localhost" not in local_url:
        print("DATABASE_URL (local) not set or not localhost.")
        return 1
    if not prod_url or "your-" in prod_url.lower() or ".railway.internal" in prod_url:
        print("DATABASE_URL_PROD not set or invalid (use public URL).")
        return 1

    print("Fetching counts...")
    local_total, local_by_year = get_counts(local_url)
    prod_total, prod_by_year = get_counts(prod_url)

    local_years = {r["year"]: r["c"] for r in local_by_year}
    prod_years = {r["year"]: r["c"] for r in prod_by_year}
    all_years = sorted(set(local_years) | set(prod_years))

    print()
    print("=" * 60)
    print("OIL_TRADE_EDGES COMPARISON")
    print("=" * 60)
    print(f"{'':20} {'Local':>12} {'Production':>12} {'Diff':>10}")
    print("-" * 60)
    print(f"{'Total rows':20} {local_total:>12,} {prod_total:>12,} {prod_total - local_total:>+10,}")
    print()

    if all_years:
        print("By year:")
        for y in all_years:
            lc = local_years.get(y, 0)
            pc = prod_years.get(y, 0)
            diff = pc - lc
            print(f"  {y}: local={lc:>6,}  prod={pc:>6,}  diff={diff:>+6,}")
        print()

    if local_total == prod_total and local_by_year == prod_by_year:
        print("Match: local and production have identical counts.")
    elif prod_total < local_total:
        print("Production has fewer rows. Run: PYTHONPATH=src python scripts/sync_oil_trade_to_production.py")
    else:
        print("Production has more rows than local (unusual).")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
