"""Oil trade network service: fetch from Comtrade, store in DB, return edges by year."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Fallback when DB empty and Comtrade unavailable (e.g. initial setup, API limits)
def _curated_fallback() -> dict[str, list[dict[str, Any]]]:
    """Curated approximate flows (thousand bbl/day). Each year has distinct edges for visible evolution."""
    return {
        # 2018–2019: Russia exports strongly to EU; smaller flows to India/China; US exports modest
        "2018": [
            {"source": "Saudi Arabia", "target": "China", "value": 1100},
            {"source": "Saudi Arabia", "target": "India", "value": 750},
            {"source": "Saudi Arabia", "target": "Japan", "value": 1000},
            {"source": "Russia", "target": "China", "value": 500},
            {"source": "Russia", "target": "India", "value": 200},
            {"source": "Russia", "target": "EU", "value": 1500},
            {"source": "United States", "target": "EU", "value": 450},
            {"source": "United States", "target": "South Korea", "value": 250},
            {"source": "United States", "target": "Japan", "value": 180},
            {"source": "United States", "target": "India", "value": 120},
            {"source": "United States", "target": "Singapore", "value": 80},
            {"source": "Iran", "target": "China", "value": 600},
            {"source": "Iraq", "target": "China", "value": 550},
            {"source": "Iraq", "target": "India", "value": 480},
            {"source": "UAE", "target": "Japan", "value": 420},
            {"source": "UAE", "target": "India", "value": 650},
            {"source": "UAE", "target": "China", "value": 320},
        ],
        "2019": [
            {"source": "Saudi Arabia", "target": "China", "value": 1200},
            {"source": "Saudi Arabia", "target": "India", "value": 800},
            {"source": "Saudi Arabia", "target": "Japan", "value": 980},
            {"source": "Russia", "target": "China", "value": 550},
            {"source": "Russia", "target": "India", "value": 280},
            {"source": "Russia", "target": "EU", "value": 1480},
            {"source": "United States", "target": "EU", "value": 520},
            {"source": "United States", "target": "South Korea", "value": 300},
            {"source": "United States", "target": "Japan", "value": 220},
            {"source": "United States", "target": "India", "value": 180},
            {"source": "United States", "target": "Singapore", "value": 120},
            {"source": "Iran", "target": "China", "value": 480},
            {"source": "Iraq", "target": "China", "value": 620},
            {"source": "Iraq", "target": "India", "value": 500},
            {"source": "UAE", "target": "Japan", "value": 460},
            {"source": "UAE", "target": "India", "value": 720},
            {"source": "UAE", "target": "China", "value": 350},
        ],
        # 2020–2021: US exports increase; Russia still strong to EU
        "2020": [
            {"source": "Saudi Arabia", "target": "China", "value": 1300},
            {"source": "Saudi Arabia", "target": "India", "value": 680},
            {"source": "Saudi Arabia", "target": "Japan", "value": 920},
            {"source": "Russia", "target": "China", "value": 750},
            {"source": "Russia", "target": "India", "value": 420},
            {"source": "Russia", "target": "EU", "value": 1400},
            {"source": "United States", "target": "EU", "value": 700},
            {"source": "United States", "target": "South Korea", "value": 400},
            {"source": "United States", "target": "Japan", "value": 300},
            {"source": "United States", "target": "India", "value": 280},
            {"source": "United States", "target": "Singapore", "value": 200},
            {"source": "Iran", "target": "China", "value": 520},
            {"source": "Iraq", "target": "China", "value": 680},
            {"source": "Iraq", "target": "India", "value": 460},
            {"source": "UAE", "target": "Japan", "value": 400},
            {"source": "UAE", "target": "India", "value": 600},
            {"source": "UAE", "target": "China", "value": 380},
        ],
        "2021": [
            {"source": "Saudi Arabia", "target": "China", "value": 1400},
            {"source": "Saudi Arabia", "target": "India", "value": 780},
            {"source": "Saudi Arabia", "target": "Japan", "value": 950},
            {"source": "Russia", "target": "China", "value": 900},
            {"source": "Russia", "target": "India", "value": 550},
            {"source": "Russia", "target": "EU", "value": 1350},
            {"source": "United States", "target": "EU", "value": 720},
            {"source": "United States", "target": "South Korea", "value": 440},
            {"source": "United States", "target": "Japan", "value": 340},
            {"source": "United States", "target": "India", "value": 380},
            {"source": "United States", "target": "Singapore", "value": 280},
            {"source": "Iran", "target": "China", "value": 580},
            {"source": "Iraq", "target": "China", "value": 720},
            {"source": "Iraq", "target": "India", "value": 520},
            {"source": "UAE", "target": "Japan", "value": 430},
            {"source": "UAE", "target": "India", "value": 780},
            {"source": "UAE", "target": "China", "value": 360},
        ],
        # 2022–2023: Russia shifts to Asia; EU flow collapses; US fills EU gap, exports grow
        "2022": [
            {"source": "Saudi Arabia", "target": "China", "value": 1550},
            {"source": "Saudi Arabia", "target": "India", "value": 920},
            {"source": "Saudi Arabia", "target": "Japan", "value": 1000},
            {"source": "Russia", "target": "China", "value": 1200},
            {"source": "Russia", "target": "India", "value": 1600},
            {"source": "Russia", "target": "EU", "value": 200},
            {"source": "United States", "target": "EU", "value": 900},
            {"source": "United States", "target": "South Korea", "value": 500},
            {"source": "United States", "target": "Japan", "value": 380},
            {"source": "United States", "target": "India", "value": 520},
            {"source": "United States", "target": "Singapore", "value": 350},
            {"source": "Iran", "target": "China", "value": 640},
            {"source": "Iraq", "target": "China", "value": 780},
            {"source": "Iraq", "target": "India", "value": 580},
            {"source": "UAE", "target": "Japan", "value": 480},
            {"source": "UAE", "target": "India", "value": 850},
            {"source": "UAE", "target": "China", "value": 400},
        ],
        "2023": [
            {"source": "Saudi Arabia", "target": "China", "value": 1650},
            {"source": "Saudi Arabia", "target": "India", "value": 880},
            {"source": "Saudi Arabia", "target": "Japan", "value": 580},
            {"source": "Russia", "target": "China", "value": 1200},
            {"source": "Russia", "target": "India", "value": 1600},
            {"source": "Russia", "target": "EU", "value": 250},
            {"source": "United States", "target": "EU", "value": 900},
            {"source": "United States", "target": "South Korea", "value": 480},
            {"source": "United States", "target": "Japan", "value": 360},
            {"source": "United States", "target": "India", "value": 580},
            {"source": "United States", "target": "Singapore", "value": 400},
            {"source": "Iran", "target": "China", "value": 680},
            {"source": "Iraq", "target": "China", "value": 760},
            {"source": "Iraq", "target": "India", "value": 560},
            {"source": "UAE", "target": "Japan", "value": 470},
            {"source": "UAE", "target": "India", "value": 880},
            {"source": "UAE", "target": "China", "value": 420},
        ],
    }

# EU member states (Comtrade reports individually; we aggregate to EU for network)
EU_IMPORTERS = frozenset({
    "Germany", "Netherlands", "France", "Italy", "Spain", "Poland",
    "Belgium", "Greece", "United Kingdom",
})


def _aggregate_importer(name: str) -> str:
    """Aggregate EU member importers to 'EU' for network display."""
    return "EU" if name in EU_IMPORTERS else name


def _has_data_for_years(start_year: int, end_year: int) -> bool:
    """Check if oil_trade_edges has data for the full year range."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL:
        return False
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT year) AS cnt
                FROM oil_trade_edges
                WHERE year >= %s AND year <= %s
                """,
                (start_year, end_year),
            )
            row = cur.fetchone()
            expected = end_year - start_year + 1
            return row and row.get("cnt", 0) >= expected
    except Exception:
        return False


def _upsert_edges(rows: list[dict[str, Any]], source: str = "comtrade") -> int:
    """Upsert edges into oil_trade_edges. Returns count of rows upserted."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL or not rows:
        return 0
    count = 0
    try:
        with cursor() as cur:
            for r in rows:
                cur.execute(
                    """
                    INSERT INTO oil_trade_edges (year, exporter, importer, value, source, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (year, exporter, importer)
                    DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()
                    """,
                    (
                        r["year"],
                        r["exporter"],
                        r["importer"],
                        r["value"],
                        source,
                    ),
                )
                count += 1
    except Exception as e:
        logger.exception("oil_trade_edges upsert: %s", e)
    return count


