# SignalMap Project State

Snapshot of the current repository state for development continuity.

---

## 1. Project Overview

**What SignalMap does:** Longitudinal studies of emotion, language, and interaction in public discourse. A research-style macro/geopolitical dashboard that overlays economic and social signals (oil prices, FX rates, wages, trade flows) with historical events.

**Purpose:** Provide contextual, measurement-focused views of macroeconomic and geopolitical data—especially Iran-related—for education and research. Emphasis on **measurement, not prediction**: descriptive overlays, event-anchored windows, and transparent sourcing.

**Design philosophy:**
- Education-first: LearningNote sections, concept keys, "In Simple Terms" explanations
- Measurement over prediction: no forecasts; focus on what the data shows
- Event overlays as exogenous anchors (not outcome variables)
- Transparent data sources and methodology

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js | 15.0.7 |
| | React | 18.3.1 |
| | ECharts | 5.5.1 |
| | Tailwind CSS | 3.4.15 |
| | TypeScript | 5.6.3 |
| **Backend** | FastAPI | ≥0.115.0 |
| | Uvicorn | ≥0.32.0 |
| | Python | (see requirements.txt) |
| **Database** | PostgreSQL | (via DATABASE_URL) |
| **Deployment** | Railway | (web + API + optional cron) |

**Backend dependencies (requirements.txt):**
- fastapi>=0.115.0
- uvicorn[standard]>=0.32.0
- httpx>=0.27.0
- pytest>=8.0.0
- psycopg2-binary>=2.9.9
- python-dotenv>=1.0.0
- textblob>=0.18.0

---

## 3. Repository Structure

```
signalmap/
├── apps/
│   ├── api/                    # FastAPI backend (port 8000)
│   │   ├── main.py             # API routes, cron endpoints
│   │   ├── db.py               # Postgres connection, schema
│   │   ├── jobs.py             # Wayback job runners
│   │   ├── cron_daily_update.py
│   │   ├── connectors/        # Wayback (Instagram, YouTube, Twitter)
│   │   └── src/signalmap/
│   │       ├── data/           # Static data, event loaders
│   │       ├── sources/        # FRED, EIA, Bonbast, Comtrade, etc.
│   │       ├── services/       # signals.py, daily_updates, comment_*
│   │       ├── store/          # signals_repo
│   │       ├── connectors/     # wayback_youtube, youtube_comments
│   │       └── utils/
│   │
│   └── web/                    # Next.js frontend (port 3000)
│       └── src/
│           ├── app/            # Routes, API proxies
│           │   ├── studies/[studyId]/  # Main study page
│           │   ├── explore/    # Wayback, YouTube wordcloud/sentiment
│           │   └── api/        # Next.js API routes (proxy to backend)
│           ├── components/     # TimelineChart, EventsTimeline, etc.
│           └── lib/            # studies.ts, concepts, api, oil-volatility
│
├── docs/
├── .github/workflows/          # cron-update-data.yml
└── pnpm-workspace.yaml
```

**Key directories:**
- `apps/api/src/signalmap/data/` — Event layers, load_events, events_iran.json, static series (gold, wage, export volume)
- `apps/api/src/signalmap/sources/` — External API fetchers (FRED, Bonbast, Comtrade, EIA, World Bank)
- `apps/api/src/signalmap/services/` — Signal orchestration, daily updates, comment wordcloud/sentiment
- `apps/web/src/components/` — TimelineChart, events-timeline, network-graph, oil-trade-sankey

---

## 4. Studies Currently Implemented

From `apps/web/src/lib/studies.ts`:

| id | number | title | primarySignal.kind |
|----|--------|-------|--------------------|
| 1 | 1 | SignalMap Overview | overview_stub |
| iran | 2 | Brent oil price as an exogenous context signal | oil_brent |
| usd-toman | 3 | USD→Toman (open market) as a socio-economic signal | fx_usd_toman |
| oil-and-fx | 4 | Oil and USD/toman: dual macroeconomic signals | oil_and_fx |
| global_oil_1900 | 5 | Global conflict and economic shocks (1900–present) | gold_and_oil |
| real_oil_price | 6 | Real oil prices and global economic burden | real_oil |
| iran_oil_ppp | 7 | Oil price burden in Iran (PPP-based) | oil_ppp_iran |
| iran_oil_ppp_turkey | 8 | Iran and Turkey: comparative PPP oil burden | oil_ppp_iran |
| iran_oil_export_capacity | 9 | Iran oil export capacity: price and volume | oil_export_capacity |
| oil_major_exporters | 14 | Major oil exporters: production levels | oil_production_major_exporters |
| follower_growth_dynamics | 10 | Follower growth dynamics over time | follower_growth_dynamics |
| events_timeline | 11 | Historical events timeline (1900–present) | events_timeline |
| iran_fx_spread | 12 | Dual Exchange Rates in Iran | fx_usd_irr_dual |
| iran_real_wage_cpi | 13 | Real Minimum Wage in Iran | wage_cpi_real |
| oil_trade_network | 15 | Oil trade network | oil_trade_network |
| oil_geopolitical_reaction | 16 | Oil market reaction to geopolitical tensions | oil_geopolitical_reaction |

