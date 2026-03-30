import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# Allow signalmap package imports (apps/api/src/signalmap)
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from typing import Literal

from pydantic import BaseModel, Field

from fastapi import BackgroundTasks, Body, FastAPI, HTTPException, Query, Request

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
from signalmap.connectors.youtube import fetch_channel, test_youtube_api
from signalmap.services.comment_analysis import (
    analyze_comments,
    compute_cluster_labels_from_umap,
    compute_wordcloud_from_comments,
    load_cached_dataset,
    load_cached_snapshot,
    save_cached_snapshot,
)
from signalmap.sources.youtube_comments import get_channel_videos, get_video_comments
from signalmap.services.transcript_analysis import run_transcript_analysis_from_text
from signalmap.services.youtube_transcripts import (
    get_transcript_for_url,
    run_transcript_analysis_for_url,
)
from signalmap.utils.youtube_resolver import resolve_channel_id
from signalmap.connectors.wayback_twitter import get_twitter_archival_metrics

from db import (
    cursor,
    delete_youtube_comment_analysis,
    get_cached_youtube_comment_analysis,
    get_youtube_quota_usage_today,
    init_tables,
    save_youtube_comment_analysis,
)
from jobs import (
    cache_first_instagram,
    cache_first_twitter,
    cache_first_youtube,
    create_instagram_job,
    create_youtube_job,
    create_twitter_job,
    get_cached_youtube_channel_snapshots,
    get_job,
    get_job_results,
    list_jobs,
    cancel_job,
    delete_job,
    get_youtube_channel_cache_first,
    _run_instagram_job,
    _run_youtube_job,
    _run_twitter_job,
)


# --- Normalized cache-first response (research-grade, all platforms) ---
class CacheFirstSnapshot(BaseModel):
    """Single snapshot in cache-first response. timestamp is ISO-8601."""
    timestamp: str
    followers: Optional[int] = None
    snapshot_url: Optional[str] = None
    raw: Optional[dict] = None


class CacheFirstMeta(BaseModel):
    cache_hit: bool
    cache_rows: int
    wayback_calls: int
    rate_limited: bool = False
    notes: list[str] = Field(default_factory=list)
    last_cached_at: Optional[str] = None


class CacheFirstResponse(BaseModel):
    platform: Literal["instagram", "youtube", "twitter"]
    handle: str
    canonical_url: str
    source: Literal["cache", "live", "mixed"]
    snapshots: list[CacheFirstSnapshot] = Field(default_factory=list)
    meta: CacheFirstMeta


