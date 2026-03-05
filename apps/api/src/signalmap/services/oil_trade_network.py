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
    source: str = "curated",
) -> dict[str, Any]:
    """
    Return oil trade edges grouped by year.

    source: "curated" = stable curated dataset; "db" = full ingested Comtrade data.

    Output: { years: { "2010": [...], "2011": [...], ... } }
    Each edge: { source, target, value }.
    """
    if start_year > end_year:
        start_year, end_year = end_year, start_year

    if source == "db":
        db_result = _query_edges_by_year(start_year, end_year)
        result = {k: db_result.get(k, []) for k in [str(y) for y in range(start_year, end_year + 1)]}
        return {"years": result}

    result: dict[str, list[dict[str, Any]]] = {}
    for year in range(start_year, end_year + 1):
        key = str(year)
        curated = get_curated_edges(year)
        result[key] = curated or []
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


def _clear_oil_trade_edges() -> int:
    """Delete all rows from oil_trade_edges. Returns count deleted."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL:
        return 0
    try:
        with cursor() as cur:
            cur.execute("DELETE FROM oil_trade_edges")
            return cur.rowcount or 0
    except Exception as e:
        logger.exception("oil_trade_edges clear: %s", e)
        return 0


def _delete_year(year: int) -> int:
    """Delete rows for one year. Returns count deleted."""
    from db import DATABASE_URL, cursor
    if not DATABASE_URL:
        return 0
    try:
        with cursor() as cur:
            cur.execute("DELETE FROM oil_trade_edges WHERE year = %s", (year,))
            return cur.rowcount or 0
    except Exception as e:
        logger.exception("oil_trade_edges delete year %s: %s", year, e)
        return 0


def ingest_missing_years_from_comtrade(
    start_year: int = OIL_TRADE_START_YEAR,
    end_year: int | None = None,
    force_reingest: bool = False,
) -> dict[str, Any]:
    """
    Fetch missing years from UN Comtrade and populate oil_trade_edges.
    Uses NetWeight (kg) only - never TradeValue. Converts to thousand barrels/day.
    Idempotent: only fetches years that have no data in DB, unless force_reingest=True.
    Returns summary of rows upserted per year.
    """
    from datetime import datetime
    from signalmap.sources.comtrade_oil_trade import fetch_comtrade_oil_trade

    if end_year is None:
        end_year = datetime.now().year

    if force_reingest:
        years_in_db = set()
        years_to_fetch = list(range(start_year, end_year + 1))
    else:
        years_in_db = _get_years_in_db()
        years_to_fetch = [y for y in range(start_year, end_year + 1) if y not in years_in_db]

    if not years_to_fetch:
        logger.info("oil_trade_network: all years %s-%s already in DB", start_year, end_year)
        return {"rows_upserted": 0, "years_fetched": [], "years_already_present": list(years_in_db)}

    total = 0
    for year in years_to_fetch:
        try:
            if force_reingest:
                _delete_year(year)
            rows = fetch_comtrade_oil_trade(year, year)
            if rows:
                n = _upsert_edges(rows, source="comtrade")
                total += n
                logger.info("oil_trade_network: ingested year %s, %s edges", year, n)
        except Exception as e:
            logger.warning("oil_trade_network: Comtrade fetch year %s failed: %s", year, e)

    return {
        "rows_upserted": total,
        "years_fetched": years_to_fetch,
        "years_already_present": list(years_in_db),
    }
