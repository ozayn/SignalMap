#!/usr/bin/env python3
"""Debug: print raw Comtrade API response structure to diagnose parsing."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

app_dir = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(app_dir / ".env")
except ImportError:
    pass

def fetch_raw():
    key = (os.getenv("COMTRADE_API_KEY") or os.getenv("COMTRADE_SUBSCRIPTION_KEY") or "").strip()
    if not key:
        raise ValueError("Set COMTRADE_API_KEY")
    params = {"cmdCode": "2709", "flowCode": "X", "period": "2023", "typeCode": "C", "freqCode": "A", "clCode": "HS", "maxRecords": "5"}
    url = f"https://comtradeapi.un.org/data/v1/get/C/A/HS?{urlencode(params)}"
    req = Request(url, headers={"Ocp-Apim-Subscription-Key": key, "User-Agent": "SignalMap/1.0"})
    with urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    return data.get("data", data) if isinstance(data, dict) else (data if isinstance(data, list) else [])

def main():
    raw = fetch_raw()
    print(f"Records returned: {len(raw)}")
    if raw:
        print("\n--- All keys in first record ---")
        print(sorted(raw[0].keys()))
        print("\n--- First record (full) ---")
        print(json.dumps(raw[0], indent=2, default=str))
        print("\n--- All records: reporterDesc, partnerDesc, qty, tradeValue, primaryValue ---")
        for i, r in enumerate(raw):
            print(f"{i+1}: reporter={r.get('reporterDesc')!r} partner={r.get('partnerDesc')!r} qty={r.get('qty')} tradeValue={r.get('tradeValue')} primaryValue={r.get('primaryValue')} netWgt={r.get('netWgt')}")

if __name__ == "__main__":
    main()
