#!/usr/bin/env python3
"""
Seed local DB from all JSON files in data/youtube_cache/.
Use before sync_youtube_comment_analysis_to_production.py so production gets the data.

Run from apps/api:
  PYTHONPATH=src python scripts/seed_all_youtube_cache_to_db.py
"""
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

from db import init_tables, save_youtube_comment_analysis

CACHE_DIR = app_dir / "data" / "youtube_cache"


def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("ERROR: DATABASE_URL not set")
        return 1

    if not CACHE_DIR.exists():
        print(f"ERROR: Cache dir not found: {CACHE_DIR}")
        return 1

    json_files = list(CACHE_DIR.glob("*.json"))
    if not json_files:
        print("No JSON files in cache dir")
        return 0

    init_tables()
    seeded = 0
    for p in sorted(json_files):
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Skip {p.name}: {e}")
            continue

        cid = data.get("channel_id")
        if not cid:
            print(f"  Skip {p.name}: no channel_id")
            continue

        videos = data.get("videos_analyzed", len(data.get("videos", [])))
        comments = data.get("comments_analyzed") or data.get("total_comments") or len(data.get("comments", []))
        save_youtube_comment_analysis(
            channel_id=cid,
            analysis=data,
            videos_analyzed=videos,
            comments_analyzed=comments,
        )
        print(f"  Seeded {cid} ({videos} videos, {comments} comments)")
        seeded += 1

    print(f"\nSeeded {seeded} channel(s) to local DB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
