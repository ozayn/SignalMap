"""
Ingest real YouTube comments for a channel into youtube_comment_snapshots (for word cloud).
Uses YouTube Data API v3: channel uploads playlist -> recent videos -> top comments per video.

Requires: YOUTUBE_API_KEY, DATABASE_URL. Install deps: pip install -r apps/api/requirements.txt (use a venv).

Run from repo root (signalmap/):
  python3 apps/api/scripts/ingest_youtube_comments.py --channel bpluspodcast --after 2024-01-01
Or with apps/api venv:
  apps/api/.venv/bin/python3 apps/api/scripts/ingest_youtube_comments.py --channel bpluspodcast --after 2024-01-01

From apps/api/ (no cd):
  PYTHONPATH=src python3 scripts/ingest_youtube_comments.py --channel bpluspodcast --after 2024-01-01 --max-videos 15
  (or: source .venv/bin/activate then the same)
"""
import os
import sys
from datetime import datetime, timezone

_script_dir = os.path.dirname(os.path.abspath(__file__))
_api_dir = os.path.join(_script_dir, "..")
_src_dir = os.path.join(_api_dir, "src")
for _p in (_src_dir, _api_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Load .env before importing db (db reads DATABASE_URL at import time)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_api_dir, ".env"))
    load_dotenv(os.path.join(_api_dir, ".env.local"))
except ImportError:
    pass

try:
    from db import cursor
except ModuleNotFoundError as e:
    if "psycopg2" in str(e):
        _venv_py = os.path.join(_api_dir, ".venv", "bin", "python3")
        print("Missing psycopg2. Run this script with the API venv:", file=sys.stderr)
        print(f"  {os.path.abspath(_venv_py)} {os.path.abspath(__file__)} --channel CHANNEL --after YYYY-MM-DD", file=sys.stderr)
        print("Or from apps/api: source .venv/bin/activate  then  PYTHONPATH=src python3 scripts/ingest_youtube_comments.py ...", file=sys.stderr)
        sys.exit(1)
    raise


def parse_published_at(s: str):
    """Return datetime or None for API publishedAt string."""
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    if not s:
        return None
    try:
        # ISO 8601 e.g. 2024-06-15T12:00:00Z
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Ingest YouTube comments for a channel into DB")
    parser.add_argument("--channel", required=True, help="Channel handle (e.g. bpluspodcast) or channel ID (UC...)")
    parser.add_argument("--after", type=str, default=None, help="Only videos published on or after this date (YYYY-MM-DD)")
    parser.add_argument("--max-videos", type=int, default=20, help="Max number of recent videos to fetch comments from (default 20)")
    parser.add_argument("--max-comments-per-video", type=int, default=100, help="Max top comments per video (default 100)")
    parser.add_argument("--order", choices=("relevance", "time"), default="relevance", help="Comment order: relevance (top) or time")
    args = parser.parse_args()

    if not os.getenv("YOUTUBE_API_KEY"):
        print("YOUTUBE_API_KEY is not set. Set it in the environment.", file=sys.stderr)
        sys.exit(1)
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL is not set. Set it to your Postgres URL.", file=sys.stderr)
        sys.exit(1)

    channel_arg = (args.channel or "").strip()
    if not channel_arg:
        print("--channel is required.", file=sys.stderr)
        sys.exit(1)

    published_after = None
    if args.after:
        try:
            d = datetime.strptime(args.after.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            published_after = d.isoformat().replace("+00:00", "Z")
        except ValueError:
            print(f"Invalid --after date: {args.after}. Use YYYY-MM-DD.", file=sys.stderr)
            sys.exit(1)

    from signalmap.connectors.youtube_comments import fetch_channel_comments

    use_handle = not channel_arg.startswith("UC") or len(channel_arg) != 24
    if use_handle:
        channel_id, comments = fetch_channel_comments(
            handle=channel_arg,
            published_after=published_after,
            max_videos=args.max_videos,
            max_comments_per_video=args.max_comments_per_video,
            order=args.order,
        )
    else:
        channel_id, comments = fetch_channel_comments(
            channel_id=channel_arg,
            published_after=published_after,
            max_videos=args.max_videos,
            max_comments_per_video=args.max_comments_per_video,
            order=args.order,
        )

    if not comments:
        print(f"No comments fetched for channel {channel_id}. Try a different --after or check the channel.", file=sys.stderr)
        sys.exit(0)

    now = datetime.now(timezone.utc)
    inserted = 0
    with cursor() as cur:
        for c in comments:
            text = (c.get("comment_text") or "").strip()
            if not text:
                continue
            pub_at = parse_published_at(c.get("published_at") or "")
            cur.execute(
                """
                INSERT INTO youtube_comment_snapshots
                (channel_id, video_id, comment_id, comment_text, captured_at, published_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    c.get("channel_id") or channel_id,
                    c.get("video_id") or None,
                    (c.get("comment_id") or "").strip() or None,
                    text,
                    now,
                    pub_at,
                ),
            )
            inserted += 1

    print(f"Inserted {inserted} comments for channel_id={channel_id}")
    if published_after:
        print(f"Videos filter: published on or after {args.after}")
    print("View word cloud: /explore/youtube/wordcloud?channel_id=" + channel_id + "&window_start=YYYY-MM-DD&window_end=YYYY-MM-DD")


if __name__ == "__main__":
    main()
