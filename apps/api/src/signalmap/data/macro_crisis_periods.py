"""Canonical global macro-crisis date ranges. Single source for world_core, world_1900, and timeline curation.

Ids align with the web band timeline (``g-covid-pandemic-era``, etc.).
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

def _row(**kwargs: Any) -> dict:
    return dict(**kwargs)


# Rows omit ``layer``; use ``with_layer`` when attaching to a study layer.
MACRO_CRISIS_PERIODS: list[dict] = [
    _row(
        id="g-macro-great-depression",
        title="Great Depression",
        title_fa="رکود بزرگ",
        date_start="1929-10-24",
        date_end="1939-12-31",
        type="economic",
        scope="world",
        confidence="high",
        description="Global depression after the 1929 crash; deep trade, employment, and output losses across major economies (1920s–30s).",
        description_fa="رکود جهانی پس از بحران ۱۹۲۹؛ افت سنگین تجارت، اشتغال و تولید در اقتصادهای اصلی.",
        sources=[],
    ),
    _row(
        id="g-macro-gfc-2007",
        title="Global Financial Crisis",
        title_fa="بحران مالی جهانی",
        date_start="2007-08-09",
        date_end="2009-12-31",
        type="economic",
        scope="world",
        confidence="high",
        description="Subprime shock through banking stress, Lehman failure, and global recession (2007–2009).",
        description_fa="شوک «ساب‌پرایم» تا بحران بانکی و رکود جهانی (۲۰۰۷–۲۰۰۹).",
        sources=[],
    ),
    _row(
        id="g-covid-pandemic-era",
        title="COVID-19 shock (2020–2022)",
        title_fa="شوک کووید-۱۹ (۲۰۲۰–۲۰۲۲)",
        date_start="2020-01-30",
        date_end="2022-12-31",
        type="economic",
        scope="world",
        confidence="high",
        description="PHEIC and pandemic phase: lockdowns, large demand and supply dislocations, and major macro/energy swings.",
        description_fa="فاز همه‌گیری و اضطرار بهداشت جهانی؛ تعطیلی‌ها و جابه‌جایی بزرگ تقاضا و عرضه و اثرهای کلان و انرژی.",
        sources=[],
    ),
]


def with_layer(layer: str) -> list[dict]:
    """Return copies of ``MACRO_CRISIS_PERIODS`` with ``layer`` set (``world_core`` or ``world_1900``)."""
    out: list[dict] = []
    for r in MACRO_CRISIS_PERIODS:
        d = deepcopy(r)
        d["layer"] = layer
        out.append(d)
    return out