Study 1 (overview) has `visible: false`. Others are active.

---

## 5. Signals Implemented

From `apps/api/src/signalmap/services/signals.py`:

| Signal | Endpoint | Data Source |
|--------|----------|-------------|
| Brent oil price | `/api/signals/oil/brent` | FRED DCOILBRENTEU |
| Gold price (global) | `/api/signals/gold/global` | Static (GOLD_ANNUAL: LBMA/Treasury/WGC) |
| Real oil price | `/api/signals/oil/real` | FRED Brent + FRED CPIAUCSL |
| Oil PPP Iran | `/api/signals/oil/ppp-iran` | FRED Brent + World Bank PPP |
| Oil PPP Turkey | `/api/signals/oil/ppp-turkey` | FRED Brent + World Bank PPP |
| Iran export volume | (internal) | Static (IRAN_EXPORT_VOLUME_EST: EIA/tanker estimates) |
| Export revenue proxy | (internal) | Derived: oil × volume |
| Oil export capacity study | `/api/signals/oil/export-capacity` | Brent + Iran export volume + proxy |
| USD→Toman | `/api/signals/fx/usd-toman` | Bonbast archive + rial-exchange-rates-archive + FRED |
| USD/IRR dual | `/api/signals/fx/usd-irr-dual` | FRED XRNCUSIRA618NRUG + open market |
| Oil production exporters | `/api/signals/oil/production-exporters` | EIA/IMF (fetch) or DB (cron) |
| Oil global long | `/api/signals/oil/global-long` | EIA annual pre-1987 + FRED Brent from 1987 |
| Iran wage/CPI | `/api/signals/wage/iran-minimum-cpi` | Static (IRAN_NOMINAL_MINIMUM_WAGE, IRAN_CPI_2010_BASE) |
| Brent market current | `/api/market/brent-current` | FMP (brent_market_price) |

Read path: in-memory TTL cache → Postgres `signal_points` → fetcher (with upsert).

---

## 6. API Endpoints

From `apps/api/main.py`:

**Core**
- `GET /` — API status
- `GET /health` — Health check
- `GET /api` — Endpoint index
- `GET /api/version` — Debug (jobs support)
- `GET /api/meta/last-update` — Last cron run (UTC ISO)

**Signals**
- `GET /api/signals/oil/brent` — Brent oil (start, end)
- `GET /api/signals/oil/global-long` — Long-range oil (annual + daily)
- `GET /api/signals/oil/real` — Real oil (CPI-adjusted)
- `GET /api/signals/oil/ppp-iran` — Iran PPP oil burden
- `GET /api/signals/oil/ppp-turkey` — Turkey PPP oil burden
- `GET /api/signals/oil/production-exporters` — US, Saudi, Russia, Iran production
- `GET /api/signals/oil/export-capacity` — Study 9 combined
- `GET /api/signals/gold/global` — Gold price (annual)
- `GET /api/signals/fx/usd-toman` — USD→Toman
- `GET /api/signals/fx/usd-irr-dual` — Dual exchange rates
- `GET /api/signals/wage/iran-minimum-cpi` — Iran wage/CPI
- `GET /api/market/brent-current` — Latest Brent (FMP, cached 1h)

**Events**
- `GET /api/events` — Contextual events (study_id, layers)

**Networks**
- `GET /api/networks/oil-trade` — Bilateral oil trade by year (source=curated|db)

**Overview**
- `GET /api/overview` — Study overview (anchor_event_id, window_days)

**Cron**
- `POST /api/cron/daily-update` — Legacy: oil, fx, gold
- `POST /api/cron/update-all` — Unified: oil, fx, gold, fx_dual, oil_production, oil_trade, youtube_followers
- `POST /api/cron/update-oil-trade` — Oil trade network (Comtrade)

**Wayback**
- `GET /api/wayback/snapshots` — Generic URL snapshots
- `GET /api/wayback/instagram`, `/cached`, `/cache-first`, `/followers`, `/debug`
- `GET /api/wayback/youtube`, `/cached`, `/cache-first`, `/debug`
- `GET /api/wayback/twitter`, `/cache-first`
- `POST /api/wayback/instagram/jobs`, `/youtube/jobs`, `/twitter/jobs`
- `GET /api/wayback/jobs/list`, `/jobs/{id}`, `/jobs/{id}/results`
- `POST /api/wayback/jobs/{id}/cancel`, `DELETE /api/wayback/jobs/{id}`

**YouTube**
- `GET /api/youtube/channel/cache-first` — Channel snapshots (subscribers, views, videos)
- `POST /api/youtube/channel/jobs`
- `GET /api/youtube/comments/wordcloud` — Word frequencies
- `GET /api/youtube/comments/sentiment` — Sentiment for one video

