# Dev & ops scripts

Handy commands for local development and restarts.

## Restart API (graceful)

Uses SIGTERM so joblib/sklearn workers can clean up; avoids "leaked semaphore" warnings.

```bash
lsof -ti:8000 | xargs kill -TERM 2>/dev/null
sleep 3
pnpm --filter api dev
```

Or via npm: `pnpm restart:api`

## Restart full app (web + API)

```bash
lsof -ti:3000 -ti:8000 2>/dev/null | xargs kill -TERM 2>/dev/null
sleep 3
pnpm dev
```

Or via npm: `pnpm restart`

## Force-kill (if graceful shutdown hangs)

```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null
```

## Install API dependency (e.g. after adding to requirements.txt)

```bash
cd apps/api && .venv/bin/pip install -r requirements.txt
```

## Seed YouTube comment analysis cache

```bash
cd apps/api && python scripts/seed_youtube_comment_analysis_cache.py
# Or with custom file:
python scripts/seed_youtube_comment_analysis_cache.py ./seed_data/comment_analysis_bplus.json
```

Requires `DATABASE_URL` in `apps/api/.env`.

## Debug cluster labels

Set `DEBUG_CLUSTER_LABELS=1` in `apps/api/.env` to force all cluster labels to `"DEBUG_LABEL"` (verifies pipeline recomputes).
