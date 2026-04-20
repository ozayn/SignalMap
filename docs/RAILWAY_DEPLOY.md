# Railway deployment (web + API)

This repo uses **per-service** Railway config: each service’s **Root Directory** is a single app folder, and **Config-as-code** points at **`railway.json` inside that folder**. There is **no** root-level `railway.json` and **no** `railway.web.json` (removed on purpose).

## Verify repo layout

| Path | Role |
|------|------|
| `apps/web/railway.json` | Web service config-as-code |
| `apps/web/Dockerfile` | Web image build |
| `apps/api/railway.json` | API service config-as-code |
| `apps/api/Dockerfile` | API image build |

Cron-only services (optional): `apps/api/railway.cron.json`, `apps/api/railway.cron-http.json` — see **`docs/RAILWAY_CRON_SETUP.md`** (their Root/Config pattern may differ).

---

## Web service (Next.js)

Set these in the **Railway dashboard** for the **web** service (not in git alone—stale UI settings cause deploy failures).

| Railway UI field | Value | Resolves on disk to |
|------------------|-------|----------------------|
| **Root Directory** | `apps/web` | Repo folder `apps/web/` |
| **Config-as-code path** (may appear as *Railway config file*, *Config file*, or *Config path*) | **`railway.json`** | **`apps/web/railway.json`** |

- **Dockerfile:** Declared in that JSON as `build.dockerfilePath`: `Dockerfile` → build uses **`apps/web/Dockerfile`**.
- **Health check:** `deploy.healthcheckPath` in `apps/web/railway.json` → `/health`.
- **Required env:** **`API_URL`** — FastAPI base URL the Next.js server uses for server-side proxy.

**Rules:**

- Config-as-code path must be **`railway.json`** only (relative to **Root Directory** `apps/web`).
- Do **not** set it to `railway.web.json`, `/railway.web.json`, `apps/web/railway.web.json`, or a path relative to the monorepo root unless Root Directory is also the monorepo root (this project expects Root = `apps/web`).

---

## API service (FastAPI)

| Railway UI field | Value | Resolves on disk to |
|------------------|-------|----------------------|
| **Root Directory** | `apps/api` | Repo folder `apps/api/` |
| **Config-as-code path** | **`railway.json`** | **`apps/api/railway.json`** |

- **Dockerfile:** `apps/api/Dockerfile` via `dockerfilePath` in that JSON.
- **Port:** align with `EXPOSE` / app binding (e.g. `8080`).

---

## Troubleshooting: `service config at '/railway.web.json' not found`

That message means Railway is still trying to load the **old** root-level web config file. **Fixing this is done in the Railway project settings, not by adding files to the repo.** Do **not** re-add `railway.web.json`.

1. Open your Railway project → select the **Web** service.
2. Open **Settings** (or **Build** / **Deploy**, depending on UI version).
3. **Root Directory:** set to **`apps/web`** (not empty, not repo root unless you intentionally use a different layout).
4. **Config-as-code path** (or *Railway config file* / *Config file*): change **`/railway.web.json`** or **`railway.web.json`** to exactly **`railway.json`**.
5. Save, then **Redeploy**.

After this, Railway reads **`apps/web/railway.json`**. If the API service ever pointed at a wrong path, apply the same idea: Root **`apps/api`**, config **`railway.json`**.

---

## Related

- Root **`README.md`** → **Railway deployment** (env vars, health debug).
- **`docs/RAILWAY_CRON_SETUP.md`** — scheduled / cron services.
