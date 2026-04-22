#!/bin/sh
# HTTP trigger: oil production (US, SA, RU, IR). For monthly schedule; set CRON_API_URL.
set -e
URL="${CRON_API_URL}/api/cron/oil-economy/production"
echo "POST $URL"
curl -sf -X POST "$URL" | head -c 800
echo ""
echo "Done."
