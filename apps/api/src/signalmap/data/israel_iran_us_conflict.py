"""Canonical Israel–Iran–US direct-conflict events (2024+). Used by world_core, world_1900, and timeline curation.

Ongoing range ends roll with ``date.today()`` for study overlays. Timeline lists may use ``date_end: None`` where noted.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any


def _ongoing_end() -> str:
    return date.today().isoformat()


def _point(
    eid: str,
    at: str,
    title: str,
    title_fa: str,
    description: str,
    description_fa: str,
) -> dict[str, Any]:
    return {
        "id": eid,
        "title": title,
        "title_fa": title_fa,
        "date": at,
        "type": "war",
        "scope": "world",
        "confidence": "high",
        "description": description,
        "description_fa": description_fa,
        "sources": [],
    }


def _period_ongoing(
    eid: str,
    start: str,
    end: str,
    title: str,
    title_fa: str,
    description: str,
    description_fa: str,
) -> dict[str, Any]:
    return {
        "id": eid,
        "title": title,
        "title_fa": title_fa,
        "date_start": start,
        "date_end": end,
        "type": "war",
        "scope": "world",
        "confidence": "high",
        "description": description,
        "description_fa": description_fa,
        "sources": [],
    }


def _period_fixed(
    eid: str,
    start: str,
    end: str,
    title: str,
    title_fa: str,
    description: str,
    description_fa: str,
) -> dict[str, Any]:
    return _period_ongoing(eid, start, end, title, title_fa, description, description_fa)


# --- Base rows (no ``layer``) — merge into registries with ``with_layer`` as needed. ---

ISRAEL_IRAN_US_EVENTS_BASE: list[dict] = [
    _period_ongoing(
        "g-israel-iran-us-direct-conflict-ongoing",
        "2024-04-13",
        _ongoing_end(),
        "Israel–Iran direct conflict (ongoing)",
        "رویارویی مستقیم اسرائیل و ایران (جاری)",
        "Direct Israel–Iran military exchange and escalation from April 2024; regional spillovers, sanctions, and energy-market risk. End date updates daily (ongoing phase).",
        "مبادله/تشدید نظامی مستقیم اسرائیل-ایران از آوریل ۲۰۲۴ به بعد؛ اثرات منطقه‌ای و ریسک بازار انرژی؛ پایان تاریخ به‌صورت روزمره (فاز جاری).",
    ),
    _point(
        "g-il-ir-apr-2024-exchanges",
        "2024-04-14",
        "April 2024 Israel–Iran exchanges",
        "مبادلات/تبادل آتش اردیبهشت ۱۴۰۳",
        "Initial major drone/missile exchange round after a Damascus strike; U.S. and partners involved in defence and crisis diplomacy.",
        "نخستین موج بزرگ حمله/دفاع پهپاد-موشکی پس از اصابت دمشق؛ نقش آمریکا و متحدان در دفاع و بحران‌کاری.",
    ),
    _period_fixed(
        "g-il-ir-12day-war-2025",
        "2025-06-13",
        "2025-06-24",
        "June 2025 Israel–Iran strikes (12 days)",
        "حملات ژوئن ۲۰۲۵ (۱۲ روز)",
        "Twelve-day open conflict with missile and drone volleys, air operations, and civilian/energy-infrastructure risk.",
        "جنگ دوازده‌روزه با موج‌های موشک/پهپاد و پروازها و ریسک جدی برای زیرساخت و انرژی.",
    ),
    _point(
        "g-il-ir-2025-ceasefire",
        "2025-06-24",
        "June 2025 ceasefire",
        "آتش‌بس ژوئن ۲۰۲۵",
        "Cessation-of-hostilities line after the 12-day phase; fragile stabilisation, continued regional tension.",
        "توقف رسمی اصلی نبرد پس از فاز ۱۲روزه؛ تثبیت شکننده و ادامه تنش منطقه‌ای.",
    ),
    _point(
        "g-us-il-ir-strikes-2026-02",
        "2026-02-28",
        "U.S.–Israel strikes on Iran (2026)",
        "حملات آمریکا-اسرائیل به ایران (۲۰۲۶)",
        "Coordinated U.S. and Israeli operations against nuclear-related and military targets; large oil and security shock.",
        "عملیات هماهنگ ایالات متحده و اسرائیل علیه اهداف مرتبط با هسته و نظامی؛ شوک امنیتی-نفتی مهم.",
    ),
]


def israel_iran_events_for_layer(layer: str) -> list[dict]:
    """Copy canonical rows, refresh ongoing end date, and set ``layer`` (e.g. ``world_core`` / ``world_1900``)."""
    d = deepcopy(ISRAEL_IRAN_US_EVENTS_BASE)
    for row in d:
        if row["id"] == "g-israel-iran-us-direct-conflict-ongoing":
            row["date_end"] = _ongoing_end()
        row["layer"] = layer
    return d


def israel_iran_events_for_world_core() -> list[dict]:
    """``layer=world_core`` (same as ``israel_iran_events_for_layer(\"world_core\")``)."""
    return israel_iran_events_for_layer("world_core")


# --- events_timeline ``global_geopolitics`` (category + date_start / date_end only) ---

def israel_iran_global_geopolitics_timeline_rows() -> list[dict]:
    """Narrative row shape for the standalone events timeline. Ongoing main span uses ``date_end: None``."""
    rows: list[dict] = []
    for b in ISRAEL_IRAN_US_EVENTS_BASE:
        eid = b["id"]
        if "date" in b:
            rows.append(
                {
                    "id": eid,
                    "title": b["title"],
                    "category": "global_geopolitics",
                    "date_start": b["date"],
                    "date_end": None,
                    "description": b["description"],
                }
            )
        elif eid == "g-israel-iran-us-direct-conflict-ongoing":
            rows.append(
                {
                    "id": eid,
                    "title": b["title"],
                    "category": "global_geopolitics",
                    "date_start": b["date_start"],
                    "date_end": None,
                    "description": b["description"],
                }
            )
        else:
            rows.append(
                {
                    "id": eid,
                    "title": b["title"],
                    "category": "global_geopolitics",
                    "date_start": b["date_start"],
                    "date_end": b.get("date_end"),
                    "description": b["description"],
                }
            )
    return rows
