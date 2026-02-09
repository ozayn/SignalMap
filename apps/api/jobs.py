"""
Wayback Instagram, YouTube, and Twitter job runners.
Uses Postgres cache and job tables. Runs in background.
Cache-first endpoints return a normalized response (platform, handle, source, snapshots, meta).
"""

import time
import uuid
from typing import Optional

from connectors.wayback_instagram import (
    list_snapshots,
    deduplicate_snapshots,
    evenly_sample_snapshots,
    fetch_snapshot_html,
    extract_instagram_metrics,
    _build_archived_url,
    get_instagram_archival_metrics,
)
from db import cursor

PLATFORM = "instagram"
# Internet Archive limit: 15 requests/min (archive.org/details/toomanyrequests_20191110)
REQUEST_DELAY_S = 4.5  # ~13 req/min; cache hits skip delay


def _cdx_ts_to_iso(ts: str) -> str:
    """Convert CDX timestamp (YYYYMMDDhhmmss) to ISO-8601."""
    if not ts or len(ts) < 8:
        return ts
    if len(ts) >= 14:
        return f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}Z"
    return f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}Z"


def _build_cache_first_response(
    platform: str,
    handle: str,
    canonical_url: str,
    source: str,
    snapshots: list[dict],
    cache_rows: int,
    wayback_calls: int,
    rate_limited: bool = False,
    notes: Optional[list[str]] = None,
    last_cached_at: Optional[str] = None,
) -> dict:
    """Build normalized cache-first JSON. snapshots: list of {timestamp (ISO), followers, snapshot_url}."""
    return {
        "platform": platform,
        "handle": handle,
        "canonical_url": canonical_url,
        "source": source,
        "snapshots": snapshots,
        "meta": {
            "cache_hit": source == "cache",
            "cache_rows": cache_rows,
            "wayback_calls": wayback_calls,
            "rate_limited": rate_limited,
            "notes": notes or [],
            "last_cached_at": last_cached_at,
        },
    }


def _run_instagram_job(job_id: str) -> None:
    """Execute job: fetch snapshots, check cache, extract metrics, persist."""
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT username, canonical_url, from_year, to_year, from_date, to_date, sample FROM wayback_jobs WHERE job_id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            if not row:
                return
            username = row["username"]
            canonical_url = row["canonical_url"]
            from_year = row["from_year"]
            to_year = row["to_year"]
            from_date = row.get("from_date")
            to_date = row.get("to_date")
            sample = row["sample"]

            cur.execute(
                "UPDATE wayback_jobs SET status = %s, started_at = NOW() WHERE job_id = %s",
                ("running", job_id),
            )

        raw_snapshots = list_snapshots(
            canonical_url,
            from_year=from_year,
            to_year=to_year,
            from_date=from_date,
            to_date=to_date,
            limit=500,
        )
        deduped = deduplicate_snapshots(raw_snapshots)
        sampled = evenly_sample_snapshots(deduped, sample)
        total = len(sampled)
        snapshots_found = len(deduped)
        snapshots_sampled = len(sampled)

        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET total = %s, snapshots_found = %s, snapshots_sampled = %s WHERE job_id = %s",
                (total, snapshots_found, snapshots_sampled, job_id),
            )

        processed = 0
        snapshots_cached = 0
        snapshots_fetched = 0
        snapshots_with_metrics = 0
        for s in sampled:
            with cursor() as cur:
                cur.execute(
                    "SELECT status FROM wayback_jobs WHERE job_id = %s",
                    (job_id,),
                )
                r = cur.fetchone()
                if r and r["status"] == "canceled":
                    return

            timestamp = s["timestamp"]
            original_url = s["original"]
            archived_url = _build_archived_url(timestamp, original_url)
            platform = PLATFORM

            # Check cache
            with cursor() as cur:
                cur.execute(
                    """
                    SELECT followers, following, posts, confidence, evidence
                    FROM wayback_snapshot_cache
                    WHERE platform = %s AND canonical_url = %s AND timestamp = %s
                    """,
                    (platform, canonical_url, timestamp),
                )
                cached = cur.fetchone()

            # Use cache only if we have at least one metric (null cache = re-fetch for improved extraction)
            has_metrics = cached and (
                cached.get("followers") is not None
                or cached.get("following") is not None
                or cached.get("posts") is not None
            )
            if has_metrics:
                source = "cache"
                snapshots_cached += 1
                followers = cached["followers"]
                following = cached["following"]
                posts = cached["posts"]
                confidence = float(cached["confidence"] or 0.2)
                evidence = cached["evidence"]
            else:
                source = "wayback"
                snapshots_fetched += 1
                time.sleep(REQUEST_DELAY_S)
                html, _ = fetch_snapshot_html(timestamp, original_url)
                if html:
                    metrics = extract_instagram_metrics(html)
                    followers = metrics["followers"]["value"]
                    following = metrics["following"]["value"]
                    posts = metrics["posts"]["value"]
                    confs = [m["confidence"] for m in metrics.values() if m["value"] is not None]
                    confidence = round(max(confs, default=0.2), 2) if confs else 0.2
                    evidence = next((m["evidence"] for m in metrics.values() if m["evidence"]), None)
                else:
                    followers = following = posts = None
                    confidence = 0.0
                    evidence = None

                # Upsert cache
                with cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO wayback_snapshot_cache
                        (platform, username, canonical_url, timestamp, original_url, archived_url,
                         followers, following, posts, confidence, evidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (platform, canonical_url, timestamp)
                        DO UPDATE SET
                            followers = EXCLUDED.followers,
                            following = EXCLUDED.following,
                            posts = EXCLUDED.posts,
                            confidence = EXCLUDED.confidence,
                            evidence = EXCLUDED.evidence,
                            fetched_at = NOW()
                        """,
                        (
                            platform,
                            username,
                            canonical_url,
                            timestamp,
                            original_url,
                            archived_url,
                            followers,
                            following,
                            posts,
                            confidence,
                            evidence,
                        ),
                    )

            # Insert job snapshot
            with cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO wayback_job_snapshots
                    (job_id, timestamp, archived_url, followers, following, posts, confidence, evidence, source)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (job_id, timestamp) DO UPDATE SET
                        archived_url = EXCLUDED.archived_url,
                        followers = EXCLUDED.followers,
                        following = EXCLUDED.following,
                        posts = EXCLUDED.posts,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        source = EXCLUDED.source
                    """,
                    (
                        job_id,
                        timestamp,
                        archived_url,
                        followers,
                        following,
                        posts,
                        confidence,
                        evidence,
                        source,
                    ),
                )
                processed += 1
                if followers is not None or following is not None or posts is not None:
                    snapshots_with_metrics += 1
                cur.execute(
                    "UPDATE wayback_jobs SET processed = %s WHERE job_id = %s",
                    (processed, job_id),
                )

        # Build summary for transparency
        if snapshots_sampled == 0:
            if snapshots_found == 0:
                summary = "No Wayback snapshots found for selected date range."
            else:
                summary = "No snapshots sampled (unexpected)."
        elif snapshots_with_metrics == 0:
            summary = "Snapshots found but no extractable metrics."
        elif snapshots_cached == snapshots_sampled:
            summary = "All snapshots served from cache."
        else:
            summary = None

        with cursor() as cur:
            cur.execute(
                """
                UPDATE wayback_jobs SET
                    status = %s, finished_at = NOW(),
                    snapshots_with_metrics = %s, snapshots_cached = %s, snapshots_fetched = %s,
                    summary = %s
                WHERE job_id = %s
                """,
                (
                    "completed",
                    snapshots_with_metrics,
                    snapshots_cached,
                    snapshots_fetched,
                    summary,
                    job_id,
                ),
            )

    except Exception as e:
        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET status = %s, error = %s, finished_at = NOW() WHERE job_id = %s",
                ("failed", str(e), job_id),
            )


