import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from pydantic import BaseModel

from fastapi import BackgroundTasks, FastAPI, HTTPException

from connectors.wayback import get_snapshots_with_metrics
from connectors.wayback_instagram import (
    get_instagram_archival_metrics,
    get_instagram_followers_time_series,
    list_snapshots,
    deduplicate_snapshots,
    evenly_sample_snapshots,
)
from fastapi.middleware.cors import CORSMiddleware

from db import init_tables
from jobs import (
    create_instagram_job,
    get_job,
    get_job_results,
    list_jobs,
    cancel_job,
    delete_job,
    _run_instagram_job,
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
            "wayback_instagram_jobs": "POST /api/wayback/instagram/jobs",
            "wayback_jobs_list": "GET /api/wayback/jobs/list",
            "wayback_job_status": "GET /api/wayback/jobs/{job_id}",
        },
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


OVERVIEW_STUB = {
    "study_id": "default",
    "study_title": "SignalMap Overview",
    "time_range": ["2024-01-01", "2024-08-31"],
    "kpis": [
        {"label": "Total interactions", "value": 2047, "unit": None},
        {"label": "Avg. sentiment", "value": 0.18, "unit": "score"},
        {"label": "Unique hashtags", "value": 14, "unit": None},
    ],
    "timeline": [
        {"date": "2024-01-01", "value": 0.15},
        {"date": "2024-01-15", "value": 0.22},
        {"date": "2024-02-01", "value": 0.19},
        {"date": "2024-02-15", "value": 0.31},
        {"date": "2024-03-01", "value": 0.25},
        {"date": "2024-03-15", "value": 0.28},
        {"date": "2024-04-01", "value": 0.12},
        {"date": "2024-04-15", "value": 0.08},
        {"date": "2024-05-01", "value": 0.14},
        {"date": "2024-05-15", "value": -0.05},
        {"date": "2024-06-01", "value": -0.12},
        {"date": "2024-06-15", "value": -0.08},
        {"date": "2024-07-01", "value": 0.05},
        {"date": "2024-07-15", "value": 0.18},
        {"date": "2024-08-01", "value": 0.22},
        {"date": "2024-08-15", "value": 0.19},
    ],
}


@app.get("/api/overview")
def get_overview(study_id: str = "1"):
    result = {**OVERVIEW_STUB, "study_id": study_id}
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
def list_wayback_jobs(username: Optional[str] = None, limit: int = 10):
    """List recent jobs, optionally filtered by username."""
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL for job support.",
        )
    try:
        jobs = list_jobs(username=username, limit=limit)
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
