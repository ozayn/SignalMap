"""
Seed youtube_comment_snapshots with sample rows for testing the word cloud.
Run from repo root with DATABASE_URL set:
  cd apps/api && python3 scripts/seed_comment_snapshots.py
Or: python3 apps/api/scripts/seed_comment_snapshots.py (from repo root, with PYTHONPATH=apps/api/src)
"""
import os
import sys
from datetime import datetime, timezone

# Allow imports from apps/api
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db import cursor

TEST_CHANNEL_ID = "UC-test-wordcloud"
# Window for queries: 2024-06-01 to 2024-06-30
WINDOW_START = "2024-06-01T00:00:00Z"
WINDOW_END = "2024-06-30T23:59:59Z"

SAMPLE_COMMENTS = [
    "This video was really helpful thanks for sharing",
    "I have been waiting for this kind of content for a long time",
    "Great explanation and the examples made it clear",
    "Could you do more videos like this please",
    "The quality of the content is always good here",
    "Thanks for the update and the detailed explanation",
    "This is exactly what I needed for my project",
    "Really helpful content as always",
    "The examples in this video are very clear",
    "More content like this would be amazing",
    "Thanks for making this so easy to understand",
    "Helpful and clear as always",
    "This video helped me understand the topic",
    "Great content thanks for sharing",
    "The explanation was clear and the examples helped",
]


def main():
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL is not set. Set it to your Postgres URL.")
        sys.exit(1)
    base = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    with cursor() as cur:
        for i, text in enumerate(SAMPLE_COMMENTS):
            # captured_at and published_at in window
            cur.execute(
                """
                INSERT INTO youtube_comment_snapshots
                (channel_id, comment_text, captured_at, published_at)
                VALUES (%s, %s, %s, %s)
                """,
                (TEST_CHANNEL_ID, text, base, base),
            )
    print(f"Inserted {len(SAMPLE_COMMENTS)} rows for channel_id={TEST_CHANNEL_ID}")
    print(f"Test with: GET /api/youtube/comments/wordcloud?channel_id={TEST_CHANNEL_ID}&window_start=2024-06-01&window_end=2024-06-30")


if __name__ == "__main__":
    main()
