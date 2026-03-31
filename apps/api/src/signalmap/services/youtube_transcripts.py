"""
YouTube transcript fetching (caption tracks via youtube-transcript-api).

Future uses (SignalMap):
- Cognitive bias / logical fallacy analysis over spoken content
- Political direction / framing clustering from transcript text
- Ingesting transcripts into discourse studies alongside comments and signals

Ported from MemoNext (flashcards): extract_video_id, title fetch, Webshare / generic proxy,
and YouTubeTranscriptApi usage with cache-first persistence in Postgres.

Time-window chunking: ``transcript_chunks``. Experimental chunk analysis (frames, future
bias/clustering/discourse work): ``transcript_analysis``.
"""

from __future__ import annotations

import html
import logging
import os
import re
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import HTTPException
from youtube_transcript_api import (
    FetchedTranscript,
    TranscriptList,
    YouTubeTranscriptApi,
)
from youtube_transcript_api import (
    AgeRestricted,
    CouldNotRetrieveTranscript,
    InvalidVideoId,
    IpBlocked,
    NoTranscriptFound,
    PoTokenRequired,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    VideoUnplayable,
    YouTubeDataUnparsable,
    YouTubeRequestFailed,
)
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

from signalmap.services.transcript_chunks import chunk_transcript_segments

log = logging.getLogger(__name__)

_YT_PATTERNS = [
    re.compile(
        r"(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})"
    ),
    # Live URLs: require delimiter after 11-char id (reject /live/notavalididatall-style paths)
    re.compile(r"youtube\.com/live/([a-zA-Z0-9_-]{11})(?=\?|/|#|$)"),
]

# /live/VIDEO_ID on youtube.com hosts (m.youtube.com, etc.)
_LIVE_PATH = re.compile(r"^/live/([a-zA-Z0-9_-]{11})(?:/|$)")

_proxy_loaded = False
_proxy_config: Any = None


def build_proxy_config():
    """Build proxy config from WEBSHARE_* or YOUTUBE_PROXY_URL, if set."""
    ws_user = os.environ.get("WEBSHARE_PROXY_USER", "").strip()
    ws_pass = os.environ.get("WEBSHARE_PROXY_PW", "").strip()
    if ws_user and ws_pass:
        log.debug("YouTube transcript proxy: Webshare rotating residential")
        return WebshareProxyConfig(
            proxy_username=ws_user,
            proxy_password=ws_pass,
        )

    proxy_url = os.environ.get("YOUTUBE_PROXY_URL", "").strip()
    if proxy_url:
        safe_url = proxy_url.split("@")[-1] if "@" in proxy_url else proxy_url[:48]
        log.debug("YouTube transcript proxy: generic → %s", safe_url)
        return GenericProxyConfig(
            http_url=proxy_url,
            https_url=proxy_url,
        )

    log.debug("YouTube transcript proxy: none (direct)")
    return None


def get_proxy_config():
    """Lazy singleton so env is read after load_dotenv."""
    global _proxy_loaded, _proxy_config
    if not _proxy_loaded:
        _proxy_config = build_proxy_config()
        _proxy_loaded = True
    return _proxy_config


def extract_video_id(url: str) -> Optional[str]:
    url = url.strip()
    if len(url) == 11 and re.match(r"^[a-zA-Z0-9_-]+$", url):
        return url
    for pattern in _YT_PATTERNS:
        m = pattern.search(url)
        if m:
            return m.group(1)
    parsed = urlparse(url)
    if "youtube.com" in (parsed.hostname or ""):
        qs = parse_qs(parsed.query)
        v = qs.get("v")
        if v and len(v[0]) == 11:
            return v[0]
        path = parsed.path or ""
        live_m = _LIVE_PATH.match(path)
        if live_m:
            return live_m.group(1)
    return None


def fetch_video_title(video_id: str) -> Optional[str]:
    try:
        resp = httpx.get(
            f"https://www.youtube.com/watch?v={video_id}",
            headers={"Accept-Language": "en-US,en;q=0.9"},
            timeout=10.0,
        )
        if resp.status_code == 200:
            m = re.search(r"<title>(.+?)(?:\s*-\s*YouTube)?\s*</title>", resp.text)
            if m:
                return html.unescape(m.group(1)).strip()
    except Exception:
        log.debug("Could not fetch video title for %s", video_id)
    return None


def _detail(title: Optional[str], message: str) -> dict[str, Any]:
    d: dict[str, Any] = {"message": message}
    if title is not None:
        d["title"] = title
    return d


