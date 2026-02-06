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
- Settings → Build → Config File Path = `railway.web.json`
- Uses `Dockerfile.web`; Next.js listens on `PORT` (Railway injects this)

**Environment variables:**

| Service | Variable | Value |
|---------|----------|-------|
| Web | `API_URL` | **Required.** For private: `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080` (port required). For public: `https://your-api.up.railway.app` |
| API | — | CORS allows `*.up.railway.app` automatically |

**Debug:** Hit `https://your-web.up.railway.app/api/health` to check API connectivity.
