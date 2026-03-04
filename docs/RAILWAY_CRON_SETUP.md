# Railway Cron Setup

Same pattern as the [planner](https://github.com/.../planner) project: a Python script runs the update logic directly, using the same build as the API.

## Option 1: Add Cron Schedule to Existing API Service (not recommended)

The API service runs a web server and never exits. Railway cron requires the process to exit when done. Use Option 2.

## Option 2: Create a Separate Cron Service (Recommended)

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
   - Settings → **Config** (or **Service Settings**): set **Railway config file** to `apps/api/railway.cron.json`
   - This sets the start command to `python cron_daily_update.py` (no web server, script exits)

5. **Add Cron Schedule**
   - Settings → **Cron Schedule**
   - Example: `0 7 * * *` (daily at 7:00 UTC)

6. **Variables**
   - Copy from API service or use shared variables:
     - `DATABASE_URL`
     - `FRED_API_KEY`
   - Optional: `YOUTUBE_DAILY_UPDATE_CHANNELS`, `YOUTUBE_API_KEY` for channel snapshots

## Cron Expression Examples (UTC)

| Schedule | Cron | Description |
|----------|------|-------------|
| Daily 7:00 UTC | `0 7 * * *` | Every day at 7 AM UTC |
| Daily 2:00 UTC | `0 2 * * *` | Every day at 2 AM UTC |
| Weekdays 8:00 UTC | `0 8 * * 1-5` | Mon–Fri 8 AM UTC |

## Testing

1. **Local:**
   ```bash
   cd apps/api && source .venv/bin/activate
   PYTHONPATH=src python cron_daily_update.py
   ```

2. **Railway:** Deployments tab → **Deploy** (manual) → check Logs

## Notes

- **Service must exit**: The script runs `update_all_data_sources()` and exits. No web server.
- **Same image as API**: Uses `apps/api/Dockerfile`; only the start command differs.
- **Minimum interval**: Railway requires ≥5 minutes between cron runs.
