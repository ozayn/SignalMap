# Signal Registry

Canonical reference for all time-series signals in SignalMap. Signals are stored in `signal_points` (Postgres) and served via API endpoints.

---

## Signal Keys (DB / Internal)

These are the `signal_key` values used in `signal_points` and `signals.py`:

| Signal Key | Unit | Resolution | Cron Updated |
|------------|------|------------|--------------|
| `brent_oil_price` | USD/barrel | daily | ✓ (oil) |
| `usd_toman_open_market` | toman per USD | daily | ✓ (fx) |
| `usd_irr_official` | toman per USD | annual | ✓ (fx_dual) |
| `oil_production_us` | million bbl/day | annual | ✓ (oil_production_exporters) |
| `oil_production_saudi` | million bbl/day | annual | ✓ |
| `oil_production_russia` | million bbl/day | annual | ✓ |
| `oil_production_iran` | million bbl/day | annual | ✓ |

**Computed / static (not stored in DB):**
- `oil_global_long` — Derived from EIA + Brent
- `real_oil_price` — Derived from Brent + CPI
- `oil_price_ppp_iran` — Derived from Brent + World Bank PPP
- `oil_price_ppp_turkey` — Derived from Brent + World Bank PPP
- `iran_oil_export_volume` — Static (IRAN_EXPORT_VOLUME_EST)
- `derived_export_revenue_proxy` — Derived from oil × volume
- `gdp_composition` — World Bank WDI (per country, TTL cache; not in `signal_points`)

---

## API Endpoints → Signals

| Endpoint | Signal(s) | Service Function |
|----------|-----------|------------------|
| `GET /api/signals/oil/brent` | brent_oil_price | `get_brent_series` |
| `GET /api/signals/oil/global-long` | oil_global_long | `get_oil_global_long_series` |
| `GET /api/signals/oil/real` | real_oil_price | `get_real_oil_series` |
| `GET /api/signals/oil/ppp-iran` | oil_price_ppp_iran | `get_oil_ppp_iran_series` |
| `GET /api/signals/oil/ppp-turkey` | oil_price_ppp_turkey | `get_oil_ppp_turkey_series` |
| `GET /api/signals/oil/export-capacity` | oil_price + iran_oil_export_volume + derived_export_revenue_proxy | `get_oil_export_capacity_study` |
| `GET /api/signals/oil/production-exporters` | oil_production_us, _saudi, _russia, _iran | `get_oil_production_exporters_series` |
| `GET /api/signals/gold/global` | (static) | `get_gold_price_global_series` |
| `GET /api/signals/fx/usd-toman` | usd_toman_open_market | `get_usd_toman_series` |
| `GET /api/signals/fx/usd-irr-dual` | usd_irr_official + usd_toman_open_market | `get_usd_irr_dual_series` |
| `GET /api/signals/wage/iran-minimum-cpi` | (static) | `get_iran_wage_cpi_series` |
| `GET /api/market/brent-current` | (FMP, cached 1h) | `get_current_brent_price` |
| `GET /api/signals/macro/gdp-composition` | gdp_composition (WDI indicators) | `get_gdp_composition_series` |

---

## Signal Details

### Oil

| Signal | Endpoint | Source | Resolution | Notes |
|--------|----------|--------|-------------|-------|
| **Brent** | `/api/signals/oil/brent` | FRED DCOILBRENTEU | daily | Requires FRED_API_KEY. Cron: append-only. |
| **Oil global long** | `/api/signals/oil/global-long` | EIA (pre-1987) + FRED Brent (1987+) | annual pre-1987, daily from 1987-05-20 | Sampled to monthly for ranges >10 years. |
| **Real oil** | `/api/signals/oil/real` | Brent + FRED CPIAUCSL | daily | Constant 2015 USD. CPI base: 2015-01. |
| **Oil PPP Iran** | `/api/signals/oil/ppp-iran` | Brent + World Bank PA.NUS.PPP | annual | PPP-adjusted toman per barrel. |
| **Oil PPP Turkey** | `/api/signals/oil/ppp-turkey` | Brent + World Bank PA.NUS.PPP | annual | PPP-adjusted lira per barrel. |
| **Oil export capacity** | `/api/signals/oil/export-capacity` | Brent + IRAN_EXPORT_VOLUME_EST | annual | Study 9: price, volume, revenue proxy. |
| **Oil production exporters** | `/api/signals/oil/production-exporters` | EIA/IMF or DB | annual | US, Saudi, Russia, Iran. Fallback to fetch if DB empty. |

### FX

