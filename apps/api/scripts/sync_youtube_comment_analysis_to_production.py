#!/usr/bin/env python3
"""
Copy youtube_comment_analysis from local DB to production.

Run locally with:
  DATABASE_URL=postgresql://localhost/signalmap  (source - local)
  DATABASE_URL_PROD=postgresql://...             (target - production from Railway)

  PYTHONPATH=src python scripts/sync_youtube_comment_analysis_to_production.py [--clear]

  --clear  Delete all rows in production before syncing. Use when production
           has stale data you want to replace entirely.
"""

import argparse
import json
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
    parser = argparse.ArgumentParser(
        description="Sync youtube_comment_analysis from local to production"
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete all prod rows before sync (removes stale data)",
    )
    parser.add_argument(
        "--channel-id",
        type=str,
        default=None,
        help="Sync only this channel (e.g. UCGttrUON87gWfU6dMWm1fcA for Tucker)",
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
        print("  Railway Dashboard → Postgres → Connect → Public URL")
        print("  Internal (postgres.railway.internal) only works from within Railway.")
        return 1

    print("Reading from local...")
    conn_src = psycopg2.connect(source_url)
    rows = []
    try:
        with conn_src.cursor(cursor_factory=RealDictCursor) as cur:
            if args.channel_id:
                cur.execute(
                    """
                    SELECT channel_id, analysis_json, videos_analyzed, comments_analyzed, computed_at
                    FROM youtube_comment_analysis
                    WHERE channel_id = %s
                    """,
                    (args.channel_id.strip(),),
                )
                rows = cur.fetchall()
            else:
                cur.execute(
                    """
                    SELECT channel_id, analysis_json, videos_analyzed, comments_analyzed, computed_at
                    FROM youtube_comment_analysis
                    """
                )
                rows = cur.fetchall()
    finally:
        conn_src.close()

    print(f"Found {len(rows)} channel(s)")

    if not rows:
        print("No data to sync")
        return 0

    print("Writing to production...")
    conn_dst = psycopg2.connect(prod_url)
    try:
        with conn_dst.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_comment_analysis (
                    channel_id TEXT PRIMARY KEY,
                    analysis_json JSONB NOT NULL,
                    videos_analyzed INT NOT NULL,
                    comments_analyzed INT NOT NULL,
                    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            conn_dst.commit()

            if args.clear:
                cur.execute("DELETE FROM youtube_comment_analysis")
                deleted = cur.rowcount
                conn_dst.commit()
                print(f"Cleared {deleted} old row(s) from production")

            for r in rows:
                analysis_json = r["analysis_json"]
                if hasattr(analysis_json, "copy"):
                    analysis_json = analysis_json.copy()
                if not isinstance(analysis_json, str):
                    analysis_json = json.dumps(analysis_json)
                computed_at = r["computed_at"]
                if hasattr(computed_at, "isoformat"):
                    computed_at = computed_at.isoformat()

                cur.execute(
                    """
                    INSERT INTO youtube_comment_analysis
                    (channel_id, analysis_json, videos_analyzed, comments_analyzed, computed_at)
                    VALUES (%s, %s::jsonb, %s, %s, %s::timestamptz)
                    ON CONFLICT (channel_id)
                    DO UPDATE SET
                        analysis_json = EXCLUDED.analysis_json,
                        videos_analyzed = EXCLUDED.videos_analyzed,
                        comments_analyzed = EXCLUDED.comments_analyzed,
                        computed_at = EXCLUDED.computed_at
                    """,
                    (
                        r["channel_id"],
                        analysis_json,
                        r["videos_analyzed"],
                        r["comments_analyzed"],
                        computed_at,
                    ),
                )
        conn_dst.commit()
        print(f"Synced {len(rows)} channel(s) to production")
    finally:
        conn_dst.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
