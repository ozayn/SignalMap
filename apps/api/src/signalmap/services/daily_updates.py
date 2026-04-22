"""Daily append-only updates for macro time-series signals.
Idempotent: fetches only missing dates, never overwrites historical rows.

Oil-economy overview: Brent is stored in ``signal_points`` (FRED:DCOILBRENTEU);
Iran+exporter production is in ``signal_points`` (IMF:EIA:oil_production).
**Revenue is not stored** — it is always computed in ``get_oil_economy_overview_iran`` as production × price.

**Unified daily** ``update_all_data_sources`` includes oil production by default. Set
``DAILY_CRON_OIL_PRODUCTION=0`` to skip it (e.g. use monthly ``cron_oil_production_monthly.py`` only).
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Callable

from signalmap.data.oil_annual import BRENT_DAILY_START
from signalmap.store.signals_repo import get_max_date, insert_points_ignore_conflict, _has_db

logger = logging.getLogger(__name__)


def _include_oil_production_in_daily() -> bool:
    """When false, update_all does not run oil_production_exporters (use monthly cron)."""
    return (os.getenv("DAILY_CRON_OIL_PRODUCTION") or "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_FX_USD_TOMAN = "usd_toman_open_market"
SIGNAL_FX_OFFICIAL = "usd_irr_official"
FX_DEFAULT_START = "2012-10-09"  # rial-exchange-rates-archive start
FX_OFFICIAL_DEFAULT_START = "1955-01-01"  # FRED XRNCUSIRA618NRUG starts ~1955


def _add_days(date_str: str, days: int) -> str:
    """Add days to YYYY-MM-DD string. Returns YYYY-MM-DD."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return (d + timedelta(days=days)).strftime("%Y-%m-%d")


def update_brent_prices() -> dict[str, Any]:
    """Append-only update for Brent oil. Fetches only missing dates.
    Drives the oil-economy-overview **price** series in DB; revenue remains API-computed only.
    """
    if not _has_db():
        logger.warning("brent: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": "no db"}

    try:
        logger.info("oil_economy: brent_cron start (FRED DCOILBRENTEU, append missing dates)")
        last = get_max_date(SIGNAL_BRENT)
        start_date = _add_days(last, 1) if last else BRENT_DAILY_START
        end_date = datetime.now().date().strftime("%Y-%m-%d")

        if start_date > end_date:
            return {"rows_added": 0, "start_date": start_date, "end_date": end_date}

        from signalmap.sources.fred_brent import fetch_brent_from_fred

        points = fetch_brent_from_fred(start_date, end_date)
        rows = insert_points_ignore_conflict(
            SIGNAL_BRENT,
            points,
            source="FRED:DCOILBRENTEU",
            metadata={"ingested_by": "daily_update"},
        )
        logger.info("brent: rows_added=%s start=%s end=%s", rows, start_date, end_date)
        logger.info("oil_economy: brent_cron success rows=%s", rows)
        try:
            from signalmap.utils.ttl_cache import invalidate_prefix

            invalidate_prefix("signal:oil_economy_overview:")
        except Exception:
            pass
        return {"rows_added": rows, "start_date": start_date, "end_date": end_date}
    except Exception as e:
        logger.error("oil_economy: brent_cron failed: %s", e)
        logger.exception("brent: %s", e)
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": str(e)}


def update_fx_usd_toman() -> dict[str, Any]:
    """Append-only update for USD/toman. Fetches only missing dates."""
    if not _has_db():
        logger.warning("fx_usd_toman: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": "no db"}

    try:
        last = get_max_date(SIGNAL_FX_USD_TOMAN)
        start_date = _add_days(last, 1) if last else FX_DEFAULT_START
        end_date = datetime.now().date().strftime("%Y-%m-%d")

        if start_date > end_date:
            return {"rows_added": 0, "start_date": start_date, "end_date": end_date}

        from signalmap.services.signals import fetch_usd_toman_merged

        merged = fetch_usd_toman_merged()
        points = [p for p in merged if start_date <= p["date"] <= end_date]
        rows = insert_points_ignore_conflict(
            SIGNAL_FX_USD_TOMAN,
            points,
            source="bonbast_archive_fred",
            metadata={"ingested_by": "daily_update"},
        )
        logger.info("fx_usd_toman: rows_added=%s start=%s end=%s", rows, start_date, end_date)
        return {"rows_added": rows, "start_date": start_date, "end_date": end_date}
    except Exception as e:
        logger.exception("fx_usd_toman: %s", e)
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": str(e)}


def update_gold_prices() -> dict[str, Any]:
    """Append-only update for daily gold. No daily gold source in codebase; returns no-op."""
    if not _has_db():
        logger.warning("gold: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": "no db"}

    # Gold is annual-only (GOLD_ANNUAL); no daily source. Return consistent shape.
    logger.info("gold: rows_added=0 (daily gold not supported; annual only)")
    return {"rows_added": 0, "start_date": None, "end_date": None}