| Signal | Endpoint | Source | Resolution | Notes |
|--------|----------|--------|-------------|-------|
| **USD→Toman** | `/api/signals/fx/usd-toman` | Bonbast archive + rial-exchange-rates-archive + FRED | daily (2012+), annual (pre-2012) | Merged from multiple sources. |
| **USD/IRR dual** | `/api/signals/fx/usd-irr-dual` | FRED XRNCUSIRA618NRUG + open market | annual (official), daily (open) | Study 12: dual exchange rates. |

### Other

| Signal | Endpoint | Source | Resolution | Notes |
|--------|----------|--------|-------------|-------|
| **Gold** | `/api/signals/gold/global` | GOLD_ANNUAL (static) | annual | LBMA/Treasury/WGC. No daily source. |
| **Iran wage/CPI** | `/api/signals/wage/iran-minimum-cpi` | IRAN_NOMINAL_MINIMUM_WAGE, IRAN_CPI_2010_BASE (static) | annual | Study 13: nominal + CPI for real wage. |
| **GDP composition** | `/api/signals/macro/gdp-composition` | World Bank WDI: shares NE.CON.TOTL.ZS, NE.GDI.TOTL.ZS; nominal NY.GDP.MKTP.CD; levels prefer NE.CON.TOTL.KD, NY.GDP.MKTP.KD, NE.GDI.TOTL.KD else *CD | annual | Study 27: % GDP, nominal GDP log, absolute levels. Query `levels_currency` (`usd` or `toman`; toman IRN-only): levels scaled by calendar-year mean open-market tomans per USD; response includes `levels_conversion`. Cached per ISO3; `data_span` + `levels.price_basis`. |
| **Brent current** | `/api/market/brent-current` | FMP (brent_market_price) | point-in-time | Cached 1h. Not in signal_points. |

---

## Read Path

All signals follow: **in-memory TTL cache (6h) → Postgres `signal_points` → fetcher (with upsert)**.

- Cache key format: `signal:{signal_key}:{start}:{end}` (or variant for derived signals)
- `get_points(signal_key, start, end)` — DB read
- `upsert_points(signal_key, points, source, ...)` — DB write (on fetch miss)
- Cron uses `insert_points_ignore_conflict` (append-only, no overwrite)

---

## Cron Updaters

From `daily_updates.DATA_SOURCE_UPDATERS`:

| Key | Signals Updated | Fetcher |
|-----|-----------------|---------|
| `oil` | brent_oil_price | FRED DCOILBRENTEU |
| `fx` | usd_toman_open_market | Bonbast + archive + FRED |
| `gold` | (none) | No daily gold source |
| `fx_dual` | usd_irr_official | FRED XRNCUSIRA618NRUG |
| `oil_production_exporters` | oil_production_us, _saudi, _russia, _iran | fetch_oil_production_exporters |
| `oil_trade_network` | oil_trade_edges (separate table) | Comtrade |
| `youtube_followers` | youtube_channel_snapshots (separate table) | YouTube Data API |

---

## Study → Signal Mapping

| Study | Primary Signal(s) |
|-------|-------------------|
| 2 (Brent) | brent_oil_price |
| 3 (USD-Toman) | usd_toman_open_market |
| 4 (Oil and FX) | brent_oil_price, usd_toman_open_market |
| 5 (Gold and oil) | gold_price_global, oil_global_long |
| 6 (Real oil) | real_oil_price |
| 7, 8 (PPP Iran/Turkey) | oil_price_ppp_iran, oil_price_ppp_turkey |
| 9 (Export capacity) | oil export capacity study (oil + volume + proxy) |
| 10 (Follower growth) | Wayback snapshots (not signal_points) |
| 11 (Events timeline) | Events only |
| 12 (Dual FX) | usd_irr_dual (official + open) |
| 13 (Real wage) | iran wage/CPI |
| 14 (Oil production) | oil_production_exporters |
| 15 (Oil trade) | oil_trade_edges |
| 16 (Geopolitical) | brent_oil_price |

---

## Adding a New Signal

1. **Define signal key** in `signals.py` (e.g. `SIGNAL_NEW = "new_signal_key"`).
2. **Implement fetcher** in `sources/` or use static data in `data/`.
3. **Add service function** in `signals.py` with cache → DB → fetch logic.
4. **Register API endpoint** in `main.py` and optionally in `apps/web/src/app/api/signals/`.
5. **If cron-updated:** add to `daily_updates.DATA_SOURCE_UPDATERS` and use `insert_points_ignore_conflict`.
6. **Wire to study** in `apps/web/src/app/studies/[studyId]/page.tsx`.
