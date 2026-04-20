# SignalMap Technical Architecture

A technical summary of the SignalMap repository structure and how the system works.

---

## 1. Repository Structure

```
signalmap/
├── apps/
│   ├── api/          # FastAPI backend (port 8000)
│   └── web/          # Next.js frontend (port 3000)
├── docs/             # Deployment and setup docs
├── .github/          # GitHub Actions (e.g. cron workflow)
├── pnpm-workspace.yaml
└── package.json      # Root scripts: pnpm dev (runs both apps)
```

| Folder | Purpose |
|--------|---------|
| `apps/api` | FastAPI backend: signals, Wayback, cron, jobs |
| `apps/web` | Next.js App Router: studies UI, charts, API proxy routes |
| `docs` | Railway cron setup, Cursor context |
| `.github/workflows` | Daily cron (POST to `/api/cron/update-all`) |

### API ↔ Web Interaction

```
┌─────────────────┐     fetch("/api/...")      ┌─────────────────┐
│   Browser       │ ─────────────────────────► │  Next.js (3000)  │
│   (Client)      │     same-origin (no CORS)  │  API Routes      │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                                         │ fetch(API_URL + path)
                                                         ▼
                                                ┌─────────────────┐
                                                │  FastAPI (8000) │
                                                │  Backend        │
                                                └─────────────────┘
```

- Client fetches `/api/*` (same origin as Next.js).
- Next.js API routes proxy to FastAPI using `API_URL`.
- No CORS or direct backend URL in the browser.

---

## 2. Signal Data Pipeline

### Flow

```
External APIs (FRED, EIA, Bonbast, etc.)
         │
         ▼
┌─────────────────────┐
│  sources/*.py       │  Fetch raw data
│  (fred_brent, etc.) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     cache miss      ┌─────────────────────┐
│  services/signals   │ ──────────────────► │  store/signals_repo │
│  (orchestration)    │                     │  (Postgres)          │
└──────────┬──────────┘                     └─────────────────────┘
           │
           │  cache hit
           ▼
┌─────────────────────┐
│  utils/ttl_cache    │  In-memory TTL (6h)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  main.py endpoints  │  /api/signals/oil/brent, etc.
└─────────────────────┘
```

### Read Path (Cache → DB → Fetch)

1. **TTL cache** – In-memory, 6h TTL (`signalmap.utils.ttl_cache`)
2. **Postgres** – `signal_points` via `signals_repo.get_points()`
3. **Fetch** – Call source (e.g. FRED), then `upsert_points()` into DB

### Transformations

- **Real oil**: Brent ÷ CPI × CPI_base (CPI from FRED)
- **Oil PPP Iran/Turkey**: oil_avg × PPP (World Bank)
- **Export revenue proxy**: oil_price × export_volume, indexed
- **USD/toman**: Merge rial-exchange-rates-archive + Bonbast + FRED

### Caching

| Layer | Where | TTL |
|-------|-------|-----|
| In-memory | `signalmap.utils.ttl_cache` | 6 hours |
| Postgres | `signal_points` | Persistent |
| Wayback | `wayback_snapshot_cache` | Persistent |

---

## 3. Backend Architecture (FastAPI)

### `main.py`

- FastAPI app, CORS, startup (`init_tables()`)
- Signal endpoints: `/api/signals/oil/brent`, `/api/signals/gold/global`, etc.
- Cron: `POST /api/cron/daily-update`, `POST /api/cron/update-all`
- Wayback: Instagram, YouTube, Twitter cache-first and jobs
- YouTube: channel cache-first, comments wordcloud/sentiment
- Events: `/api/events`
- Meta: `/api/meta/last-update`

### `db.py`

- Postgres via `psycopg2`
- `cursor()` context manager
- `init_tables()` – creates tables if missing:
  - `wayback_snapshot_cache`, `wayback_jobs`, `wayback_job_snapshots`
  - `signal_points`
  - `youtube_channel_snapshots`, `youtube_comment_snapshots`
  - `data_updates`
- `upsert_data_update()`, `get_data_update()` for cron timestamps

### `jobs.py`

- Wayback job runners (Instagram, YouTube, Twitter)
- Cache-first logic: DB → live fetch → upsert
- `_run_instagram_job`, `_run_youtube_job`, `_run_twitter_job`
- YouTube channel cache-first and snapshot upsert

### `services/`

