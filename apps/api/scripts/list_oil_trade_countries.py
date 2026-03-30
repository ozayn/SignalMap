#!/usr/bin/env python3
"""List distinct country names in oil_trade_edges."""
import sys
from pathlib import Path

app_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(app_dir / "src"))
try:
    from dotenv import load_dotenv
    load_dotenv(app_dir / ".env")
except ImportError:
    pass

from db import cursor

with cursor() as cur:
    cur.execute("""
        SELECT DISTINCT country FROM (
            SELECT exporter AS country FROM oil_trade_edges
            UNION
            SELECT importer AS country FROM oil_trade_edges
        ) t
        ORDER BY country
    """)
    for row in cur.fetchall():
        print(row["country"])
