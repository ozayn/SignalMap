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

**If you see 404s for `/_next/static/...`** (layout.css, chunks, etc.): the build cache is out of sync. When the project is in Dropbox, the build folder is now automatically placed in `node_modules/.cache/next` to avoid sync corruption. Stop any running dev server, run `pnpm clean`, then `pnpm dev`.

- Web: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Railway deployment

**API service:**
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
| Web | `API_URL` | **Required.** Use public URL: `https://api-production-XXXX.up.railway.app` (from your API service). Or private: `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| API | — | CORS allows `*.up.railway.app` automatically |

**Debug:** Hit `https://your-web.up.railway.app/api/health` to check API connectivity.
