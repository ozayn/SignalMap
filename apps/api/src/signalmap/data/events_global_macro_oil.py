"""
Curated global oil-market and macro anchors (point-in-time for chart markLines).

Separate from ``iran_core`` / ``load_events`` Iran feeds and from ``world_core`` (recent
headline markers). Use layer ``global_macro_oil`` and optional ``category`` for future
filtering (oil_market, global_macro, war, …).

IDs use prefix ``gmo-`` to avoid collisions with ``world_1900`` / ``world_core`` events.
"""

from __future__ import annotations

EVENTS_GLOBAL_MACRO_OIL: list[dict] = [
    {
        "id": "gmo-1973-arab-oil-embargo",
        "title": "1973 Arab oil embargo",
        "date": "1973-10-17",
        "type": "energy",
        "category": "oil_market",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "OPEC producers announced curtailments of oil shipments to supporters of Israel "
            "during the Yom Kippur War; widely treated as the first major postwar oil shock."
        ),
        "confidence": "high",
        "sources": ["https://www.eia.gov/todayinenergy/detail.php?id=10191"],
    },
    {
        "id": "gmo-1979-iran-revolution",
        "title": "1979 Iranian Revolution",
        "date": "1979-02-01",
        "type": "political",
        "category": "oil_market",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "Monarchy collapses; prolonged disruption and uncertainty over Iranian crude "
            "exports contribute to the second major oil shock of the 1970s."
        ),
        "confidence": "high",
        "sources": ["https://www.britannica.com/event/Iranian-Revolution"],
    },
    {
        "id": "gmo-1990-gulf-war",
        "title": "1990 Gulf War (Iraq invades Kuwait)",
        "date": "1990-08-02",
        "type": "war",
        "category": "war",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "Iraq’s invasion of Kuwait removes capacity from the market and triggers a "
            "sharp, short-lived oil price spike ahead of coalition operations."
        ),
        "confidence": "high",
        "sources": ["https://www.britannica.com/event/Persian-Gulf-War"],
    },
    {
        "id": "gmo-1997-asian-financial-crisis",
        "title": "1997 Asian Financial Crisis",
        "date": "1997-07-02",
        "type": "economic",
        "category": "global_macro",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "Thailand floats the baht after defending a peg; currency panic and credit "
            "crunch spread across East Asia, hitting regional oil demand growth expectations."
        ),
        "confidence": "high",
        "sources": ["https://www.imf.org/en/About/Factsheets/Sheets/2016/ANNUAL/08/01/16/49/Asian-Financial-Crisis"],
    },
    {
        "id": "gmo-1999-opec-cuts",
        "title": "1999 OPEC output curbs",
        "date": "1999-03-23",
        "type": "energy",
        "category": "oil_market",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "OPEC agrees (March 1999, effective April) to coordinated production cuts with "
            "key non-OPEC partners to stem the price slump after the 1997–98 crisis—often "
            "cited as the start of the 1999–2000 price recovery cycle."
        ),
        "confidence": "high",
        "sources": ["https://www.opec.org/opec_web/en/publications/338.htm"],
    },
    {
        "id": "gmo-2005-china-oil-demand",
        "title": "Chinese oil demand surge (mid-2000s anchor)",
        "date": "2005-01-01",
        "type": "energy",
        "category": "oil_market",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "Illustrative anchor for the period when rapid growth in Chinese imports became "
            "a dominant marginal-demand narrative in global oil balances (often discussed "
            "around 2003–2008; not a single statistical breakpoint)."
        ),
        "confidence": "medium",
        "sources": ["https://www.iea.org/reports/world-energy-outlook-2007"],
    },
    {
        "id": "gmo-2008-lehman-gfc",
        "title": "2008 Lehman / Global Financial Crisis",
        "date": "2008-09-15",
        "type": "economic",
        "category": "global_macro",
        "scope": "world",
        "layer": "global_macro_oil",
        "description": (
            "Lehman Brothers files for bankruptcy; global credit freeze and synchronized "
            "demand contraction; oil prices collapse from mid-2008 peaks."
        ),
        "confidence": "high",
        "sources": ["https://www.federalreservehistory.org/essays/lehman-brothers"],
    },
]


def get_events_global_macro_oil() -> list[dict]:
    """Return a copy so callers cannot mutate module state."""
    return list(EVENTS_GLOBAL_MACRO_OIL)
