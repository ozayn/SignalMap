#!/bin/sh
# Trigger the API cron endpoint. Requires CRON_API_URL (e.g. https://api-production-XXXX.up.railway.app)
set -e
URL="${CRON_API_URL}/api/cron/update-all"
echo "Triggering: $URL"
curl -sf -X POST "$URL" | head -c 500
echo ""
echo "Done."
