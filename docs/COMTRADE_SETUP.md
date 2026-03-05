# UN Comtrade Setup

The oil trade network study uses bilateral crude oil trade flows from the UN Comtrade API and stores them in the `oil_trade_edges` table.

## Environment Variable

Set one of:

- `COMTRADE_API_KEY` (preferred)
- `COMTRADE_SUBSCRIPTION_KEY` (legacy alias)

Get a subscription key from:

- [UN Comtrade Plus](https://comtradeplus.un.org/)
- [Comtrade Developer Portal](https://comtradedeveloper.un.org/)

Without a key, the Comtrade API has strict rate limits and may return errors. The oil trade network will fall back to curated data when Comtrade is unavailable.

## Data Flow

1. **Ingestion** – Cron job calls `update_oil_trade_network` (or `POST /api/cron/update-oil-trade`)
2. **Source** – `signalmap.sources.comtrade_oil_trade` fetches HS 2709 (crude oil) exports for 2010–2023
3. **Storage** – `oil_trade_edges` table (year, exporter, importer, value, source)
4. **API** – `GET /api/networks/oil-trade?start_year=2010&end_year=2023`
5. **Frontend** – Oil Trade Network study

## Conversion

Comtrade returns net weight in kilograms. Conversion:

- 1 tonne crude ≈ 7.33 barrels
- `barrels_per_day = (kg / 1000) * 7.33 / 365`
- Stored as thousand barrels/day (value in API)

## Cron Schedule

Oil trade data is annual and changes infrequently. Recommended schedule:

- **Weekly:** `0 3 * * 0` (Sundays 3:00 UTC) – call `POST /api/cron/update-oil-trade`
- Or include in daily `update-all` – it runs idempotently and skips years already in DB

## Manual Ingestion

```bash
# Via API (requires DATABASE_URL on API service)
curl -X POST https://your-api.up.railway.app/api/cron/update-oil-trade

# Or via Python (from apps/api)
cd apps/api && python scripts/update_oil_trade_network.py --start 2010 --end 2023

# Force re-ingest (clear DB and refetch; use after fixing value metric)
python scripts/update_oil_trade_network.py --force
```
