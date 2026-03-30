#!/usr/bin/env python3
"""
Write comment analysis JSON to comment_analysis_bplus.json.

Use when you have the full JSON (e.g. from API response) and want to save it
for seeding the cache. Reads from stdin, validates, and writes to the seed file.

Usage (macOS - paste from clipboard):
  pbpaste | python paste_comment_analysis.py

Usage (from file):
  cat your_data.json | python paste_comment_analysis.py

Usage (interactive - paste then Ctrl+D):
  python paste_comment_analysis.py
"""
import json
import sys
from pathlib import Path

OUTPUT_FILE = Path(__file__).resolve().parent / "comment_analysis_bplus.json"

REQUIRED_KEYS = {"channel_id", "videos_analyzed", "total_comments", "comments"}
COMMENT_KEYS = {"video_id", "author", "comment_text", "like_count", "published_at", "video_title", "sentiment"}


def main():
    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    missing = REQUIRED_KEYS - set(raw.keys())
    if missing:
        print(f"ERROR: Missing required keys: {missing}", file=sys.stderr)
        sys.exit(1)

    comments = raw["comments"]
    if not isinstance(comments, list):
        print("ERROR: 'comments' must be an array", file=sys.stderr)
        sys.exit(1)

    for i, c in enumerate(comments[:3]):  # sample first 3
        if not isinstance(c, dict):
            print(f"ERROR: comments[{i}] must be an object", file=sys.stderr)
            sys.exit(1)
        missing_c = COMMENT_KEYS - set(c.keys())
        if missing_c:
            print(f"WARN: comments[{i}] missing keys: {missing_c}", file=sys.stderr)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(comments)} comments to {OUTPUT_FILE}")
    print(f"  channel_id: {raw['channel_id']}")
    print(f"  videos_analyzed: {raw['videos_analyzed']}")
    print(f"  total_comments: {raw['total_comments']}")
    print()
    print("Next: run from apps/api:")
    print("  python scripts/seed_youtube_comment_analysis_cache.py")


if __name__ == "__main__":
    main()
