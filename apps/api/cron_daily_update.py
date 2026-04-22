#!/usr/bin/env python3
"""
Cron job: run daily update for oil (Brent), fx, gold, fx_dual, oil_production (optional), …

Designed for Railway Cron. Same build as API; override Start Command to:
  python cron_daily_update.py

- **Brent** (``oil`` key): append missing DCOILBRENTEU — used by oil-economy price.
- **Oil production** (``oil_production_exporters``): set ``DAILY_CRON_OIL_PRODUCTION=0`` to skip
  and use ``cron_oil_production_monthly.py`` or ``POST /api/cron/oil-economy/production`` monthly.
- **Revenue** is never written here; oil-economy API computes it.

Exits when done. Requires DATABASE_URL, FRED_API_KEY (for oil).
"""

import json
import os
import sys
import time
from pathlib import Path

# Ensure src is on path (when run from /app in container)
app_dir = Path(__file__).resolve().parent
src = app_dir / "src"
if str(src) not in sys.path:
    sys.path.insert(0, str(src))

try:
    from dotenv import load_dotenv

    load_dotenv(app_dir / ".env")
except ImportError:
    pass

from signalmap.services.daily_updates import update_all_data_sources


def main() -> int:
    result = update_all_data_sources()
    print(json.dumps(result, indent=2))
    # Allow DB connections to close gracefully before process exit.
    # Avoids TCP_ABORT_ON_DATA when Railway tears down the cron process.
    time.sleep(0.5)
    return 0


if __name__ == "__main__":
    sys.exit(main())
