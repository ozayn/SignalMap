"""
Loader for events_iran.json. Canonical source for modern Iran events (2021+).
Returns normalized events with id, date_start, date_end, title, description, category, layer.
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
        date_start = ev.get("date_start") or ev.get("date")
        if not date_start:
            continue
        date_end = ev.get("date_end")
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
        }
        out.append(normalized)
    return out
