#!/usr/bin/env python3
"""
Copy oil_trade_edges from local DB to production.

Run locally with:
  DATABASE_URL=postgresql://localhost/signalmap  (source - local)
  DATABASE_URL_PROD=postgresql://...             (target - production from Railway)

  PYTHONPATH=src python scripts/sync_oil_trade_to_production.py [--clear]

  --clear  Delete all rows in production before syncing. Use this when production
           has stale TradeValue (USD) rows that local doesn't have; otherwise
           those old rows remain.
"""

import argparse
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync oil_trade_edges from local to production")
    parser.add_argument("--clear", action="store_true", help="Delete all prod rows before sync (removes stale old data)")
    args = parser.parse_args()

    source_url = os.getenv("DATABASE_URL", "").replace("postgres://", "postgresql://", 1)
    prod_url = os.getenv("DATABASE_URL_PROD", "").replace("postgres://", "postgresql://", 1)

    if not source_url:
        print("Error: DATABASE_URL required (local/source)")
        return 1
    if not prod_url:
        print("Error: DATABASE_URL_PROD required (production)")
        return 1

    if prod_url == source_url:
        print("Error: DATABASE_URL_PROD must differ from DATABASE_URL")
        return 1

    if ".railway.internal" in prod_url:
        print("Error: Use the PUBLIC database URL, not the internal one.")
        print("  Railway Dashboard → Postgres → Connect → Public URL")
        print("  Internal (postgres.railway.internal) only works from within Railway.")
        return 1

    print("Reading from local...")
    conn_src = psycopg2.connect(source_url)
    rows = []
    try:
        with conn_src.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT year, exporter, importer, value, source FROM oil_trade_edges"
            )
            rows = cur.fetchall()
    finally:
        conn_src.close()

    print(f"Found {len(rows)} rows")

    if not rows:
        print("No data to sync")
        return 0

    print("Writing to production...")
    conn_dst = psycopg2.connect(prod_url)
    try:
        with conn_dst.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS oil_trade_edges (
                    year INTEGER NOT NULL,
                    exporter TEXT NOT NULL,
                    importer TEXT NOT NULL,
                    value FLOAT NOT NULL,
                    source TEXT NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    PRIMARY KEY (year, exporter, importer)
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_oil_trade_edges_year ON oil_trade_edges (year)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_oil_trade_edges_exporter ON oil_trade_edges (exporter)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_oil_trade_edges_importer ON oil_trade_edges (importer)")
            conn_dst.commit()

            if args.clear:
                cur.execute("DELETE FROM oil_trade_edges")
                deleted = cur.rowcount
                conn_dst.commit()
                print(f"Cleared {deleted} old rows from production")

            for r in rows:
                cur.execute(
                    """
                    INSERT INTO oil_trade_edges (year, exporter, importer, value, source, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (year, exporter, importer)
                    DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()
                    """,
                    (r["year"], r["exporter"], r["importer"], r["value"], r["source"]),
                )
        conn_dst.commit()
        print(f"Synced {len(rows)} rows to production")
    finally:
        conn_dst.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
