#!/usr/bin/env python3
"""
Monthly (or on-demand) cron: EIA/IMF oil production for US, SA, RU, IR.

- Run less often than Brent; EIA/IMF is annual, so daily fetches are unnecessary.
- Only **new** dates (vs existing ``signal_points``) are written; idempotent.
- **Does not** insert “revenue” (always computed in API: production x price).
- Embedded ``iran_oil_production_annual_historical`` (1965–1999 EI/EIA-BP, gap-fill) is not touched here.

Start command: ``python cron_oil_production_monthly.py``
Requires: DATABASE_URL, EIA_API_KEY (or falls back to embedded static — still append-only in DB)
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

from signalmap.services.daily_updates import run_oil_production_cron  # noqa: E402


def main() -> int:
    r = run_oil_production_cron()
    print(json.dumps(r, indent=2))
    time.sleep(0.5)
    if r.get("error"):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
