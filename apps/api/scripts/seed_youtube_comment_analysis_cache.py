#!/usr/bin/env python3
"""
Seed the youtube_comment_analysis cache with pre-fetched data.
Run from apps/api: python scripts/seed_youtube_comment_analysis_cache.py [path_to_json]

  python scripts/seed_youtube_comment_analysis_cache.py
  python scripts/seed_youtube_comment_analysis_cache.py ./seed_data/comment_analysis_bplus.json
  cat your_data.json | python scripts/seed_youtube_comment_analysis_cache.py -

Requires: DATABASE_URL
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Allow signalmap package imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from db import init_tables, save_youtube_comment_analysis
from signalmap.services.comment_analysis import analyze_comments

CHANNEL_ID = "UChWB95_-n9rUc3H9srsn9bQ"
DEFAULT_SEED_FILE = Path(__file__).resolve().parent / "seed_data" / "comment_analysis_bplus.json"


def main():
    if not os.getenv("DATABASE_URL"):
        print("ERROR: DATABASE_URL not set. Cannot seed cache.")
        sys.exit(1)

    use_stdin = len(sys.argv) > 1 and sys.argv[1] == "-"
    if use_stdin:
        raw = json.load(sys.stdin)
    else:
        seed_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SEED_FILE
        if not seed_path.exists():
            print(f"ERROR: Seed file not found: {seed_path}")
            print(f"  Usage: python {Path(__file__).name} [path_to_json]")
            print(f"  Or: cat data.json | python {Path(__file__).name} -")
            sys.exit(1)
        with open(seed_path, encoding="utf-8") as f:
            raw = json.load(f)

    comments = raw.get("comments", [])
    if not comments:
        print("ERROR: No comments in seed data")
        sys.exit(1)

    # Re-run analysis to get points_pca, points_umap, topics (no API calls)
    analysis = analyze_comments(comments)

    # Build videos list from comments (unique by video_id)
    seen = set()
    videos_list = []
    for c in comments:
        vid = c.get("video_id")
        if vid and vid not in seen:
            seen.add(vid)
            videos_list.append({
                "title": c.get("video_title", ""),
                "published_at": c.get("published_at", ""),
                "video_id": vid,
            })

    # Time range from comment published_at
    dates = []
    for c in comments:
        pt = c.get("published_at")
        if pt and isinstance(pt, str):
            try:
                dt = datetime.fromisoformat(pt.replace("Z", "+00:00"))
                dates.append(dt)
            except Exception:
                pass
    time_range_start = None
    time_range_end = None
    if dates:
        time_range_start = min(dates).strftime("%b %d %Y")
        time_range_end = max(dates).strftime("%b %d %Y")

    result = {
        "channel_id": CHANNEL_ID,
        "channel_name": "BPlus Podcast",
        "channel_owner": "Ali Bandari",
        "channel_title": "BPlus Podcast",
        "videos_analyzed": len(videos_list),
        "videos": videos_list,
        "comments_analyzed": len(comments),
        "total_comments": len(comments),
        "time_range": {"start": time_range_start, "end": time_range_end},
        "time_period_start": time_range_start,
        "time_period_end": time_range_end,
        "language": "Persian",
        "avg_sentiment": analysis["avg_sentiment"],
        "top_words": analysis["top_words"],
        "topics": analysis["topics"],
        "points_pca": analysis["points_pca"],
        "points_umap": analysis["points_umap"],
        "points_tfidf": analysis.get("points_tfidf", analysis.get("points_umap", [])),
        "points_hdbscan": analysis.get("points_hdbscan", analysis.get("points_umap", [])),
        "points_minilm": analysis.get("points_minilm", []),
        "cluster_labels": analysis.get("cluster_labels", []),
        "cluster_labels_pca": analysis.get("cluster_labels_pca", []),
        "cluster_labels_tfidf": analysis.get("cluster_labels_tfidf", analysis.get("cluster_labels", [])),
        "cluster_labels_hdbscan": analysis.get("cluster_labels_hdbscan", []),
        "cluster_labels_minilm": analysis.get("cluster_labels_minilm", []),
        "cluster_assignments_pca": analysis.get("cluster_assignments_pca", []),
        "cluster_assignments_tfidf": analysis.get("cluster_assignments_tfidf", []),
        "cluster_assignments_hdbscan": analysis.get("cluster_assignments_hdbscan", []),
        "cluster_assignments_minilm": analysis.get("cluster_assignments_minilm", []),
        "cluster_stats_pca": analysis.get("cluster_stats_pca", {}),
        "cluster_stats_tfidf": analysis.get("cluster_stats_tfidf", {}),
        "cluster_stats_hdbscan": analysis.get("cluster_stats_hdbscan", {}),
        "cluster_stats_minilm": analysis.get("cluster_stats_minilm", {}),
        "clusters_summary_pca": analysis.get("clusters_summary_pca", []),
        "clusters_summary_tfidf": analysis.get("clusters_summary_tfidf", []),
        "clusters_summary_hdbscan": analysis.get("clusters_summary_hdbscan", []),
        "clusters_summary_minilm": analysis.get("clusters_summary_minilm", []),
        "discourse_comments": analysis.get("discourse_comments", []),
        "comments": analysis["comments"],
    }

    init_tables()
    save_youtube_comment_analysis(
        channel_id=CHANNEL_ID,
        analysis=result,
        videos_analyzed=len(videos_list),
        comments_analyzed=len(comments),
    )

    print(f"Seeded cache for channel {CHANNEL_ID}")
    print(f"  Videos: {len(videos_list)}, Comments: {len(comments)}")
    print(f"  Time range: {time_range_start} – {time_range_end}")
    print(f"  Points PCA: {len(analysis['points_pca'])}, TF-IDF: {len(analysis.get('points_tfidf', []))}, MiniLM: {len(analysis.get('points_minilm', []))}")


if __name__ == "__main__":
    main()
