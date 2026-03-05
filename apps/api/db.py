"""
Postgres connection and schema for Wayback caching and jobs.
Tables created idempotently on startup when DATABASE_URL is set.
"""

import os
from contextlib import contextmanager
from typing import Generator

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
