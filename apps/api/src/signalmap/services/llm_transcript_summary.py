"""
Groq-backed transcript summarization (short text, bullets, main topics).

Uses ``GROQ_API_KEY`` via ``groq_chat_json`` from ``llm_transcript_analysis``.
Output is validated JSON only; English vs Persian prompts match transcript language hints.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

# Must match ``_truncate_for_llm`` / ``_MAX_TRANSCRIPT_CHARS`` in ``llm_transcript_analysis`` (80k).
LLM_SUMMARY_TRUNCATION_NOTE = (
    "Input was truncated to the first 80,000 characters before summarization (prototype limit)."
)

SummaryFormat = Literal["bullets", "paragraphs"]
SummaryLength = Literal["short", "medium", "long"]


def normalize_summary_format(fmt: Optional[str]) -> SummaryFormat:
    s = (fmt or "").strip().lower()
    if s == "paragraphs":
        return "paragraphs"
    return "bullets"


def normalize_summary_length(ln: Optional[str]) -> SummaryLength:
    s = (ln or "").strip().lower()
    if s == "short":
        return "short"
    if s == "long":
        return "long"
    return "medium"


def validate_summarize_output(obj: Any) -> dict[str, Any]:
    """Return a dict with summary_short, summary_bullets, summary_paragraphs, main_topics (safe defaults)."""
    out: dict[str, Any] = {
        "summary_short": "",
        "summary_bullets": [],
        "summary_paragraphs": [],
        "main_topics": [],
    }
    if not isinstance(obj, dict):
        return out
    ss = obj.get("summary_short")
    out["summary_short"] = ss.strip() if isinstance(ss, str) else ""
    bullets = obj.get("summary_bullets")
    if isinstance(bullets, list):
        out["summary_bullets"] = [str(x).strip() for x in bullets if str(x).strip()][:20]
    paras = obj.get("summary_paragraphs")
    if isinstance(paras, list):
        out["summary_paragraphs"] = [str(x).strip() for x in paras if str(x).strip()][:15]
    topics = obj.get("main_topics")
    if isinstance(topics, list):
        out["main_topics"] = [str(x).strip() for x in topics if str(x).strip()][:20]
    return out


def _length_instructions_en(fmt: SummaryFormat, length: SummaryLength) -> str:
    if fmt == "bullets":
        if length == "short":
            return (
                "Verbosity: SHORT — use 2–4 very concise bullet strings (a few words each where possible). "
                "Keep summary_short to 1–2 short sentences."
            )
        if length == "long":
            return (
                "Verbosity: LONG — use up to 12–15 bullets with fuller phrasing where needed; cover more nuance. "
                "summary_short may be 3–5 sentences."
            )
        return (
            "Verbosity: MEDIUM — use 3–8 balanced bullets (default depth). "
            "summary_short: 2–4 sentences."
        )
    # paragraphs
    if length == "short":
        return (
            "Verbosity: SHORT — summary_paragraphs: 1–2 short paragraphs total; each paragraph brief. "
            "summary_short: one tight sentence. Set summary_bullets to []."
        )
    if length == "long":
        return (
            "Verbosity: LONG — summary_paragraphs: 3–5 paragraphs with more detail; stay grounded in the text. "
            "summary_short: optional 1–2 sentence headline. Set summary_bullets to []."
        )
    return (
        "Verbosity: MEDIUM — summary_paragraphs: 2–3 well-formed paragraphs. "
        "summary_short: 1–2 sentences for the gist. Set summary_bullets to []."
    )


def _length_instructions_fa(fmt: SummaryFormat, length: SummaryLength) -> str:
    if fmt == "bullets":
        if length == "short":
            return (
                "طول: کوتاه — ۲ تا ۴ نکتهٔ بسیار کوتاه؛ summary_short یک یا دو جملهٔ کوتاه."
            )
        if length == "long":
            return (
                "طول: بلند — تا حدود ۱۲–۱۵ نکته با جزئیات بیشتر؛ summary_short می‌تواند ۳ تا ۵ جمله باشد."
            )
        return "طول: متوسط — ۳ تا ۸ نکته؛ summary_short حدود ۲ تا ۴ جمله برای خلاصهٔ کلی."
    if length == "short":
        return (
            "طول: کوتاه — summary_paragraphs: ۱–۲ پاراگراف کوتاه؛ summary_bullets را [] بگذارید."
        )
    if length == "long":
        return (
            "طول: بلند — summary_paragraphs: ۳–۵ پاراگراف با جزئیات بیشتر؛ summary_bullets را [] بگذارید."
        )
    return "طول: متوسط — summary_paragraphs: ۲–۳ پاراگراف؛ summary_bullets را [] بگذارید."


def _build_summary_system_en(fmt: SummaryFormat, length: SummaryLength) -> str:
    base = """You are a careful assistant for transcript summarization (internal review aid).
Respond with a single JSON object only (no markdown, no prose outside JSON).

Always include these keys:
- summary_short: string
- summary_bullets: array of strings (use [] if format is paragraphs-only below)
- summary_paragraphs: array of strings (use [] if format is bullets-only below)
- main_topics: array of strings (short topic labels)

Grounding (critical):
- Use ONLY information explicitly present in the provided text. Do not add facts, names, dates, or claims from outside knowledge.
- Stay factual and neutral; do not editorialize beyond what the text supports."""


    if fmt == "bullets":
        fmt_block = """
