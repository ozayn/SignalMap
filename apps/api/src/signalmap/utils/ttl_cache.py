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


def invalidate_prefix(prefix: str) -> int:
    """Remove all keys starting with ``prefix``. Returns number of entries removed."""
    to_del = [k for k in list(_cache.keys()) if k.startswith(prefix)]
    for k in to_del:
        del _cache[k]
    return len(to_del)
