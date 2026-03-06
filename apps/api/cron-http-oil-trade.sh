#!/bin/sh
# Trigger oil trade update only. For weekly cron (e.g. 0 3 * * 0).
# Requires CRON_API_URL.
set -e
URL="${CRON_API_URL}/api/cron/update-oil-trade"
echo "Triggering: $URL"
curl -sf -X POST "$URL" | head -c 500
echo ""
echo "Done."
