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


def _is_missing_signal_points_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        'relation "signal_points" does not exist' in msg
        or 'relation "public.signal_points" does not exist' in msg
    )


def _ensure_signal_points_table() -> None:
    if not _has_db():
        return
    with cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS public.signal_points (
                signal_key TEXT NOT NULL,
                date TEXT NOT NULL,
                value DOUBLE PRECISION NOT NULL,
                source TEXT NOT NULL,
                confidence DOUBLE PRECISION,
                metadata JSONB,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (signal_key, date)
            )
            """
        )


def get_max_date(signal_key: str) -> Optional[str]:
    """Return max(date) for signal_key, or None if table empty."""
    if not _has_db():
        return None
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT MAX(date) AS max_date FROM public.signal_points WHERE signal_key = %s",
                (signal_key,),
            )
            row = cur.fetchone()
    except Exception as e:
        if not _is_missing_signal_points_error(e):
            raise
        _ensure_signal_points_table()
        with cursor() as cur:
            cur.execute(
                "SELECT MAX(date) AS max_date FROM public.signal_points WHERE signal_key = %s",
                (signal_key,),
            )
            row = cur.fetchone()
    return row["max_date"] if row and row.get("max_date") else None


def insert_points_ignore_conflict(
    signal_key: str,
    points: list[dict[str, Any]],
    source: str,
    confidence: Optional[float] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> int:
    """Insert points; skip on (signal_key, date) conflict. Returns count actually inserted.
    Never overwrites existing rows."""
    if not _has_db():
        return 0
    meta_json = json.dumps(metadata or {})
    count = 0
    for attempt in range(2):
        try:
            with cursor() as cur:
                for p in points:
                    date = p.get("date")
                    value = p.get("value")
                    if not date or value is None:
                        continue
                    confidence_val = p.get("confidence") if p.get("confidence") is not None else confidence
                    cur.execute(
                        """
                        INSERT INTO public.signal_points (signal_key, date, value, source, confidence, metadata, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (signal_key, date) DO NOTHING
                        """,
                        (signal_key, date, value, source, confidence_val, meta_json),
                    )
                    if cur.rowcount > 0:
                        count += 1
            break
        except Exception as e:
            if attempt == 1 or not _is_missing_signal_points_error(e):
                raise
            _ensure_signal_points_table()
    return count


def get_points(
    signal_key: str,
    start: str,
    end: str,
) -> list[dict[str, Any]]:
    """Return points for signal_key in [start, end]. Sorted by date.
    Each point: {date, value, confidence?, metadata?}.
    """
    if not _has_db():
        return []
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT date, value, source, confidence, metadata
                FROM public.signal_points
                WHERE signal_key = %s AND date >= %s AND date <= %s
                ORDER BY date
                """,
                (signal_key, start, end),
            )
            rows = cur.fetchall()
    except Exception as e:
        if not _is_missing_signal_points_error(e):
            raise
        _ensure_signal_points_table()
        with cursor() as cur:
            cur.execute(
                """
                SELECT date, value, source, confidence, metadata
                FROM public.signal_points
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
            **({"confidence": r["confidence"]} if r.get("confidence") is not None else {}),
            **({"metadata": r["metadata"]} if r.get("metadata") is not None else {}),
        }
        for r in rows
    ]


def upsert_points(
    signal_key: str,
    points: list[dict[str, Any]],
    source: str,
    confidence: Optional[float] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> int:
    """Insert or update points. Idempotent on (signal_key, date). Returns count upserted.
    source: short identifier (e.g. FRED:DCOILBRENTEU). Full source info can go in metadata.
    """
    if not _has_db():
        return 0
    meta_json = json.dumps(metadata or {})
    count = 0
    for attempt in range(2):
        try:
            with cursor() as cur:
                for p in points:
                    date = p.get("date")
                    value = p.get("value")
                    if not date or value is None:
                        continue
                    confidence_val = p.get("confidence") if p.get("confidence") is not None else confidence
                    cur.execute(
                        """
                        INSERT INTO public.signal_points (signal_key, date, value, source, confidence, metadata, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (signal_key, date) DO UPDATE SET
                            value = EXCLUDED.value,
                            source = EXCLUDED.source,
                            confidence = EXCLUDED.confidence,
                            metadata = EXCLUDED.metadata,
                            updated_at = NOW()
                        """,
                        (signal_key, date, value, source, confidence_val, meta_json),
                    )
                    count += 1
            break
        except Exception as e:
            if attempt == 1 or not _is_missing_signal_points_error(e):
                raise
            _ensure_signal_points_table()
    return count
