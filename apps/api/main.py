import os

from fastapi import FastAPI
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
