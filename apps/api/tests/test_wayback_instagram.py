"""
Local test for Wayback Instagram connector.
Tests username=golfarahani - verifies response shape, stable archived_url, evidence, metrics.
Run: pytest apps/api/tests/test_wayback_instagram.py -v
"""

import pytest

from connectors.wayback_instagram import (
    get_instagram_archival_metrics,
    _normalize_url_for_dedup,
    _url_preference_score,
    _build_archived_url,
    deduplicate_snapshots,
)


def test_normalize_url_for_dedup():
    """Dedup normalization removes scheme, :80, www, trailing slash."""
    assert _normalize_url_for_dedup("http://instagram.com:80/golfarahani") == "instagram.com/golfarahani"
    assert _normalize_url_for_dedup("https://www.instagram.com/golfarahani/") == "instagram.com/golfarahani"
    assert _normalize_url_for_dedup("https://www.instagram.com/golfarahani") == "instagram.com/golfarahani"


def test_url_preference_score():
    """Prefer https+www over http+non-www."""
    assert _url_preference_score("https://www.instagram.com/golfarahani") > _url_preference_score(
        "http://instagram.com:80/golfarahani"
    )


def test_deduplicate_snapshots_prefers_https_www():
    """When multiple variants exist for same timestamp, prefer https+www."""
    snapshots = [
        {"timestamp": "20150219194607", "original": "http://instagram.com:80/golfarahani"},
        {"timestamp": "20150219194607", "original": "https://www.instagram.com/golfarahani/"},
    ]
    deduped = deduplicate_snapshots(snapshots)
    assert len(deduped) == 1
    assert deduped[0]["original"] == "https://www.instagram.com/golfarahani/"


def test_build_archived_url():
    """Archived URL uses CDX original (Wayback expects it)."""
    url = _build_archived_url("20150219194607", "http://instagram.com:80/golfarahani")
    assert url == "https://web.archive.org/web/20150219194607/http://instagram.com:80/golfarahani"


def test_golfarahani_wayback_instagram():
    """
    Integration test: username=golfarahani.
    Verifies response shape, stable archived_url format, evidence when present.
    Keeps sample=3 to avoid long runs.
    """
    result = get_instagram_archival_metrics(
        username="golfarahani",
        from_year=2012,
        to_year=2026,
        sample=3,
        include_evidence=True,
    )

    assert result["platform"] == "instagram"
    assert result["username"] == "golfarahani"
    assert result["canonical_url"] == "https://www.instagram.com/golfarahani/"
    assert "snapshots_total" in result
    assert "snapshots_sampled" in result
    assert "results" in result
    assert "notes" in result

    for r in result["results"]:
        assert "timestamp" in r
        assert "original_url" in r
        assert "archived_url" in r
        assert "followers" in r
        assert "following" in r
        assert "posts" in r
        assert "confidence" in r
        assert "evidence" in r

        # archived_url is stable: web.archive.org/web/{timestamp}/{original}
        assert r["archived_url"].startswith("https://web.archive.org/web/")
        assert r["timestamp"] in r["archived_url"]
        assert r["original_url"] in r["archived_url"]

        # When metrics exist, evidence should be present (if include_evidence=True)
        if r["followers"] is not None or r["following"] is not None or r["posts"] is not None:
            assert r["confidence"] >= 0.2
            # evidence can be None for 0.2 confidence edge cases
            if r["confidence"] >= 0.55:
                assert r["evidence"] is not None or r["confidence"] == 0.2