Format: BULLETS (primary output)
- Put the main takeaways in summary_bullets; order by importance.
- summary_paragraphs must be an empty array [].
- main_topics: 3–8 short labels (adjust count to match length setting below)."""
    else:
        fmt_block = """
Format: PARAGRAPHS (primary output)
- Put the main takeaways in summary_paragraphs as distinct paragraphs (each string is one paragraph).
- summary_bullets must be an empty array [].
- main_topics: 3–8 short labels (adjust to length)."""

    len_block = _length_instructions_en(fmt, length)
    return f"{base}\n{fmt_block}\n\n{len_block}"


def _build_summary_system_fa(fmt: SummaryFormat, length: SummaryLength) -> str:
    base = """شما یک دستیار دقیق برای خلاصه‌سازی متن رونوشت هستید.
فقط یک شیء JSON معتبر برگردانید (بدون مارک‌داون و بدون متن بیرون از JSON).

همیشه این کلیدها را بگذارید:
- summary_short: رشته
- summary_bullets: آرایهٔ رشته‌ها (اگر فقط پاراگراف می‌خواهید [] بگذارید)
- summary_paragraphs: آرایهٔ رشته‌ها (اگر فقط نکات می‌خواهید [] بگذارید)
- main_topics: آرایهٔ برچسب موضوعی کوتاه

قواعد پایه:
- فقط از اطلاعاتی استفاده کنید که صریحاً در متن داده‌شده هست. از دانش بیرونی استفاده نکنید.
- واقع‌بینانه و بی‌طرف بمانید."""

    if fmt == "bullets":
        fmt_block = """
قالب: نکات (خروجی اصلی)
- نکات اصلی را در summary_bullets بگذارید؛ به ترتیب اهمیت.
- summary_paragraphs باید آرایهٔ خالی [] باشد.
- main_topics: ۳ تا ۸ برچسب (بسته به طول زیر)."""
    else:
        fmt_block = """
قالب: پاراگراف (خروجی اصلی)
- خلاصهٔ اصلی را در summary_paragraphs به‌صورت چند رشتهٔ جدا (هر رشته یک پاراگراف).
- summary_bullets باید آرایهٔ خالی [] باشد.
- main_topics: ۳ تا ۸ برچسب (بسته به طول)."""

    len_block = _length_instructions_fa(fmt, length)
    return f"{base}\n{fmt_block}\n\n{len_block}"


def _summary_user_en(text: str, *, is_short: bool) -> str:
    parts = [
        "Summarize the following text using ONLY what is stated below. "
        "Do not invent or infer facts not supported by the text.\n\n",
        "TEXT:\n",
        text,
    ]
    if is_short:
        parts.append(
            "\n\nThe source is brief; keep summary_short, bullets, and topics minimal but still useful."
        )
    return "".join(parts)


def _summary_user_fa(text: str, *, is_short: bool) -> str:
    parts = [
        "متن زیر را فقط بر اساس خود متن خلاصه کنید. هیچ اطلاعاتی که در متن نیست اضافه نکنید.\n\n",
        "متن:\n",
        text,
    ]
    if is_short:
        parts.append(
            "\n\nمنبع کوتاه است؛ خلاصه و موارد را مختصر ولی مفید نگه دارید."
        )
    return "".join(parts)


def run_transcript_summary_llm(
    *,
    full_text: str,
    analysis_language: Optional[str] = None,
    summary_format: Optional[str] = None,
    summary_length: Optional[str] = None,
) -> tuple[dict[str, Any], Optional[str]]:
    """
    Produce summary_short, summary_bullets, main_topics via Groq JSON mode (single call).

    ``summary_format`` / ``summary_length`` default to ``bullets`` / ``medium`` when omitted.

    The returned dict also includes:

    - ``input_truncated``: whether ``full_text`` was cut to the prototype character limit
      before the model call.
    - ``truncation_note``: ``LLM_SUMMARY_TRUNCATION_NOTE`` when truncated, else ``None``.
    - ``summary_format``: normalized ``bullets`` | ``paragraphs``
    - ``summary_length``: normalized ``short`` | ``medium`` | ``long``

    The second tuple element repeats the truncation note for merging into ``analysis_note`` (or
    ``None`` when nothing was truncated).
    """
    # Lazy import avoids circular import with llm_transcript_analysis.
    from signalmap.services.llm_transcript_analysis import _truncate_for_llm, groq_chat_json

    fmt_norm = normalize_summary_format(summary_format)
    len_norm = normalize_summary_length(summary_length)

    text, truncated = _truncate_for_llm(full_text)
    trunc_note: Optional[str] = LLM_SUMMARY_TRUNCATION_NOTE if truncated else None

    al = (analysis_language or "").strip().lower()
    if al == "fa":
        system = _build_summary_system_fa(fmt_norm, len_norm)
        user = _summary_user_fa(text, is_short=len(text.strip()) < 200)
    else:
        system = _build_summary_system_en(fmt_norm, len_norm)
        user = _summary_user_en(text, is_short=len(text.strip()) < 200)

    max_tokens = 6144 if len_norm == "long" else 4096
    raw = groq_chat_json(system=system, user=user, temperature=0.2, max_tokens=max_tokens)
    validated = validate_summarize_output(raw)
    validated["input_truncated"] = truncated
    validated["truncation_note"] = trunc_note
    validated["summary_format"] = fmt_norm
    validated["summary_length"] = len_norm
    return validated, trunc_note