def _requested_languages() -> tuple[str, ...]:
    """Priority list of transcript language codes (default: English only)."""
    raw = os.environ.get("YOUTUBE_TRANSCRIPT_LANGUAGES", "en").strip()
    if not raw:
        return ("en",)
    parts = [p.strip() for p in raw.replace(",", " ").split() if p.strip()]
    return tuple(parts) if parts else ("en",)


def allow_language_fallback() -> bool:
    """When True, use any available caption track if requested languages are missing."""
    v = os.environ.get("YOUTUBE_TRANSCRIPT_LANGUAGE_FALLBACK", "true").strip().lower()
    return v in ("1", "true", "yes", "")


def _available_languages_payload(transcript_list: TranscriptList) -> list[dict[str, Any]]:
    return [
        {
            "language_code": t.language_code,
            "language": t.language,
            "is_generated": t.is_generated,
        }
        for t in transcript_list
    ]


def _first_transcript_for_fallback(transcript_list: TranscriptList) -> Any:
    """Same ordering as find_transcript: manual tracks first, then generated."""
    for t in transcript_list:
        return t
    return None


def _segments_and_text_from_transcript(transcript_list: Any) -> tuple[list[dict[str, Any]], str]:
    if hasattr(transcript_list, "to_raw_data"):
        try:
            raw = transcript_list.to_raw_data()
            if isinstance(raw, list) and raw and all(isinstance(x, dict) for x in raw):
                text = " ".join(str(x.get("text", "")) for x in raw)
                return raw, text
        except Exception:
            pass

    segments: list[dict[str, Any]] = []
    try:
        for snippet in transcript_list.snippets:
            seg: dict[str, Any] = {"text": getattr(snippet, "text", str(snippet))}
            if hasattr(snippet, "start"):
                seg["start"] = snippet.start
            if hasattr(snippet, "duration"):
                seg["duration"] = snippet.duration
            segments.append(seg)
        text = " ".join(s["text"] for s in segments)
    except Exception:
        parts = [str(entry) for entry in transcript_list]
        segments = [{"text": p} for p in parts]
        text = " ".join(parts)

    return segments, text


def _language_from_transcript(transcript_list: Any) -> Optional[str]:
    try:
        code = getattr(transcript_list, "language_code", None)
        if code:
            return str(code)
    except Exception:
        pass
    try:
        lang = getattr(transcript_list, "language", None)
        if lang:
            return str(lang)
    except Exception:
        pass
    return None


