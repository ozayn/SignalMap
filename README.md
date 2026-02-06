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

**API service (required):**
1. Set **Root Directory** to `apps/api` (Settings → General)
2. The `railway.json` + `Dockerfile` force a Python-only build (no pnpm/Node)
3. Add **Generate Domain** under Settings → Networking for a public URL

**Web service:** Set **Root Directory** to `apps/web`.

**Environment variables:**
- Web: `NEXT_PUBLIC_API_URL` = your API URL (e.g. `https://xxx.up.railway.app`)
- API: `WEB_ORIGIN` = your web URL (for CORS)
