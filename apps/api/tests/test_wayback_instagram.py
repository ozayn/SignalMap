"""
Local test for Wayback Instagram connector.
Tests username=golfarahani - verifies response shape, stable archived_url, evidence, metrics.
Run: pytest apps/api/tests/test_wayback_instagram.py -v
"""

import pytest

from connectors.wayback_instagram import (
    get_instagram_archival_metrics,
    get_instagram_followers_time_series,
    extract_instagram_metrics,
    _normalize_url_for_dedup,
    _url_preference_score,
    _build_archived_url,
    _is_profile_url,
    deduplicate_snapshots,
    evenly_sample_snapshots,
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


def test_is_profile_url_accepts_port():
    """Older archives use http://instagram.com:80/username - should not be filtered."""
    assert _is_profile_url("http://instagram.com:80/golfarahani", "golfarahani")
    assert _is_profile_url("http://instagram.com:80/golfarahani/", "golfarahani")
    assert not _is_profile_url("http://instagram.com:80/golfarahani/photos/", "golfarahani")


def test_evenly_sample_ensures_year_coverage():
    """Stratified sampling should include at least one from each year with data."""
    snaps = [
        {"timestamp": f"{y}0615012300", "original": "https://instagram.com/u/"}
        for y in range(2015, 2025)
        for _ in range(5)
    ]
    sampled = evenly_sample_snapshots(snaps, sample=15)
    years = {s["timestamp"][:4] for s in sampled}
    assert len(years) >= 10, "Should have coverage across years"
    assert "2015" in years
    assert "2019" in years


def test_extract_2015_style_html():
    """Extract from 2015-style IG with followers/following/posts in separate list items."""
    html = """
    <li>3 posts</li>
    <li>3,646 followers</li>
    <li>9 following</li>
    """
    out = extract_instagram_metrics(html)
    assert out["followers"]["value"] == 3646
    assert out["following"]["value"] == 9
    assert out["posts"]["value"] == 3


def test_extract_2015_span_format():
    """2015 IG uses <span class='number-stat'>3,646</span> followers."""
    html = '<span class="number-stat" title="3,646">3,646</span> followers'
    out = extract_instagram_metrics(html)
    assert out["followers"]["value"] == 3646


def test_extract_2016_shared_data():
    """2016 IG uses window._sharedData with followed_by, follows, media."""
    html = '"followed_by":{"count":406462},"follows":{"count":14},"media":{"count":164}'
    out = extract_instagram_metrics(html)
    assert out["followers"]["value"] == 406462
    assert out["following"]["value"] == 14
    assert out["posts"]["value"] == 164


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


def test_golfarahani_2016_snapshots():
    """Fetch 2016 snapshots for golfarahani; verify we extract followers (e.g. 406462 from Jan 7 2016)."""
    result = get_instagram_archival_metrics(
        username="golfarahani",
        from_year=2016,
        to_year=2016,
        sample=15,
        include_evidence=True,
    )
    assert result["platform"] == "instagram"
    assert result["username"] == "golfarahani"
    # Expect at least one 2016 snapshot with extracted followers
    results_2016 = [r for r in result["results"] if r["timestamp"].startswith("2016")]
    assert len(results_2016) >= 1, "Should have at least one 2016 snapshot"
    with_followers = [r for r in results_2016 if r["followers"] is not None]
    assert len(with_followers) >= 1, "Should extract followers from at least one 2016 snapshot"
    # Jan 7 2016 snapshot has 406462 followers
    follower_counts = [r["followers"] for r in with_followers]
    assert 406462 in follower_counts or any(400000 <= f <= 450000 for f in follower_counts), (
        f"Expected ~406462 from 2016; got {follower_counts}"
    )
    # Log extracted 2016 points for visibility when run with -s
    for r in with_followers[:5]:
        print(f"  2016 {r['timestamp'][:8]}  followers={r['followers']}  following={r['following']}  posts={r['posts']}")


def test_followers_time_series():
    """Followers endpoint returns sorted points with non-null followers only."""
    result = get_instagram_followers_time_series(
        username="golfarahani",
        from_year=2012,
        to_year=2026,
        sample=5,
    )
    assert "username" in result
    assert "canonical_url" in result
    assert "points" in result
    assert "notes" in result
    assert result["username"] == "golfarahani"

    dates = [p["date"] for p in result["points"]]
    assert dates == sorted(dates)
    for p in result["points"]:
        assert "date" in p
        assert "followers" in p
        assert "confidence" in p
        assert "archived_url" in p
        assert p["followers"] is not None