def resolve_handle(
    handle: Optional[str] = None,
    username: Optional[str] = None,
    input_param: Optional[str] = None,
) -> str:
    """
    Resolve platform-agnostic handle from query params.
    Precedence: handle > username (deprecated) > input (deprecated).
    Raises HTTPException 422 if none provided or empty after strip.
    """
    for val in (handle, username, input_param):
        if val is not None and (s := (val or "").strip()):
            return s
    raise HTTPException(
        status_code=422,
        detail="One of 'handle', 'username', or 'input' is required (prefer 'handle').",
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
            "youtube_transcript": "POST /api/youtube/transcript",
            "youtube_transcript_analyze": "POST /api/youtube/transcript/analyze",
            "transcript_analyze_text": "POST /api/transcript/analyze-text",
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


@app.get("/api/market/brent-current")
def api_market_brent_current():
    """Return latest Brent crude market price (FMP). Cached 1 hour."""
    from signalmap.services.signals import get_current_brent_price
    result = get_current_brent_price()
    if result is None:
        raise HTTPException(status_code=503, detail="Market price unavailable")
    return result


@app.get("/api/meta/last-update")
def api_meta_last_update():
    """Return when the cron update last ran. UTC ISO string."""
    from db import get_data_update
    last = get_data_update("global_update")
    return {"last_updated": last}


@app.post("/api/cron/daily-update")
def cron_daily_update():
    """Append-only daily update for macro signals (brent, fx_usd_toman, gold).
    Safe to run multiple times per day. Fetches only missing dates."""
    from datetime import datetime
    from signalmap.services.daily_updates import (
        update_brent_prices,
        update_fx_usd_toman,
        update_gold_prices,
    )

    updated = {}
    for name, fn in [
        ("brent", update_brent_prices),
        ("fx", update_fx_usd_toman),
        ("gold", update_gold_prices),
    ]:
        try:
            updated[name] = fn()
        except Exception as e:
            updated[name] = {"rows_added": 0, "start_date": None, "end_date": None, "error": str(e)}

    return {
        "updated": updated,
        "run_timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@app.post("/api/cron/update-all")
def cron_update_all():
    """Unified daily update for all time-varying data sources.
    Safe to run multiple times. Fetches only missing data, never overwrites."""
    from signalmap.services.daily_updates import update_all_data_sources
    return update_all_data_sources()


@app.post("/api/cron/update-oil-trade")
def cron_update_oil_trade():
    """Update oil trade network from UN Comtrade. Idempotent; fetches only missing years.
    Trigger manually for production: curl -X POST https://your-api.up.railway.app/api/cron/update-oil-trade"""
    from signalmap.services.daily_updates import update_oil_trade_network
    return update_oil_trade_network()


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
        if "opec_decisions" in layer_list:
            opec_count = sum(1 for e in events if e.get("layer") == "opec_decisions")
            import sys
            print(f"[events] layers={layer_list} study_id={study_id} events={len(events)} opec={opec_count}", file=sys.stderr)
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


@app.get("/api/signals/oil/production-exporters")
def get_oil_production_exporters_signal(
    start: str | None = Query(None, description="Start date YYYY-MM-DD"),
    end: str | None = Query(None, description="End date YYYY-MM-DD"),
    nocache: bool = Query(False, description="Bypass cache for debugging"),
):
    """Return oil production for Saudi Arabia, Russia, Iran (million barrels/day)."""
    if start is None:
        start = "2000-01-01"
    if end is None:
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_oil_production_exporters_series
        result = get_oil_production_exporters_series(start, end, nocache=nocache)
        out = {"data": result["data"], "source": result.get("source"), "unit": result.get("unit")}
        if result.get("_debug"):
            out["_debug"] = result["_debug"]
        return out
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


def _oil_trade_fallback(start_year: int, end_year: int) -> dict:
    """Curated fallback when oil_trade_network service unavailable."""
    try:
        from signalmap.data.oil_trade_curated import get_curated_years
        return {"years": get_curated_years(start_year, end_year)}
    except Exception:
        fb = {
            "2018": [{"source": "Russia", "target": "EU", "value": 1500}, {"source": "Saudi Arabia", "target": "China", "value": 1100}],
            "2023": [{"source": "Russia", "target": "India", "value": 1600}, {"source": "United States", "target": "EU", "value": 900}],
        }
        return {"years": {k: v for k, v in fb.items() if start_year <= int(k) <= end_year}}


@app.get("/api/networks/oil-trade")
def api_oil_trade_network(
    start_year: int = Query(2010, description="Start year"),
    end_year: int | None = Query(default=None, description="End year (default: current year)"),
    source: str = Query("curated", description="curated or db (full ingested data)"),
):
    """Return bilateral crude oil trade flows (HS 2709) by year. source=curated|db."""
    if end_year is None:
        end_year = datetime.now().year
    if start_year > end_year:
        start_year, end_year = end_year, start_year
    try:
        from signalmap.services.oil_trade_network import get_oil_trade_network
        return get_oil_trade_network(start_year=start_year, end_year=end_year, source=source or "curated")
    except Exception as e:
        try:
            return _oil_trade_fallback(start_year, end_year)
        except Exception:
            raise HTTPException(status_code=502, detail=f"Oil trade fetch failed: {e}")


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


@app.get("/api/signals/fx/usd-irr-dual")
def get_usd_irr_dual_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return official (FRED proxy) and open-market USD/IRR for dual exchange rate study."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_usd_irr_dual_series
        return get_usd_irr_dual_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


@app.get("/api/signals/wage/iran-minimum-cpi")
def get_iran_wage_cpi_signal(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return Iran nominal minimum wage and CPI (annual) for real wage study."""
    if not _validate_date(start) or not _validate_date(end):
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    try:
        from signalmap.services.signals import get_iran_wage_cpi_series
        return get_iran_wage_cpi_series(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Signal fetch failed: {e}")


def _today_iso() -> str:
    from datetime import date
    return date.today().strftime("%Y-%m-%d")


@app.get("/api/overview")
def get_overview(
    study_id: str = "1",
    anchor_event_id: Optional[str] = None,
    window_days: Optional[int] = None,
):
    """Return study overview. Optionally filter by event-centered window."""
    result = {**OVERVIEW_STUB, "study_id": study_id}
    result["time_range"] = ["2021-01-15", _today_iso()]
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
            result["time_range"] = ["2021-01-15", _today_iso()]
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
    from jobs import get_cached_instagram_snapshots
    cached = get_cached_instagram_snapshots(username)
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached data for this username")
    return cached


@app.get("/api/wayback/instagram/cache-first")
def wayback_instagram_cache_first(
    handle: Optional[str] = Query(None, description="Platform-agnostic handle (preferred)"),
    username: Optional[str] = Query(None, description="Deprecated: use handle"),
    input_param: Optional[str] = Query(None, alias="input", description="Deprecated: use handle"),
    force_live: bool = Query(False, description="Force one live fetch and upsert"),
    limit: Optional[int] = Query(None, description="Cap on snapshots returned / fetched"),
):
    """
    Cache-first: return cache only unless force_live or cache empty. One live batch max.
    Normalized response: platform, handle, canonical_url, source, snapshots, meta.
    """
    h = resolve_handle(handle=handle, username=username, input_param=input_param)
    return cache_first_instagram(handle=h, force_live=force_live, limit=limit)


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
    from jobs import get_cached_youtube_snapshots
    cached = get_cached_youtube_snapshots(input_param)
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached data for this input")
    return cached


@app.get("/api/wayback/youtube/cache-first")
def wayback_youtube_cache_first(
    handle: Optional[str] = Query(None, description="Platform-agnostic handle (preferred)"),
    username: Optional[str] = Query(None, description="Deprecated: use handle"),
    input_param: Optional[str] = Query(None, alias="input", description="Deprecated: use handle"),
    force_live: bool = Query(False, description="Force one live fetch and upsert"),
    limit: Optional[int] = Query(None, description="Cap on snapshots returned / fetched"),
):
    """
    Cache-first: return cache only unless force_live or cache empty. One live batch max.
    Normalized response: platform, handle, canonical_url, source, snapshots, meta.
    """
    h = resolve_handle(handle=handle, username=username, input_param=input_param)
    return cache_first_youtube(handle=h, force_live=force_live, limit=limit)


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


@app.get("/api/wayback/twitter/cache-first")
def wayback_twitter_cache_first(
    handle: Optional[str] = Query(None, description="Platform-agnostic handle (preferred)"),
    username: Optional[str] = Query(None, description="Deprecated: use handle"),
    input_param: Optional[str] = Query(None, alias="input", description="Deprecated: use handle"),
    force_live: bool = Query(False, description="Force one live fetch and upsert"),
    limit: Optional[int] = Query(None, description="Cap on snapshots returned / fetched"),
):
    """
    Cache-first: return cache only unless force_live or cache empty. One live batch max.
    Normalized response: platform, handle, canonical_url, source, snapshots, meta.
    """
    h = resolve_handle(handle=handle, username=username, input_param=input_param)
    return cache_first_twitter(handle=h, force_live=force_live, limit=limit)


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


# --- YouTube Data API v3 channel (cache-first + job) ---

# When set, only requests that send header X-Youtube-Api-Secret: <this value> can trigger live YouTube API calls.
YOUTUBE_API_ALLOWED_SECRET = (os.getenv("YOUTUBE_API_ALLOWED_SECRET") or "").strip()
# Set to 1 or true to disable the secret check (e.g. for local testing).
YOUTUBE_API_SECRET_CHECK_DISABLED = (os.getenv("YOUTUBE_API_SECRET_CHECK_DISABLED") or "").strip().lower() in ("1", "true", "yes")


def _require_youtube_live_secret(request: Request) -> None:
    """Raise 403 if YOUTUBE_API_ALLOWED_SECRET is set and request does not send a matching secret."""
    if YOUTUBE_API_SECRET_CHECK_DISABLED or not YOUTUBE_API_ALLOWED_SECRET:
        return
    secret = (request.headers.get("X-Youtube-Api-Secret") or "").strip()
    if secret != YOUTUBE_API_ALLOWED_SECRET:
        raise HTTPException(
            status_code=403,
            detail="YouTube API access restricted. Set X-Youtube-Api-Secret header to use live channel data.",
        )


def _youtube_channel_cache_response(cache_rows: list, handle: Optional[str], channel_id: Optional[str], limit: int):
    """Build the same response shape as get_youtube_channel_cache_first for cache-only."""
    if not cache_rows:
        return None
    snapshots = [
        {
            "captured_at": r["captured_at"].isoformat() if hasattr(r["captured_at"], "isoformat") else str(r["captured_at"]),
            "subscribers": r.get("subscriber_count"),
            "views": r.get("view_count"),
            "videos": r.get("video_count"),
        }
        for r in cache_rows
    ]
    return {
        "platform": "youtube",
        "handle": (cache_rows[0].get("channel_handle") or handle or ""),
        "channel_id": (cache_rows[0].get("channel_id") or channel_id or ""),
        "source": "cache",
        "snapshots": snapshots,
        "meta": {"cache_rows": len(cache_rows), "api_calls": 0, "notes": []},
    }


@app.get("/api/youtube/quota")
def youtube_quota():
    """
    Return today's YouTube API quota usage. Quota resets at midnight Pacific Time.
    Returns units_used, limit (10000), remaining, usage_date_pt, last_updated.
    """
    return get_youtube_quota_usage_today()


@app.get("/api/youtube/debug")
def youtube_debug(handle: str = Query("googledevelopers", description="Channel handle to test")):
    """
    Debug: verify YouTube API key and call channels.list.
    Returns api_key_detected, channel stats, or error message.
    """
    return test_youtube_api(handle=handle)


@app.get("/api/youtube/resolve")
def youtube_resolve(identifier: str = Query(..., description="Handle, URL, or channel ID")):
    """Resolve a YouTube identifier to canonical channel ID."""
    try:
        cid = resolve_channel_id(identifier)
        return {"identifier": identifier, "channel_id": cid}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


class YouTubeTranscriptRequestBody(BaseModel):
    url: str = Field(..., min_length=5, description="YouTube video URL")


class YouTubeTranscriptResponseBody(BaseModel):
    video_id: str
    title: Optional[str] = None
    language: Optional[str] = None
    transcript_text: str
    segments: list[dict[str, Any]]
    chunks: list[dict[str, Any]]
    cached: bool
    fallback_used: bool = Field(
        default=False,
        description="True when a non-requested caption language was used (see YOUTUBE_TRANSCRIPT_LANGUAGE_FALLBACK).",
    )


@app.post("/api/youtube/transcript", response_model=YouTubeTranscriptResponseBody)
def api_youtube_transcript(body: YouTubeTranscriptRequestBody):
    """
    Fetch YouTube captions (joined text, raw segments, and time-window chunks). Cache-first by video_id in Postgres.
    """
    data = get_transcript_for_url(body.url)
    return YouTubeTranscriptResponseBody(
        video_id=data["video_id"],
        title=data.get("title"),
        language=data.get("language"),
        transcript_text=data["transcript_text"],
        segments=data["segments"],
        chunks=data.get("chunks") or [],
        cached=bool(data.get("_cached")),
        fallback_used=bool(data.get("fallback_used")),
    )


class YouTubeTranscriptAnalyzeRequestBody(BaseModel):
    url: str = Field(..., min_length=5, description="YouTube video URL")
    mode: Literal["frames", "fallacies", "summarize_llm", "speaker_guess_llm"] = Field(
        ...,
        description=(
            "Analysis mode. For fallacies, use ``method`` to pick heuristic / classifier / llm. "
            "summarize_llm and speaker_guess_llm require GROQ_API_KEY (experimental)."
        ),
    )
    method: Literal["heuristic", "classifier", "llm"] = Field(
        default="heuristic",
        description=(
            "When mode is fallacies: fallacy detection method (with transcript language). "
            "Heuristic: English only. LLM: English or Persian prompts. Ignored for other modes."
        ),
    )


class YouTubeTranscriptAnalyzeResponseBody(BaseModel):
    video_id: str
    title: Optional[str] = None
    language: Optional[str] = None
    cached: bool
    chunks: list[dict[str, Any]]  # labels, label_matches; fallacies adds label_strengths
    summary: dict[str, int] = Field(
        default_factory=dict,
        description="Fallacies modes: chunk counts per fallacy label (non-zero only); empty for other modes.",
    )
    fallback_used: bool = Field(
        default=False,
        description="True when transcript used a non-requested caption language.",
    )
    analysis_supported: bool = Field(
        default=True,
        description=(
            "False when the mode/method/language combination is not implemented "
            "(e.g. Persian heuristic fallacies, or non-English frame keywords)."
        ),
    )
    analysis_note: Optional[str] = Field(
        default=None,
        description="Human-readable reason when analysis_supported is false or LLM caveats apply.",
    )
    llm_summarize: Optional[dict[str, Any]] = Field(
        default=None,
        description="summarize_llm only: summary_short, summary_bullets, main_topics.",
    )
    speaker_blocks: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="speaker_guess_llm only: approximate speaker segments (not diarization).",
    )
    method: Optional[Literal["heuristic", "classifier", "llm"]] = Field(
        default=None,
        description="When the request used mode fallacies: which fallacy method was selected.",
    )


@app.post("/api/youtube/transcript/analyze", response_model=YouTubeTranscriptAnalyzeResponseBody)
def api_youtube_transcript_analyze(body: YouTubeTranscriptAnalyzeRequestBody):
    """
    Experimental chunk-level transcript analysis (playground). Reuses fetch + chunking.
    Language is taken from the fetched transcript; routing is mode × method × language
    (e.g. Persian heuristic fallacies are not run; LLM fallacies use a Persian prompt when applicable).
    For ``mode=fallacies``, ``method`` selects heuristic, classifier (placeholder), or llm (Groq).
    ``summarize_llm`` and ``speaker_guess_llm`` require ``GROQ_API_KEY`` and are prototypes only.
    """
    data = run_transcript_analysis_for_url(
        body.url,
        body.mode,
        fallacy_method=body.method,
    )
    return YouTubeTranscriptAnalyzeResponseBody(
        video_id=data["video_id"],
        title=data.get("title"),
        language=data.get("language"),
        cached=bool(data.get("cached")),
        chunks=data.get("chunks") or [],
        summary=data.get("summary") or {},
        fallback_used=bool(data.get("fallback_used")),
        analysis_supported=bool(data.get("analysis_supported", True)),
        analysis_note=data.get("analysis_note"),
        llm_summarize=data.get("llm_summarize"),
        speaker_blocks=data.get("speaker_blocks"),
        method=data.get("method"),
    )


class TranscriptAnalyzeTextRequestBody(BaseModel):
    text: str = Field(..., min_length=1, description="Raw transcript text to analyze")
    mode: Literal["fallacies", "frames", "summarize_llm", "speaker_guess_llm"] = Field(
        default="fallacies",
        description="Analysis mode; for fallacies use ``method``; LLM modes require GROQ_API_KEY.",
    )
    method: Literal["heuristic", "classifier", "llm"] = Field(
        default="heuristic",
        description=(
            "When mode is fallacies: fallacy detection method (with transcript language). "
            "Heuristic: English only. LLM: English or Persian prompts. Ignored for other modes."
        ),
    )
    language: str = Field(
        default="en",
        description=(
            "Transcript language hint (e.g. en, fa, fa-IR). Gates heuristic rules; "
            "LLM fallacy mode uses English or Persian system prompts accordingly."
        ),
    )


@app.post("/api/transcript/analyze-text", response_model=YouTubeTranscriptAnalyzeResponseBody)
def api_transcript_analyze_text(body: TranscriptAnalyzeTextRequestBody):
    """
    Chunk pasted transcript text and run the same analysis modes as
    ``/api/youtube/transcript/analyze`` without fetching from YouTube.
    """
    data = run_transcript_analysis_from_text(
        body.text,
        body.mode,
        body.language,
        fallacy_method=body.method,
    )
    return YouTubeTranscriptAnalyzeResponseBody(
        video_id=data["video_id"],
        title=data.get("title"),
        language=data.get("language"),
        cached=bool(data.get("cached")),
        chunks=data.get("chunks") or [],
        summary=data.get("summary") or {},
        fallback_used=bool(data.get("fallback_used")),
        analysis_supported=bool(data.get("analysis_supported", True)),
        analysis_note=data.get("analysis_note"),
        llm_summarize=data.get("llm_summarize"),
        speaker_blocks=data.get("speaker_blocks"),
        method=data.get("method"),
    )


@app.get("/api/youtube/channel/videos")
def youtube_channel_videos(
    identifier: Optional[str] = Query(
        None,
        description="Handle, URL, or channel ID (resolved to channel_id)",
    ),
    channel_id: Optional[str] = Query(
        None,
        description="YouTube channel ID (use if already known; overrides identifier)",
    ),
    max_results: int = Query(10, ge=1, le=50, description="Max videos to return"),
):
    """Fetch recent videos from a YouTube channel."""
    try:
        if channel_id and channel_id.strip():
            cid = channel_id.strip()
        elif identifier and identifier.strip():
            cid = resolve_channel_id(identifier.strip())
        else:
            cid = resolve_channel_id("UCQwB6D0tO3oN7RZc7cVh5XQ")
        videos = get_channel_videos(cid, max_results)
        return {
            "channel_id": cid,
            "videos_found": len(videos),
            "videos": videos,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/youtube/video/comments")
def youtube_video_comments(
    video_id: str = Query(..., description="YouTube video ID"),
    max_results: int = Query(50, ge=1, le=100, description="Max comments to return"),
):
    """Fetch top-level comments for a YouTube video."""
    try:
        comments = get_video_comments(video_id, max_results)
        return {
            "video_id": video_id,
            "comments_found": len(comments),
            "comments": comments,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/youtube/channel/comments")
def youtube_channel_comments(
    channel_id: Optional[str] = Query(None, description="YouTube channel ID"),
    identifier: Optional[str] = Query(None, description="Handle, URL, or channel ID (resolved to channel_id)"),
    videos_limit: int = Query(10, ge=1, le=50, description="Max videos to analyze"),
    comments_per_video: int = Query(50, ge=1, le=100, description="Max comments per video"),
):
    """Collect comments from the most recent videos of a channel."""
    try:
        if channel_id and channel_id.strip():
            cid = channel_id.strip()
        elif identifier and identifier.strip():
            cid = resolve_channel_id(identifier.strip())
        else:
            raise HTTPException(status_code=422, detail="Either channel_id or identifier is required.")

        videos = get_channel_videos(cid, max_results=videos_limit)

        all_comments = []
        for v in videos:
            video_id = v["video_id"]
            try:
                comments = get_video_comments(video_id, comments_per_video)
            except RuntimeError:
                continue
            for c in comments:
                c["video_title"] = v["title"]
                c["video_published_at"] = v["published_at"]
            all_comments.extend(comments)

        return {
            "channel_id": cid,
            "videos_analyzed": len(videos),
            "total_comments": len(all_comments),
            "comments": all_comments,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _run_youtube_comment_analysis(
    cid: str,
    videos_limit: int = 10,
    comments_per_video: int = 30,
) -> dict:
    """Fetch comments, run analysis, save to cache, return result. Does not check cache."""
    videos = get_channel_videos(cid, max_results=videos_limit)

    def fetch_for_video(v):
        try:
            comments = get_video_comments(v["video_id"], comments_per_video)
            for c in comments:
                c["video_title"] = v["title"]
            return comments
        except RuntimeError:
            return []

    all_comments = []
    with ThreadPoolExecutor(max_workers=max(1, min(8, len(videos)))) as ex:
        for result in ex.map(fetch_for_video, videos):
            all_comments.extend(result)

    analysis = analyze_comments(all_comments, channel_id=cid)

    channel_name = ""
    channel_owner = ""
    try:
        ch_data = fetch_channel(channel_id=cid)
        snippet = (ch_data.get("raw") or {}).get("snippet") or {}
        full_title = (snippet.get("title") or "").strip()
        if "(" in full_title and ")" in full_title:
            paren = full_title.rfind("(")
            channel_name = full_title[:paren].strip()
            channel_owner = full_title[paren + 1 : full_title.rfind(")")].strip()
        else:
            channel_name = full_title
    except Exception:
        pass

    time_range_start = None
    time_range_end = None
    if videos:
        dates = []
        for v in videos:
            pt = v.get("published_at")
            if pt and isinstance(pt, str):
                try:
                    dt = datetime.fromisoformat(pt.replace("Z", "+00:00"))
                    dates.append(dt)
                except Exception:
                    pass
        if dates:
            time_range_start = min(dates).strftime("%b %d %Y")
            time_range_end = max(dates).strftime("%b %d %Y")

    videos_list = [
        {"title": v.get("title", ""), "published_at": v.get("published_at", ""), "video_id": v.get("video_id", "")}
        for v in videos
    ]

    result = {
        "channel_id": cid,
        "channel_name": channel_name or None,
        "channel_owner": channel_owner or None,
        "channel_title": channel_name or None,
        "videos_analyzed": len(videos),
        "videos": videos_list,
        "comments_analyzed": len(all_comments),
        "total_comments": len(all_comments),
        "time_range": {"start": time_range_start, "end": time_range_end},
        "time_period_start": time_range_start,
        "time_period_end": time_range_end,
        "language": "English" if analysis.get("language") == "en" else "Persian",
        "avg_sentiment": analysis["avg_sentiment"],
        "top_words": analysis["top_words"],
        "keywords": analysis.get("keywords", analysis["top_words"]),
        "narrative_phrases": analysis.get("narrative_phrases", []),
        "topics": analysis["topics"],
        "trigrams": analysis.get("trigrams", []),
        "bigrams_pmi": analysis.get("bigrams_pmi", []),
        "trigrams_pmi": analysis.get("trigrams_pmi", []),
        "discourse_comments": analysis.get("discourse_comments", []),
        "points_pca": analysis["points_pca"],
        "points_umap": analysis["points_umap"],
        "points_tfidf": analysis.get("points_tfidf", analysis.get("points_umap", [])),
        "points_hdbscan": analysis.get("points_hdbscan", analysis.get("points_umap", [])),
        "points_minilm": analysis.get("points_minilm", []),
        "cluster_labels": analysis.get("cluster_labels", []),
        "cluster_labels_pca": analysis.get("cluster_labels_pca", []),
        "cluster_labels_tfidf": analysis.get("cluster_labels_tfidf", analysis.get("cluster_labels", [])),
        "cluster_labels_hdbscan": analysis.get("cluster_labels_hdbscan", []),
        "cluster_labels_minilm": analysis.get("cluster_labels_minilm", []),
        "cluster_assignments_pca": analysis.get("cluster_assignments_pca", []),
        "cluster_assignments_tfidf": analysis.get("cluster_assignments_tfidf", []),
        "cluster_assignments_hdbscan": analysis.get("cluster_assignments_hdbscan", []),
        "cluster_assignments_minilm": analysis.get("cluster_assignments_minilm", []),
        "cluster_stats_pca": analysis.get("cluster_stats_pca", {}),
        "cluster_stats_tfidf": analysis.get("cluster_stats_tfidf", {}),
        "cluster_stats_hdbscan": analysis.get("cluster_stats_hdbscan", {}),
        "cluster_stats_minilm": analysis.get("cluster_stats_minilm", {}),
        "clusters_summary_pca": analysis.get("clusters_summary_pca", []),
        "clusters_summary_tfidf": analysis.get("clusters_summary_tfidf", []),
        "clusters_summary_hdbscan": analysis.get("clusters_summary_hdbscan", []),
        "clusters_summary_minilm": analysis.get("clusters_summary_minilm", []),
        "comments": analysis["comments"],
    }

    save_youtube_comment_analysis(
        channel_id=cid,
        analysis=result,
        videos_analyzed=len(videos),
        comments_analyzed=len(all_comments),
    )

    result["computed_at"] = datetime.now(timezone.utc).isoformat()

    # Also persist to file cache so we avoid re-using API quota when DB isn't available
    save_cached_snapshot(cid, result)

    return result


class RefreshAnalysisBody(BaseModel):
    channel_id: str


@app.post("/api/youtube/channel/refresh-analysis")
def youtube_channel_refresh_analysis(body: RefreshAnalysisBody):
    """Delete cached analysis, run fresh analysis, store and return new result."""
    try:
        cid = (body.channel_id or "").strip()
        if not cid:
            raise HTTPException(status_code=422, detail="channel_id is required.")

        delete_youtube_comment_analysis(cid)
        result = _run_youtube_comment_analysis(cid, videos_limit=10, comments_per_video=30)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _recompute_from_cached_dataset(cache_dict: dict, cid: str) -> dict | None:
    """
    Load comments from cache and recompute embeddings and clustering.
    Does NOT use cached cluster labels. Always recomputes labels from comments.
    """
    # Strip cluster labels from cache so we never accidentally use them
    for key in (
        "cluster_labels", "cluster_labels_pca", "cluster_labels_tfidf", "cluster_labels_hdbscan", "cluster_labels_minilm",
        "clusters_summary_pca", "clusters_summary_tfidf", "clusters_summary_hdbscan", "clusters_summary_minilm",
    ):
        cache_dict.pop(key, None)

    dataset = load_cached_dataset(cache_dict)
    if not dataset or not dataset.get("comments"):
        return None
    comments = dataset["comments"]
    videos = dataset.get("videos", [])
    log.info("Recomputing cluster labels from cached comments (channel=%s, n=%d)", cid, len(comments))
    analysis = analyze_comments(comments, channel_id=cid)
    return {
        "channel_id": cid,
        "channel_name": cache_dict.get("channel_name"),
        "channel_owner": cache_dict.get("channel_owner"),
        "channel_title": cache_dict.get("channel_title"),
        "videos_analyzed": cache_dict.get("videos_analyzed", len(videos)),
        "videos": cache_dict.get("videos", videos),
        "comments_analyzed": len(comments),
        "total_comments": len(comments),
        "time_range": cache_dict.get("time_range"),
        "time_period_start": cache_dict.get("time_period_start"),
        "time_period_end": cache_dict.get("time_period_end"),
        "language": "English" if analysis.get("language") == "en" else "Persian",
        "avg_sentiment": analysis["avg_sentiment"],
        "top_words": analysis["top_words"],
        "keywords": analysis.get("keywords", analysis["top_words"]),
        "narrative_phrases": analysis.get("narrative_phrases", []),
        "topics": analysis["topics"],
        "trigrams": analysis.get("trigrams", []),
        "bigrams_pmi": analysis.get("bigrams_pmi", []),
        "trigrams_pmi": analysis.get("trigrams_pmi", []),
        "discourse_comments": analysis.get("discourse_comments", []),
        "points_pca": analysis["points_pca"],
        "points_umap": analysis["points_umap"],
        "points_tfidf": analysis.get("points_tfidf", analysis.get("points_umap", [])),
        "points_hdbscan": analysis.get("points_hdbscan", analysis.get("points_umap", [])),
        "points_minilm": analysis.get("points_minilm", []),
        "cluster_labels": analysis.get("cluster_labels", []),
        "cluster_labels_pca": analysis.get("cluster_labels_pca", []),
        "cluster_labels_tfidf": analysis.get("cluster_labels_tfidf", analysis.get("cluster_labels", [])),
        "cluster_labels_hdbscan": analysis.get("cluster_labels_hdbscan", []),
        "cluster_labels_minilm": analysis.get("cluster_labels_minilm", []),
        "cluster_assignments_pca": analysis.get("cluster_assignments_pca", []),
        "cluster_assignments_tfidf": analysis.get("cluster_assignments_tfidf", []),
        "cluster_assignments_hdbscan": analysis.get("cluster_assignments_hdbscan", []),
        "cluster_assignments_minilm": analysis.get("cluster_assignments_minilm", []),
        "cluster_stats_pca": analysis.get("cluster_stats_pca", {}),
        "cluster_stats_tfidf": analysis.get("cluster_stats_tfidf", {}),
        "cluster_stats_hdbscan": analysis.get("cluster_stats_hdbscan", {}),
        "cluster_stats_minilm": analysis.get("cluster_stats_minilm", {}),
        "clusters_summary_pca": analysis.get("clusters_summary_pca", []),
        "clusters_summary_tfidf": analysis.get("clusters_summary_tfidf", []),
        "clusters_summary_hdbscan": analysis.get("clusters_summary_hdbscan", []),
        "clusters_summary_minilm": analysis.get("clusters_summary_minilm", []),
        "comments": analysis["comments"],
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/youtube/channel/comment-analysis")
def youtube_channel_comment_analysis(
    channel_id: Optional[str] = Query(None, description="YouTube channel ID"),
    identifier: Optional[str] = Query(None, description="Handle, URL, or channel ID (resolved to channel_id)"),
    videos_limit: int = Query(10, ge=1, le=50, description="Max videos to analyze"),
    comments_per_video: int = Query(30, ge=1, le=100, description="Max comments per video"),
    refresh: bool = Query(False, description="If true, delete cache and fetch fresh from YouTube (uses API quota)"),
    recompute: bool = Query(False, description="If true, recompute labels from cached comments (slow)"),
    recompute_wordcloud: bool = Query(False, description="If true, recompute only word cloud from cached comments (fast; keeps plots)"),
    admin_code: Optional[str] = Query(None, description="Required when refresh=1 if YOUTUBE_REFRESH_CODE is set"),
):
    """Collect comments from recent videos of a YouTube channel and run analysis.
    Cache-first: when cached, returns immediately unless recompute=1. Recompute only when explicitly requested."""
    try:
        if channel_id and channel_id.strip():
            cid = channel_id.strip()
        elif identifier and identifier.strip():
            cid = resolve_channel_id(identifier.strip())
        else:
            raise HTTPException(status_code=422, detail="Either channel_id or identifier is required.")

        # If refresh=1: require YOUTUBE_REFRESH_CODE to be set and admin_code to match (protects quota)
        if refresh:
            expected = os.environ.get("YOUTUBE_REFRESH_CODE")
            if not expected or (not admin_code or (admin_code or "").strip() != expected):
                raise HTTPException(status_code=403, detail="Admin code required to refresh from YouTube.")
            delete_youtube_comment_analysis(cid)
            return _run_youtube_comment_analysis(cid, videos_limit, comments_per_video)

        # Try DB cache
        cache = get_cached_youtube_comment_analysis(cid)
        if cache:
            cache_dict = dict(cache["analysis_json"])
            cache_dict["videos_analyzed"] = cache["videos_analyzed"]
            cache_dict["comments_analyzed"] = cache["comments_analyzed"]
            if not recompute and not recompute_wordcloud:
                # Return cached result immediately (fast)
                return cache_dict
            if recompute_wordcloud and not recompute:
                # Recompute only word cloud; keep cached plots
                comments = cache_dict.get("comments", [])
                if comments:
                    wc = compute_wordcloud_from_comments(comments, cid)
                    cache_dict.update(wc)
                return cache_dict
            out = _recompute_from_cached_dataset(cache_dict, cid)
            if out:
                out["videos_analyzed"] = cache["videos_analyzed"]
                out["comments_analyzed"] = cache["comments_analyzed"]
                save_youtube_comment_analysis(cid, out, cache["videos_analyzed"], cache["comments_analyzed"])
                save_cached_snapshot(cid, out)
                return out

        # Try file cache
        snapshot = load_cached_snapshot(cid)
        if snapshot:
            if not recompute and not recompute_wordcloud:
                # Return cached result immediately (fast)
                return snapshot
            if recompute_wordcloud and not recompute:
                # Recompute only word cloud; keep cached plots
                comments = snapshot.get("comments", [])
                if comments:
                    wc = compute_wordcloud_from_comments(comments, cid)
                    snapshot = dict(snapshot)
                    snapshot.update(wc)
                return snapshot
            out = _recompute_from_cached_dataset(snapshot, cid)
            if out:
                v = snapshot.get("videos_analyzed", 0)
                c = snapshot.get("comments_analyzed", 0)
                save_youtube_comment_analysis(cid, out, v, c)
                save_cached_snapshot(cid, out)
                return out

        # No cache: fetch from YouTube (no admin required for initial setup of new channels)
        return _run_youtube_comment_analysis(cid, videos_limit, comments_per_video)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Comment analysis failed: {e}")


@app.get("/api/youtube/channel/cache-first")
def youtube_channel_cache_first(
    request: Request,
    handle: Optional[str] = Query(None),
    channel_id: Optional[str] = Query(None),
    force_live: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
):
    """Cache-first channel snapshots (subscriber/view/video counts). Prefer handle; channel_id optional."""
    h = (handle or "").strip() or None
    cid = (channel_id or "").strip() or None
    if not h and not cid:
        raise HTTPException(status_code=422, detail="Either handle or channel_id is required.")
    limit = min(max(limit, 1), 100)
    cache_rows = get_cached_youtube_channel_snapshots(channel_id=cid, handle=h, limit=limit)
    if cache_rows and not force_live:
        out = _youtube_channel_cache_response(cache_rows, h, cid, limit)
        if out:
            return out
    _require_youtube_live_secret(request)
    try:
        return get_youtube_channel_cache_first(
            handle=h,
            channel_id=cid,
            force_live=force_live,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


class YouTubeChannelJobBody(BaseModel):
    handle: Optional[str] = None
    channel_id: Optional[str] = None


@app.post("/api/youtube/channel/jobs")
def create_youtube_channel_job(
    request: Request,
    handle: Optional[str] = Query(None),
    channel_id: Optional[str] = Query(None),
    force_live: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    body: Optional[YouTubeChannelJobBody] = Body(None),
):
    """
    Fetch channel snapshot (same logic as cache-first). Query params preferred; optional body for backward compat.
    Returns the same normalized shape as GET /api/youtube/channel/cache-first.
    Example: curl -X POST "http://localhost:8000/api/youtube/channel/jobs?handle=googledevelopers"
    """
    _require_youtube_live_secret(request)
    # Prefer query params; fall back to body if provided
    h = (handle or (body.handle if body else None) or "").strip() or None
    cid = (channel_id or (body.channel_id if body else None) or "").strip() or None
    if not h and not cid:
        raise HTTPException(status_code=422, detail="Either handle or channel_id is required (query or body).")
    try:
        return get_youtube_channel_cache_first(
            handle=h,
            channel_id=cid,
            force_live=force_live,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


# --- YouTube comments word cloud (observational, descriptive only) ---

@app.get("/api/youtube/comments/wordcloud")
def youtube_comments_wordcloud(
    channel_id: str = Query(..., description="YouTube channel ID"),
    window_start: str = Query(..., description="Window start (ISO date or datetime)"),
    window_end: str = Query(..., description="Window end (ISO date or datetime)"),
    by: str = Query("published_at", description="Window by: published_at (when comment was posted) | captured_at (when we ingested)"),
    top_n: int = Query(80, ge=1, le=200),
    channel_terms: Optional[str] = Query(None, description="Comma-separated terms to exclude (e.g. bplus,podcast)"),
):
    """
    Word frequencies from comment text in the given window. Observational only; no topic or sentiment.
    Returns { items: [{ token, count }], window_start, window_end }.
    Sample channel UC-test-wordcloud works without DB (in-memory fallback).
    """
    terms = None
    if channel_terms:
        terms = {t.strip().lower() for t in channel_terms.split(",") if t.strip()}
    cid = channel_id.strip()
    from signalmap.services.comment_wordcloud import (
        BPLUS_HANDLE_NORMALIZED,
        BPLUS_SAMPLE_COMMENTS,
        SAMPLE_CHANNEL_ID,
        SAMPLE_COMMENTS_FALLBACK,
        get_wordcloud_data,
        get_wordcloud_data_from_texts,
        _normalize_handle_for_fallback,
    )
    # Sample channel: serve from memory when DB not configured or has no rows
    if cid == SAMPLE_CHANNEL_ID and not os.getenv("DATABASE_URL"):
        data = get_wordcloud_data_from_texts(
            SAMPLE_COMMENTS_FALLBACK,
            window_start=window_start.strip(),
            window_end=window_end.strip(),
            top_n=top_n,
            channel_terms=terms,
        )
        return data
    # Bplus Podcast by handle: serve from memory when DB not configured
    if _normalize_handle_for_fallback(cid) == BPLUS_HANDLE_NORMALIZED and not os.getenv("DATABASE_URL"):
        data = get_wordcloud_data_from_texts(
            BPLUS_SAMPLE_COMMENTS,
            window_start=window_start.strip(),
            window_end=window_end.strip(),
            top_n=top_n,
            channel_terms=terms,
        )
        return data
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(status_code=503, detail="Database not configured.")
    try:
        with cursor() as cur:
            data = get_wordcloud_data(
                cur,
                channel_id=cid,
                window_start=window_start.strip(),
                window_end=window_end.strip(),
                by=by if by in ("captured_at", "published_at") else "captured_at",
                top_n=top_n,
                channel_terms=terms,
            )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- YouTube comments sentiment (one video) ---

@app.get("/api/youtube/comments/sentiment")
def youtube_comments_sentiment(
    channel_id: str = Query(..., description="YouTube channel ID"),
    video_id: str = Query(..., description="YouTube video ID"),
    include_polarities: bool = Query(False, description="Include per-comment polarity list"),
):
    """
    Sentiment for one video's comments (from youtube_comment_snapshots).
    Returns aggregate: count, avg_polarity, positive_pct, neutral_pct, negative_pct.
    English-oriented; other languages may score neutral.
    """
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(status_code=503, detail="Database not configured.")
    try:
        from signalmap.services.comment_sentiment import get_sentiment_for_video
        with cursor() as cur:
            data = get_sentiment_for_video(
                cur,
                channel_id=channel_id.strip(),
                video_id=video_id.strip(),
                include_polarities=include_polarities,
            )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
