"""Minimal in-memory TTL cache."""

import time
from typing import Any, Optional

_cache: dict[str, tuple[Any, float]] = {}


def get(key: str) -> Optional[Any]:
    """Return cached value if present and not expired, else None."""
    if key not in _cache:
        return None
    value, expires_at = _cache[key]
    if time.time() >= expires_at:
        del _cache[key]
        return None
    return value


def set(key: str, value: Any, ttl_seconds: float) -> None:
    """Store value with TTL."""
    _cache[key] = (value, time.time() + ttl_seconds)