def update_dual_fx_rates() -> dict[str, Any]:
    """Append-only update for official USD/IRR (FRED). Open market is updated by fx."""
    if not _has_db():
        logger.warning("fx_dual: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": "no db"}

    try:
        last = get_max_date(SIGNAL_FX_OFFICIAL)
        start_date = _add_days(last, 1) if last else FX_OFFICIAL_DEFAULT_START
        end_date = datetime.now().date().strftime("%Y-%m-%d")

        if start_date > end_date:
            return {"rows_added": 0, "start_date": start_date, "end_date": end_date}

        from signalmap.sources.fred_iran_fx import fetch_iran_fx_series

        full = fetch_iran_fx_series()
        points = [p for p in full if start_date <= p["date"] <= end_date]
        rows = insert_points_ignore_conflict(
            SIGNAL_FX_OFFICIAL,
            points,
            source="FRED:XRNCUSIRA618NRUG",
            metadata={"ingested_by": "daily_update"},
        )
        logger.info("fx_dual: rows_added=%s start=%s end=%s", rows, start_date, end_date)
        return {"rows_added": rows, "start_date": start_date, "end_date": end_date}
    except Exception as e:
        logger.exception("fx_dual: %s", e)
        return {"rows_added": 0, "start_date": None, "end_date": None, "error": str(e)}


