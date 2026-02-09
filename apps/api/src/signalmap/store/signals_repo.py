"""Repository for signal time series data."""

import json
from typing import Any, Optional

# db is at api root; import works when running from apps/api
try:
    from db import DATABASE_URL, cursor
except ImportError:
    DATABASE_URL = None
    cursor = None  # type: ignore


def _has_db() -> bool:
    return bool(DATABASE_URL and cursor)


def upsert_points(
    signal_key: str,
    points: list[dict[str, Any]],
    source: str,
    metadata: Optional[dict[str, Any]] = None,
) -> int:
    """Insert or update points. Idempotent on (signal_key, date). Returns count upserted."""
    if not _has_db():
        return 0
    meta_json = json.dumps(metadata or {})
    count = 0
    with cursor() as cur:
        for p in points:
            date = p.get("date")
            value = p.get("value")
            if not date or value is None:
                continue
            confidence = p.get("confidence")
            cur.execute(
                """
                INSERT INTO signal_points (signal_key, date, value, source, confidence, metadata, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (signal_key, date) DO UPDATE SET
                    value = EXCLUDED.value,
                    source = EXCLUDED.source,
                    confidence = EXCLUDED.confidence,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (signal_key, date, value, source, confidence, meta_json),
            )
            count += 1
    return count


def get_points(signal_key: str, start: str, end: str) -> list[dict[str, Any]]:
    """Return points for signal_key in [start, end]. Sorted by date."""
    if not _has_db():
        return []
    with cursor() as cur:
        cur.execute(
            """
            SELECT date, value, source, confidence, metadata
            FROM signal_points
            WHERE signal_key = %s AND date >= %s AND date <= %s
            ORDER BY date
            """,
            (signal_key, start, end),
        )
        rows = cur.fetchall()
    return [
        {
            "date": r["date"],
            "value": float(r["value"]) if r["value"] is not None else None,
        }
        for r in rows
    ]
