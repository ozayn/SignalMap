"""
Event loading for study context. Layers: iran_core, world_core, world_1900, sanctions,
iran_presidents, opec_decisions, global_macro_oil (curated global oil / macro anchors).
"""

from datetime import date

def _get_iran_conflict_2026():
    """U.S.–Israel strikes on Iran (Feb 2026) — date_end=today since conflict is ongoing."""
    from signalmap.data.event_layers import _us_israel_iran_2026_event
    ev = _us_israel_iran_2026_event("us_israel_iran_strikes_2026")
    ev["scope"] = "iran"
    ev["layer"] = "iran_core"
    return [ev]

# Iran presidential terms 1990→present (RANGE events)
# Sources: Wikipedia List of presidents of Iran
IRAN_PRESIDENTS = [
    {
        "id": "president-rafsanjani",
        "title": "Akbar Hashemi Rafsanjani",
        "date_start": "1990-01-01",
        "date_end": "1997-08-03",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (1989–1997).",
        "confidence": "high",
    },
    {
        "id": "president-khatami",
        "title": "Mohammad Khatami",
        "date_start": "1997-08-03",
        "date_end": "2005-08-03",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (1997–2005).",
        "confidence": "high",
    },
    {
        "id": "president-ahmadinejad",
        "title": "Mahmoud Ahmadinejad",
        "date_start": "2005-08-03",
        "date_end": "2013-08-03",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (2005–2013).",
        "confidence": "high",
    },
    {
        "id": "president-rouhani",
        "title": "Hassan Rouhani",
        "date_start": "2013-08-03",
        "date_end": "2021-08-03",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (2013–2021).",
        "confidence": "high",
    },
    {
        "id": "president-raisi",
        "title": "Ebrahim Raisi",
        "date_start": "2021-08-03",
        "date_end": "2024-05-19",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (2021–2024).",
        "confidence": "high",
    },
    {
        "id": "president-mokhber",
        "title": "Mohammad Mokhber (acting)",
        "date_start": "2024-05-19",
        "date_end": "2024-07-28",
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "Acting President (May–July 2024).",
        "confidence": "high",
    },
    {
        "id": "president-pezeshkian",
        "title": "Masoud Pezeshkian",
        "date_start": "2024-07-28",
        "date_end": date.today().isoformat(),
        "type": "leadership",
        "scope": "iran",
        "layer": "iran_presidents",
        "description": "President of Iran (2024–present).",
        "confidence": "high",
    },
]

