"""
Loader for events_iran.json. Canonical source for modern Iran events (2021+).
Returns normalized events with id, date_start, date_end, title, description, category, layer.
Supports optional ACLED-style fields: event_type, actors, scope, signal_relevance.
"""

import json
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent
_EVENTS_IRAN_JSON = _DATA_DIR / "events_iran.json"


def load_events_iran_json() -> list[dict]:
    """Load and normalize events from events_iran.json."""
    if not _EVENTS_IRAN_JSON.exists():
        return []
    try:
        raw = json.loads(_EVENTS_IRAN_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    out: list[dict] = []
    for ev in raw if isinstance(raw, list) else []:
        if not ev.get("id") or not ev.get("title"):
            continue
        # Curated: timeline noise / scenarios excluded from default iran_core overlays (opt-in TBD)
        if ev.get("include_in_iran_core") is False:
            continue
        date_start = ev.get("date_start") or ev.get("date")
        if not date_start:
            continue
        date_end = ev.get("date_end")
        actors_raw = ev.get("actors")
        actors = list(actors_raw) if isinstance(actors_raw, list) else []
        signal_raw = ev.get("signal_relevance")
        signal_relevance = list(signal_raw) if isinstance(signal_raw, list) else []
        normalized = {
            "id": str(ev["id"]),
            "date_start": str(date_start),
            "date_end": str(date_end) if date_end else None,
            "title": str(ev["title"]),
            "description": str(ev.get("description") or ""),
            "category": str(ev.get("category") or "iran_domestic"),
            "layer": str(ev.get("layer") or "iran_core"),
            "date": str(date_start),
            "type": str(ev.get("type") or "political"),
            "scope": "iran",
            "confidence": "high",
            "event_type": str(ev.get("event_type") or "political"),
            "actors": actors,
            "scope_acl": str(ev.get("scope") or "iran_domestic"),
            "signal_relevance": signal_relevance,
        }
        out.append(normalized)
    return out


def get_events_for_signal(signal_name: str) -> list[dict]:
    """Return events where signal_name is in event['signal_relevance']."""
    events = load_events_iran_json()
    return [e for e in events if signal_name in (e.get("signal_relevance") or [])]