---

## 7. Data Sources

| Source | Use |
|--------|-----|
| **FRED** | Brent oil (DCOILBRENTEU), CPI (CPIAUCSL), Iran FX (XRNCUSIRA618NRUG). Requires `FRED_API_KEY`. |
| **EIA** | Annual oil prices pre-1987; oil production (US, Saudi, Russia, Iran) via EIA International Data API. |
| **Bonbast / rial-exchange-rates-archive** | USD→Toman open-market rate (2012–present). |
| **World Bank / ICP** | PPP conversion factors (PA.NUS.PPP) for Iran and Turkey. |
| **UN Comtrade** | Bilateral crude oil trade (HS 2709). Optional `COMTRADE_API_KEY`. |
| **Internet Archive (Wayback)** | Follower/subscriber snapshots for Instagram, YouTube, Twitter. |
| **YouTube Data API v3** | Channel snapshots (subscribers, views, videos). Optional `YOUTUBE_API_KEY`. |
| **FMP (Financial Modeling Prep)** | Current Brent market price (fallback). |
| **Static datasets** | Gold annual (GOLD_ANNUAL), Iran wage/CPI (iran_wage_cpi), Iran export volume (iran_export_volume), oil annual EIA (oil_annual). |

---

## 8. Caching and Jobs

**Tables (Postgres):**
- `wayback_snapshot_cache` — Cached follower/subscriber snapshots (platform, canonical_url, timestamp)
- `wayback_jobs` — Job metadata (status, sample, progress)
- `wayback_job_snapshots` — Job results
- `signal_points` — Time-series points (signal_key, date, value)
- `youtube_channel_snapshots` — Channel subscriber/view/video counts
- `youtube_comment_snapshots` — Comment text for wordcloud/sentiment
- `data_updates` — Last update timestamp (key: `global_update`)
- `oil_trade_edges` — Bilateral trade (year, exporter, importer, value)

**In-memory cache:** `signalmap.utils.ttl_cache` (6h for signals, 1h for Brent market).

**Jobs:** Wayback fetch jobs for Instagram, YouTube, Twitter. Create via POST, run in background, poll via GET.

**Cron workflow:**
- `POST /api/cron/update-all` runs: oil (Brent), fx (USD/toman), gold (no-op), fx_dual, oil_production_exporters, oil_trade_network, youtube_followers
- Idempotent: append-only, fetches only missing dates
- Records `global_update` in `data_updates`
- Options: Railway Cron (Python or HTTP), GitHub Actions, cron-job.org
- See `docs/RAILWAY_CRON_SETUP.md`

---

## 9. Event System

**events_iran.json** (`apps/api/src/signalmap/data/events_iran.json`):
- Canonical source for Iran events 2021+
- Fields: id, title, date/date_start/date_end, type, description, category, layer, signal_relevance
- Loaded by `events_iran_loader.load_events_iran_json()`

**Events loader** (`load_events.py`):
- `load_events(study_id)` — Returns events for `events_timeline` study; else []
- `get_events_by_layers(study_id, layer_list)` — Merges events from requested layers, dedupes by id
- Layers: `iran_presidents`, `iran_core`, `world_core`, `world_1900`, `sanctions`, `opec_decisions`
- Iran core: pre-2021 hardcoded + events_iran.json + U.S.–Israel Iran strikes 2026

**Timeline usage:** Study 11 (events_timeline) shows all events in categories: iran_domestic, iran_external, global_geopolitics, energy_markets.

**Overlay usage:** Studies request events via `GET /api/events?study_id=...&layers=iran_core,sanctions,opec_decisions`. Frontend overlays point events (vertical lines) and range events (bands) on charts via `TimelineChart` (ECharts markLine/markArea). Event dropdown + ±N years window zooms chart to anchor event.

---

## 10. Current Unfinished Work

Areas that may need attention (inferred from structure and docs):

- **EIA oil production integration:** Oil production uses EIA/IMF fetch or DB; cron populates `signal_points` for four signals. Fallback to static when DB empty.
- **Monthly oil production:** Production data is annual; no monthly series.
- **YouTube comments:** Wordcloud and sentiment require `youtube_comment_snapshots`; ingestion via `ingest_youtube_comments.py` / `seed_comment_snapshots.py`.
- **Social media analytics:** Wayback jobs and cache-first endpoints exist; follower growth study uses archival snapshots.
- **Comtrade oil trade:** Optional `COMTRADE_API_KEY`; curated fallback when unavailable. `update_oil_trade_network` cron fetches missing years.
- **Cron reliability:** Railway free tier cold starts; HTTP-trigger cron (Option 3) recommended if Python cron has connection issues.
- **Font preload warning:** Next.js Inter font preload can warn on study pages (client-rendered content). Cosmetic; `preload: false` or `display: "optional"` can suppress.

---

## 11. Output Style

This document is structured for clarity and quick onboarding. Sections are self-contained. Use it to resume development in a new chat or context.
