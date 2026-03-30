"""
Postgres connection and schema for Wayback caching and jobs.
Tables created idempotently on startup when DATABASE_URL is set.
"""

import json
import os
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Generator, Optional
from zoneinfo import ZoneInfo

import psycopg2
from psycopg2.extras import RealDictCursor

_raw = os.getenv("DATABASE_URL")
# psycopg2 expects postgresql://; Railway may provide postgres://
DATABASE_URL = _raw.replace("postgres://", "postgresql://", 1) if _raw and _raw.startswith("postgres://") else _raw


def get_conn():
    """Get a new connection. Raises if DATABASE_URL not set."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set")
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def cursor() -> Generator:
    """Context manager for a connection with dict cursor."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_tables() -> None:
    """Create tables if they don't exist. Idempotent."""
    if not DATABASE_URL:
        return

    try:
        with cursor() as cur:
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
            cur.execute("""
            CREATE TABLE IF NOT EXISTS wayback_jobs (
                job_id UUID PRIMARY KEY,
                platform TEXT NOT NULL,
                username TEXT NOT NULL,
                canonical_url TEXT NOT NULL,
                from_year INT,
                to_year INT,
                from_date TEXT,
                to_date TEXT,
                sample INT NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                total INT DEFAULT 0,
                processed INT DEFAULT 0,
                error TEXT,
                snapshots_found INT,
                snapshots_sampled INT,
                snapshots_with_metrics INT,
                snapshots_cached INT,
                snapshots_fetched INT,
                summary TEXT
            )
        """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS wayback_job_snapshots (
                job_id UUID NOT NULL REFERENCES wayback_jobs(job_id),
                timestamp TEXT NOT NULL,
                archived_url TEXT,
                followers BIGINT,
                following BIGINT,
                posts BIGINT,
                confidence DOUBLE PRECISION,
                evidence TEXT,
                source TEXT NOT NULL,
                PRIMARY KEY (job_id, timestamp)
            )
        """)
            # Migration: add columns if table exists without them
            for col in ("from_date", "to_date"):
                try:
                    cur.execute(
                        "ALTER TABLE wayback_jobs ADD COLUMN IF NOT EXISTS " + col + " TEXT"
                    )
                except Exception:
                    pass
            for col in ("snapshots_found", "snapshots_sampled", "snapshots_with_metrics", "snapshots_cached", "snapshots_fetched"):
                try:
                    cur.execute(
                        "ALTER TABLE wayback_jobs ADD COLUMN IF NOT EXISTS " + col + " INT"
                    )
                except Exception:
                    pass
            try:
                cur.execute("ALTER TABLE wayback_jobs ADD COLUMN IF NOT EXISTS summary TEXT")
            except Exception:
                pass
            for col in ("subscribers",):
                try:
                    cur.execute(
                        "ALTER TABLE wayback_snapshot_cache ADD COLUMN IF NOT EXISTS " + col + " BIGINT"
                    )
                except Exception:
                    pass
            try:
                cur.execute("ALTER TABLE wayback_job_snapshots ADD COLUMN IF NOT EXISTS subscribers BIGINT")
            except Exception:
                pass
            cur.execute("""
                CREATE TABLE IF NOT EXISTS signal_points (
                    signal_key TEXT NOT NULL,
                    date TEXT NOT NULL,
                    value DOUBLE PRECISION NOT NULL,
                    source TEXT NOT NULL,
                    confidence DOUBLE PRECISION,
                    metadata JSONB,
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    PRIMARY KEY (signal_key, date)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_channel_snapshots (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    channel_handle TEXT,
                    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    subscriber_count BIGINT,
                    view_count BIGINT,
                    video_count BIGINT,
                    raw JSONB
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_youtube_channel_snapshots_channel_captured
                ON youtube_channel_snapshots (channel_id, captured_at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_comment_snapshots (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    video_id TEXT,
                    comment_id TEXT,
                    comment_text TEXT NOT NULL,
                    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    published_at TIMESTAMPTZ,
                    raw JSONB
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_youtube_comment_snapshots_channel_captured
                ON youtube_comment_snapshots (channel_id, captured_at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_youtube_comment_snapshots_channel_published
                ON youtube_comment_snapshots (channel_id, published_at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS data_updates (
                    key TEXT PRIMARY KEY,
                    last_updated TIMESTAMPTZ NOT NULL
                )
            """)
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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_comment_analysis (
                    channel_id TEXT PRIMARY KEY,
                    analysis_json JSONB NOT NULL,
                    videos_analyzed INT NOT NULL,
                    comments_analyzed INT NOT NULL,
                    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_quota_usage (
                    usage_date DATE PRIMARY KEY,
                    units_used INT NOT NULL DEFAULT 0,
                    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS youtube_transcript_cache (
                    id SERIAL PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    title TEXT,
                    language TEXT NOT NULL DEFAULT '',
                    transcript_text TEXT NOT NULL,
                    transcript_json JSONB NOT NULL,
                    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (video_id, language)
                )
            """)
            # Migrate older DBs: cache was keyed only by video_id; now (video_id, language).
            try:
                cur.execute(
                    "UPDATE youtube_transcript_cache SET language = '' WHERE language IS NULL"
                )
            except Exception:
                pass
            try:
                cur.execute(
                    "ALTER TABLE youtube_transcript_cache ALTER COLUMN language SET DEFAULT ''"
                )
            except Exception:
                pass
            try:
                cur.execute(
                    "ALTER TABLE youtube_transcript_cache ALTER COLUMN language SET NOT NULL"
                )
            except Exception:
                pass
            try:
                cur.execute(
                    "ALTER TABLE youtube_transcript_cache "
                    "DROP CONSTRAINT IF EXISTS youtube_transcript_cache_video_id_key"
                )
            except Exception:
                pass
            try:
                cur.execute(
                    "ALTER TABLE youtube_transcript_cache "
                    "ADD CONSTRAINT youtube_transcript_cache_video_id_language_key "
                    "UNIQUE (video_id, language)"
                )
            except Exception:
                pass
    except Exception:
        pass  # DB may not be available; job endpoints will return 503


def upsert_data_update(key: str) -> None:
    """Record current UTC time for a data update key. Idempotent."""
    if not DATABASE_URL:
        return
    try:
        with cursor() as cur:
            cur.execute(
                """
                INSERT INTO data_updates (key, last_updated)
                VALUES (%s, NOW())
                ON CONFLICT (key)
                DO UPDATE SET last_updated = EXCLUDED.last_updated
                """,
                (key,),
            )
    except Exception:
        pass


def get_data_update(key: str) -> str | None:
    """Return last_updated as ISO string for key, or None."""
    if not DATABASE_URL:
        return None
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT last_updated FROM data_updates WHERE key = %s",
                (key,),
            )
            row = cur.fetchone()
            if row and row.get("last_updated"):
                ts = row["last_updated"]
                return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            return None
    except Exception:
        return None


def get_cached_youtube_comment_analysis(channel_id: str) -> dict | None:
    """
    Return stored analysis for channel. No expiry—treat as a database of comments.
    Refresh via explicit refresh action or scheduled job (e.g. weekly).
    """
    if not DATABASE_URL:
        return None
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT analysis_json, videos_analyzed, comments_analyzed, computed_at
                FROM youtube_comment_analysis
                WHERE channel_id = %s
                """,
                (channel_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            computed_at = row["computed_at"]
            if computed_at and computed_at.tzinfo is None:
                computed_at = computed_at.replace(tzinfo=timezone.utc)
            return {
                "analysis_json": row["analysis_json"],
                "videos_analyzed": row["videos_analyzed"],
                "comments_analyzed": row["comments_analyzed"],
                "computed_at": computed_at.isoformat() if computed_at and hasattr(computed_at, "isoformat") else str(computed_at) if computed_at else None,
            }
    except Exception:
        return None


def delete_youtube_comment_analysis(channel_id: str) -> None:
    """Delete cached analysis for channel."""
    if not DATABASE_URL:
        return
    try:
        with cursor() as cur:
            cur.execute(
                "DELETE FROM youtube_comment_analysis WHERE channel_id = %s",
                (channel_id,),
            )
    except Exception:
        pass


def save_youtube_comment_analysis(
    channel_id: str,
    analysis: dict[str, Any],
    videos_analyzed: int,
    comments_analyzed: int,
) -> None:
    """Upsert cached analysis for channel."""
    if not DATABASE_URL:
        return
    try:
        with cursor() as cur:
            cur.execute(
                """
                INSERT INTO youtube_comment_analysis (channel_id, analysis_json, videos_analyzed, comments_analyzed, computed_at)
                VALUES (%s, %s::jsonb, %s, %s, NOW())
                ON CONFLICT (channel_id)
                DO UPDATE SET
                    analysis_json = EXCLUDED.analysis_json,
                    videos_analyzed = EXCLUDED.videos_analyzed,
                    comments_analyzed = EXCLUDED.comments_analyzed,
                    computed_at = EXCLUDED.computed_at
                """,
                (channel_id, json.dumps(analysis), videos_analyzed, comments_analyzed),
            )
    except Exception:
        pass


# YouTube quota resets at midnight Pacific Time
YOUTUBE_QUOTA_DAILY_LIMIT = 10_000
_PT = ZoneInfo("America/Los_Angeles")


def _today_pt() -> date:
    """Current date in Pacific Time (YouTube quota reset timezone)."""
    return datetime.now(_PT).date()


def record_youtube_quota_usage(units: int) -> None:
    """Record YouTube API quota usage for today (Pacific Time)."""
    if not DATABASE_URL or units <= 0:
        return
    try:
        today = _today_pt()
        with cursor() as cur:
            cur.execute(
                """
                INSERT INTO youtube_quota_usage (usage_date, units_used, last_updated)
                VALUES (%s, %s, NOW())
                ON CONFLICT (usage_date)
                DO UPDATE SET
                    units_used = youtube_quota_usage.units_used + EXCLUDED.units_used,
                    last_updated = NOW()
                """,
                (today, units),
            )
    except Exception:
        pass


def _cache_language_key(lang: Optional[str]) -> str:
    """Normalize transcript language for cache key (column is NOT NULL)."""
    if lang is None:
        return ""
    s = str(lang).strip().lower()
    return s if s else ""


def _row_to_transcript_cache_dict(row: dict) -> dict:
    tj = row["transcript_json"]
    if isinstance(tj, str):
        tj = json.loads(tj)
    segments = tj if isinstance(tj, list) else []
    return {
        "title": row["title"],
        "language": row["language"],
        "transcript_text": row["transcript_text"],
        "segments": segments,
    }


def get_any_youtube_transcript_cache(video_id: str) -> Optional[dict]:
    """
    Return one cached transcript for ``video_id`` (any caption language), preferring the
    most recently updated row. Used when language fallback is allowed and no row matches
    the preferred language list.

    Rows are keyed by (video_id, language); see ``get_youtube_transcript_cache``.
    """
    if not DATABASE_URL:
        return None
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT title, language, transcript_text, transcript_json
                FROM youtube_transcript_cache
                WHERE video_id = %s
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (video_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return _row_to_transcript_cache_dict(row)
    except Exception:
        return None


def get_youtube_transcript_cache(
    video_id: str,
    language: Optional[str] = None,
    requested_languages: Optional[tuple[str, ...]] = None,
    *,
    fallback_allowed: bool = True,
) -> tuple[Optional[dict], bool]:
    """
    Look up a cached transcript row.

    Cache is keyed by ``(video_id, transcript language)`` so one video can store multiple
    caption languages (e.g. English and Persian) without overwriting.

    Returns ``(cached_row, fallback_used)``. ``fallback_used`` is True when the row came
    from language fallback (any cached language for the video) rather than a preferred
    requested language. On cache miss, returns ``(None, False)``.

    * If ``language`` is set, only an exact (video_id, language) row is returned.
    * If ``requested_languages`` is set (and ``language`` is not), rows are tried in that
      order; if none match and ``fallback_allowed``, see ``get_any_youtube_transcript_cache``.
    * If both are None and ``fallback_allowed``, returns any row for the video.
    """
    if not DATABASE_URL:
        return None, False

    try:
        with cursor() as cur:
            if language is not None:
                lk = _cache_language_key(language)
                cur.execute(
                    """
                    SELECT title, language, transcript_text, transcript_json
                    FROM youtube_transcript_cache
                    WHERE video_id = %s AND language = %s
                    """,
                    (video_id, lk),
                )
                row = cur.fetchone()
                if row:
                    return _row_to_transcript_cache_dict(row), False
                return None, False

            if requested_languages:
                for pref in requested_languages:
                    lk = _cache_language_key(pref)
                    cur.execute(
                        """
                        SELECT title, language, transcript_text, transcript_json
                        FROM youtube_transcript_cache
                        WHERE video_id = %s AND language = %s
                        """,
                        (video_id, lk),
                    )
                    row = cur.fetchone()
                    if row:
                        return _row_to_transcript_cache_dict(row), False

                if fallback_allowed:
                    any_cached = get_any_youtube_transcript_cache(video_id)
                    if any_cached:
                        cached_lang = _cache_language_key(any_cached.get("language"))
                        preferred_keys = {_cache_language_key(p) for p in requested_languages}
                        fb = cached_lang not in preferred_keys
                        return any_cached, fb
                return None, False

            if fallback_allowed:
                any_cached = get_any_youtube_transcript_cache(video_id)
                if any_cached:
                    return any_cached, False
            return None, False
    except Exception:
        return None, False


def save_youtube_transcript_cache(
    video_id: str,
    source_url: str,
    title: Optional[str],
    language: Optional[str],
    transcript_text: str,
    segments: list[dict[str, Any]],
) -> None:
    """
    Upsert transcript text and segments for ``(video_id, language)``.

    Multiple languages per video are stored as separate rows; see ``get_youtube_transcript_cache``.
    """
    if not DATABASE_URL:
        return
    lang_key = _cache_language_key(language)
    try:
        with cursor() as cur:
            cur.execute(
                """
                INSERT INTO youtube_transcript_cache (
                    video_id, source_url, title, language, transcript_text, transcript_json, fetched_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW())
                ON CONFLICT (video_id, language) DO UPDATE SET
                    source_url = EXCLUDED.source_url,
                    title = EXCLUDED.title,
                    transcript_text = EXCLUDED.transcript_text,
                    transcript_json = EXCLUDED.transcript_json,
                    updated_at = NOW()
                """,
                (
                    video_id,
                    source_url,
                    title,
                    lang_key,
                    transcript_text,
                    json.dumps(segments),
                ),
            )
    except Exception:
        pass


def get_youtube_quota_usage_today() -> dict:
    """
    Return today's YouTube quota usage. Quota resets at midnight Pacific Time.
    Returns: { units_used, limit, remaining, usage_date_pt, last_updated }
    """
    today = _today_pt()
    result = {
        "units_used": 0,
        "limit": YOUTUBE_QUOTA_DAILY_LIMIT,
        "remaining": YOUTUBE_QUOTA_DAILY_LIMIT,
        "usage_date_pt": today.isoformat(),
        "last_updated": None,
    }
    if not DATABASE_URL:
        return result
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT units_used, last_updated FROM youtube_quota_usage WHERE usage_date = %s",
                (today,),
            )
            row = cur.fetchone()
            if row:
                used = int(row.get("units_used") or 0)
                result["units_used"] = used
                result["remaining"] = max(0, YOUTUBE_QUOTA_DAILY_LIMIT - used)
                lu = row.get("last_updated")
                if lu:
                    result["last_updated"] = lu.isoformat() if hasattr(lu, "isoformat") else str(lu)
    except Exception:
        pass
    return result
