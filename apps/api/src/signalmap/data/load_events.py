"""Load and validate manual events data."""

import json
from datetime import date
from pathlib import Path
from typing import List, Optional

from signalmap.models.events import Event

from signalmap.data.event_layers import EVENTS_SANCTIONS, EVENTS_WORLD_1900, EVENTS_WORLD_CORE, EVENTS_WORLD_RANGE


def _load_iran_events() -> list[dict]:
    """Load Iran-focused events from JSON."""
    path = Path(__file__).parent / "events_iran.json"
    if not path.exists():
        return []
    with open(path) as f:
        raw = json.load(f)
    events: list[dict] = []
    for item in raw:
        try:
            ev = Event.model_validate(item)
            events.append(ev.model_dump())
        except Exception:
            continue
    return events


def load_events(study_id: str = "1") -> list[dict]:
    """
    Load events for a study. Validates schema and returns sorted by date.
    Study 1 uses Iran-focused events.
    """
    if study_id not in ("1", "iran"):
        return []
    events = _load_iran_events()
    events.sort(key=lambda e: e["date"])
    return events


def get_events_by_layers(study_id: str, layers: Optional[List[str]] = None) -> list:
    """
    Return events for requested layers. Each event includes a "layer" field.
    layers: e.g. ["iran_core", "world_core"]. If None, defaults to iran_core for study 2.
    """
    if layers is None or len(layers) == 0:
        layers = ["iran_core"]
    events: list[dict] = []
    if "iran_core" in layers and study_id in ("1", "iran"):
        for ev in _load_iran_events():
            events.append({**ev, "layer": "iran_core", "scope": "iran"})
    if "world_core" in layers:
        for ev in EVENTS_WORLD_CORE:
            events.append({**ev, "layer": "world_core", "scope": "world"})
    if "sanctions" in layers:
        for ev in EVENTS_SANCTIONS:
            events.append({**ev, "layer": "sanctions", "scope": "sanctions"})
    if "world_core" in layers:
        for ev in EVENTS_WORLD_RANGE:
            events.append({**ev, "layer": "world_core", "scope": "world"})
    if "world_1900" in layers:
        today = date.today().isoformat()
        for ev in EVENTS_WORLD_1900:
            ev_copy = {**ev, "layer": "world_1900", "scope": "world"}
            if ev_copy.get("id") == "g1900-ukraine" and ev_copy.get("date_end"):
                ev_copy["date_end"] = today
            events.append(ev_copy)
    events.sort(key=lambda e: e.get("date") or e.get("date_start", ""))
    return events