def _normalize_instagram_username(username: str) -> str:
    """Lowercase, trim, remove @. Consistent key for cache reads and writes."""
    return (username or "").strip().replace("@", "").lower()


def get_cached_instagram_snapshots(username: str) -> Optional[dict]:
    """Return cached Instagram snapshots for a username, or None if no cache or DB unavailable."""
    username = _normalize_instagram_username(username)
    if not username:
        return None
    canonical_url = f"https://www.instagram.com/{username}/"
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (timestamp) timestamp, archived_url, followers, following, posts, confidence, evidence, fetched_at
                FROM wayback_snapshot_cache
                WHERE platform = %s AND LOWER(canonical_url) = LOWER(%s)
                ORDER BY timestamp ASC, fetched_at DESC NULLS LAST
                """,
                (PLATFORM, canonical_url),
            )
            rows = [dict(r) for r in cur.fetchall()]
    except Exception:
        return None
    if not rows:
        return None
    fa_values = [r.get("fetched_at") for r in rows if r.get("fetched_at")]
    last_cached_at = max(fa_values).isoformat() if fa_values else None
    results = [
        {
            "timestamp": r["timestamp"],
            "archived_url": r.get("archived_url"),
            "followers": r.get("followers"),
            "following": r.get("following"),
            "posts": r.get("posts"),
            "confidence": float(r["confidence"]) if r.get("confidence") is not None else 0.2,
            "evidence": r.get("evidence"),
            "source": "cache",
        }
        for r in rows
    ]
    return {
        "platform": "instagram",
        "username": username,
        "results": results,
        "snapshots_total": len(results),
        "snapshots_sampled": len(results),
        "notes": "Served from cache. Run a job from Explore for more snapshots.",
        "metadata": {
            "source": "cache",
            "count": len(results),
            "last_cached_at": last_cached_at,
        },
    }


def _upsert_instagram_cache(username: str, results: list[dict]) -> None:
    """Upsert live fetch results into wayback_snapshot_cache. Seeds future cache reads."""
    username = _normalize_instagram_username(username)
    if not username:
        return
    canonical_url = f"https://www.instagram.com/{username}/"
    try:
        with cursor() as cur:
            for r in results:
                ts = r.get("timestamp")
                if not ts:
                    continue
                archived_url = r.get("archived_url")
                original_url = r.get("original_url", "")
                cur.execute(
                    """
                    INSERT INTO wayback_snapshot_cache
                    (platform, username, canonical_url, timestamp, original_url, archived_url,
                     followers, following, posts, confidence, evidence)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (platform, canonical_url, timestamp)
                    DO UPDATE SET
                        followers = EXCLUDED.followers,
                        following = EXCLUDED.following,
                        posts = EXCLUDED.posts,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        fetched_at = NOW()
                    """,
                    (
                        PLATFORM,
                        username,
                        canonical_url,
                        ts,
                        original_url,
                        archived_url,
                        r.get("followers"),
                        r.get("following"),
                        r.get("posts"),
                        r.get("confidence") or 0.2,
                        r.get("evidence"),
                    ),
                )
    except Exception:
        pass  # Non-fatal; cache seeding is best-effort


def get_instagram_cache_first(username: str, sample: int = 40) -> dict:
    """
    Cache-first read: try cache, else live Wayback fetch.
    When falling back to live, upserts results into cache to seed future reads.
    Returns same shape as get_instagram_archival_metrics, plus metadata.source.
    (Legacy; prefer cache_first_instagram for normalized response.)
    """
    cached = get_cached_instagram_snapshots(username)
    if cached is not None and cached.get("metadata", {}).get("count", 0) >= 1:
        return cached

    live = get_instagram_archival_metrics(
        username=username,
        sample=sample,
        include_evidence=True,
        progress=False,
    )
    results = live.get("results", [])
    if results:
        _upsert_instagram_cache(username, results)
    live["metadata"] = {
        "source": "wayback_live",
        "count": len(results),
        "last_cached_at": None,
    }
    return live


def _get_cache_rows(platform: str, canonical_url: str) -> tuple[list[dict], Optional[str]]:
    """Return (rows, last_cached_at) from wayback_snapshot_cache for platform + canonical_url."""
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT timestamp, archived_url, followers, following, posts, subscribers, confidence, evidence, fetched_at
                FROM wayback_snapshot_cache
                WHERE platform = %s AND LOWER(canonical_url) = LOWER(%s)
                ORDER BY timestamp ASC
                """,
                (platform, canonical_url),
            )
            rows = [dict(r) for r in cur.fetchall()]
    except Exception:
        return [], None
    fa_values = [r.get("fetched_at") for r in rows if r.get("fetched_at")]
    last_cached_at = max(fa_values).isoformat() if fa_values else None
    return rows, last_cached_at


