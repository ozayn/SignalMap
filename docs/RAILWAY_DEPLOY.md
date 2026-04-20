# Railway deployment (API + Web)

Railway configs live **per app** under `apps/api` and `apps/web`. There is **no** root-level `railway.json` or `railway.web.json` in this repo.

## Web service (Next.js)

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/web` |
| **Config file** | `railway.json` (path is **relative to Root Directory**, so Railway resolves `apps/web/railway.json`) |
| **Dockerfile** | Declared in `apps/web/railway.json` as `build.dockerfilePath`: `Dockerfile` → `apps/web/Dockerfile` |
| **Health check** | `deploy.healthcheckPath` in that file → `/health` |

Required variable: **`API_URL`** (FastAPI base URL the Next.js server uses to proxy).

### If deploy fails: `service config at '/railway.web.json' not found`

That path is the **old** root-level web config (removed). Railway is still using a saved **custom config path**.

1. Open the **Web** service → **Settings** (or **Service** → **Build / Deploy**).
2. Set **Root Directory** to **`apps/web`** (not repo root).
3. Set **Railway config file** / **Config path** to **`railway.json`** only — **not** `railway.web.json`, not `/railway.web.json`, not a path outside `apps/web`.
4. Redeploy.

After Root Directory is `apps/web`, the effective config file on disk is **`apps/web/railway.json`**.

## API service (FastAPI)

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/api` |
| **Config file** | `railway.json` → `apps/api/railway.json` |
| **Dockerfile** | `apps/api/Dockerfile` (via `dockerfilePath` in that JSON) |

Cron variants (separate services if used): `apps/api/railway.cron.json`, `apps/api/railway.cron-http.json` — see `docs/RAILWAY_CRON_SETUP.md`.

## Related docs

- Root README → **Railway deployment** section for env vars and debugging.
- `docs/RAILWAY_CRON_SETUP.md` — scheduled updates.
