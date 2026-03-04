#!/usr/bin/env python3
"""
Cron job: run daily update for oil, fx, gold, fx_dual, youtube_followers.

Designed for Railway Cron. Same build as API; override Start Command to:
  python cron_daily_update.py

Exits when done. Requires DATABASE_URL, FRED_API_KEY (for oil).
"""

import json
import os
import sys
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
