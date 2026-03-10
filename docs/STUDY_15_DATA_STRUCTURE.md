# Study 15 Data Structure Report

## 1. Study 15 Definition

**File:** `apps/web/src/lib/studies.ts`

| Field | Value |
|-------|-------|
| **study id** | `oil_trade_network` |
| **number** | 15 |
| **title** | Oil trade network |
| **primarySignal** | `{ kind: "oil_trade_network" }` |
| **secondary signals** | None |
| **timeRange** | `["2010", String(currentYear)]` (e.g. `["2010", "2026"]`) |
| **concepts** | `["trade_networks", "energy_geopolitics", "export_dependencies"]` |

---

## 2. Frontend API Route

**File:** `apps/web/src/app/api/networks/oil-trade/route.ts`

| Property | Value |
|----------|-------|
| **URL** | `/api/networks/oil-trade` |
| **Method** | GET |
| **Query params** | `start_year`, `end_year`, `source` |
| **source** | `"curated"` (default) or `"db"` |

**Behavior:** Proxies to backend `API_URL/api/networks/oil-trade`. Falls back to `CURATED_FALLBACK` when backend returns 404 or is unreachable (only when `source=curated`).

---

## 3. Backend Endpoint

**File:** `apps/api/main.py`

```python
@app.get("/api/networks/oil-trade")
def api_oil_trade_network(
    start_year: int = 2010,
    end_year: int | None = None,
    source: str | None = None,
):
    """Return bilateral crude oil trade flows (HS 2709) by year. source=curated|db."""
```

**Service:** `signalmap.services.oil_trade_network.get_oil_trade_network(start_year, end_year, source)`

**Fallback:** `_oil_trade_fallback()` when service raises (uses curated data).

---

## 4. Service Function

**File:** `apps/api/src/signalmap/services/oil_trade_network.py`

**Function:** `get_oil_trade_network(start_year, end_year, source)`

**Data source:**

- **source=curated:** `signalmap.data.oil_trade_curated.get_curated_edges(year)` — static Python dict
- **source=db:** `_query_edges_by_year()` — SQL query on `oil_trade_edges` table

**Transformations:**

1. **DB:** EU member importers (Germany, Netherlands, France, etc.) are aggregated to `"EU"`
2. **DB:** Country names normalized (e.g. `"USA"` → `"United States"`, `"Rep. of Korea"` → `"South Korea"`)
3. **DB:** Multiple exporter→importer rows for same year aggregated (sum per source, target)
4. **Output:** `{ source, target, value }` per edge; `value` = thousand barrels/day

---

## 5. Original Data Source

### Database (Comtrade-ingested)

**Table:** `oil_trade_edges`

| Column | Type | Description |
|--------|------|-------------|
| year | INTEGER | Year |
| exporter | TEXT | Exporter country name |
| importer | TEXT | Importer country name |
| value | FLOAT | Thousand barrels/day |
| source | TEXT | `"comtrade"` or `"curated"` |
| updated_at | TIMESTAMPTZ | Last update |

**Primary key:** `(year, exporter, importer)`

### Curated fallback

**File:** `apps/api/src/signalmap/data/oil_trade_curated.py`

- **Schema:** `OIL_TRADE_CURATED: dict[str, list[dict]]` — year → list of `{ source, target, value }`
- **Coverage:** 2010–2023
- **Source:** Hand-curated; reflects sanctions, Russia→EU shift, etc.

### Comtrade source (for DB ingestion)

**File:** `apps/api/src/signalmap/sources/comtrade_oil_trade.py`

- **API:** UN Comtrade `https://comtradeapi.un.org/data/v1/get/C/A/HS`
- **HS code:** 2709 (crude oil)
- **Conversion:** NetWeight (kg) → metric tonnes → barrels (×7.33) → thousand barrels/day

---

## 6. Example Rows (5 samples)

```json
[
  { "source": "Saudi Arabia", "target": "China", "value": 900 },
  { "source": "Saudi Arabia", "target": "Japan", "value": 1100 },
  { "source": "Russia", "target": "EU", "value": 1400 },
  { "source": "Iran", "target": "China", "value": 450 },
  { "source": "United States", "target": "EU", "value": 120 }
]
```

---

## 7. Exact JSON Returned to Frontend

```json
{
  "years": {
    "2010": [
      { "source": "Saudi Arabia", "target": "China", "value": 900 },
      { "source": "Saudi Arabia", "target": "Japan", "value": 1100 },
      ...
    ],
    "2011": [
      { "source": "Saudi Arabia", "target": "China", "value": 950 },
      ...
    ],
    ...
  }
}
```

---

## 8. Dataset Summary

### Dimensions

| Dimension | Type | Description |
|-----------|------|-------------|
| **year** | string | Year (e.g. "2010", "2023") |
| **source** | string | Exporter country/region |
| **target** | string | Importer country/region |

### Measures

| Measure | Unit | Description |
|---------|------|-------------|
| **value** | thousand barrels/day | Bilateral crude oil trade flow |

### Time resolution

- **Annual** — one value per year per exporter–importer pair

### Possible new analyses

1. **Exporter time series:** Total exports by country over time
2. **Importer dependency:** Share of imports by source for major importers
3. **Market share:** Exporter share of global crude exports by year
4. **Sanctions impact:** Iran export flows before/after 2012–2013
5. **Russia reorientation:** Russia→EU vs Russia→India/China after 2022
6. **US export growth:** US exports over time (shale era)
7. **Regional diversification:** Import concentration (Herfindahl) by importer
8. **Trade concentration:** Top N flows as % of total trade by year