def _load_transcript_list(
    ytt_api: YouTubeTranscriptApi, video_id: str, title: Optional[str]
) -> TranscriptList:
    """List caption tracks; map upstream/blocking errors to 503, missing video/captions to 422."""
    try:
        return ytt_api.list(video_id)
    except IpBlocked as exc:
        log.warning("Transcript list IpBlocked for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except RequestBlocked as exc:
        log.warning("Transcript list RequestBlocked for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except YouTubeRequestFailed as exc:
        log.warning("Transcript list HTTP failed for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except YouTubeDataUnparsable as exc:
        log.warning("Transcript list unparsable for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except PoTokenRequired as exc:
        log.warning("Transcript list PoTokenRequired for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except TranscriptsDisabled:
        raise HTTPException(
            status_code=422,
            detail=_detail(
                title,
                "No transcript available for this video. It may not have captions enabled.",
            ),
        )
    except (VideoUnavailable, InvalidVideoId, AgeRestricted, VideoUnplayable) as exc:
        log.info("Transcript list unavailable for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=422,
            detail=_detail(
                title,
                "No transcript available for this video. It may not have captions enabled.",
            ),
        )
    except CouldNotRetrieveTranscript as exc:
        log.warning("Transcript list error for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=422,
            detail=_detail(
                title,
                "No transcript available for this video. It may not have captions enabled.",
            ),
        )


def _fetch_caption_xml(
    transcript_obj: Any, video_id: str, title: Optional[str]
) -> FetchedTranscript:
    """Download the selected caption track; upstream failures become 503."""
    try:
        return transcript_obj.fetch()
    except IpBlocked as exc:
        log.warning("Transcript cue IpBlocked for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except RequestBlocked as exc:
        log.warning("Transcript cue RequestBlocked for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except YouTubeRequestFailed as exc:
        log.warning("Transcript cue HTTP failed for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except YouTubeDataUnparsable as exc:
        log.warning("Transcript cue unparsable for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except PoTokenRequired as exc:
        log.warning("Transcript cue PoTokenRequired for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_detail(title, "We couldn't fetch the transcript from YouTube right now."),
        )
    except CouldNotRetrieveTranscript as exc:
        log.warning("Transcript cue fetch error for %s: %s", video_id, exc)
        raise HTTPException(
            status_code=422,
            detail=_detail(
                title,
                "No usable transcript for this video (caption fetch failed).",
            ),
        )


def fetch_transcript_live(
    video_id: str,
) -> tuple[list[dict[str, Any]], str, Optional[str], Optional[str], bool]:
    """
    Fetch transcript from YouTube (via proxy when configured).
    Returns (segments, joined text, language code, title, fallback_used).
    Raises HTTPException 422 or 503 on failure.

    Tries ``YOUTUBE_TRANSCRIPT_LANGUAGES`` first; if none match and
    ``YOUTUBE_TRANSCRIPT_LANGUAGE_FALLBACK`` is enabled, uses the first
    available track (manual before auto-generated).
    """
    title = fetch_video_title(video_id)
    proxy = get_proxy_config()
    ytt_api = YouTubeTranscriptApi(proxy_config=proxy)
    transcript_list = _load_transcript_list(ytt_api, video_id, title)

    requested_languages = _requested_languages()
    fallback_used = False
    try:
        transcript_obj = transcript_list.find_transcript(requested_languages)
    except NoTranscriptFound:
        if not allow_language_fallback():
            raise HTTPException(
                status_code=422,
                detail={
                    **_detail(title, "No transcript in the requested languages."),
                    "requested_languages": list(requested_languages),
                    "available_languages": _available_languages_payload(transcript_list),
                },
            )
        alt = _first_transcript_for_fallback(transcript_list)
        if alt is None:
            raise HTTPException(
                status_code=422,
                detail=_detail(
                    title,
                    "No transcript available for this video. It may not have captions enabled.",
                ),
            )
        transcript_obj = alt
        fallback_used = True

    fetched = _fetch_caption_xml(transcript_obj, video_id, title)
    segments, text = _segments_and_text_from_transcript(fetched)
    lang = _language_from_transcript(fetched)

    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail=_detail(
                title,
                "No usable transcript for this video (too short or empty).",
            ),
        )

    return segments, text, lang, title, fallback_used


def _segments_to_chunks(segments: Any) -> list[dict[str, Any]]:
    """Build fixed time-window chunks for downstream analysis (bias, clustering, discourse)."""
    if not isinstance(segments, list):
        return []
    seg_dicts = [s for s in segments if isinstance(s, dict)]
    return chunk_transcript_segments(seg_dicts, window_seconds=45)


def get_transcript_for_url(url: str) -> dict[str, Any]:
    """
    Cache-first: resolve video_id, return DB row if present else fetch, persist, return.
    Response shape matches POST /api/youtube/transcript (without ``cached`` — caller sets it).

    Cache rows are keyed by ``(video_id, transcript language)`` so multiple caption languages
    for the same video can be stored. Lookup follows ``YOUTUBE_TRANSCRIPT_LANGUAGES`` order,
    then optional any-language fallback (see ``get_youtube_transcript_cache``).
    """
    from db import (
        DATABASE_URL,
        get_youtube_transcript_cache,
        save_youtube_transcript_cache,
    )

    video_id = extract_video_id(url)
    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please paste a valid video link.",
        )

    if DATABASE_URL:
        cached, cache_fallback_used = get_youtube_transcript_cache(
            video_id,
            requested_languages=_requested_languages(),
            fallback_allowed=allow_language_fallback(),
        )
        if cached:
            segments = cached.get("segments") or []
            if not isinstance(segments, list):
                segments = []
            return {
                "video_id": video_id,
                "title": cached.get("title"),
                "language": cached.get("language"),
                "transcript_text": cached.get("transcript_text") or "",
                "segments": segments,
                "chunks": _segments_to_chunks(segments),
                "_cached": True,
                "fallback_used": cache_fallback_used,
            }

    segments, text, language, title, fallback_used = fetch_transcript_live(video_id)

    if DATABASE_URL:
        save_youtube_transcript_cache(
            video_id=video_id,
            source_url=url.strip(),
            title=title,
            language=language,
            transcript_text=text,
            segments=segments,
        )

    return {
        "video_id": video_id,
        "title": title,
        "language": language,
        "transcript_text": text,
        "segments": segments,
        "chunks": _segments_to_chunks(segments),
        "_cached": False,
        "fallback_used": fallback_used,
    }


def run_transcript_analysis_for_url(
    url: str,
    mode: str,
    fallacy_method: Optional[str] = None,
    summary_format: Optional[str] = None,
    summary_length: Optional[str] = None,
) -> dict[str, Any]:
    """
    Experimental chunk-level analysis on top of the transcript pipeline.
    Delegates to ``transcript_analysis.run_transcript_analysis``.
    """
    from signalmap.services.transcript_analysis import run_transcript_analysis

    return run_transcript_analysis(
        url,
        mode,
        fallacy_method=fallacy_method,
        summary_format=summary_format,
        summary_length=summary_length,
    )
