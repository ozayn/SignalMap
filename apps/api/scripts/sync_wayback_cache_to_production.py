#!/usr/bin/env python3
"""
Copy wayback_snapshot_cache from local DB to production.
Useful for Instagram, YouTube, Twitter Wayback snapshots (golfarahani, etc.).

Run locally with:
  DATABASE_URL=postgresql://localhost/signalmap  (source - local)
  DATABASE_URL_PROD=postgresql://...             (target - production from Railway)

  PYTHONPATH=src python scripts/sync_wayback_cache_to_production.py [--platform instagram] [--clear]

  --platform PLATFORM  Only sync this platform (instagram|youtube|twitter). Default: all.
  --clear              Delete matching rows in production before syncing.
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

COLS = [
    "platform", "username", "canonical_url", "timestamp", "original_url",
    "archived_url", "followers", "following", "posts", "confidence", "evidence", "fetched_at",
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync wayback_snapshot_cache from local to production"
    )
    parser.add_argument(
        "--platform",
        choices=["instagram", "youtube", "twitter"],
        help="Only sync this platform (default: all)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete matching rows in production before sync",
    )
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
        return 1

    print("Reading from local...")
    conn_src = psycopg2.connect(source_url)
    rows = []
    try:
        with conn_src.cursor(cursor_factory=RealDictCursor) as cur:
            if args.platform:
                cur.execute(
                    """
                    SELECT platform, username, canonical_url, timestamp, original_url,
                           archived_url, followers, following, posts, confidence, evidence, fetched_at
                    FROM wayback_snapshot_cache
                    WHERE platform = %s
                    """,
                    (args.platform,),
                )
            else:
                cur.execute(
                    """
                    SELECT platform, username, canonical_url, timestamp, original_url,
                           archived_url, followers, following, posts, confidence, evidence, fetched_at
                    FROM wayback_snapshot_cache
                    """
                )
            rows = cur.fetchall()
    finally:
        conn_src.close()

    # Summary by platform/canonical_url
    by_handle: dict[str, int] = {}
    for r in rows:
        k = f"{r['platform']}:{r['canonical_url']}"
        by_handle[k] = by_handle.get(k, 0) + 1
    print(f"Found {len(rows)} snapshot(s)")
    for k, cnt in sorted(by_handle.items(), key=lambda x: -x[1]):
        print(f"  {k}: {cnt}")

    if not rows:
        print("No data to sync")
        return 0

    print("Writing to production...")
    conn_dst = psycopg2.connect(prod_url)
    try:
        with conn_dst.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS wayback_snapshot_cache (
                    platform TEXT NOT NULL,
                    username TEXT,
                    canonical_url TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    original_url TEXT,
                    archived_url TEXT,
                    followers BIGINT,
                    following BIGINT,
                    posts BIGINT,
                    confidence DOUBLE PRECISION,
                    evidence TEXT,
                    fetched_at TIMESTAMPTZ DEFAULT NOW(),
                    PRIMARY KEY (platform, canonical_url, timestamp)
                )
            """)
            conn_dst.commit()

            if args.clear:
                if args.platform:
                    cur.execute("DELETE FROM wayback_snapshot_cache WHERE platform = %s", (args.platform,))
                else:
                    cur.execute("DELETE FROM wayback_snapshot_cache")
                deleted = cur.rowcount
                conn_dst.commit()
                print(f"Cleared {deleted} row(s) from production")

            placeholders = ", ".join(["%s"] * len(COLS))
            cols_str = ", ".join(COLS)
            update_set = ", ".join(
                f"{c} = EXCLUDED.{c}" for c in COLS if c not in ("platform", "canonical_url", "timestamp")
            )
            for r in rows:
                fetched_at = r.get("fetched_at")
                if hasattr(fetched_at, "isoformat"):
                    fetched_at = fetched_at.isoformat()
                vals = tuple(r.get(c) for c in COLS)
                cur.execute(
                    f"""
                    INSERT INTO wayback_snapshot_cache ({cols_str})
                    VALUES ({placeholders})
                    ON CONFLICT (platform, canonical_url, timestamp)
                    DO UPDATE SET {update_set}
                    """,
                    vals,
                )
        conn_dst.commit()
        print(f"Synced {len(rows)} snapshot(s) to production")
    finally:
        conn_dst.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
