#!/usr/bin/env python3
"""Prefetch US Living Standards FRED series into disk cache and committed snapshot."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_API_ROOT / "src"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    from signalmap.sources.us_living_standards_fred_cache import prefetch_us_living_standards_fred_series

    result = prefetch_us_living_standards_fred_series(timeout_seconds=20.0, write_snapshot=True)
    logger.info("prefetch complete: %s", json.dumps(result, indent=2))
    if result.get("failed", 0) > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
