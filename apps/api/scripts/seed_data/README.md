# Seed data for youtube_comment_analysis cache

Place your comment-analysis JSON here as `comment_analysis_bplus.json`.

## Quick paste (from clipboard or file)

If you have the full JSON (e.g. from an API response) in your clipboard or a file:

```bash
# From clipboard (macOS)
pbpaste | python scripts/seed_data/paste_comment_analysis.py

# From file
cat your_data.json | python scripts/seed_data/paste_comment_analysis.py
```

Run from `apps/api` directory. The script validates the JSON and writes to `comment_analysis_bplus.json`.

## Manual placement

Required structure:
```json
{
  "channel_id": "UChWB95_-n9rUc3H9srsn9bQ",
  "videos_analyzed": 10,
  "total_comments": 432,
  "avg_sentiment": 0.02,
  "top_words": [["word", count], ...],
  "comments": [
    {
      "video_id": "...",
      "author": "@...",
      "comment_text": "...",
      "like_count": 0,
      "published_at": "2026-03-09T19:05:32Z",
      "video_title": "...",
      "sentiment": 0.0
    }
  ]
}
```

Then run from `apps/api`:
```bash
python scripts/seed_youtube_comment_analysis_cache.py
```

Or pipe JSON from stdin:
```bash
cat your_data.json | python scripts/seed_youtube_comment_analysis_cache.py -
```

## Sync to production

After seeding locally, push the cache to production (same pattern as oil trade):

```bash
# Set DATABASE_URL (local) and DATABASE_URL_PROD (Railway Postgres public URL)
DATABASE_URL=postgresql://localhost/signalmap \
DATABASE_URL_PROD=postgresql://... \
PYTHONPATH=src python scripts/sync_youtube_comment_analysis_to_production.py
```

Use `--clear` to replace all production rows before syncing.
