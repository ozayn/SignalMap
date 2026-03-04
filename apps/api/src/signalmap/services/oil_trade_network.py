"""Oil trade network service: query DB, fallback to curated dataset.

Real data is ingested by the cron job (update_oil_trade_network) which fetches
missing years from UN Comtrade and populates oil_trade_edges.

Service logic per year:
  1. Query oil_trade_edges for the requested year.
  2. If data exists → return database results.
  3. If no data exists → return curated dataset.
"""

import logging
from typing import Any

from signalmap.data.oil_trade_curated import get_curated_edges

logger = logging.getLogger(__name__)

OIL_TRADE_START_YEAR = 2010

# EU member states (Comtrade reports individually; we aggregate to EU for network)
EU_IMPORTERS = frozenset({
    "Germany", "Netherlands", "France", "Italy", "Spain", "Poland",
    "Belgium", "Greece", "United Kingdom",
})


def _aggregate_importer(name: str) -> str:
    """Aggregate EU member importers to 'EU' for network display."""
    return "EU" if name in EU_IMPORTERS else name


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
    start_year: int = 2010,
    end_year: int = 2023,
) -> dict[str, Any]:
    """
    Return oil trade edges grouped by year.

    For each year in [start_year, end_year]:
      - If oil_trade_edges has data → use database results.
      - If no data → use curated fallback.

    Output: { years: { "2010": [...], "2011": [...], ... } }
    Each edge: { source, target, value } (value = thousand barrels/day).
    """
    if start_year > end_year:
        start_year, end_year = end_year, start_year

    db_result = _query_edges_by_year(start_year, end_year)

    result: dict[str, list[dict[str, Any]]] = {}
    for year in range(start_year, end_year + 1):
        key = str(year)
        if key in db_result and db_result[key]:
            result[key] = db_result[key]
        else:
            curated = get_curated_edges(year)
            if curated:
                result[key] = curated
                logger.debug("oil_trade_network: year %s using curated fallback", year)

    return {"years": result}


def _get_years_in_db() -> set[int]:
    """Return set of years that have at least one edge in oil_trade_edges."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL:
        return set()
    try:
        with cursor() as cur:
            cur.execute("SELECT DISTINCT year FROM oil_trade_edges ORDER BY year")
            return {row["year"] for row in (cur.fetchall() or [])}
    except Exception as e:
        logger.warning("oil_trade_edges get years: %s", e)
        return set()


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


def ingest_missing_years_from_comtrade(
    start_year: int = OIL_TRADE_START_YEAR,
    end_year: int | None = None,
) -> dict[str, Any]:
    """
    Fetch missing years from UN Comtrade and populate oil_trade_edges.
    Idempotent: only fetches years that have no data in DB.
    Returns summary of rows upserted per year.
    """
    from datetime import datetime
    from signalmap.sources.comtrade_oil_trade import fetch_comtrade_oil_trade

    if end_year is None:
        end_year = datetime.now().year

    years_in_db = _get_years_in_db()
    missing = [y for y in range(start_year, end_year + 1) if y not in years_in_db]

    if not missing:
        logger.info("oil_trade_network: all years %s-%s already in DB", start_year, end_year)
        return {"rows_upserted": 0, "years_fetched": [], "years_already_present": list(years_in_db)}

    total = 0
    for year in missing:
        try:
            rows = fetch_comtrade_oil_trade(year, year)
            if rows:
                n = _upsert_edges(rows, source="comtrade")
                total += n
                logger.info("oil_trade_network: ingested year %s, %s edges", year, n)
        except Exception as e:
            logger.warning("oil_trade_network: Comtrade fetch year %s failed: %s", year, e)

    return {
        "rows_upserted": total,
        "years_fetched": missing,
        "years_already_present": list(years_in_db),
    }
