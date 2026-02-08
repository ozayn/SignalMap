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
    except Exception:
        pass  # DB may not be available; job endpoints will return 503
