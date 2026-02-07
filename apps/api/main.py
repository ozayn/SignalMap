import os
from typing import Optional

from fastapi import FastAPI

from connectors.wayback import get_snapshots_with_metrics
from connectors.wayback_instagram import get_instagram_archival_metrics
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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
    sample: int = 30,
    include_evidence: bool = True,
    progress: bool = False,
):
    """Return Wayback archival snapshots for an Instagram profile."""
    sample = min(max(sample, 1), 50)
    return get_instagram_archival_metrics(
        username=username,
        from_year=from_year,
        to_year=to_year,
        sample=sample,
        include_evidence=include_evidence,
        progress=progress,
    )
