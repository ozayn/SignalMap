"""
Event loading for study context. Layers: iran_core, world_core, world_1900, sanctions, iran_presidents.
"""

from datetime import date

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
# Sources: public timelines
IRAN_CORE = [
    {"id": "iran-1997-khatami", "title": "Khatami inaugurated", "date": "1997-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Mohammad Khatami became president.", "confidence": "high"},
    {"id": "iran-2005-ahmadinejad", "title": "Ahmadinejad inaugurated", "date": "2005-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Mahmoud Ahmadinejad became president.", "confidence": "high"},
    {"id": "iran-2009-election", "title": "Disputed presidential election", "date": "2009-06-12", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Election protests and crackdown.", "confidence": "high"},
    {"id": "iran-2013-rouhani", "title": "Rouhani inaugurated", "date": "2013-08-03", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Hassan Rouhani became president.", "confidence": "high"},
    {"id": "iran-2015-jcpoa", "title": "JCPOA finalized", "date": "2015-07-14", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Joint Comprehensive Plan of Action agreed.", "confidence": "high"},
    {"id": "iran-2018-us-withdrawal", "title": "US withdraws from JCPOA", "date": "2018-05-08", "type": "political", "scope": "iran", "layer": "iran_core", "description": "Trump announced US withdrawal.", "confidence": "high"},
]

# Sanctions events (point events → vertical lines)
# Sources: USIP, State Dept
SANCTIONS = [
    {"id": "sanctions-1996-isa", "title": "Iran Sanctions Act", "date": "1996-08-05", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "ISA signed into law.", "confidence": "high"},
    {"id": "sanctions-2010-cisada", "title": "CISADA", "date": "2010-07-01", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Comprehensive Iran Sanctions Act.", "confidence": "high"},
    {"id": "sanctions-2011-cbi", "title": "CBI sanctions", "date": "2011-12-31", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Central Bank sanctions (NDAA 1245).", "confidence": "high"},
    {"id": "sanctions-2012-oil", "title": "Oil sector sanctions", "date": "2012-07-01", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Oil export sanctions tightened.", "confidence": "high"},
    {"id": "sanctions-2016-implementation", "title": "JCPOA Implementation Day", "date": "2016-01-16", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "Sanctions relief under JCPOA.", "confidence": "high"},
    {"id": "sanctions-2018-reimposition", "title": "Sanctions reimposed", "date": "2018-08-06", "type": "economic", "scope": "sanctions", "layer": "sanctions", "description": "US reimposed JCPOA-lifted sanctions.", "confidence": "high"},
]

_LAYER_REGISTRY = {
    "iran_presidents": IRAN_PRESIDENTS,
    "iran_core": IRAN_CORE,
    "world_core": [],
    "world_1900": [],
    "sanctions": SANCTIONS,
}


def load_events(study_id: str) -> list[dict]:
    """Load default events for a study. Returns empty when no default layer is configured."""
    return []


def get_events_by_layers(study_id: str, layer_list: list[str]) -> list[dict]:
    """Return events from requested layers. Merges and deduplicates by id."""
    seen: set[str] = set()
    out: list[dict] = []
    for layer in layer_list:
        if layer == "none":
            continue
        events = _LAYER_REGISTRY.get(layer, [])
        for ev in events:
            if ev.get("id") and ev["id"] not in seen:
                seen.add(ev["id"])
                out.append(ev)
    return out
