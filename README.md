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

# 2. Install Python API deps
pip install -r apps/api/requirements.txt

# 3. Start both
pnpm dev
```

**If you see 404s for `/_next/static/...`** (layout.css, chunks, etc.): the build cache is out of sync. Stop any running dev server, run `pnpm clean`, then `pnpm dev`.

- Web: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Railway deployment

Add a **Postgres** database and link it to the API service for Wayback jobs (cache + job queue).

### API service
- **Option A:** Root Directory = `apps/api`, domain port = `8080`
- **Option B (if A fails):** Root Directory = `.` (empty), add variable `RAILWAY_DOCKERFILE_PATH` = `Dockerfile.api`, domain port = `8080`

**Web service:**
- Root Directory = `.` (repo root)
- **Settings → Build → Config File Path = `railway.web.json`** (critical: without this, it builds the API Dockerfile instead)
- Settings → Networking → ensure target port matches `PORT` (Railway auto-sets this)
- **Do not add `startCommand` in railway.web.json** — Railway runs it without a shell, so `cd` fails ("executable could not be found"). Use the Dockerfile’s `CMD` instead (it runs via `sh -c`).

**Environment variables:**

| Service | Variable | Value |
|---------|----------|-------|
| Web | `API_URL` | **Required.** Backend URL for server-side proxy: `https://api-production-XXXX.up.railway.app` or `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| API | `DATABASE_URL` | Postgres URL (link Postgres service). Required for Wayback jobs. |
| API | `WEB_ORIGIN` | Optional. Web URL for CORS (only needed if clients hit API directly) |

**Custom domain:** With a custom domain on the web service, the client uses same-origin fetches (`/api/...`). Next.js proxies to the backend, so no CORS or `NEXT_PUBLIC_API_URL` is needed.

**Debug:** Hit `https://your-web.up.railway.app/api/health` to check API connectivity.
