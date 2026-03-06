#!/usr/bin/env python3
"""Check oil_trade_edges row count in production. Requires DATABASE_URL_PROD."""
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

def main():
    url = os.getenv("DATABASE_URL_PROD", "").replace("postgres://", "postgresql://", 1)
    if not url or "your-public" in url or "your-" in url.lower():
        print("Set DATABASE_URL_PROD to your actual Railway public DB URL.")
        print("  Railway → Postgres → Connect → Public URL (starts with postgresql://)")
        return 1
    if ".railway.internal" in url:
        print("Use the PUBLIC URL, not .railway.internal")
        return 1
    conn = psycopg2.connect(url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM oil_trade_edges")
            n = cur.fetchone()["n"]
            cur.execute("SELECT year, COUNT(*) AS c FROM oil_trade_edges GROUP BY year ORDER BY year")
            by_year = cur.fetchall()
        print(f"Production oil_trade_edges: {n} rows")
        for r in by_year[:5]:
            print(f"  {r['year']}: {r['c']} rows")
        if len(by_year) > 5:
            print(f"  ... and {len(by_year)-5} more years")
    finally:
        conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