# Iran core events (point events → vertical lines)
# Pre-2021: hardcoded. 2021+: from events_iran.json (canonical).
IRAN_CORE_PRE_2021 = [
    {"id": "iran-1997-khatami", "title": "Khatami inaugurated", "date": "1997-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Mohammad Khatami became president.", "confidence": "high"},
    {"id": "iran-2005-ahmadinejad", "title": "Ahmadinejad inaugurated", "date": "2005-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Mahmoud Ahmadinejad became president.", "confidence": "high"},
    {"id": "iran-2009-election", "title": "Disputed presidential election", "date": "2009-06-12", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Election protests and crackdown.", "confidence": "high"},
    {"id": "iran-2013-rouhani", "title": "Rouhani inaugurated", "date": "2013-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Hassan Rouhani became president.", "confidence": "high"},
    {"id": "iran-2015-jcpoa", "title": "JCPOA finalized", "date": "2015-07-14", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Joint Comprehensive Plan of Action agreed.", "confidence": "high"},
    {"id": "iran-2018-us-withdrawal", "title": "US withdraws from JCPOA", "date": "2018-05-08", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Trump announced US withdrawal.", "confidence": "high"},
]


def _get_iran_core() -> list[dict]:
    from signalmap.data.events_iran_loader import load_events_iran_json
    return IRAN_CORE_PRE_2021 + load_events_iran_json() + _get_iran_conflict_2026()

# Sanctions events (point events → vertical lines)
# Sources: USIP, State Dept
SANCTIONS_POINT = [
    {"id": "sanctions-1996-isa", "title": "Iran Sanctions Act", "date": "1996-08-05", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "ISA signed into law.", "confidence": "high"},
    {"id": "sanctions-2010-cisada", "title": "CISADA", "date": "2010-07-01", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Comprehensive Iran Sanctions Act.", "confidence": "high"},
    {"id": "sanctions-2011-cbi", "title": "CBI sanctions", "date": "2011-12-31", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Central Bank sanctions (NDAA 1245).", "confidence": "high"},
    {"id": "sanctions-2012-oil", "title": "Oil sector sanctions", "date": "2012-07-01", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Oil export sanctions tightened.", "confidence": "high"},
    {"id": "sanctions-2016-implementation", "title": "JCPOA Implementation Day", "date": "2016-01-16", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Sanctions relief under JCPOA.", "confidence": "high"},
    {"id": "sanctions-iran-2018", "title": "US reimposes sanctions on Iranian oil exports", "date": "2018-05-08", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "The United States withdrew from the JCPOA and reinstated sanctions targeting Iranian oil exports.", "confidence": "high"},
    {"id": "sanctions-2018-reimposition", "title": "Sanctions reimposed", "date": "2018-08-06", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "US reimposed JCPOA-lifted sanctions.", "confidence": "high"},
    {"id": "sanctions-2021-vienna", "title": "Vienna JCPOA talks begin", "date": "2021-04-06", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Negotiations to restore JCPOA resume in Vienna.", "confidence": "high"},
    {"id": "sanctions-russia-2022", "title": "Sanctions on Russian energy sector after Ukraine invasion", "date": "2022-02-24", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Western countries imposed sanctions affecting Russian oil exports.", "confidence": "high"},
    {"id": "sanctions-2022-eu-pause", "title": "EU removes JCPOA from agenda", "date": "2022-08-08", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "EU coordinator pauses JCPOA restoration talks.", "confidence": "high"},
    {"id": "sanctions-2024-eu-iran", "title": "EU sanctions on Iran (after Israel strike)", "date": "2024-04-18", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "EU expands sanctions on Iran following April 2024 drone and missile attack on Israel.", "confidence": "high"},
]

# Sanctions RANGE events for Study 9 (oil export capacity context)
# date_end nullable if ongoing; scope: oil_exports
SANCTIONS_OIL_EXPORTS_RANGE = [
    {"id": "sanctions-range-oil-2012", "title": "Oil sector sanctions (2012–2016)", "date_start": "2012-07-01", "date_end": "2016-01-16", "type": "economic", "scope": "oil_exports", "layer": "sanctions", "description": "Oil export sanctions tightened until JCPOA implementation."},
    {"id": "sanctions-range-oil-2018", "title": "Oil sanctions reimposed (2018–)", "date_start": "2018-08-06", "date_end": None, "type": "economic", "scope": "oil_exports", "layer": "sanctions", "description": "US reimposed oil and financial sanctions; ongoing."},
]

SANCTIONS = SANCTIONS_POINT + SANCTIONS_OIL_EXPORTS_RANGE

def _get_world_core():
    from signalmap.data.event_layers import EVENTS_WORLD_CORE, get_events_world_range
    return EVENTS_WORLD_CORE + get_events_world_range()

def _get_world_1900():
    from signalmap.data.event_layers import get_events_world_1900
    return get_events_world_1900()

def _get_opec_decisions():
    from signalmap.data.event_layers import EVENTS_OPEC_DECISIONS
    return EVENTS_OPEC_DECISIONS


def _get_global_macro_oil():
    from signalmap.data.events_global_macro_oil import get_events_global_macro_oil
    return get_events_global_macro_oil()


def _get_iran_core_events():
    return _get_iran_core()

_LAYER_REGISTRY = {
    "iran_presidents": IRAN_PRESIDENTS,
    "iran_core": _get_iran_core_events,
    "world_core": _get_world_core,
    "world_1900": _get_world_1900,
    "sanctions": SANCTIONS,
    "opec_decisions": _get_opec_decisions(),
    "global_macro_oil": _get_global_macro_oil,
}


def load_events(study_id: str) -> list[dict]:
    """Load default events for a study. Returns empty when no default layer is configured."""
    if study_id == "events_timeline":
        from signalmap.data.events_timeline import get_events_timeline_all
        return get_events_timeline_all()
    return []


def get_events_by_layers(study_id: str, layer_list: list[str]) -> list[dict]:
    """Return events from requested layers. Merges and deduplicates by id."""
    seen: set[str] = set()
    out: list[dict] = []
    for layer in layer_list:
        if layer == "none":
            continue
        events = _LAYER_REGISTRY.get(layer, [])
        if callable(events):
            events = events()
        for ev in events:
            if ev.get("id") and ev["id"] not in seen:
                seen.add(ev["id"])
                out.append(ev)
    return out
