"""Cache-first FRED row storage for US Living Standards (memory, disk, committed snapshot)."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from signalmap.utils.ttl_cache import get as cache_get
from signalmap.utils.ttl_cache import get_stale as cache_get_stale
from signalmap.utils.ttl_cache import set as cache_set

_logger = logging.getLogger(__name__)

STUDY_ID = "us-living-standards"
FRED_ROWS_MEMORY_PREFIX = "us_ls_fred_rows:"
FRED_ROWS_MEMORY_TTL = 7 * 24 * 3600.0  # 7 days
SNAPSHOT_FILENAME = "us_living_standards_fred_snapshot.json"
DISK_CACHE_FILENAME = "us_living_standards_fred_series_cache.json"

_snapshot_cache: dict[str, list[tuple[int, float]]] | None = None
_disk_cache: dict[str, Any] | None = None
_disk_cache_mtime: float | None = None


def _data_path_candidates(filename: str) -> list[Path]:
    module = Path(__file__).resolve()
    candidates: list[Path] = [
        module.parents[3] / "data" / filename,
        module.parents[2] / "data" / filename,
    ]
    data_dir = (os.getenv("SIGNALMAP_API_DATA_DIR") or "").strip()
    if data_dir:
        candidates.insert(0, Path(data_dir) / filename)
    return candidates


def _find_data_file(filename: str) -> Path | None:
    for path in _data_path_candidates(filename):
        if path.is_file():
            return path
    return None


def _disk_cache_write_path() -> Path:
    found = _find_data_file(DISK_CACHE_FILENAME)
    if found is not None:
        return found
    return _data_path_candidates(DISK_CACHE_FILENAME)[0]


def _rows_from_json(raw: Any) -> list[tuple[int, float]]:
    if not isinstance(raw, list):
        return []
    out: list[tuple[int, float]] = []
    for item in raw:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            try:
                out.append((int(item[0]), float(item[1])))
            except (TypeError, ValueError):
                continue
    return out


def _rows_to_json(rows: list[tuple[int, float]]) -> list[list[float]]:
    return [[float(y), float(v)] for y, v in rows]


def _load_snapshot() -> dict[str, list[tuple[int, float]]]:
    global _snapshot_cache
    if _snapshot_cache is not None:
        return _snapshot_cache
    path = _find_data_file(SNAPSHOT_FILENAME)
    if path is None:
        _snapshot_cache = {}
        return _snapshot_cache
    try:
        with path.open(encoding="utf-8") as f:
            payload = json.load(f)
        series = payload.get("series", payload) if isinstance(payload, dict) else {}
        _snapshot_cache = {
            str(sid): _rows_from_json(entry.get("rows") if isinstance(entry, dict) else entry)
            for sid, entry in series.items()
            if isinstance(series, dict)
        }
    except Exception as e:
        _logger.warning(
            "us_ls_fred snapshot read failed study=%s path=%s err=%s",
            STUDY_ID,
            path,
            e,
        )
        _snapshot_cache = {}
    return _snapshot_cache


def _load_disk_cache() -> dict[str, Any]:
    global _disk_cache, _disk_cache_mtime
    path = _find_data_file(DISK_CACHE_FILENAME)
    if path is None:
        _disk_cache = {}
        _disk_cache_mtime = None
        return _disk_cache
    try:
        mtime = path.stat().st_mtime
        if _disk_cache is not None and _disk_cache_mtime == mtime:
            return _disk_cache
        with path.open(encoding="utf-8") as f:
            payload = json.load(f)
        _disk_cache = payload if isinstance(payload, dict) else {}
        _disk_cache_mtime = mtime
    except Exception as e:
        _logger.warning(
            "us_ls_fred disk cache read failed study=%s path=%s err=%s",
            STUDY_ID,
            path,
            e,
        )
        _disk_cache = {}
        _disk_cache_mtime = None
    return _disk_cache


def _persist_disk_cache(series_id: str, rows: list[tuple[int, float]], source: str) -> None:
    global _disk_cache, _disk_cache_mtime
    cache = dict(_load_disk_cache())
    cache.setdefault("series", {})
    if not isinstance(cache["series"], dict):
        cache["series"] = {}
    cache["series"][series_id] = {
        "rows": _rows_to_json(rows),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
    }
    cache["updated_at"] = datetime.now(timezone.utc).isoformat()
    path = _disk_cache_write_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)
        f.write("\n")
    _disk_cache = cache
    _disk_cache_mtime = path.stat().st_mtime


def _log_fred_cache(series_id: str, phase: str, **fields: Any) -> None:
    extra = " ".join(f"{k}={v}" for k, v in fields.items() if v is not None)
    if extra:
        _logger.info(
            "us_ls_fred study=%s series=%s source=FRED phase=%s %s",
            STUDY_ID,
            series_id,
            phase,
            extra,
        )
    else:
        _logger.info(
            "us_ls_fred study=%s series=%s source=FRED phase=%s",
            STUDY_ID,
            series_id,
            phase,
        )


def _memory_key(series_id: str) -> str:
    return f"{FRED_ROWS_MEMORY_PREFIX}{series_id}"


def store_fred_rows(series_id: str, rows: list[tuple[int, float]], *, source: str = "live") -> None:
    if not rows:
        return
    cache_set(_memory_key(series_id), rows, FRED_ROWS_MEMORY_TTL)
    try:
        _persist_disk_cache(series_id, rows, source)
    except Exception as e:
        _logger.warning(
            "us_ls_fred disk cache write failed study=%s series=%s err=%s",
            STUDY_ID,
            series_id,
            e,
        )


def _disk_rows(series_id: str) -> list[tuple[int, float]] | None:
    cache = _load_disk_cache()
    series = cache.get("series", {})
    if not isinstance(series, dict):
        return None
    entry = series.get(series_id)
    if not isinstance(entry, dict):
        return None
    rows = _rows_from_json(entry.get("rows"))
    return rows or None


def get_fred_rows_from_cache(series_id: str) -> tuple[list[tuple[int, float]] | None, str | None]:
    """Return cached rows and provenance label (memory, disk, snapshot, stale_*)."""
    hit = cache_get(_memory_key(series_id))
    if hit:
        _log_fred_cache(series_id, "cache_hit", layer="memory")
        return hit, "memory"

    disk_rows = _disk_rows(series_id)
    if disk_rows:
        cache_set(_memory_key(series_id), disk_rows, FRED_ROWS_MEMORY_TTL)
        _log_fred_cache(series_id, "cache_hit", layer="disk")
        return disk_rows, "disk"

    snapshot_rows = _load_snapshot().get(series_id)
    if snapshot_rows:
        cache_set(_memory_key(series_id), snapshot_rows, FRED_ROWS_MEMORY_TTL)
        _log_fred_cache(series_id, "cache_hit", layer="snapshot")
        return snapshot_rows, "snapshot"

    stale = cache_get_stale(_memory_key(series_id))
    if stale:
        _log_fred_cache(series_id, "cache_hit", layer="stale_memory", fallback="stale_memory")
        return stale, "stale_memory"

    _log_fred_cache(series_id, "cache_miss")
    return None, None


def resolve_fred_rows(
    series_id: str,
    live_fetcher: Callable[[], list[tuple[int, float]]],
    *,
    allow_live: bool = True,
    timeout_seconds: float | None = None,
) -> tuple[list[tuple[int, float]] | None, str | None]:
    """
    Cache-first FRED row resolution.
    Returns (rows, error_message). error_message is set only when no rows are available.
    """
    cache_only = (os.getenv("SIGNALMAP_US_LS_FRED_CACHE_ONLY") or "").strip() in ("1", "true", "yes")
    prefer_snapshot = (os.getenv("SIGNALMAP_US_LS_FRED_SNAPSHOT") or "").strip() in ("1", "true", "yes")

    if prefer_snapshot or cache_only:
        cached, layer = get_fred_rows_from_cache(series_id)
        if cached:
            return cached, None
        if cache_only:
            return None, f"FRED {series_id} unavailable (cache_only, no cached rows)"

    cached, layer = get_fred_rows_from_cache(series_id)
    if cached and layer in ("memory", "disk", "snapshot"):
        return cached, None

    if not allow_live:
        if cached:
            return cached, None
        return None, f"FRED {series_id} unavailable (live fetch disabled, no cache)"

    t0 = time.perf_counter()
    try:
        rows = live_fetcher()
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        if rows:
            store_fred_rows(series_id, rows, source="live")
            _log_fred_cache(
                series_id,
                "live_fetch_ok",
                timeout_ms=int((timeout_seconds or 0) * 1000) or None,
                elapsed_ms=elapsed_ms,
            )
            return rows, None
        _log_fred_cache(series_id, "live_fetch_empty", elapsed_ms=elapsed_ms)
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        _log_fred_cache(
            series_id,
            "live_fetch_failed",
            timeout_ms=int((timeout_seconds or 0) * 1000) or None,
            elapsed_ms=elapsed_ms,
            err=str(e),
        )
        if cached:
            return cached, None
        cached2, _ = get_fred_rows_from_cache(series_id)
        if cached2:
            _log_fred_cache(series_id, "fallback_used", fallback="cache_after_error")
            return cached2, None
        return None, f"FRED {series_id} unavailable ({e})"

    if cached:
        return cached, None
    cached2, _ = get_fred_rows_from_cache(series_id)
    if cached2:
        return cached2, None
    return None, f"FRED {series_id} unavailable (empty response)"


def collect_us_living_standards_fred_series_ids(reference: dict[str, Any]) -> list[str]:
    from signalmap.sources.us_living_standards import FRED_SERIES

    ids: set[str] = {series_id for series_id, _ in FRED_SERIES.values()}
    items_cfg: dict[str, Any] = reference.get("household_goods", {}).get("items", {})
    for item_cfg in items_cfg.values():
        ids.add(str(item_cfg["cpi_fred_series"]))
        continuation_id = item_cfg.get("cpi_continuation_series")
        if continuation_id:
            ids.add(str(continuation_id))
    nv = reference.get("phase2", {}).get("new_vehicle", {})
    if nv.get("cpi_fred_series"):
        ids.add(str(nv["cpi_fred_series"]))
    return sorted(ids)


def write_fred_snapshot(series_rows: dict[str, list[tuple[int, float]]], *, source: str = "prefetch") -> Path:
    path = _find_data_file(SNAPSHOT_FILENAME) or _data_path_candidates(SNAPSHOT_FILENAME)[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "series": {
            sid: {"rows": _rows_to_json(rows), "source": source}
            for sid, rows in sorted(series_rows.items())
            if rows
        },
    }
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    global _snapshot_cache
    _snapshot_cache = dict(series_rows)
    return path


def prefetch_us_living_standards_fred_series(
    *,
    timeout_seconds: float = 15.0,
    write_snapshot: bool = True,
) -> dict[str, Any]:
    """Fetch all US Living Standards FRED series (for cron / manual refresh)."""
    from signalmap.sources.us_living_standards import (
        _fetch_fred_graph_csv_rows_timed,
        _fetch_fred_api_rows,
        _load_reference,
    )
    from signalmap.sources.us_living_standards_fred_cache import get_fred_rows_from_cache

    reference = _load_reference()
    series_ids = collect_us_living_standards_fred_series_ids(reference)
    results: dict[str, Any] = {"series": {}, "ok": 0, "failed": 0}

    def _live_fetch(series_id: str) -> list[tuple[int, float]]:
        try:
            return _fetch_fred_graph_csv_rows_timed(series_id, timeout=timeout_seconds)
        except Exception as graph_err:
            api_key = (os.getenv("FRED_API_KEY") or "").strip()
            if not api_key:
                raise ValueError(f"graph failed ({graph_err}); FRED_API_KEY not configured") from graph_err
            return _fetch_fred_api_rows(series_id)

    fetched: dict[str, list[tuple[int, float]]] = {}
    for series_id in series_ids:
        try:
            rows = _live_fetch(series_id)
        except Exception as e:
            rows = None
            err = str(e)
        else:
            err = None
        if rows:
            fetched[series_id] = rows
            store_fred_rows(series_id, rows, source="prefetch")
            results["series"][series_id] = {"ok": True, "rows": len(rows)}
            results["ok"] += 1
        else:
            cached, layer = get_fred_rows_from_cache(series_id)
            if cached:
                fetched[series_id] = cached
                results["series"][series_id] = {
                    "ok": True,
                    "rows": len(cached),
                    "fallback": layer,
                    "live_error": err,
                }
                results["ok"] += 1
            else:
                results["series"][series_id] = {"ok": False, "error": err or "empty"}
                results["failed"] += 1

    if write_snapshot and fetched:
        snap_path = write_fred_snapshot(fetched, source="prefetch")
        results["snapshot_path"] = str(snap_path)

    from signalmap.utils.ttl_cache import invalidate_prefix

    results["bundle_cache_invalidated"] = invalidate_prefix("signal:us_living_standards_bundle:")
    return results
