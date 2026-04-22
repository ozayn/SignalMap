#!/bin/sh
# HTTP trigger: append Brent only (FRED DCOILBRENTEU). Set CRON_API_URL to the API base.
set -e
URL="${CRON_API_URL}/api/cron/oil-economy/brent"
echo "POST $URL"
curl -sf -X POST "$URL" | head -c 800
echo ""
echo "Done."
