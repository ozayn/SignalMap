"""
Wayback Instagram job runner.
Uses Postgres cache and job tables. Runs in background.
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
)
from db import cursor

PLATFORM = "instagram"
REQUEST_DELAY_S = 0.25  # Between archive fetches (cache hits skip delay)


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


def create_instagram_job(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
) -> str:
    """Create job row and return job_id. Caller starts background task."""
    username = (username or "").strip()
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

        # Job results (this job's snapshots)
        cur.execute(
            """
            SELECT timestamp, archived_url, followers, following, posts, confidence, evidence, source
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
            SELECT timestamp, archived_url, followers, following, posts, confidence, evidence
            FROM wayback_snapshot_cache
            WHERE platform = %s AND canonical_url = %s
            ORDER BY timestamp DESC
            """,
            (PLATFORM, canonical_url),
        )
        cache_rows = [dict(r) for r in cur.fetchall()]

        # Merge: job results + cache, dedupe by timestamp.
        # Prefer non-null over null (job may have stale nulls from before extraction fixes).
        def _has_metrics(x: dict) -> bool:
            return (
                x.get("followers") is not None
                or x.get("following") is not None
                or x.get("posts") is not None
            )

        seen: dict[str, dict] = {}
        for r in job["results"]:
            row = _row_to_result(r)
            seen[row["timestamp"]] = row
        for r in cache_rows:
            ts = r["timestamp"]
            cache_row = _row_to_result(r)
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


def list_jobs(username: Optional[str] = None, limit: int = 10) -> list[dict]:
    """List recent jobs, optionally filtered by username."""
    with cursor() as cur:
        if username:
            cur.execute(
                """
                SELECT job_id, username, status, total, processed, created_at, finished_at,
                       snapshots_found, snapshots_sampled, snapshots_with_metrics,
                       snapshots_cached, snapshots_fetched, summary
                FROM wayback_jobs
                WHERE username = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (username.strip(), limit),
            )
        else:
            cur.execute(
                """
                SELECT job_id, username, status, total, processed, created_at, finished_at,
                       snapshots_found, snapshots_sampled, snapshots_with_metrics,
                       snapshots_cached, snapshots_fetched, summary
                FROM wayback_jobs
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
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
