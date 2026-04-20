# SignalMap

Longitudinal studies of emotion, language, and interaction in public discourse.

## Structure

```
signalmap/
├── apps/
│   ├── web/     # Next.js (port 3000)
│   └── api/     # FastAPI (port 8000)
└── pnpm-workspace.yaml
```

**Ports:** Web 3000, API 8000. Never use 5000 (macOS AirPlay conflict).

## Run locally (macOS)

```bash
# 0. If pnpm not installed: corepack enable pnpm

# 1. Install dependencies
pnpm install

# 2. Install Python API deps (venv recommended — see apps/api)
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

# 3. Start both
pnpm dev
```

**Shell scripts** in `scripts/` (same as `package.json`; run from repo root):

| Script | Equivalent |
|--------|------------|
| `./scripts/dev.sh` | `pnpm dev` — web + API |
| `./scripts/restart.sh` | `pnpm restart` — graceful restart both |
| `./scripts/restart-api.sh` | `pnpm restart:api` — API only |
| `./scripts/dev-fresh.sh` | `pnpm dev:fresh` — clean `.next`, kill ports, dev |

Scripts use global `pnpm` if available, otherwise `npx pnpm`. See `docs/DEV_SCRIPTS.md`.

**If you see 404s for `/_next/static/...`** (layout.css, chunks, etc.): the build cache is out of sync. Stop any running dev server, run `pnpm clean`, then `pnpm dev`.

- Web: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Run cron locally

Update oil, fx, gold, fx_dual, and YouTube channel data. Requires `DATABASE_URL` and `FRED_API_KEY` in `apps/api/.env`.

```bash
cd apps/api && source .venv/bin/activate
PYTHONPATH=src python cron_daily_update.py
```

Or trigger via HTTP (with API running):

```bash
curl -X POST http://localhost:8000/api/cron/update-all
```

The study page shows "Last updated" after a successful run.

## Railway deployment

Add a **Postgres** database and link it to the API service for Wayback jobs (cache + job queue).

Use **two Railway services** in the same project. Each service sets **Root Directory** to its app folder so the Docker build context is only that app (no root-level `railway.json` / `railway.web.json` — those were removed to avoid the wrong service building).

### API service
- **Root Directory:** `apps/api`
- **Config file (repo):** `apps/api/railway.json` — in the Railway UI this often appears as **`railway.json`** because the service root is already `apps/api`.
- **Dockerfile:** `apps/api/Dockerfile` (`dockerfilePath` in that config is `Dockerfile`)
- **Port:** `8080` (match `EXPOSE` / your `run.py` / `PORT` binding)

### Web service
- **Root Directory:** `apps/web`
- **Config file (repo):** `apps/web/railway.json` — in the UI, **`railway.json`** relative to the service root.
- **Dockerfile:** `apps/web/Dockerfile` (context is only `apps/web`; install is **`npm install`** from `apps/web/package.json`, no repo-root `pnpm-lock.yaml` required)
- Settings → Networking → ensure target port matches `PORT` (Railway auto-sets this)
- **Do not set a deploy `startCommand` that uses `cd`** — use the Dockerfile `CMD` (via `sh -c`). Both configs rely on Docker `CMD` / `railway.json` `startCommand` only where a plain executable is valid (API).

**Environment variables:**

| Service | Variable | Value |
|---------|----------|-------|
| Web | `API_URL` | **Required.** Backend URL for server-side proxy: `https://api-production-XXXX.up.railway.app` or `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| API | `DATABASE_URL` | Postgres URL (link Postgres service). Required for Wayback jobs. |
| API | `FRED_API_KEY` | **Required for Brent oil.** FRED API key for DCOILBRENTEU. Get one at [fred.stlouisfed.org/docs/api](https://fred.stlouisfed.org/docs/api/api_key.html). Do not commit. |
| API | `YOUTUBE_API_KEY` | Optional. YouTube Data API v3 key for channel snapshots (subscriber/view/video counts). Create at [Google Cloud Console](https://console.cloud.google.com/apis/credentials); do not commit real keys. |
| API | `YOUTUBE_DAILY_UPDATE_CHANNELS` | Optional. Comma-separated handles or channel IDs to refresh daily via cron (e.g. `googledevelopers,@bpluspodcast`). |
| API | `YOUTUBE_REFRESH_CODE` | Optional. Admin code required for "Refresh from YouTube" on discourse studies (uses API quota). If set, users must enter this code to refresh. |
| API | `WEB_ORIGIN` | Optional. Web URL for CORS (only needed if clients hit API directly) |

**Custom domain:** With a custom domain on the web service, the client uses same-origin fetches (`/api/...`). Next.js proxies to the backend, so no CORS or `NEXT_PUBLIC_API_URL` is needed.

**Debug:** Hit `https://your-web.up.railway.app/api/health` to check API connectivity.

### Daily data updates

Unified endpoint updates all time-varying sources (oil, fx, fx_dual, gold, youtube_followers):

```bash
curl -X POST https://your-api.up.railway.app/api/cron/update-all
```

**Legacy:** `POST /api/cron/daily-update` still works for oil/fx/gold only.

**Schedule it:** See `docs/RAILWAY_CRON_SETUP.md`. Options:

- **Railway Cron (HTTP trigger):** New service, root `apps/api`, config `apps/api/railway.cron-http.json`. Set `CRON_API_URL` to your API URL. Triggers the endpoint via curl—no DB in cron service. Use if the Python cron has connection issues.
- **Railway Cron (Python):** Config `apps/api/railway.cron.json`. Requires DATABASE_URL, FRED_API_KEY. See `docs/RAILWAY_CRON_SETUP.md`.
- **GitHub Actions:** `.github/workflows/cron-update-data.yml` runs daily. Add `CRON_API_URL` as repo secret.
- **cron-job.org:** POST to `/api/cron/update-all` on a schedule.

Idempotent—safe to run multiple times.

**YouTube channels:** Set `YOUTUBE_DAILY_UPDATE_CHANNELS` (comma-separated handles or channel IDs) and `YOUTUBE_API_KEY` to refresh channel snapshots daily.

**FRED API (Brent oil):** Required for oil signals and cron updates. Local: `export FRED_API_KEY=your_key`. Railway: Add `FRED_API_KEY` in API service variables. Get a key at [fred.stlouisfed.org/docs/api](https://fred.stlouisfed.org/docs/api/api_key.html).

### Sync YouTube comment analysis to production

To push cached YouTube comment analysis (keywords, narrative phrases, discourse maps) from local to production:

```bash
cd apps/api

# 1. Seed local DB from file cache (if needed)
.venv/bin/python scripts/seed_all_youtube_cache_to_db.py

# 2. Sync to production (requires DATABASE_URL and DATABASE_URL_PROD in .env)
.venv/bin/python scripts/sync_youtube_comment_analysis_to_production.py --channel-id UCGttrUON87gWfU6dMWm1fcA
```

- `DATABASE_URL` = local Postgres (source)
- `DATABASE_URL_PROD` = production Postgres (Railway public URL, not internal)
- Omit `--channel-id` to sync all channels
- Use `--clear` to delete all prod rows before syncing
