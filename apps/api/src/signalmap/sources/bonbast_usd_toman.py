"""Fetch USD→Toman open-market rate from Bonbast (unofficial proxy, values in toman)."""

import re
from datetime import date
from typing import Any, List, Optional

import httpx

BONBAST_URL = "https://www.bonbast.com/"
BONBAST_GRAPH_USD = "https://www.bonbast.com/graph/usd"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"
TIMEOUT = 10.0

# Match numbers that could be toman rates (typically 50,000–300,000)
_TOMAN_PATTERN = re.compile(r"\b(\d{4,6})\b")

# Chart.js: new Date('YYYY-MM-DD')
_DATE_LABEL = re.compile(r"new\s+Date\s*\(\s*['\"](\d{4}-\d{2}-\d{2})['\"]\s*\)")


def _parse_current_from_html(text: str) -> Optional[float]:
    """
    Parse USD sell/buy value in toman from Bonbast HTML.
    Tries multiple strategies; returns average of sell/buy if both found, else single value.
    """
    # Strategy 1: Look for JSON in script tags (pages often embed data)
    json_match = re.search(
        r'"(?:usd|USD)"\s*:\s*\{[^}]*"(?:sell|buy)"\s*:\s*["\']?(\d+)["\']?',
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if json_match:
        try:
            return float(json_match.group(1))
        except ValueError:
            pass

    # Strategy 2: data-sell, data-buy attributes for USD
    attr_match = re.search(
        r'data-(?:currency|code)="usd"[^>]*data-(?:sell|buy)="(\d+)"',
        text,
        re.IGNORECASE,
    )
    if attr_match:
        try:
            return float(attr_match.group(1))
        except ValueError:
            pass

    # Strategy 3: Graph page - <td class="av_table">Average</td><td class="price">142911</td><td class="price">142811</td>
    avg_match = re.search(
        r"(?:Average|Avg)[^<]*</td>\s*<[^>]+>\s*(\d{4,6})\s*</td>\s*<[^>]+>\s*(\d{4,6})",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if avg_match:
        try:
            sell = float(avg_match.group(1))
            buy = float(avg_match.group(2))
            return round((sell + buy) / 2, 0)
        except ValueError:
            pass

    # Strategy 4: "US Dollar" followed by digits (table row)
    usd_row = re.search(
        r"US\s+Dollar[^|]*\|[^|]*\|?\s*(\d{4,6})\s*\|?\s*(\d{4,6})?",
        text,
        re.IGNORECASE,
    )
    if usd_row:
        try:
            sell = float(usd_row.group(1))
            buy = usd_row.group(2)
            if buy:
                return round((sell + float(buy)) / 2, 0)
            return float(sell)
        except (ValueError, TypeError):
            pass

    # Strategy 5: First occurrence of USD/graph/usd followed by 5-6 digit number
    graph_match = re.search(
        r'bonbast\.com/graph/usd[^>]*>.*?(\d{4,6})',
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if graph_match:
        try:
            return float(graph_match.group(1))
        except ValueError:
            pass

    # Strategy 6: Any 5-6 digit number near "toman" or "USD" (conservative)
    blocks = re.split(r"<[^>]+>", text)
    for block in blocks:
        if "usd" in block.lower() and "dollar" in block.lower():
            nums = _TOMAN_PATTERN.findall(block)
            # Filter: toman rates are typically 50k-500k
            valid = [float(n) for n in nums if 10000 <= int(n) <= 999999]
            if valid:
                return round(sum(valid) / len(valid), 0)

    return None


def _parse_chart_series_from_html(text: str) -> List[dict[str, Any]]:
    """
    Parse Chart.js embedded data: labels (dates) and datasets[].data (values).
    Structure: data: { labels: [...], datasets: [{ data: [...] }] }
    Returns [{date, value}, ...] or empty list if not found.
    """
    # Find labels: [new Date('2025-12-11'), ...]
    labels_match = re.search(
        r"labels:\s*\[(.*?)\]\s*,\s*\n\s*datasets:",
        text,
        re.DOTALL,
    )
    if not labels_match:
        return []

    labels_str = labels_match.group(1)
    dates = _DATE_LABEL.findall(labels_str)

    # Find data: [126100, 126500, ...] inside datasets
    data_match = re.search(
        r"datasets:\s*\[\s*\{\s*[^}]*data:\s*\[([\d,\s]+)\]",
        text,
        re.DOTALL,
    )
    if not data_match:
        return []

    values_str = data_match.group(1)
    values = []
    for part in values_str.split(","):
        part = part.strip()
        if part and part.isdigit():
            values.append(float(part))

    if len(dates) != len(values) or not dates:
        return []

    return [
        {"date": d, "value": round(v, 2)}
        for d, v in zip(dates, values)
        if 10000 <= v <= 999999
    ]


def fetch_usd_toman_series() -> list[dict[str, Any]]:
    """
    Fetch USD→Toman open-market rate from Bonbast.
    Returns [{date, value}, ...] sorted by date ascending.
    Tries to parse Chart.js historical series first (~60 days).
    Falls back to single point (today) from Average table if needed.
    """
    headers = {"User-Agent": USER_AGENT}
    err_msg = ""

    # Try graph page first (has Chart.js labels + data)
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(BONBAST_GRAPH_USD, headers=headers)
            r.raise_for_status()
            text = r.text
            series = _parse_chart_series_from_html(text)
            if series:
                return sorted(series, key=lambda p: p["date"])
            val = _parse_current_from_html(text)
            if val is not None:
                today = date.today().isoformat()
                return [{"date": today, "value": round(float(val), 2)}]
    except httpx.TimeoutException as e:
        err_msg = f"Bonbast request timed out: {e}"
    except httpx.HTTPStatusError as e:
        err_msg = f"Bonbast returned {e.response.status_code}"
    except Exception as e:
        err_msg = str(e)

    # Fallback: main page
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(BONBAST_URL, headers=headers)
            r.raise_for_status()
            val = _parse_current_from_html(r.text)
            if val is not None:
                today = date.today().isoformat()
                return [{"date": today, "value": round(float(val), 2)}]
    except Exception as e:
        if not err_msg:
            err_msg = str(e)

    raise ValueError(f"Could not parse USD/toman from Bonbast. {err_msg}")
