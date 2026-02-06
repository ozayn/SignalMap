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

**API service:** Set **Root Directory** to `apps/api` in Railway. The Dockerfile ensures a Python-only build (no Node/Next.js).

**Web service:** Set **Root Directory** to `apps/web` (or repo root with appropriate build commands).

**Environment variables:**
- Web: `NEXT_PUBLIC_API_URL` = your API URL
- API: `WEB_ORIGIN` = your web URL (for CORS)
