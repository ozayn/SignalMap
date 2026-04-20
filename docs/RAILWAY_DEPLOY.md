# Railway deployment (web + API)

This repo uses **per-service** Railway config: each service’s **Root Directory** is a single app folder (`apps/web`, `apps/api`). The **Config-as-code** file path is separate: per [Railway’s monorepo docs](https://docs.railway.app/guides/monorepo), the config path **does not follow** Root Directory—you should set it as an **absolute path from the repository root** (e.g. `/apps/web/railway.json`). There is **no** root-level `railway.json` and **no** `railway.web.json` (removed on purpose).

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

| Railway UI field | Value | File in repo |
|------------------|-------|----------------|
| **Root Directory** | `apps/web` | Build context: `apps/web/` |
| **Config-as-code path** (may appear as *Railway config file*, *Config file*, or *Config path*) | **`/apps/web/railway.json`** | Leading `/` = from **repo root** (Railway does not resolve this relative to Root Directory). |

- **Dockerfile:** Declared in that JSON as `build.dockerfilePath`: `Dockerfile` → build uses **`apps/web/Dockerfile`** (path is relative to the config file’s directory).
- **Health check:** `deploy.healthcheckPath` in `apps/web/railway.json` → `/health`.
- **Required env:** **`API_URL`** — FastAPI base URL the Next.js server uses for server-side proxy.

**Rules:**

- Prefer **`/apps/web/railway.json`** for the config path so it matches Railway’s documented behavior. Do **not** use `/railway.web.json` or `railway.web.json` (obsolete).
- If your Railway UI accepts a path relative to Root Directory only, **`railway.json`** can work in some setups—but if deploys still look for `/railway.web.json` or fail to find the config, switch to the **absolute** path above.

---

## API service (FastAPI)

| Railway UI field | Value | File in repo |
|------------------|-------|----------------|
| **Root Directory** | `apps/api` | Build context: `apps/api/` |
| **Config-as-code path** | **`/apps/api/railway.json`** | Absolute from repo root |

- **Dockerfile:** `apps/api/Dockerfile` via `dockerfilePath` in that JSON.
- **Port:** align with `EXPOSE` / app binding (e.g. `8080`).

---

## Troubleshooting: `service config at '/railway.web.json' not found`

That message means the **Web** service’s dashboard setting still points at a **deleted** config file at the **repository root**. **Fix this in Railway only** (do **not** re-add `railway.web.json` to git).

1. Railway project → select the **Web** service (the one that builds Next.js).
2. **Settings** → find **Root Directory** and **Railway config file** / **Config-as-code** / **Config file** (wording varies).
3. **Root Directory:** **`apps/web`**
4. **Config file path:** set to **`/apps/web/railway.json`** (leading slash, full path from repo root). Remove **`/railway.web.json`** entirely.
5. Save, then **Redeploy** (or push a new commit).

Check **every** environment (Production, Preview, etc.) if Railway shows separate service overrides—each can still reference `/railway.web.json`.

For **API**, if you see a similar “config not found” error: Root **`apps/api`**, config **`/apps/api/railway.json`**.

---

## Related

- Root **`README.md`** → **Railway deployment** (env vars, health debug).
- **`docs/RAILWAY_CRON_SETUP.md`** — scheduled / cron services.
