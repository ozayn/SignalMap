# SignalMap

Minimal scaffold: Overview page with 3 KPIs + 1 timeline chart.

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
pip install fastapi uvicorn

# 3. Terminal 1: Start API
pnpm dev:api

# 4. Terminal 2: Start web
pnpm dev:web
```

- Web: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
