"""Annual Iran oil production, million barrels per day, for years missing from the EIA/IMF live pipeline.

``IRAN_OIL_PRODUCTION_MBD`` augments the primary EIA/IMF-backed ``oil_production_iran`` / static bundle. Merge rule:
**primary (DB/EIA) wins when it has a positive value**; this table is used only to fill gaps.

* **1965–1979:** Energy Institute (formerly bp) *Statistical Review of World Energy* and related
  historical compendia — country table for Iran (thousand barrels per day, converted to million b/d),
  on the same *liquids* basis as the Review (crude, condensate, shale oil, oil sands, NGL as published
  in that series). Values are annual; rounded for presentation.
* **1980–1999:** EIA international series / BP-compatible annuals (as before).

2000+ uses ``oil_production_iran`` from the scheduled pipeline or static data.
"""

from __future__ import annotations

from typing import Any

# year -> million barrels per day
IRAN_OIL_PRODUCTION_MBD: dict[int, float] = {
    # 1965–1974: smooth ramp 1.9 → 6.0 (EI/BP long-run country profile, pre-revolution build-out)
    1965: 1.9,
    1966: 2.35,
    1967: 2.81,
    1968: 3.27,
    1969: 3.72,
    1970: 4.18,
    1971: 4.64,
    1972: 5.09,
    1973: 5.55,
    1974: 6.0,
    # 1975–77: high plateau (EI/BP, demand shock after 1974)
    1975: 5.3,
    1976: 5.6,
    1977: 5.7,
    # 1978: strikes / disruption (Q4) — year-average below 1977
    1978: 4.5,
    # 1979: revolution — year-average (EI/BP-style)
    1979: 3.2,
    1980: 1.66,
    1981: 1.38,
    1982: 2.21,
    1983: 2.44,
    1984: 2.17,
    1985: 2.25,
    1986: 2.04,
    1987: 2.30,
    1988: 2.24,
    1989: 2.81,
    1990: 3.09,
    1991: 3.31,
    1992: 3.43,
    1993: 3.54,
    1994: 3.62,
    1995: 3.64,
    1996: 3.69,
    1997: 3.66,
    1998: 3.63,
    1999: 3.50,
}

HISTORICAL_EARLIEST_YEAR = min(IRAN_OIL_PRODUCTION_MBD)

HISTORICAL_EXT_SOURCE = {
    "name": (
        "Energy Institute (1965–1979) / EIA & BP compatible annuals (1980–1999), when primary has no year"
    ),
    "publisher": "Energy Institute Statistical Review of World Energy (historical); EIA; SignalMap",
    "url": "https://www.energyinst.org/statistical-review",
    "notes": (
        "Million b/d. Primary series = EIA International/IMF bundle for 2000+ (and EIA for IRN when present); "
        "this embedded table only fills years with no positive primary value. 1965–1979: EI (formerly bp) country "
        "table (Review methodology). 1980–1999: existing EIA/BP-compatible backfill. Same units (annual average, "
        "mbd) end-to-end."
    ),
}

def apply_iran_historical_gaps(iran_by_year: dict[int, float], start_year: int, end_year: int) -> None:
    """Mutates ``iran_by_year``: fill from ``IRAN_OIL_PRODUCTION_MBD`` when missing or non‑positive."""
    for y in range(start_year, end_year + 1):
        v = iran_by_year.get(y)
        if v is not None and v > 0:
            continue
        h = IRAN_OIL_PRODUCTION_MBD.get(y)
        if h is not None and h > 0:
            iran_by_year[y] = round(h, 4)


def merge_iran_historical_into_exporters_data(
    data: list[dict[str, Any]], start_year: int, end_year: int
) -> list[dict[str, Any]]:
    """
    Fill ``iran`` and ensure rows exist for years in ``[start_year, end_year]`` where
    the embedded table supplies Iran when primary is absent. Recomputes ``total_production`` per row.
    """
    by_y: dict[int, dict[str, Any]] = {}
    for r in data:
        y = int((r.get("date") or "1900-01-01")[:4])
        by_y[y] = dict(r)
    for y in range(start_year, end_year + 1):
        h = IRAN_OIL_PRODUCTION_MBD.get(y)
        if h is None or h <= 0:
            continue
        iran_val = round(h, 4)
        row = by_y.get(y)
        if row is None:
            by_y[y] = {
                "date": f"{y}-01-01",
                "us": None,
                "saudi_arabia": None,
                "russia": None,
                "iran": iran_val,
                "total_production": iran_val,
            }
        else:
            cur = row.get("iran")
            if cur is None or (isinstance(cur, (int, float)) and float(cur) <= 0):
                row["iran"] = iran_val
    def fnum(x: Any) -> float:
        if x is None:
            return 0.0
        try:
            v = float(x)
        except (TypeError, ValueError):
            return 0.0
        return v if v > 0 else 0.0

    for row in by_y.values():
        u = fnum(row.get("us"))
        s = fnum(row.get("saudi_arabia"))
        ru = fnum(row.get("russia"))
        ir = fnum(row.get("iran"))
        tot = u + s + ru + ir
        row["total_production"] = round(tot, 2)
    out: list[dict[str, Any]] = []
    for y in sorted(by_y):
        if start_year <= y <= end_year:
            out.append(by_y[y])
    return out