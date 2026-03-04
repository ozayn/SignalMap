# Railway Cron Setup

## Option 1: Add Cron Schedule to Existing API Service (not recommended)

The API service runs a web server and never exits. Railway cron requires the process to exit when done. Use Option 2 or 3.

## Option 2: Python Cron Service (runs update logic directly)

A Python script runs the update logic directly, using the same build as the API.

1. **Create New Service**
   - Railway Dashboard → Your project → **+ New** → **Empty Service**
   - Name it e.g. "SignalMap Daily Update"

2. **Connect Source**
   - Same GitHub repo as the API
   - Same branch (e.g. main)

3. **Build**
   - Root directory: `apps/api`
   - Dockerfile: `Dockerfile`

4. **Config File**
   - Settings → **Config**: set **Railway config file** to `apps/api/railway.cron.json`
   - Note: Config path is from repo root, not root directory.

5. **Add Cron Schedule**
   - Settings → **Cron Schedule**
   - Example: `0 7 * * *` (daily at 7:00 UTC)

6. **Variables**
   - **Link Postgres** to the cron service (or copy `DATABASE_URL`)
   - `FRED_API_KEY` (required for oil)
   - Optional: `YOUTUBE_DAILY_UPDATE_CHANNELS`, `YOUTUBE_API_KEY`

**Troubleshooting Option 2:** If you see `TCP_ABORT_ON_DATA` or connection errors, the cron service may not have Postgres access or env vars. Use Option 3 instead.

## Option 3: HTTP-Trigger Cron (Recommended if Option 2 fails)

Triggers the API via HTTP. No DB connection in the cron service—the API does the work. Use this if `curl -X POST https://your-api.up.railway.app/api/cron/update-all` works.

1. **Create New Service**
   - **+ New** → **Empty Service**
   - Name it e.g. "SignalMap Cron (HTTP)"

2. **Connect Source**
   - Same repo and branch

3. **Build**
   - Root directory: `apps/api`
   - Config file: `apps/api/railway.cron-http.json`

4. **Variables**
   - `CRON_API_URL` = your API URL (e.g. `https://api-production-0332.up.railway.app`)

5. **Cron Schedule**
   - `0 7 * * *` (daily at 7:00 UTC)

## Cron Expression Examples (UTC)

| Schedule | Cron | Description |
|----------|------|-------------|
| Daily 7:00 UTC | `0 7 * * *` | Every day at 7 AM UTC |
| Daily 2:00 UTC | `0 2 * * *` | Every day at 2 AM UTC |
| Weekdays 8:00 UTC | `0 8 * * 1-5` | Mon–Fri 8 AM UTC |

## Testing

1. **Local (Option 2):**
   ```bash
   cd apps/api && source .venv/bin/activate
   PYTHONPATH=src python cron_daily_update.py
   ```

2. **HTTP (Option 3):** Verify API works first:
   ```bash
   curl -X POST https://your-api.up.railway.app/api/cron/update-all
   ```

3. **Railway:** Deployments tab → **Deploy** (manual) → check Logs

## Notes

- **Service must exit**: Cron services must terminate when done. No web servers.
- **Minimum interval**: Railway requires ≥5 minutes between cron runs.
- **Option 3** uses a minimal curl image; no Python or DB in the cron service.