| Module | Role |
|--------|------|
| `signals.py` | Signal orchestration: cache → DB → fetch, transformations |
| `daily_updates.py` | Cron updaters for oil, fx, gold, fx_dual, oil_production, youtube |
| `comment_wordcloud.py` | YouTube comment word frequencies |
| `comment_sentiment.py` | Per-video sentiment |

### `sources/`

| Module | Data |
|--------|------|
| `fred_brent.py` | Brent oil (FRED DCOILBRENTEU) |
| `fred_cpi.py` | US CPI (FRED CPIAUCSL) |
| `fred_iran_fx.py` | Official USD/IRR (FRED) |
| `bonbast_usd_toman.py` | Open-market USD/toman |
| `rial_archive_usd_toman.py` | Historical toman archive |
| `world_bank_ppp.py` | Iran/Turkey PPP |
| `oil_production_exporters.py` | EIA oil production (USA, SAU, RUS, IRN) |

### `connectors/`

| Module | Role |
|--------|------|
| `wayback_youtube.py` | YouTube channel snapshots from Wayback |
| `wayback_twitter.py` | Twitter follower snapshots |
| `youtube.py` | YouTube Data API v3 (channels) |
| `youtube_comments.py` | Comment ingestion |
| `fred_oil.py` | FRED oil-related helpers |

### `data/` (embedded datasets)

| Module | Content |
|--------|---------|
| `oil_annual.py` | Pre-1987 annual oil (EIA) |
| `gold_annual.py` | Annual gold prices |
| `iran_wage_cpi.py` | Iran nominal wage, CPI |
| `iran_export_volume.py` | Iran export volume estimates |
| `oil_production_exporters.py` | Static fallback for oil production |
| `load_events.py`, `events_*.py` | Event layers for studies |

---

## 4. Frontend Architecture (Next.js)

### Study Definitions (`lib/studies.ts`)

```ts
STUDIES: StudyMeta[] = [
  { id: "iran", primarySignal: { kind: "oil_brent" }, timeRange: ["2021-01-15", "today"], ... },
  { id: "oil_major_exporters", primarySignal: { kind: "oil_production_major_exporters" }, ... },
  ...
]
```

- `primarySignal.kind` selects which API and chart to use
- `timeRange` is `[start, end]`; `"today"` is resolved at runtime
- `eventLayers` for event overlays
- `concepts` for learning notes

### Charts

- `TimelineChart` (`components/timeline-chart.tsx`) – main time-series chart (ECharts)
- `FollowerGrowthChart` – follower growth with linear/exponential/logistic fits
- `EventsTimeline` – event markers

### API Data Fetching

- `fetchJson(path)` in `lib/api.ts` – same-origin `/api/...`
- Study page `useEffect` calls `fetchJson` based on `primarySignal.kind`:
  - Oil: `/api/signals/oil/brent`, `/api/signals/oil/global-long`, etc.
  - FX: `/api/signals/fx/usd-toman`, `/api/signals/fx/usd-irr-dual`
  - Gold: `/api/signals/gold/global`
  - Wage: `/api/signals/wage/iran-minimum-cpi`
  - Events: `/api/events?study_id=...&layers=...`

### Routing

- `/studies` – list of studies
- `/studies/[studyId]` – study detail (dynamic)
- `/explore` – explore index
- `/explore/wayback/[jobId]` – Wayback job results
- `/explore/youtube/wordcloud`, `/explore/youtube/sentiment` – YouTube tools

---

## 5. Database and Caching

### Tables

| Table | Purpose |
|-------|---------|
| `signal_points` | Time series: (signal_key, date, value, source, metadata) |
| `wayback_snapshot_cache` | Cached Wayback snapshots (platform, canonical_url, timestamp) |
| `wayback_jobs` | Job metadata (status, progress) |
| `wayback_job_snapshots` | Job results |
| `youtube_channel_snapshots` | Channel subscriber/view/video counts |
| `youtube_comment_snapshots` | Comment text for wordcloud/sentiment |
| `data_updates` | Last cron run (key → last_updated) |

### Cache-First Logic

- **Signals**: TTL cache → `signal_points` → external fetch + upsert
- **Wayback**: DB cache → live fetch (with rate limiting) → upsert
- **YouTube channel**: DB cache → YouTube API → upsert

---

## 6. Cron Jobs / Background Jobs

### Scheduled Updates