def _query_edges_by_year(start_year: int, end_year: int) -> dict[str, list[dict[str, Any]]]:
    """Query oil_trade_edges and return { year: [ { source, target, value } ] }.
    Aggregates EU member importers into single EU edges (summed values)."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL:
        return {}
    raw: dict[str, dict[tuple[str, str], float]] = {}
    try:
        with cursor() as cur:
            cur.execute(
                """
                SELECT year, exporter, importer, value
                FROM oil_trade_edges
                WHERE year >= %s AND year <= %s
                ORDER BY year, value DESC
                """,
                (start_year, end_year),
            )
            for row in cur.fetchall() or []:
                year = str(row["year"])
                importer = _aggregate_importer(row["importer"])
                key = (row["exporter"], importer)
                if year not in raw:
                    raw[year] = {}
                raw[year][key] = raw[year].get(key, 0) + float(row["value"])
    except Exception as e:
        logger.exception("oil_trade_edges query: %s", e)
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    for year, agg in raw.items():
        out[year] = [
            {"source": ex, "target": im, "value": round(v, 2)}
            for (ex, im), v in agg.items()
        ]
    return out


def get_oil_trade_network(
    start_year: int = 2018,
    end_year: int = 2023,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Return oil trade edges grouped by year.
    If data missing, fetches from Comtrade and upserts.
    Output: { years: { "2018": [...], "2019": [...], ... } }
    Each edge: { source, target, value } (value = thousand barrels/day).
    """
    if start_year > end_year:
        start_year, end_year = end_year, start_year

    from db import DATABASE_URL
    has_data = _has_data_for_years(start_year, end_year) if DATABASE_URL else False

    if not has_data or force_refresh:
        try:
            from signalmap.sources.comtrade_oil_trade import fetch_comtrade_oil_trade
            rows = fetch_comtrade_oil_trade(start_year, end_year)
            if rows:
                n = _upsert_edges(rows, source="comtrade")
                logger.info("oil_trade_network: upserted %s edges from Comtrade", n)
        except Exception as e:
            logger.warning("oil_trade_network: Comtrade fetch failed: %s", e)

    result = _query_edges_by_year(start_year, end_year)

    if not result:
        logger.info("oil_trade_network: using curated fallback (no Comtrade/DB data)")
        fallback = _curated_fallback()
        result = {
            k: v for k, v in fallback.items()
            if start_year <= int(k) <= end_year
        }

    return {"years": result}
