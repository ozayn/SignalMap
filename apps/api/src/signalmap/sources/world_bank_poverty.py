"""World Bank WDI: poverty headcount ratios at international poverty lines (Iran)."""

from __future__ import annotations

import re
from typing import Any

import httpx

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator, USER_AGENT

WDI_HEADCOUNT_EXTREME = "SI.POV.DDAY"
WDI_HEADCOUNT_LMIC = "SI.POV.LMIC"


def _fetch_indicator_name(indicator_id: str) -> str:
    """Official WDI indicator title (includes current $/day threshold text)."""
    url = f"https://api.worldbank.org/v2/indicator/{indicator_id}"
    with httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(url, params={"format": "json"})
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list) and data[1]:
            name = (data[1][0] or {}).get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
    return indicator_id


def _short_threshold_label(full_name: str) -> str:
    """E.g. WB title with 'at $3.00 a day (2021 PPP)' -> '$3.00/day (2021 PPP)' for chart legend/tooltip."""
    m = re.search(r"at (\$[\d.]+\s*)a\s*day\s*(\([^)]+\))?", full_name, re.I)
    if m:
        dollars = m.group(1).strip()
        ppp = (m.group(2) or "").strip()
        base = f"{dollars}/day"
        return f"{base} {ppp}".strip() if ppp else base
    return full_name[:72]


def rows_to_chart_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = float(r["value"])
        out.append({"date": f"{y}-01-01", "value": round(v, 2)})
    return out


def coverage_years(points: list[dict[str, float | str]]) -> tuple[int | None, int | None]:
    if not points:
        return None, None
    ys = [int(p["date"][:4]) for p in points]
    return min(ys), max(ys)


def build_iran_poverty_headcount_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    """
    Two international poverty headcount series for Iran (IRN).
    Uses WDI SI.POV.DDAY and SI.POV.LMIC; dollar thresholds are defined by the World Bank and can change with PPP revisions.
    """
    name_dday = _fetch_indicator_name(WDI_HEADCOUNT_EXTREME)
    name_lmic = _fetch_indicator_name(WDI_HEADCOUNT_LMIC)
    rows_dday = fetch_wdi_annual_indicator("IRN", WDI_HEADCOUNT_EXTREME)
    rows_lmic = fetch_wdi_annual_indicator("IRN", WDI_HEADCOUNT_LMIC)
    pts_dday = rows_to_chart_points(rows_dday, start_year, end_year)
    pts_lmic = rows_to_chart_points(rows_lmic, start_year, end_year)
    y0_d, y1_d = coverage_years(pts_dday)
    y0_l, y1_l = coverage_years(pts_lmic)
    return {
        "lines": [
            {
                "key": "pov_dday",
                "indicator_id": WDI_HEADCOUNT_EXTREME,
                "indicator_title": name_dday,
                "label_short": _short_threshold_label(name_dday),
                "points": pts_dday,
                "coverage_first_year": y0_d,
                "coverage_last_year": y1_d,
            },
            {
                "key": "pov_lmic",
                "indicator_id": WDI_HEADCOUNT_LMIC,
                "indicator_title": name_lmic,
                "label_short": _short_threshold_label(name_lmic),
                "points": pts_lmic,
                "coverage_first_year": y0_l,
                "coverage_last_year": y1_l,
            },
        ],
    }
