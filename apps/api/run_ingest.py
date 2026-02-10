#!/usr/bin/env python3
"""Run ingest_signals with correct path. From repo root: python3 apps/api/run_ingest.py --signal usd_toman --days 3650"""
import sys
from pathlib import Path

api_root = Path(__file__).resolve().parent
src = api_root / "src"
if str(src) not in sys.path:
    sys.path.insert(0, str(src))

# Now run the job
from signalmap.jobs.ingest_signals import main

sys.exit(main())