| Method | Config | Trigger |
|--------|--------|---------|
| Railway Cron (Python) | `apps/api/railway.cron.json` | Runs `cron_daily_update.py` on schedule |
| Railway Cron (HTTP) | `apps/api/railway.cron-http.json` | `curl -X POST $CRON_API_URL/api/cron/update-all` |
| GitHub Actions | `.github/workflows/cron-update-data.yml` | Daily POST to `CRON_API_URL` |
| cron-job.org | Manual | POST to `/api/cron/update-all` |

### Data Refreshed by Cron

- `update_brent_prices` – Brent oil
- `update_fx_usd_toman` – USD/toman
- `update_gold_prices` – no-op (annual only)
- `update_dual_fx_rates` – official USD/IRR
- `update_oil_production_exporters` – oil production
- `update_youtube_channel_snapshots` – channels in `YOUTUBE_DAILY_UPDATE_CHANNELS`

### Background Jobs (Wayback)

- `POST /api/wayback/instagram/jobs`, `/youtube/jobs`, `/twitter/jobs`
- Returns `job_id`, runs in `BackgroundTasks`
- Poll `GET /api/wayback/jobs/{job_id}` for status

---

## 7. Data Flow: User Opens a Study Page

```
1. User navigates to /studies/oil_major_exporters

2. Next.js renders apps/web/src/app/studies/[studyId]/page.tsx
   - useParams() → studyId = "oil_major_exporters"
   - getStudyById("oil_major_exporters") → study meta (primarySignal, timeRange)

3. useEffect fetches:
   - fetchJson("/api/events?study_id=oil_major_exporters&layers=iran_core,sanctions,opec_decisions")
   - fetchJson("/api/meta/last-update")
   - fetchJson("/api/signals/oil/production-exporters?start=2000-01-01&end=2026-03-04")

4. Next.js API route (apps/web/src/app/api/signals/oil/production-exporters/route.ts):
   - GET ${API_URL}/api/signals/oil/production-exporters?start=...&end=...
   - Returns JSON to client

5. FastAPI (main.py) → get_oil_production_exporters_signal()
   - TTL cache check
   - get_points() for us, saudi_arabia, russia, iran
   - If DB incomplete → fetch_oil_production_exporters() (EIA or static)
   - Merge, extend to current year if needed
   - Cache and return

6. Study page receives data, sets state (productionUsPoints, etc.)

7. useMemo builds extended series (synthetic current-year point if needed)

8. TimelineChart renders multiSeries (US, Saudi, Russia, Iran, Total)

9. getLatestDate() computes "Data last available" from non-synthetic points
```

---

## 8. Extensibility: Adding a New Signal

### Backend

1. **Source** – `apps/api/src/signalmap/sources/my_signal.py`:
   ```python
   def fetch_my_signal(start: str, end: str) -> list[dict]:
       # Return [{"date": "YYYY-MM-DD", "value": float}, ...]
   ```

2. **Service** – `apps/api/src/signalmap/services/signals.py`:
   ```python
   def get_my_signal_series(start: str, end: str) -> dict:
       ck = _cache_key("my_signal", start, end)
       cached = cache_get(ck)
       if cached: return cached
       db_points = get_points("my_signal", start, end)
       if db_points: ...
       points = fetch_my_signal(start, end)
       if points: upsert_points("my_signal", points, source="...")
       result = {"signal": "my_signal", "unit": "...", "points": points}
       cache_set(ck, result, CACHE_TTL)
       return result
   ```

3. **Endpoint** – `apps/api/main.py`:
   ```python
   @app.get("/api/signals/my-category/my-signal")
   def get_my_signal(start: str = Query(...), end: str = Query(...)):
       return get_my_signal_series(start, end)
   ```

4. **Cron (optional)** – `apps/api/src/signalmap/services/daily_updates.py`:
   - Add updater and register in `DATA_SOURCE_UPDATERS`

### Database

- Uses existing `signal_points` with a new `signal_key`
- No migration if schema is unchanged

### Frontend

1. **Study** – `apps/web/src/lib/studies.ts`:
   ```ts
   { kind: "my_signal" }  // Add to PrimarySignal union
   { id: "my_study", primarySignal: { kind: "my_signal" }, timeRange: [...], ... }
   ```

2. **API route** – `apps/web/src/app/api/signals/my-category/my-signal/route.ts`:
   - Proxy to `${API_BASE}/api/signals/my-category/my-signal?start=&end=`

3. **Study page** – `apps/web/src/app/studies/[studyId]/page.tsx`:
   - Add `isMySignal` from `primarySignal.kind`
   - Add state for points/source
   - Add `useEffect` to fetch `/api/signals/my-category/my-signal`
   - Add chart branch for this signal type
