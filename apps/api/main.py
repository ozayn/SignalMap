import os
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# Allow signalmap package imports (apps/api/src/signalmap)
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from pydantic import BaseModel

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query

from connectors.wayback import get_snapshots_with_metrics
from connectors.wayback_instagram import (
    get_instagram_archival_metrics,
    get_instagram_followers_time_series,
    list_snapshots,
    deduplicate_snapshots,
    evenly_sample_snapshots,
)
from fastapi.middleware.cors import CORSMiddleware
from signalmap.connectors.wayback_youtube import get_youtube_archival_metrics
from signalmap.connectors.wayback_twitter import get_twitter_archival_metrics

from db import init_tables
from jobs import (
    create_instagram_job,
    create_youtube_job,
    create_twitter_job,
    get_cached_instagram_snapshots,
    get_cached_youtube_snapshots,
    get_instagram_cache_first,
    get_job,
    get_job_results,
    get_youtube_cache_first,
    list_jobs,
    cancel_job,
    delete_job,
    _run_instagram_job,
    _run_youtube_job,
    _run_twitter_job,
)


app = FastAPI()


@app.on_event("startup")
def startup():
    init_tables()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

web_origin = os.getenv("WEB_ORIGIN")
if web_origin:
    allowed_origins.append(web_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.(up\.railway\.app|railway\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": "signalmap-api", "status": "ok"}


@app.get("/api")
def api_index():
    """List available API endpoints."""
    return {
        "endpoints": {
            "overview": "/api/overview?study_id=1",
            "wayback_snapshots": "/api/wayback/snapshots?url=...&sample=30",
            "wayback_instagram": "/api/wayback/instagram?username=...&sample=30",
            "wayback_youtube": "/api/wayback/youtube?input=@handle&from_year=2010&to_year=2026&sample=40",
            "wayback_twitter": "/api/wayback/twitter?username=jack&from_year=2009&to_year=2026&sample=40",
            "wayback_instagram_jobs": "POST /api/wayback/instagram/jobs",
            "wayback_jobs_list": "GET /api/wayback/jobs/list",
            "wayback_job_status": "GET /api/wayback/jobs/{job_id}",
        },
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/version")
def api_version():
    """Debug: verify API has jobs support."""
    return {"version": "jobs-v1", "has_jobs": True}


@app.get("/api/events")
def get_events(
    study_id: str = "1",
    layers: Optional[str] = Query(None, description="Comma-separated layers, e.g. iran_core,world_core"),
):
    """Return contextual events for a study. Events are exogenous anchors, not outcome variables."""
    from signalmap.data.load_events import load_events, get_events_by_layers

    if layers:
        layer_list = [s.strip() for s in layers.split(",") if s.strip()]
        events = get_events_by_layers(study_id, layer_list)
    else:
        events = load_events(study_id)
    return {
        "study_id": study_id,
        "events": events,
        "notes": "Events are contextual anchors; missing coverage is expected.",
    }


OVERVIEW_STUB = {
    "study_id": "default",
    "study_title": "SignalMap Overview",
    "time_range": ["2021-01-15", "2026-02-06"],
    "kpis": [
        {"label": "Total interactions", "value": 2047, "unit": None},
        {"label": "Avg. sentiment", "value": 0.18, "unit": "score"},
        {"label": "Unique hashtags", "value": 14, "unit": None},
    ],
    "timeline": [
        {"date": "2021-01-15", "value": 0.08},
        {"date": "2021-04-11", "value": -0.12},
        {"date": "2021-06-18", "value": -0.05},
        {"date": "2021-08-03", "value": -0.08},
        {"date": "2021-10-15", "value": 0.02},
        {"date": "2022-01-15", "value": 0.05},
        {"date": "2022-06-01", "value": 0.10},
        {"date": "2022-08-15", "value": 0.12},
        {"date": "2022-09-01", "value": 0.08},
        {"date": "2022-09-16", "value": -0.15},
        {"date": "2022-09-30", "value": -0.22},
        {"date": "2022-10-17", "value": -0.18},
        {"date": "2022-12-08", "value": -0.12},
        {"date": "2023-02-11", "value": 0.05},
        {"date": "2023-06-15", "value": 0.12},
        {"date": "2023-10-01", "value": 0.08},
        {"date": "2024-01-01", "value": 0.15},
        {"date": "2024-01-15", "value": 0.22},
        {"date": "2024-04-13", "value": -0.20},
        {"date": "2024-05-19", "value": -0.15},
        {"date": "2024-06-15", "value": -0.08},
        {"date": "2024-08-01", "value": 0.05},
        {"date": "2024-10-15", "value": 0.12},
        {"date": "2025-01-15", "value": -0.05},
        {"date": "2025-04-01", "value": -0.18},
        {"date": "2025-06-15", "value": -0.12},
        {"date": "2025-09-01", "value": -0.08},
        {"date": "2025-12-01", "value": -0.10},
        {"date": "2026-01-15", "value": -0.06},
        {"date": "2026-02-06", "value": -0.04},
    ],
}


def _filter_overview_by_event(
    study_id: str,
    anchor_event_id: str,
    window_days: int,
) -> dict:
    """Filter timeline and recompute KPIs for an event-centered window."""
    from datetime import datetime, timedelta
    from signalmap.data.load_events import load_events

    events = load_events(study_id)
    event = next((e for e in events if e.get("id") == anchor_event_id), None)
    if not event:
        return {**OVERVIEW_STUB, "study_id": study_id}

    event_date = datetime.strptime(event["date"], "%Y-%m-%d").date()
    delta = timedelta(days=window_days)
    start = (event_date - delta).strftime("%Y-%m-%d")
    end = (event_date + delta).strftime("%Y-%m-%d")

    timeline = OVERVIEW_STUB["timeline"]
    filtered = [p for p in timeline if start <= p["date"] <= end]
    if not filtered:
        return {**OVERVIEW_STUB, "study_id": study_id}

    avg_sentiment = sum(p["value"] for p in filtered) / len(filtered)
    kpis = [
        {"label": "Total interactions", "value": int(2047 * len(filtered) / len(timeline)), "unit": None},
        {"label": "Avg. sentiment", "value": round(avg_sentiment, 2), "unit": "score"},
        {"label": "Unique hashtags", "value": 14, "unit": None},
    ]
    return {
        **OVERVIEW_STUB,
        "study_id": study_id,
        "kpis": kpis,
        "timeline": filtered,
        "time_range": [start, end],
        "anchor_event_id": anchor_event_id,
        "window_days": window_days,
        "window_range": [start, end],
    }


def _validate_date(s: str) -> bool:
    """Check YYYY-MM-DD format."""
    if len(s) != 10 or s[4] != "-" or s[7] != "-":
        return False
    try:
        from datetime import datetime
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


@app.get("/api/signals/oil/brent")
def get_brent_oil_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return Brent crude oil price (FRED DCOILBRENTEU) for date range."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_brent_series
        return get_brent_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/gold/global")
def get_gold_price_global_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return global gold price (USD/oz). Annual data only."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_gold_price_global_series
        return get_gold_price_global_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/oil/real")
def get_real_oil_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return inflation-adjusted (real) oil price in constant 2015 USD/bbl."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_real_oil_series
        return get_real_oil_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/oil/ppp-iran")
def get_oil_ppp_iran_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return Iran PPP-adjusted oil price burden (annual)."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_oil_ppp_iran_series
        return get_oil_ppp_iran_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/oil/ppp-turkey")
def get_oil_ppp_turkey_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return Turkey PPP-adjusted oil price burden (annual). Same methodology as Iran."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_oil_ppp_turkey_series
        return get_oil_ppp_turkey_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/oil/export-capacity")
def get_oil_export_capacity_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return oil price, Iran export volume, and export revenue proxy for Study 9."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_oil_export_capacity_study
        return get_oil_export_capacity_study(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/oil/global-long")
def get_oil_global_long_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return long-range oil: annual (EIA) pre-1987, daily (Brent) from 1987-05-20."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_oil_global_long_series
        return get_oil_global_long_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/fx/usd-toman")
def get_usd_toman_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return USD→Toman open-market rate (Bonbast) for date range."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_usd_toman_series
        return get_usd_toman_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/overview")
def get_overview(
    study_id: str = "1",
    anchor_event_id: Optional[str] = None,
    window_days: Optional[int] = None,
):
    """Return study overview. Optionally filter by event-centered window."""
    result = {**OVERVIEW_STUB, "study_id": study_id}
    if anchor_event_id:
        days = window_days if window_days is not None and window_days > 0 else 30
        result = _filter_overview_by_event(study_id, anchor_event_id, days)
    if study_id == "iran":
        result = {
            **result,
            "study_title": "Brent oil price as an exogenous context signal",
            "kpis": [],
            "timeline": [],
        }
        if not result.get("anchor_event_id"):
            result["time_range"] = ["2021-01-15", "2026-02-06"]
    return result


@app.get("/api/wayback/snapshots")
def wayback_snapshots(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    sample: int = 30,
):
    """Return Wayback snapshots with optional metric extraction."""
    sample = min(max(sample, 1), 50)
    return get_snapshots_with_metrics(
        url=url,
        from_year=from_year,
        to_year=to_year,
        sample=sample,
    )


@app.get("/api/wayback/instagram/cached")
def wayback_instagram_cached(username: str):
    """Return cached Instagram snapshots for a username, if any. Fast path for profiles already fetched via jobs."""
    cached = get_cached_instagram_snapshots(username)
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached data for this username")
    return cached


@app.get("/api/wayback/instagram/cache-first")
def wayback_instagram_cache_first(
    username: str,
    sample: int = 40,
):
    """
    Cache-first: read from Postgres cache first; if empty, fetch from Wayback live and seed cache.
    Returns metadata.source: "cache" or "wayback_live".
    """
    sample = min(max(sample, 1), 100)
    return get_instagram_cache_first(username=username, sample=sample)


@app.get("/api/wayback/instagram")
def wayback_instagram(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
    include_evidence: bool = True,
    progress: bool = False,
):
    """Return Wayback archival snapshots for an Instagram profile."""
    sample = min(max(sample, 1), 100)
    return get_instagram_archival_metrics(
        username=username,
        from_year=from_year,
        to_year=to_year,
        from_date=from_date,
        to_date=to_date,
        sample=sample,
        include_evidence=include_evidence,
        progress=progress,
    )


@app.get("/api/wayback/instagram/debug")
def wayback_instagram_debug(
    username: str,
    from_year: Optional[int] = 2012,
    to_year: Optional[int] = 2026,
):
    """Debug: show raw CDX snapshot count for a username."""
    url = f"https://www.instagram.com/{username.strip()}/"
    try:
        raw = list_snapshots(url, from_year=from_year, to_year=to_year, limit=500)
        deduped = deduplicate_snapshots(raw)
        sampled = evenly_sample_snapshots(deduped, 24)
        return {
            "username": username,
            "url": url,
            "raw_count": len(raw),
            "deduped_count": len(deduped),
            "sampled_count": len(sampled),
            "sample_preview": sampled[:5] if sampled else [],
        }
    except Exception as e:
        return {"username": username, "error": str(e), "raw_count": 0}


@app.get("/api/wayback/instagram/followers")
def wayback_instagram_followers(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
):
    """Return follower count time series from Wayback snapshots."""
    sample = min(max(sample, 1), 100)
    return get_instagram_followers_time_series(
        username=username,
        from_year=from_year,
        to_year=to_year,
        from_date=from_date,
        to_date=to_date,
        sample=sample,
    )


@app.get("/api/wayback/youtube/debug")
def wayback_youtube_debug(
    input_param: str = Query(..., alias="input"),
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
):
    """Debug: show raw CDX snapshot count for a YouTube channel."""
    from signalmap.connectors.wayback_youtube import (
        canonicalize_youtube_input,
        list_snapshots,
    )
    canon = canonicalize_youtube_input(input_param)
    url = canon.get("canonical_url", "")
    if not url:
        return {"input": input_param, "error": "Invalid input", "urls_tried": []}
    snaps = list_snapshots(url, from_year=from_year, to_year=to_year, limit=500)
    return {
        "input": input_param,
        "canonical_url": url,
        "snapshots_count": len(snaps),
        "preview": snaps[:5] if snaps else [],
    }


@app.get("/api/wayback/youtube/cached")
def wayback_youtube_cached(input_param: str = Query(..., alias="input")):
    """Return cached YouTube snapshots for an input (handle or URL), if any."""
    cached = get_cached_youtube_snapshots(input_param)
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached data for this input")
    return cached


@app.get("/api/wayback/youtube/cache-first")
def wayback_youtube_cache_first(
    input_param: str = Query(..., alias="input"),
    sample: int = 40,
):
    """
    Cache-first: read from Postgres cache first; if empty, fetch from Wayback live and seed cache.
    Returns metadata.source: "cache" or "wayback_live".
    """
    sample = min(max(sample, 1), 100)
    return get_youtube_cache_first(input_str=input_param, sample=sample)


@app.get("/api/wayback/youtube")
def wayback_youtube(
    input_param: str = Query(..., alias="input"),
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 40,
):
    """Return YouTube channel subscriber counts from Wayback archival snapshots."""
    sample = min(max(sample, 1), 100)
    return get_youtube_archival_metrics(
        input_str=input_param,
        from_year=from_year if from_year is not None else 2005,
        to_year=to_year if to_year is not None else 2026,
        from_date=from_date,
        to_date=to_date,
        sample=sample,
    )


def _require_db():
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL for job support.",
        )


class CreateInstagramJobBody(BaseModel):
    username: str
    from_year: Optional[int] = None
    to_year: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    sample: int = 30


class CreateYouTubeJobBody(BaseModel):
    input: str
    from_year: Optional[int] = None
    to_year: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    sample: int = 30


class CreateTwitterJobBody(BaseModel):
    username: str
    from_year: Optional[int] = None
    to_year: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    sample: int = 30


@app.get("/api/wayback/twitter")
def wayback_twitter(
    username: str = Query(..., description="Twitter handle: jack or @jack"),
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 40,
):
    """
    Return Twitter/X profile follower counts from Wayback archival snapshots.
    GET /api/wayback/twitter?username=jack&sample=20
    GET /api/wayback/twitter?username=@nytimes&sample=20
    """
    sample = min(max(sample, 1), 100)
    return get_twitter_archival_metrics(
        username=username,
        from_year=from_year if from_year is not None else 2009,
        to_year=to_year if to_year is not None else 2026,
        from_date=from_date,
        to_date=to_date,
        sample=sample,
    )


@app.post("/api/wayback/twitter/jobs")
def create_wayback_twitter_job(body: CreateTwitterJobBody, background_tasks: BackgroundTasks):
    """Start a Wayback Twitter fetch job. Returns immediately with job_id."""
    _require_db()
    job_id = create_twitter_job(
        username=body.username,
        from_year=body.from_year,
        to_year=body.to_year,
        from_date=body.from_date,
        to_date=body.to_date,
        sample=body.sample,
    )
    background_tasks.add_task(_run_twitter_job, job_id)
    return {"job_id": job_id, "status": "queued"}


@app.post("/api/wayback/youtube/jobs")
def create_wayback_youtube_job(body: CreateYouTubeJobBody, background_tasks: BackgroundTasks):
    """Start a Wayback YouTube fetch job. Returns immediately with job_id."""
    _require_db()
    job_id = create_youtube_job(
        input_str=body.input,
        from_year=body.from_year,
        to_year=body.to_year,
        from_date=body.from_date,
        to_date=body.to_date,
        sample=body.sample,
    )
    background_tasks.add_task(_run_youtube_job, job_id)
    return {"job_id": job_id, "status": "queued"}


@app.post("/api/wayback/instagram/jobs")
def create_wayback_instagram_job(body: CreateInstagramJobBody, background_tasks: BackgroundTasks):
    """Start a Wayback Instagram fetch job. Returns immediately with job_id."""
    _require_db()
    job_id = create_instagram_job(
        username=body.username,
        from_year=body.from_year,
        to_year=body.to_year,
        from_date=body.from_date,
        to_date=body.to_date,
        sample=body.sample,
    )
    background_tasks.add_task(_run_instagram_job, job_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/wayback/jobs/list")
def list_wayback_jobs(
    username: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 10,
):
    """List recent jobs, optionally filtered by username."""
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL for job support.",
        )
    try:
        jobs = list_jobs(username=username, platform=platform, limit=limit)
        return {"jobs": jobs}
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable.",
        )


@app.get("/api/wayback/jobs/{job_id}")
def get_wayback_job(job_id: str):
    """Get job status and results when completed."""
    _require_db()
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/wayback/jobs/{job_id}/results")
def get_wayback_job_results(job_id: str):
    """Get job results (snapshots)."""
    _require_db()
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    results = get_job_results(job_id)
    return {"job_id": job_id, "results": results}


@app.post("/api/wayback/jobs/{job_id}/cancel")
def cancel_wayback_job(job_id: str):
    """Cancel a queued or running job."""
    _require_db()
    if not cancel_job(job_id):
        raise HTTPException(status_code=400, detail="Job not found or not cancelable")
    return {"job_id": job_id, "status": "canceled"}


@app.delete("/api/wayback/jobs/{job_id}")
def delete_wayback_job(job_id: str):
    """Delete job and its results."""
    _require_db()
    if not delete_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "status": "deleted"}