def update_youtube_channel_snapshots() -> dict[str, Any]:
    """Append-only update for YouTube channel snapshots. Uses YOUTUBE_DAILY_UPDATE_CHANNELS env (comma-separated handles/IDs)."""
    if not _has_db():
        logger.warning("youtube_followers: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "channels_updated": 0, "error": "no db"}

    channels_str = (os.getenv("YOUTUBE_DAILY_UPDATE_CHANNELS") or "").strip()
    if not channels_str:
        logger.info("youtube_followers: YOUTUBE_DAILY_UPDATE_CHANNELS not set, skipping")
        return {"rows_added": 0, "channels_updated": 0, "note": "YOUTUBE_DAILY_UPDATE_CHANNELS not set"}

    channels = [c.strip().lstrip("@") for c in channels_str.split(",") if c.strip()]
    if not channels:
        return {"rows_added": 0, "channels_updated": 0}

    try:
        from db import cursor

        today = datetime.now().date()

        def _already_captured_today(channel_id: str | None, handle: str | None) -> bool:
            if not channel_id and not handle:
                return False
            with cursor() as cur:
                if channel_id:
                    cur.execute(
                        "SELECT 1 FROM youtube_channel_snapshots WHERE channel_id = %s AND captured_at::date = %s LIMIT 1",
                        (channel_id, today),
                    )
                else:
                    cur.execute(
                        "SELECT 1 FROM youtube_channel_snapshots WHERE channel_handle IS NOT NULL AND LOWER(TRIM(channel_handle)) = LOWER(%s) AND captured_at::date = %s LIMIT 1",
                        (handle or "", today),
                    )
                return cur.fetchone() is not None

        from signalmap.connectors.youtube import fetch_channel
        from jobs import upsert_youtube_channel_snapshot

        rows_added = 0
        for entry in channels:
            is_channel_id = entry.startswith("UC") and len(entry) == 24
            channel_id = entry if is_channel_id else None
            handle = None if is_channel_id else entry
            if _already_captured_today(channel_id, handle):
                continue
            try:
                live = fetch_channel(channel_id=channel_id, handle=handle)
                upsert_youtube_channel_snapshot(live)
                rows_added += 1
            except Exception as e:
                logger.warning("youtube_followers: %s failed: %s", entry, e)

        logger.info("youtube_followers: rows_added=%s channels=%s", rows_added, len(channels))
        return {"rows_added": rows_added, "channels_updated": rows_added}
    except Exception as e:
        logger.exception("youtube_followers: %s", e)
        return {"rows_added": 0, "channels_updated": 0, "error": str(e)}


def update_oil_trade_network() -> dict[str, Any]:
    """Fetch missing years from UN Comtrade and populate oil_trade_edges. Idempotent."""
    if not _has_db():
        logger.warning("oil_trade_network: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "error": "no db"}

    try:
        from signalmap.services.oil_trade_network import ingest_missing_years_from_comtrade

        current_year = datetime.now().year
        result = ingest_missing_years_from_comtrade(end_year=current_year)
        rows = result.get("rows_upserted", 0)
        years_fetched = result.get("years_fetched", [])
        logger.info("oil_trade_network: rows_upserted=%s years_fetched=%s", rows, years_fetched)
        return {
            "rows_added": rows,
            "years_fetched": years_fetched,
        }
    except Exception as e:
        logger.exception("oil_trade_network: %s", e)
        return {"rows_added": 0, "error": str(e)}


def update_oil_production_exporters() -> dict[str, Any]:
    """Append for oil production (US, SAU, RUS, IRN) via ``ON CONFLICT DO NOTHING`` (no duplicate dates).

    One EIA/static pull per run; most rows usually no-op after first backfill. Prefer **monthly** scheduling
    (this module does not re-ingest the embedded 1980–1999 static — that is Python only for gap years).
    """
    if not _has_db():
        logger.warning("oil_production_exporters: DATABASE_URL not set, skipping")
        return {"rows_added": 0, "error": "no db"}

    try:
        from signalmap.sources.oil_production_exporters import fetch_oil_production_exporters
        from signalmap.services.signals import (
            SIGNAL_OIL_PRODUCTION_US,
            SIGNAL_OIL_PRODUCTION_SAUDI,
            SIGNAL_OIL_PRODUCTION_RUSSIA,
            SIGNAL_OIL_PRODUCTION_IRAN,
        )

        logger.info("oil_economy: production_cron start (EIA/static → append rows, conflict-safe)")
        rows = fetch_oil_production_exporters()
        total = 0
        for r in rows:
            if r.get("us") is not None:
                n = insert_points_ignore_conflict(
                    SIGNAL_OIL_PRODUCTION_US,
                    [{"date": r["date"], "value": r["us"]}],
                    source="IMF:EIA:oil_production",
                    metadata={"ingested_by": "daily_or_monthly_update"},
                )
                total += n
            if r.get("saudi_arabia") is not None:
                n = insert_points_ignore_conflict(
                    SIGNAL_OIL_PRODUCTION_SAUDI,
                    [{"date": r["date"], "value": r["saudi_arabia"]}],
                    source="IMF:EIA:oil_production",
                    metadata={"ingested_by": "daily_or_monthly_update"},
                )
                total += n
            if r.get("russia") is not None:
                n = insert_points_ignore_conflict(
                    SIGNAL_OIL_PRODUCTION_RUSSIA,
                    [{"date": r["date"], "value": r["russia"]}],
                    source="IMF:EIA:oil_production",
                    metadata={"ingested_by": "daily_or_monthly_update"},
                )
                total += n
            if r.get("iran") is not None:
                n = insert_points_ignore_conflict(
                    SIGNAL_OIL_PRODUCTION_IRAN,
                    [{"date": r["date"], "value": r["iran"]}],
                    source="IMF:EIA:oil_production",
                    metadata={"ingested_by": "daily_or_monthly_update"},
                )
                total += n
        logger.info("oil_production_exporters: rows_inserted=%s (0 expected after backfill; conflict-safe)", total)
        logger.info("oil_economy: production_cron success rows=%s", total)
        try:
            from signalmap.utils.ttl_cache import invalidate_prefix

            invalidate_prefix("signal:oil_economy_overview:")
        except Exception:
            pass
        return {"rows_added": total}
    except Exception as e:
        logger.error("oil_economy: production_cron failed: %s", e)
        logger.exception("oil_production_exporters: %s", e)
        return {"rows_added": 0, "error": str(e)}


def _run_macro_signals_refresh() -> dict[str, Any]:
    """GDP composition WDI cache refresh (weekly, Sunday UTC); see ``jobs.update_macro_signals``."""
    from jobs import update_macro_signals

    return update_macro_signals()


def run_oil_economy_brent_cron() -> dict[str, Any]:
    """Brent (FRED) only — for oil-economy-overview and other Brent consumers."""
    return update_brent_prices()


def run_oil_production_cron() -> dict[str, Any]:
    """EIA/IMF oil production (US, SA, RU, IR) only. Safe for monthly schedule."""
    return update_oil_production_exporters()


DATA_SOURCE_UPDATERS: dict[str, Callable[[], dict[str, Any]]] = {
    "oil": update_brent_prices,
    "fx": update_fx_usd_toman,
    "gold": update_gold_prices,
    "fx_dual": update_dual_fx_rates,
    "oil_production_exporters": update_oil_production_exporters,
    "oil_trade_network": update_oil_trade_network,
    "youtube_followers": update_youtube_channel_snapshots,
    "macro_signals": _run_macro_signals_refresh,
}


def update_all_data_sources() -> dict[str, Any]:
    """Execute all registered updaters. Catches per-source exceptions.
    Set ``DAILY_CRON_OIL_PRODUCTION=0`` to skip oil_production_exporters in this run.
    """
    results: dict[str, Any] = {}
    for name, fn in DATA_SOURCE_UPDATERS.items():
        if name == "oil_production_exporters" and not _include_oil_production_in_daily():
            logger.info("oil_economy: skipping oil_production_exporters in update_all (DAILY_CRON_OIL_PRODUCTION=0)")
            results[name] = {
                "rows_added": 0,
                "skipped": True,
                "reason": "DAILY_CRON_OIL_PRODUCTION=0; use monthly cron or run_oil_production_cron()",
            }
            continue
        try:
            results[name] = fn()
        except Exception as e:
            logger.exception("%s: %s", name, e)
            results[name] = {"rows_added": 0, "error": str(e)}

    run_timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        from db import upsert_data_update
        upsert_data_update("global_update")
    except Exception:
        pass

    return {
        "updated": results,
        "run_timestamp": run_timestamp,
    }