def _rows_to_snapshots_instagram(rows: list[dict]) -> list[dict]:
    """Build normalized snapshot list from cache rows (Instagram)."""
    out = []
    for r in rows:
        ts = r.get("timestamp")
        out.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("followers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    return out


def cache_first_instagram(
    handle: str,
    force_live: bool = False,
    limit: Optional[int] = None,
) -> dict:
    """
    Normalized cache-first: return cache only if present and not force_live;
    else one live fetch, upsert, return. source in {cache, live, mixed}.
    """
    handle_norm = _normalize_instagram_username(handle)
    if not handle_norm:
        return _build_cache_first_response(
            "instagram", handle, "", "live", [], 0, 0, notes=["Invalid handle."]
        )
    canonical_url = f"https://www.instagram.com/{handle_norm}/"
    sample = min(max(limit or 40, 1), 100)

    cache_rows, last_cached_at = _get_cache_rows(PLATFORM, canonical_url)
    if cache_rows and not force_live:
        snapshots = _rows_to_snapshots_instagram(cache_rows)
        return _build_cache_first_response(
            "instagram", handle_norm, canonical_url, "cache",
            snapshots, len(cache_rows), 0,
            last_cached_at=last_cached_at,
        )

    # One live batch (no retries)
    live = get_instagram_archival_metrics(
        username=handle_norm, sample=sample, include_evidence=True, progress=False,
    )
    results = live.get("results", [])
    if results:
        _upsert_instagram_cache(handle_norm, results)
    snapshots = []
    for r in results:
        ts = r.get("timestamp")
        snapshots.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("followers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    source = "mixed" if cache_rows else "live"
    return _build_cache_first_response(
        "instagram", handle_norm, canonical_url, source,
        snapshots, len(cache_rows), len(results),
        last_cached_at=last_cached_at if cache_rows else None,
    )


def create_instagram_job(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
) -> str:
    """Create job row and return job_id. Caller starts background task."""
    username = _normalize_instagram_username(username)
    if not username:
        raise ValueError("username is required")
    sample = min(max(sample, 1), 100)
    canonical_url = f"https://www.instagram.com/{username}/"
    job_id = str(uuid.uuid4())

    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO wayback_jobs
            (job_id, platform, username, canonical_url, from_year, to_year, from_date, to_date, sample, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (job_id, PLATFORM, username, canonical_url, from_year, to_year, from_date, to_date, sample, "queued"),
        )

    return job_id


def _row_to_result(r: dict) -> dict:
    """Normalize a cache or job_snapshot row to result format."""
    return {
        "timestamp": r["timestamp"],
        "archived_url": r.get("archived_url"),
        "followers": r.get("followers"),
        "following": r.get("following"),
        "posts": r.get("posts"),
        "subscribers": r.get("subscribers"),
        "confidence": float(r["confidence"]) if r.get("confidence") is not None else 0.2,
        "evidence": r.get("evidence"),
        "source": r.get("source", "cache"),
    }


def get_job(job_id: str) -> Optional[dict]:
    """Get job status and optionally results."""
    with cursor() as cur:
        cur.execute(
            """
            SELECT job_id, platform, username, canonical_url, status, total, processed, error,
                   created_at, started_at, finished_at,
                   snapshots_found, snapshots_sampled, snapshots_with_metrics,
                   snapshots_cached, snapshots_fetched, summary
            FROM wayback_jobs WHERE job_id = %s
            """,
            (job_id,),
        )
        row = cur.fetchone()
        if not row:
            return None

        job = dict(row)
        job["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
        job["started_at"] = row["started_at"].isoformat() if row["started_at"] else None
        job["finished_at"] = row["finished_at"].isoformat() if row["finished_at"] else None

        canonical_url = row["canonical_url"]

        platform = row["platform"]
        # Job results (this job's snapshots)
        cur.execute(
            """
            SELECT timestamp, archived_url, followers, following, posts, subscribers, confidence, evidence, source
            FROM wayback_job_snapshots
            WHERE job_id = %s
            ORDER BY timestamp DESC
            """,
            (job_id,),
        )
        job["results"] = [dict(r) for r in cur.fetchall()]

        # All cached snapshots for this profile (from any job)
        cur.execute(
            """
            SELECT timestamp, archived_url, followers, following, posts, subscribers, confidence, evidence
            FROM wayback_snapshot_cache
            WHERE platform = %s AND canonical_url = %s
            ORDER BY timestamp DESC
            """,
            (platform, canonical_url),
        )
        cache_rows = [dict(r) for r in cur.fetchall()]

        # Merge: job results + cache, dedupe by timestamp.
        # Prefer non-null over null (job may have stale nulls from before extraction fixes).
        def _has_metrics(x: dict) -> bool:
            if platform == PLATFORM_YOUTUBE:
                return x.get("subscribers") is not None
            if platform == PLATFORM_TWITTER:
                return x.get("followers") is not None
            return (
                x.get("followers") is not None
                or x.get("following") is not None
                or x.get("posts") is not None
            )

        def _row_to_result_platform(r: dict) -> dict:
            out = _row_to_result(r)
            if platform == PLATFORM_YOUTUBE:
                out["subscribers"] = r.get("subscribers")
            return out

        seen: dict[str, dict] = {}
        for r in job["results"]:
            row = _row_to_result_platform(r)
            seen[row["timestamp"]] = row
        for r in cache_rows:
            ts = r["timestamp"]
            cache_row = _row_to_result_platform(r)
            cache_row["source"] = "cache"
            if ts not in seen or (
                _has_metrics(cache_row) and not _has_metrics(seen[ts])
            ):
                seen[ts] = cache_row
        job["all_results"] = sorted(seen.values(), key=lambda x: x["timestamp"], reverse=True)

        return job


def get_job_results(job_id: str) -> list[dict]:
    """Get results rows for a job."""
    with cursor() as cur:
        cur.execute(
            """
            SELECT timestamp, archived_url, followers, following, posts, confidence, evidence, source
            FROM wayback_job_snapshots
            WHERE job_id = %s
            ORDER BY timestamp DESC
            """,
            (job_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def list_jobs(
    username: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """List recent jobs, optionally filtered by username or platform."""
    with cursor() as cur:
        conditions = []
        params: list = []
        if username:
            conditions.append("username = %s")
            params.append(username.strip())
        if platform:
            conditions.append("platform = %s")
            params.append(platform)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""
            SELECT job_id, platform, username, status, total, processed, created_at, finished_at,
                   snapshots_found, snapshots_sampled, snapshots_with_metrics,
                   snapshots_cached, snapshots_fetched, summary
            FROM wayback_jobs
            {where}
            ORDER BY created_at DESC
            LIMIT %s
            """,
            tuple(params),
        )
        rows = cur.fetchall()
    return [
        {
            **dict(r),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            "finished_at": r["finished_at"].isoformat() if r.get("finished_at") else None,
        }
        for r in rows
    ]


def cancel_job(job_id: str) -> bool:
    """Set job status to canceled. Returns True if updated."""
    with cursor() as cur:
        cur.execute(
            "UPDATE wayback_jobs SET status = 'canceled' WHERE job_id = %s AND status IN ('queued', 'running')",
            (job_id,),
        )
        return cur.rowcount > 0


def delete_job(job_id: str) -> bool:
    """Delete job and its snapshots. Returns True if deleted."""
    with cursor() as cur:
        cur.execute("DELETE FROM wayback_job_snapshots WHERE job_id = %s", (job_id,))
        cur.execute("DELETE FROM wayback_jobs WHERE job_id = %s", (job_id,))
        return cur.rowcount > 0


# --- Twitter jobs ---

PLATFORM_TWITTER = "twitter"


def _upsert_twitter_cache(username: str, canonical_url: str, results: list[dict]) -> None:
    """Upsert live fetch results into wayback_snapshot_cache. Seeds cache-first reads."""
    try:
        with cursor() as cur:
            for r in results:
                ts = r.get("timestamp")
                if not ts:
                    continue
                archived_url = r.get("archived_url")
                original_url = r.get("original_url", r.get("original", ""))
                cur.execute(
                    """
                    INSERT INTO wayback_snapshot_cache
                    (platform, username, canonical_url, timestamp, original_url, archived_url,
                     followers, confidence, evidence)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (platform, canonical_url, timestamp)
                    DO UPDATE SET
                        followers = EXCLUDED.followers,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        fetched_at = NOW()
                    """,
                    (
                        PLATFORM_TWITTER,
                        username,
                        canonical_url,
                        ts,
                        original_url,
                        archived_url,
                        r.get("followers"),
                        r.get("confidence") or 0.2,
                        r.get("evidence"),
                    ),
                )
    except Exception:
        pass


def _rows_to_snapshots_twitter(rows: list[dict]) -> list[dict]:
    """Build normalized snapshot list from cache rows (Twitter)."""
    out = []
    for r in rows:
        ts = r.get("timestamp")
        out.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("followers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    return out


def cache_first_twitter(
    handle: str,
    force_live: bool = False,
    limit: Optional[int] = None,
) -> dict:
    """
    Normalized cache-first: return cache only if present and not force_live;
    else one live fetch, upsert, return. source in {cache, live, mixed}.
    """
    from signalmap.connectors.wayback_twitter import (
        normalize_username,
        get_twitter_archival_metrics,
    )

    handle_stripped = (handle or "").strip()
    if not handle_stripped:
        return _build_cache_first_response(
            "twitter", handle, "", "live", [], 0, 0, notes=["Invalid handle."]
        )
    norm_username, canonical_url = normalize_username(handle_stripped)
    if not canonical_url:
        return _build_cache_first_response(
            "twitter", handle_stripped, "", "live", [], 0, 0, notes=["Invalid Twitter handle or URL."]
        )
    sample = min(max(limit or 40, 1), 100)

    cache_rows, last_cached_at = _get_cache_rows(PLATFORM_TWITTER, canonical_url)
    if cache_rows and not force_live:
        snapshots = _rows_to_snapshots_twitter(cache_rows)
        return _build_cache_first_response(
            "twitter", norm_username, canonical_url, "cache",
            snapshots, len(cache_rows), 0,
            last_cached_at=last_cached_at,
        )

    live = get_twitter_archival_metrics(
        username=handle_stripped, from_year=2009, to_year=2026, sample=sample,
    )
    results = live.get("results", [])
    if results:
        _upsert_twitter_cache(norm_username, canonical_url, results)
    snapshots = []
    for r in results:
        ts = r.get("timestamp")
        snapshots.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("followers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    source = "mixed" if cache_rows else "live"
    return _build_cache_first_response(
        "twitter", norm_username, canonical_url, source,
        snapshots, len(cache_rows), len(results),
        last_cached_at=last_cached_at if cache_rows else None,
    )


def create_twitter_job(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
) -> str:
    """Create Twitter job row and return job_id. Caller starts background task."""
    from signalmap.connectors.wayback_twitter import normalize_username

    username = (username or "").strip()
    if not username:
        raise ValueError("username is required")
    sample = min(max(sample, 1), 100)
    norm_username, canonical_url = normalize_username(username)
    if not canonical_url:
        raise ValueError("Invalid Twitter username")
    job_id = str(uuid.uuid4())

    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO wayback_jobs
            (job_id, platform, username, canonical_url, from_year, to_year, from_date, to_date, sample, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (job_id, PLATFORM_TWITTER, norm_username, canonical_url, from_year, to_year, from_date, to_date, sample, "queued"),
        )

    return job_id


def _run_twitter_job(job_id: str) -> None:
    """Execute Twitter job: fetch snapshots, check cache, extract followers, persist."""
    from signalmap.connectors.wayback_twitter import (
        list_snapshots,
        evenly_sample,
        fetch_snapshot_html,
        extract_followers,
    )

    try:
        with cursor() as cur:
            cur.execute(
                "SELECT username, canonical_url, from_year, to_year, from_date, to_date, sample FROM wayback_jobs WHERE job_id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            if not row:
                return
            username = row["username"]
            canonical_url = row["canonical_url"]
            from_year = row["from_year"]
            to_year = row["to_year"]
            from_date = row.get("from_date")
            to_date = row.get("to_date")
            sample = row["sample"]

            cur.execute(
                "UPDATE wayback_jobs SET status = %s, started_at = NOW() WHERE job_id = %s",
                ("running", job_id),
            )

        raw_snapshots = list_snapshots(
            canonical_url,
            from_year=from_year,
            to_year=to_year,
            from_date=from_date,
            to_date=to_date,
            limit=2000,
        )
        sampled = evenly_sample(raw_snapshots, sample=sample)
        total = len(sampled)
        snapshots_found = len(raw_snapshots)
        snapshots_sampled = len(sampled)

        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET total = %s, snapshots_found = %s, snapshots_sampled = %s WHERE job_id = %s",
                (total, snapshots_found, snapshots_sampled, job_id),
            )

        processed = 0
        snapshots_cached = 0
        snapshots_fetched = 0
        snapshots_with_metrics = 0
        for s in sampled:
            with cursor() as cur:
                cur.execute(
                    "SELECT status FROM wayback_jobs WHERE job_id = %s",
                    (job_id,),
                )
                r = cur.fetchone()
                if r and r["status"] == "canceled":
                    return

            timestamp = s["timestamp"]
            original_url = s["original"]
            archived_url = f"https://web.archive.org/web/{timestamp}/{original_url}"

            with cursor() as cur:
                cur.execute(
                    """
                    SELECT followers, confidence, evidence
                    FROM wayback_snapshot_cache
                    WHERE platform = %s AND canonical_url = %s AND timestamp = %s
                    """,
                    (PLATFORM_TWITTER, canonical_url, timestamp),
                )
                cached = cur.fetchone()

            if cached and cached.get("followers") is not None:
                source = "cache"
                snapshots_cached += 1
                followers = cached["followers"]
                confidence = float(cached["confidence"] or 0.2)
                evidence = cached["evidence"]
            else:
                source = "wayback"
                snapshots_fetched += 1
                time.sleep(REQUEST_DELAY_S)
                html, _ = fetch_snapshot_html(timestamp, original_url)
                if html:
                    extracted = extract_followers(html)
                    followers = extracted["value"]
                    confidence = extracted["confidence"] or 0.2
                    evidence = extracted["evidence"]
                else:
                    followers = None
                    confidence = 0.0
                    evidence = None

                with cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO wayback_snapshot_cache
                        (platform, username, canonical_url, timestamp, original_url, archived_url,
                         followers, confidence, evidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (platform, canonical_url, timestamp)
                        DO UPDATE SET
                            followers = EXCLUDED.followers,
                            confidence = EXCLUDED.confidence,
                            evidence = EXCLUDED.evidence,
                            fetched_at = NOW()
                        """,
                        (
                            PLATFORM_TWITTER,
                            username,
                            canonical_url,
                            timestamp,
                            original_url,
                            archived_url,
                            followers,
                            confidence,
                            evidence,
                        ),
                    )

            with cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO wayback_job_snapshots
                    (job_id, timestamp, archived_url, followers, confidence, evidence, source)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (job_id, timestamp) DO UPDATE SET
                        archived_url = EXCLUDED.archived_url,
                        followers = EXCLUDED.followers,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        source = EXCLUDED.source
                    """,
                    (
                        job_id,
                        timestamp,
                        archived_url,
                        followers,
                        confidence,
                        evidence,
                        source,
                    ),
                )
                processed += 1
                if followers is not None:
                    snapshots_with_metrics += 1
                cur.execute(
                    "UPDATE wayback_jobs SET processed = %s WHERE job_id = %s",
                    (processed, job_id),
                )

        if snapshots_sampled == 0:
            if snapshots_found == 0:
                summary = "No Wayback snapshots found for selected date range."
            else:
                summary = "No snapshots sampled (unexpected)."
        elif snapshots_with_metrics == 0:
            summary = "Snapshots found but no extractable metrics."
        elif snapshots_cached == snapshots_sampled:
            summary = "All snapshots served from cache."
        else:
            summary = None

        with cursor() as cur:
            cur.execute(
                """
                UPDATE wayback_jobs SET
                    status = %s, finished_at = NOW(),
                    snapshots_with_metrics = %s, snapshots_cached = %s, snapshots_fetched = %s,
                    summary = %s
                WHERE job_id = %s
                """,
                (
                    "completed",
                    snapshots_with_metrics,
                    snapshots_cached,
                    snapshots_fetched,
                    summary,
                    job_id,
                ),
            )

    except Exception as e:
        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET status = %s, error = %s, finished_at = NOW() WHERE job_id = %s",
                ("failed", str(e), job_id),
            )


# --- YouTube jobs ---

PLATFORM_YOUTUBE = "youtube"


def get_cached_youtube_snapshots(input_str: str) -> Optional[dict]:
    """Return cached YouTube snapshots for an input (handle or URL), or None if no cache or DB unavailable."""
    from signalmap.connectors.wayback_youtube import canonicalize_youtube_input

    canon = canonicalize_youtube_input((input_str or "").strip())
    canonical_url = canon.get("canonical_url", "")
    if not canonical_url:
        return None
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (timestamp) timestamp, archived_url, subscribers, confidence, evidence, fetched_at
                FROM wayback_snapshot_cache
                WHERE platform = %s AND LOWER(canonical_url) = LOWER(%s)
                ORDER BY timestamp ASC, fetched_at DESC NULLS LAST
                """,
                (PLATFORM_YOUTUBE, canonical_url),
            )
            rows = [dict(r) for r in cur.fetchall()]
    except Exception:
        return None
    if not rows:
        return None
    fa_values = [r.get("fetched_at") for r in rows if r.get("fetched_at")]
    last_cached_at = max(fa_values).isoformat() if fa_values else None
    results = [
        {
            "timestamp": r["timestamp"],
            "archived_url": r.get("archived_url"),
            "subscribers": r.get("subscribers"),
            "confidence": float(r["confidence"]) if r.get("confidence") is not None else 0.2,
            "evidence": r.get("evidence"),
            "source": "cache",
        }
        for r in rows
    ]
    return {
        "platform": "youtube",
        "input": input_str.strip(),
        "canonical_url": canonical_url,
        "results": results,
        "snapshots_total": len(results),
        "snapshots_sampled": len(results),
        "notes": "Served from cache. Run a job from Explore for more snapshots.",
        "metadata": {
            "source": "cache",
            "count": len(results),
            "last_cached_at": last_cached_at,
        },
    }


def _upsert_youtube_cache(canonical_url: str, input_str: str, results: list[dict]) -> None:
    """Upsert live fetch results into wayback_snapshot_cache. Seeds future cache reads."""
    username = (input_str or "").strip().lstrip("@").split("/")[-1].split("?")[0] or input_str
    try:
        with cursor() as cur:
            for r in results:
                ts = r.get("timestamp")
                if not ts:
                    continue
                archived_url = r.get("archived_url")
                original_url = r.get("original_url", "")
                cur.execute(
                    """
                    INSERT INTO wayback_snapshot_cache
                    (platform, username, canonical_url, timestamp, original_url, archived_url,
                     subscribers, confidence, evidence)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (platform, canonical_url, timestamp)
                    DO UPDATE SET
                        subscribers = EXCLUDED.subscribers,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        fetched_at = NOW()
                    """,
                    (
                        PLATFORM_YOUTUBE,
                        username,
                        canonical_url,
                        ts,
                        original_url,
                        archived_url,
                        r.get("subscribers"),
                        r.get("confidence") or 0.2,
                        r.get("evidence"),
                    ),
                )
    except Exception:
        pass  # Non-fatal; cache seeding is best-effort


def get_youtube_cache_first(input_str: str, sample: int = 40) -> dict:
    """
    Cache-first read: try cache, else live Wayback fetch.
    (Legacy; prefer cache_first_youtube for normalized response.)
    """
    from signalmap.connectors.wayback_youtube import get_youtube_archival_metrics

    cached = get_cached_youtube_snapshots(input_str)
    if cached is not None and cached.get("metadata", {}).get("count", 0) >= 1:
        return cached

    live = get_youtube_archival_metrics(input_str=input_str, sample=sample)
    results = live.get("results", [])
    canonical_url = live.get("canonical_url", "")
    if results and canonical_url:
        _upsert_youtube_cache(canonical_url, input_str, results)
    live["metadata"] = {
        "source": "wayback_live",
        "count": len(results),
        "last_cached_at": None,
    }
    return live


def _rows_to_snapshots_youtube(rows: list[dict]) -> list[dict]:
    """Build normalized snapshot list from cache rows (YouTube: subscribers -> followers)."""
    out = []
    for r in rows:
        ts = r.get("timestamp")
        out.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("subscribers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    return out


def cache_first_youtube(
    handle: str,
    force_live: bool = False,
    limit: Optional[int] = None,
) -> dict:
    """
    Normalized cache-first: return cache only if present and not force_live;
    else one live fetch, upsert, return. source in {cache, live, mixed}.
    """
    from signalmap.connectors.wayback_youtube import (
        canonicalize_youtube_input,
        get_youtube_archival_metrics,
    )

    handle_stripped = (handle or "").strip()
    if not handle_stripped:
        return _build_cache_first_response(
            "youtube", handle, "", "live", [], 0, 0, notes=["Invalid handle."]
        )
    canon = canonicalize_youtube_input(handle_stripped)
    canonical_url = canon.get("canonical_url", "")
    if not canonical_url:
        return _build_cache_first_response(
            "youtube", handle_stripped, "", "live", [], 0, 0, notes=["Invalid YouTube handle or URL."]
        )
    sample = min(max(limit or 40, 1), 100)

    cache_rows, last_cached_at = _get_cache_rows(PLATFORM_YOUTUBE, canonical_url)
    if cache_rows and not force_live:
        snapshots = _rows_to_snapshots_youtube(cache_rows)
        return _build_cache_first_response(
            "youtube", handle_stripped, canonical_url, "cache",
            snapshots, len(cache_rows), 0,
            last_cached_at=last_cached_at,
        )

    live = get_youtube_archival_metrics(input_str=handle_stripped, sample=sample)
    results = live.get("results", [])
    if results and canonical_url:
        _upsert_youtube_cache(canonical_url, handle_stripped, results)
    snapshots = []
    for r in results:
        ts = r.get("timestamp")
        snapshots.append({
            "timestamp": _cdx_ts_to_iso(ts) if ts else "",
            "followers": r.get("subscribers"),
            "snapshot_url": r.get("archived_url"),
            "raw": None,
        })
    source = "mixed" if cache_rows else "live"
    return _build_cache_first_response(
        "youtube", handle_stripped, canonical_url, source,
        snapshots, len(cache_rows), len(results),
        last_cached_at=last_cached_at if cache_rows else None,
    )


def create_youtube_job(
    input_str: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
) -> str:
    """Create YouTube job row and return job_id. Caller starts background task."""
    from signalmap.connectors.wayback_youtube import canonicalize_youtube_input

    input_str = (input_str or "").strip()
    if not input_str:
        raise ValueError("input is required")
    sample = min(max(sample, 1), 100)
    canon = canonicalize_youtube_input(input_str)
    canonical_url = canon.get("canonical_url", "")
    if not canonical_url:
        raise ValueError("Invalid YouTube input")
    # Use input as display username (e.g. @BplusPodcast)
    username = input_str.lstrip("@").split("/")[-1].split("?")[0] or input_str
    job_id = str(uuid.uuid4())

    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO wayback_jobs
            (job_id, platform, username, canonical_url, from_year, to_year, from_date, to_date, sample, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (job_id, PLATFORM_YOUTUBE, username, canonical_url, from_year, to_year, from_date, to_date, sample, "queued"),
        )

    return job_id


def _run_youtube_job(job_id: str) -> None:
    """Execute YouTube job: fetch snapshots, check cache, extract subscribers, persist."""
    from signalmap.connectors.wayback_youtube import (
        list_snapshots,
        evenly_sample,
        fetch_snapshot_html,
        extract_subscribers,
    )

    try:
        with cursor() as cur:
            cur.execute(
                "SELECT username, canonical_url, from_year, to_year, from_date, to_date, sample FROM wayback_jobs WHERE job_id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            if not row:
                return
            username = row["username"]
            canonical_url = row["canonical_url"]
            from_year = row["from_year"]
            to_year = row["to_year"]
            from_date = row.get("from_date")
            to_date = row.get("to_date")
            sample = row["sample"]

            cur.execute(
                "UPDATE wayback_jobs SET status = %s, started_at = NOW() WHERE job_id = %s",
                ("running", job_id),
            )

        raw_snapshots = list_snapshots(
            canonical_url,
            from_year=from_year,
            to_year=to_year,
            from_date=from_date,
            to_date=to_date,
            limit=2000,
        )
        sampled = evenly_sample(raw_snapshots, sample=sample)
        total = len(sampled)
        snapshots_found = len(raw_snapshots)
        snapshots_sampled = len(sampled)

        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET total = %s, snapshots_found = %s, snapshots_sampled = %s WHERE job_id = %s",
                (total, snapshots_found, snapshots_sampled, job_id),
            )

        processed = 0
        snapshots_cached = 0
        snapshots_fetched = 0
        snapshots_with_metrics = 0
        for s in sampled:
            with cursor() as cur:
                cur.execute(
                    "SELECT status FROM wayback_jobs WHERE job_id = %s",
                    (job_id,),
                )
                r = cur.fetchone()
                if r and r["status"] == "canceled":
                    return

            timestamp = s["timestamp"]
            original_url = s["original"]
            archived_url = f"https://web.archive.org/web/{timestamp}/{original_url}"

            # Check cache
            with cursor() as cur:
                cur.execute(
                    """
                    SELECT subscribers, confidence, evidence
                    FROM wayback_snapshot_cache
                    WHERE platform = %s AND canonical_url = %s AND timestamp = %s
                    """,
                    (PLATFORM_YOUTUBE, canonical_url, timestamp),
                )
                cached = cur.fetchone()

            if cached and cached.get("subscribers") is not None:
                source = "cache"
                snapshots_cached += 1
                subscribers = cached["subscribers"]
                confidence = float(cached["confidence"] or 0.2)
                evidence = cached["evidence"]
            else:
                source = "wayback"
                snapshots_fetched += 1
                time.sleep(REQUEST_DELAY_S)
                html, _ = fetch_snapshot_html(timestamp, original_url)
                if html:
                    extracted = extract_subscribers(html)
                    subscribers = extracted["value"]
                    confidence = extracted["confidence"] or 0.2
                    evidence = extracted["evidence"]
                else:
                    subscribers = None
                    confidence = 0.0
                    evidence = None

                # Upsert cache
                with cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO wayback_snapshot_cache
                        (platform, username, canonical_url, timestamp, original_url, archived_url,
                         subscribers, confidence, evidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (platform, canonical_url, timestamp)
                        DO UPDATE SET
                            subscribers = EXCLUDED.subscribers,
                            confidence = EXCLUDED.confidence,
                            evidence = EXCLUDED.evidence,
                            fetched_at = NOW()
                        """,
                        (
                            PLATFORM_YOUTUBE,
                            username,
                            canonical_url,
                            timestamp,
                            original_url,
                            archived_url,
                            subscribers,
                            confidence,
                            evidence,
                        ),
                    )

            # Insert job snapshot
            with cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO wayback_job_snapshots
                    (job_id, timestamp, archived_url, subscribers, confidence, evidence, source)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (job_id, timestamp) DO UPDATE SET
                        archived_url = EXCLUDED.archived_url,
                        subscribers = EXCLUDED.subscribers,
                        confidence = EXCLUDED.confidence,
                        evidence = EXCLUDED.evidence,
                        source = EXCLUDED.source
                    """,
                    (
                        job_id,
                        timestamp,
                        archived_url,
                        subscribers,
                        confidence,
                        evidence,
                        source,
                    ),
                )
                processed += 1
                if subscribers is not None:
                    snapshots_with_metrics += 1
                cur.execute(
                    "UPDATE wayback_jobs SET processed = %s WHERE job_id = %s",
                    (processed, job_id),
                )

        if snapshots_sampled == 0:
            if snapshots_found == 0:
                summary = "No Wayback snapshots found for selected date range."
            else:
                summary = "No snapshots sampled (unexpected)."
        elif snapshots_with_metrics == 0:
            summary = "Snapshots found but no extractable metrics."
        elif snapshots_cached == snapshots_sampled:
            summary = "All snapshots served from cache."
        else:
            summary = None

        with cursor() as cur:
            cur.execute(
                """
                UPDATE wayback_jobs SET
                    status = %s, finished_at = NOW(),
                    snapshots_with_metrics = %s, snapshots_cached = %s, snapshots_fetched = %s,
                    summary = %s
                WHERE job_id = %s
                """,
                (
                    "completed",
                    snapshots_with_metrics,
                    snapshots_cached,
                    snapshots_fetched,
                    summary,
                    job_id,
                ),
            )

    except Exception as e:
        with cursor() as cur:
            cur.execute(
                "UPDATE wayback_jobs SET status = %s, error = %s, finished_at = NOW() WHERE job_id = %s",
                ("failed", str(e), job_id),
            )
