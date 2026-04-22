#!/usr/bin/env python3
"""
Daily Railway cron: append missing Brent (FRED DCOILBRENTEU) to ``signal_points``.

- Independent of the web process (run as a separate Railway Cron service with this start command).
- For oil-economy-overview, **revenue is not stored** — the API always computes it.

Start command: ``python cron_oil_economy_brent_daily.py``
Requires: DATABASE_URL, FRED_API_KEY
"""

import json
import sys
import time
from pathlib import Path

app_dir = Path(__file__).resolve().parent
src = app_dir / "src"
if str(src) not in sys.path:
    sys.path.insert(0, str(src))

try:
    from dotenv import load_dotenv

    load_dotenv(app_dir / ".env")
except ImportError:
    pass

from signalmap.services.daily_updates import run_oil_economy_brent_cron  # noqa: E402


def main() -> int:
    r = run_oil_economy_brent_cron()
    print(json.dumps(r, indent=2))
    time.sleep(0.5)
    if r.get("error"):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
