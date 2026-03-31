"""
Experimental Groq-backed transcript analysis (prototype).

Uses ``GROQ_API_KEY`` and the OpenAI-compatible Chat Completions API at Groq. Outputs are
**not** ground truth: models can hallucinate labels, miss content, or mis-attribute speakers.
All behavior is intended for internal exploration only.

If ``GROQ_API_KEY`` is unset, callers must surface a clear error (see ``require_groq_api_key``).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

import httpx
from fastapi import HTTPException

log = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
# Per-chunk fallacy LLM (override with GROQ_FALLACY_MODEL). Explicit default; older ids may be decommissioned.
DEFAULT_FALLACY_GROQ_MODEL = "llama-3.3-70b-versatile"
FALLACY_GROQ_MODEL = (os.getenv("GROQ_FALLACY_MODEL") or DEFAULT_FALLACY_GROQ_MODEL).strip() or DEFAULT_FALLACY_GROQ_MODEL

# Language-specific fallacy LLM instructions (same JSON schema; see groq_fallacy_chunk_json).
FALLACY_LLM_SYSTEM_PROMPT_EN = """You are a precise analyst of argumentation and logical fallacies.
Identify whether the given text contains any of the following fallacies:

- ad_hominem
- appeal_to_authority
- appeal_to_fear
- burden_shifting
- false_dilemma
- hasty_generalization
- relative_privation
- slippery_slope
- straw_man
- whataboutism

Definitions (short):
- ad_hominem: attacking a person instead of their argument.
- appeal_to_authority: treating an authority’s say-so as sufficient proof, especially when relevance or expertise is unclear.
- appeal_to_fear: manipulating through exaggerated or catastrophic fear (not calm risk analysis).
- burden_shifting: unfairly demanding the other side bear the burden of proof.
- false_dilemma: falsely limiting options to only two when more exist.
- hasty_generalization: a broad claim from thin or anecdotal evidence.
- relative_privation: dismissing a problem by pointing to someone who has it worse.
- slippery_slope: claiming a small first step will inevitably cause a chain of extreme or disastrous outcomes without adequate support.
- straw_man: misrepresenting or exaggerating an opponent’s position.
- whataboutism: deflecting criticism by pointing to another issue.

Return ONLY valid JSON in this format:
{
  "labels": ["..."],
  "trigger_text": "short quote or span from the text that illustrates the pattern (or empty string)",
  "reasoning": "why these labels apply (specific; avoid generic boilerplate)",
  "confidence": "low" | "medium" | "high"
}

You may also use "explanation" instead of "reasoning" (same meaning). Optional: a number between 0 and 1 for "confidence" (e.g. 0.82) meaning model certainty.

Optional advanced shape (one object per detected fallacy; use when multiple distinct patterns appear):
{
  "fallacies": [
    {
      "fallacy_key": "straw_man",
      "fallacy_name": "optional human-readable name",
      "trigger_text": "...",
      "reasoning": "...",
      "confidence": "low" | "medium" | "high"
    }
  ]
}

If "fallacies" is present and non-empty, "labels" should list the same keys; the app merges both.

Examples of clear cases (when the text is plainly like this, it usually warrants a label):
- direct personal attacks on a person, speaker, or group instead of engaging their argument → ad_hominem (not attacks on ideas alone — see below)
- "so you're saying..." style reframing that exaggerates or misstates an opponent's position → straw_man
- explicit either/or framing that limits the situation to only two options → false_dilemma
- redirecting criticism or changing the subject with "what about..." → whataboutism
- exaggerated catastrophic predictions clearly meant to provoke fear (not calm risk analysis) → appeal_to_fear
- demanding the other side prove your claim for you, or shifting the burden of proof unfairly → burden_shifting
- comparing a problem to worse cases to dismiss or minimize the concern → relative_privation
- making broad claims from limited or anecdotal evidence (e.g. sweeping "all of them" without support) → hasty_generalization
- relying on authority ("experts say", "studies prove") instead of reasoning when the authority is not clearly relevant → appeal_to_authority
- claiming that one step will inevitably trigger a chain leading to extreme or disastrous consequences → slippery_slope

ad_hominem only when attacking people, not ideas:
- Do not label criticism of an idea, policy, argument, or situation as ad_hominem.
- Only label ad_hominem when the text attacks a person, speaker, or group in place of engaging their argument.
- Insulting an idea, policy, or situation is not ad_hominem.
- Contrast: "He is an idiot" → ad_hominem. "This idea is stupid" → not ad_hominem.

If a chunk clearly matches one of these patterns, assign the label rather than defaulting to no labels.

Rules:
- Only assign a fallacy label if there is clear and explicit evidence in the text.
- If the text is neutral, analytical, or ambiguous, return no labels.
- For relative_privation, hasty_generalization, appeal_to_authority, and slippery_slope: assign only when the pattern is clearly present; if ambiguous, return no label for that category.
- Do not over-interpret or infer intent beyond what is clearly stated.
- Do not label general warnings, predictions, or risk discussions as appeal_to_fear unless they are exaggerated, emotionally manipulative, or clearly intended to provoke fear.
- Do not label structured comparisons or policy framing as false_dilemma unless the text explicitly limits the situation to only two choices.
- Do not label ordinary forecasting, cautious scenario analysis, or realistic policy-risk discussion as slippery_slope unless the text clearly claims an exaggerated inevitable escalation.
- Only include labels that are clearly present
- If none are present, return an empty list
- Do not invent new labels
- For each label, provide a short, specific explanation referencing the exact phrase or reasoning in the text that triggered the label.
- Avoid generic explanations such as 'this is a fallacy' — instead explain what in the text makes it a fallacy.
- Be conservative"""

# Persian: same task and JSON schema; model reasons over Persian source text. Explanations may be in Persian.
FALLACY_LLM_SYSTEM_PROMPT_FA = """شما تحلیل‌گر دقیق استدلال و مغالطات منطقی هستید.
متن داده‌شده را بخوانید و بررسی کنید آیا هرکدام از این الگوهای مغالطه‌آمیز را دارد:

- ad_hominem
- appeal_to_authority
- appeal_to_fear
- burden_shifting
- false_dilemma
- hasty_generalization
- relative_privation
- slippery_slope
- straw_man
- whataboutism

فقط JSON معتبر با این قالب برگردانید:
{
  "labels": ["..."],
  "trigger_text": "نقل‌قول کوتاه از متن یا خالی",
  "reasoning": "چرا این برچسب‌ها را می‌زنید",
  "confidence": "low" | "medium" | "high"
}

می‌توانید به‌جای reasoning از explanation استفاده کنید. می‌توانید confidence را عدد بین 0 و 1 بدهید.

راهنما:
- ad_hominem: حمله به فرد یا گوینده به‌جای پاسخ به استدلال (نه انتقاد صرف از یک ایده یا سیاست).
- appeal_to_authority: تکیه بر «کارشناسان می‌گویند» یا «مطالعات ثابت می‌کند» به‌جای استدلال، وقتی صلاحیت یا ارتباط روشن نیست.
- appeal_to_fear: برانگیختن ترس اغراق‌آمیز (نه تحلیل آرام خطر).
- burden_shifting: منتقل کردن نادرست بار اثبات به طرف دیگر.
- false_dilemma: قالب‌بندی صریح دو گزینه‌ی تنها وقتی طیف گزینه‌ها وجود دارد.
- hasty_generalization: تعمیم سریع از شواهد محدود یا ناکافی.
- relative_privation: کم‌اهمیت جلوه دادن یک مشکل با مقایسه به وضع بدتر دیگران («بعضی‌ها حتی … ندارند»).
- slippery_slope: ادعای اینکه یک گام کوچک ناگزیر زنجیره‌ای از پیامدهای افراطی یا فاجعه‌بار را بدون استدلال کافی در پی دارد.
- straw_man: جاانداختن حرفی که طرف مقابل نگفته یا اغراق در موضع او.
- whataboutism: منحرف کردن با «شما که دربارهٔ X چرا حرف نمی‌زنید» و امثال آن.

قواعد:
- فقط در صورت وجود شواهد روشن در متن برچسب بزنید؛ اگر ابهام یا متن خنثی است، labels خالی باشد.
- برای relative_privation، hasty_generalization، appeal_to_authority و slippery_slope: فقط وقتی الگو کاملاً روشن است؛ در ابهام، آن برچسب را نزنید.
- پیش‌بینی معمولی یا تحلیل محتاطانهٔ ریسک را slippery_slope نزنید مگر اینکه اغراق در اجتناب‌ناپذیری و تشدید آشکار باشد.
- برچسب جدید اختراع نکنید؛ فقط مقادیر مجاز بالا.
- توضیح کوتاه و مشخص با ارجاع به عبارت یا دلیل در متن.
- محافظه‌کار باشید و حدس نزنید."""

# Back-compat alias for English prompt.
FALLACY_LLM_SYSTEM_PROMPT = FALLACY_LLM_SYSTEM_PROMPT_EN

# Fallacies LLM: only these labels (subset of heuristic set; no "extra" labels).
FALLACY_LLM_LABELS: tuple[str, ...] = (
    "ad_hominem",
    "appeal_to_authority",
    "appeal_to_fear",
    "burden_shifting",
    "false_dilemma",
    "hasty_generalization",
    "relative_privation",
    "slippery_slope",
    "straw_man",
    "whataboutism",
)
FALLACY_LLM_LABEL_SET = frozenset(FALLACY_LLM_LABELS)

# Speaker inference: transcript-only roles (not diarization).
SPEAKER_ROLE_SET = frozenset(
    {
        "HOST",
        "GUEST",
        "MODERATOR",
        "SPEAKER_A",
        "SPEAKER_B",
    }
)

CONFIDENCE_WORDS = frozenset({"low", "medium", "high"})

_SPEAKER_TURN_LABEL_RE = re.compile(r"^Speaker\s*(\d+)\s*$", re.IGNORECASE)

SPEAKERS_SYSTEM_EN = """You are a careful assistant for splitting transcript text into conversational turns by inferred speaker.
Respond with a single JSON object only (no markdown, no prose outside JSON).
Shape: { "turns": [ { "speaker": "Speaker 1", "text": "..." }, ... ] }

Rules:
- Split the text into conversational turns where the speaker changes or where a natural turn boundary occurs. Group consecutive lines from the same speaker into one turn when appropriate.
- Use speaker labels exactly "Speaker 1", "Speaker 2", "Speaker 3", … as needed. Do not invent real names, titles, or roles (no HOST, GUEST, etc.).
- Do not invent dialogue, Q&A structure, or content not present in the source; preserve wording and meaning faithfully.
- If the text is a monologue, narration, article, or is not clearly multi-speaker conversation, return a single turn with speaker "Speaker 1" containing the full text (or the full provided portion).
- Keep the same language as the input in each "text" field (English stays English; Persian stays Persian).
- Do not add summaries or commentary outside the quoted text."""

SPEAKERS_SYSTEM_FA = """شما دستیار دقیق برای تقسیم متن رونوشت به نوبت‌های گفت‌وگو بر اساس گویندهٔ فرضی هستید.
فقط یک شیء JSON معتبر برگردانید (بدون مارک‌داون و بدون متن بیرون از JSON).
قالب: { "turns": [ { "speaker": "Speaker 1", "text": "..." }, ... ] }

قواعد:
- متن را به نوبت‌های گفت‌وگو تقسیم کنید جایی که گوینده عوض می‌شود یا مرز طبیعی نوبت وجود دارد. خطوط پشت‌سرهم از یک گوینده را در صورت مناسب بودن در یک نوبت جمع کنید.
- برچسب گوینده دقیقاً به صورت «Speaker 1»، «Speaker 2»، … باشد. نام واقعی، عنوان یا نقش اختراع نکنید.
- دیالوگ یا ساختار پرسش‌وپاسخی که در متن نیست نسازید؛ معنا و عبارات را وفادارانه حفظ کنید.
- اگر متن تک‌گوینده، روایت، یا گفت‌وگوی چندنفرهٔ روشن نیست، فقط یک نوبت با «Speaker 1» و تمام متن (یا تمام بخش داده‌شده) برگردانید.
- زبان هر فیلد text همان زبان ورودی باشد.
- خلاصه یا توضیح اضافه نگذارید."""

# Rough transcript cap per request (chars) to stay within context limits; prototype only.
_MAX_TRANSCRIPT_CHARS = 80_000

# --- Temporary LLM fallacy debug (set GROQ_FALLACY_LLM_DEBUG=1). Remove when no longer needed. ---
def _fallacy_llm_debug_enabled() -> bool:
    return (os.getenv("GROQ_FALLACY_LLM_DEBUG") or "").strip().lower() in ("1", "true", "yes")


_fallacy_debug_chunk_seq = 0


def require_groq_api_key() -> str:
    """Return a non-empty Groq API key or raise ``HTTPException`` with a clear message."""
    key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not set. Set it in the environment for LLM transcript modes.",
        )
    return key


def _groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL


def _groq_error_suggests_model_unavailable(detail: str) -> bool:
    """True when Groq's error text likely indicates a bad/decommissioned model id."""
    d = (detail or "").lower()
    if "decommission" in d:
        return True
    if "model" in d and (
        "invalid" in d
        or "unknown" in d
        or "not found" in d
        or "does not exist" in d
        or "no longer" in d
    ):
        return True
    return False


def _log_groq_http_rejection(*, status_code: int, detail: str, model_name: str) -> None:
    """Single log line for HTTP errors; emphasize model availability when it looks like a model issue."""
    if _groq_error_suggests_model_unavailable(detail):
        log.error(
            "Groq rejected the chat request (likely invalid or decommissioned model). "
            "model=%r http_status=%s detail=%s — "
            "Set GROQ_FALLACY_MODEL or GROQ_MODEL to a current id from https://console.groq.com/docs/models",
            model_name,
            status_code,
            detail,
        )
        return
    log.warning("Groq API error %s: %s", status_code, detail)


def _log_groq_safe_mode_http_exception(e: HTTPException, *, model: Optional[str]) -> None:
    """When safe wrapper swallows HTTPException, make model/availability issues obvious."""
    detail = str(e.detail or "")
    if _groq_error_suggests_model_unavailable(detail):
        log.error(
            "Groq fallacy LLM call failed (safe mode returned empty). "
            "Likely model id issue — model=%r detail=%s — "
            "See https://console.groq.com/docs/models",
            model,
            detail,
        )
        return
    log.warning("Groq safe-mode failure: %s", detail)


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if len(lines) >= 2 and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def _parse_json_object(content: str) -> Optional[dict[str, Any]]:
    """Parse JSON object from model output; return None on failure."""
    try:
        s = _strip_code_fence(content)
        data = json.loads(s)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def groq_chat_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 8192,
    model: Optional[str] = None,
    fallacy_debug: bool = False,
) -> dict[str, Any]:
    """
    Call Groq chat completions and parse a JSON object from the assistant message.
    On HTTP/parse error, returns ``{}`` (caller should treat as empty/safe default).

    ``fallacy_debug``: when True, log raw assistant text and parse outcome (see GROQ_FALLACY_LLM_DEBUG).
    """
    key = require_groq_api_key()
    model_name = (model or "").strip() or _groq_model()
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.RequestError as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] httpx.RequestError: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq request failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"Groq request failed: {e!s}",
        ) from e

    if r.status_code >= 400:
        try:
            err_body = r.json()
            msg = err_body.get("error", {}).get("message") if isinstance(err_body, dict) else None
        except Exception:
            msg = None
        detail = msg or r.text[:500] or f"HTTP {r.status_code}"
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] Groq HTTP error %s: %s",
                r.status_code,
                detail,
            )
        _log_groq_http_rejection(status_code=r.status_code, detail=detail, model_name=model_name)
        raise HTTPException(status_code=502, detail=f"Groq API error: {detail}")

    try:
        body = r.json()
        choices = body.get("choices") or []
        if not choices:
            if fallacy_debug:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] empty choices[] in Groq response body")
            return {}
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content")
        if not isinstance(content, str):
            if fallacy_debug:
                log.warning(
                    "[GROQ_FALLACY_LLM_DEBUG] assistant content missing or not str (type=%s)",
                    type(content).__name__,
                )
            return {}
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] raw assistant content (%s chars):\n%s",
                len(content),
                content,
            )
        parsed = _parse_json_object(content)
        if fallacy_debug:
            if parsed is None or not isinstance(parsed, dict):
                log.warning(
                    "[GROQ_FALLACY_LLM_DEBUG] _parse_json_object failed or non-dict; got %r",
                    parsed,
                )
            else:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] parsed JSON object: %s", parsed)
        return parsed if isinstance(parsed, dict) else {}
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] exception reading/parsing Groq response: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq response parse failed: %s", e)
        return {}


def groq_chat_json_safe(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 1024,
    model: Optional[str] = None,
    fallacy_debug: bool = False,
) -> dict[str, Any]:
    """
    Like ``groq_chat_json`` but never raises: returns ``{}`` on HTTP errors or ``HTTPException``.
    """
    try:
        return groq_chat_json(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            model=model,
            fallacy_debug=fallacy_debug,
        )
    except HTTPException as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] groq_chat_json_safe caught HTTPException: %s: %s",
                type(e).__name__,
                e.detail,
            )
        _log_groq_safe_mode_http_exception(e, model=model)
        return {}
    except Exception as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] groq_chat_json_safe caught unexpected: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq safe-mode unexpected failure: %s", e)
        return {}


# Per-chunk fallacy prompt; keep under Groq context limits.
_MAX_FALLACY_CHUNK_CHARS = 12_000


def _fallacy_llm_system_prompt_for_language(analysis_language: str) -> str:
    """
    ``analysis_language`` is normalized: ``en``, ``fa``, or ``other`` (non-en/fa uses English prompt).
    """
    al = (analysis_language or "").strip().lower()
    if al == "fa":
        return FALLACY_LLM_SYSTEM_PROMPT_FA
    return FALLACY_LLM_SYSTEM_PROMPT_EN


def groq_fallacy_chunk_json(chunk_text: str, *, analysis_language: str = "en") -> dict[str, Any]:
    """
    One Groq chat completion per chunk using language-specific fallacy instructions.
    Returns parsed JSON object or ``{}`` on failure / empty input.

    Set env ``GROQ_FALLACY_LLM_DEBUG=1`` for verbose logging (temporary; see module header).
    """
    global _fallacy_debug_chunk_seq
    t = (chunk_text or "").strip()
    if not t:
        return {}
    if len(t) > _MAX_FALLACY_CHUNK_CHARS:
        t = t[:_MAX_FALLACY_CHUNK_CHARS]
    user = f"Text:\n{t}"
    system = _fallacy_llm_system_prompt_for_language(analysis_language)

    dbg = _fallacy_llm_debug_enabled()
    if dbg:
        _fallacy_debug_chunk_seq += 1
        if _fallacy_debug_chunk_seq == 1:
            log.warning("[GROQ_FALLACY_LLM_DEBUG] --- first chunk INPUT text ---\n%s", t)

    raw = groq_chat_json_safe(
        system=system,
        user=user,
        temperature=0.2,
        max_tokens=1024,
        model=FALLACY_GROQ_MODEL,
        fallacy_debug=dbg,
    )

    if dbg:
        labels, explanation, conf = normalize_fallacy_llm_response(raw)
        if _fallacy_debug_chunk_seq == 1:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] --- first chunk NORMALIZED --- labels=%s confidence=%s explanation_len=%s",
                labels,
                conf,
                len(explanation),
            )
            if explanation:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] normalized explanation: %s", explanation)
        else:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] chunk #%s normalized labels=%s",
                _fallacy_debug_chunk_seq,
                labels,
            )

    return raw


def _confidence_band_from_value(conf: Any) -> tuple[str, Optional[float]]:
    """
    Map ``confidence`` to ``low`` | ``medium`` | ``high`` and optional numeric score in [0, 1].
    Numeric scores: >= 0.85 → high, >= 0.65 → medium, else low.
    """
    if isinstance(conf, (int, float)) and not isinstance(conf, bool):
        v = float(conf)
        if 0 <= v <= 1:
            if v >= 0.85:
                return "high", v
            if v >= 0.65:
                return "medium", v
            return "low", v
    if isinstance(conf, str) and conf.strip().lower() in CONFIDENCE_WORDS:
        return conf.strip().lower(), None
    return "low", None


def _confidence_band_from_row(row: dict[str, Any]) -> tuple[str, Optional[float]]:
    c = row.get("confidence")
    return _confidence_band_from_value(c)


def normalize_fallacy_llm_response(raw: dict[str, Any]) -> tuple[list[str], str, str]:
    """
    Map model JSON to ``labels`` (allowed set only), ``explanation`` string, and
    ``confidence`` in ``low`` | ``medium`` | ``high``.
    """
    labels: list[str] = []
    for x in raw.get("labels") or []:
        if isinstance(x, str):
            lab = x.strip()
            if lab in FALLACY_LLM_LABEL_SET and lab not in labels:
                labels.append(lab)
    labels.sort()
    exp_raw = raw.get("explanation")
    if isinstance(exp_raw, list):
        explanation = " ".join(str(x).strip() for x in exp_raw if str(x).strip())
    elif isinstance(exp_raw, str):
        explanation = exp_raw.strip()
    else:
        explanation = str(exp_raw or "").strip()
    reasoning = str(raw.get("reasoning") or "").strip()
    if not reasoning:
        reasoning = explanation
    else:
        explanation = reasoning
    conf, _ = _confidence_band_from_value(raw.get("confidence"))
    return labels, explanation, conf


def chunk_payload_from_fallacy_llm_raw(
    raw: dict[str, Any],
) -> tuple[list[str], dict[str, list[str]], dict[str, str], list[dict[str, Any]]]:
    """
    Build chunk fields for ``annotate_chunks_fallacies_llm``: ``labels``, ``label_matches``,
    ``label_strengths``, and structured ``fallacies`` for UI (trigger / reasoning / confidence).

    Supports legacy single-block JSON, optional ``trigger_text`` / ``reasoning``, numeric
    ``confidence`` in [0,1], and optional ``fallacies`` array of per-label instances.
    """
    labels: list[str] = []
    for x in raw.get("labels") or []:
        if isinstance(x, str):
            lab = x.strip()
            if lab in FALLACY_LLM_LABEL_SET and lab not in labels:
                labels.append(lab)
    labels.sort()

    exp_raw = raw.get("explanation")
    if isinstance(exp_raw, list):
        explanation = " ".join(str(x).strip() for x in exp_raw if str(x).strip())
    elif isinstance(exp_raw, str):
        explanation = exp_raw.strip()
    else:
        explanation = str(exp_raw or "").strip()
    reasoning = str(raw.get("reasoning") or "").strip()
    if not reasoning:
        reasoning = explanation
    trigger = str(raw.get("trigger_text") or raw.get("trigger") or "").strip()
    top_conf, top_score = _confidence_band_from_value(raw.get("confidence"))

    fallacies_out: list[dict[str, Any]] = []
    label_matches: dict[str, list[str]] = {}
    label_strengths: dict[str, str] = {}

    raw_fallacies = raw.get("fallacies")
    if isinstance(raw_fallacies, list) and len(raw_fallacies) > 0:
        seen_keys: set[str] = set()
        for row in raw_fallacies:
            if not isinstance(row, dict):
                continue
            fk = row.get("fallacy_key") or row.get("key")
            if not isinstance(fk, str):
                continue
            fk = fk.strip()
            if fk not in FALLACY_LLM_LABEL_SET:
                continue
            tr = str(row.get("trigger_text") or row.get("trigger") or "").strip()
            rs = str(row.get("reasoning") or row.get("explanation") or "").strip()
            name_raw = row.get("fallacy_name")
            fn = str(name_raw).strip() if isinstance(name_raw, str) and str(name_raw).strip() else None
            band, sc = _confidence_band_from_row(row)
            fallacies_out.append(
                {
                    "fallacy_key": fk,
                    "fallacy_name": fn,
                    "trigger_text": tr,
                    "reasoning": rs,
                    "confidence": band,
                    "confidence_score": sc,
                }
            )
            seen_keys.add(fk)
            if fk not in label_matches:
                label_matches[fk] = []
            if rs:
                label_matches[fk].append(rs)
            label_strengths[fk] = band
        labels = sorted(seen_keys)
    else:
        for lab in labels:
            label_matches[lab] = [reasoning] if reasoning else []
            label_strengths[lab] = top_conf
            fallacies_out.append(
                {
                    "fallacy_key": lab,
                    "fallacy_name": None,
                    "trigger_text": trigger,
                    "reasoning": reasoning,
                    "confidence": top_conf,
                    "confidence_score": top_score,
                }
            )

    return labels, label_matches, label_strengths, fallacies_out


def _truncate_for_llm(text: str) -> tuple[str, bool]:
    t = text or ""
    if len(t) <= _MAX_TRANSCRIPT_CHARS:
        return t, False
    return t[:_MAX_TRANSCRIPT_CHARS], True


def _build_chunk_manifest(chunks: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for i, ch in enumerate(chunks):
        if not isinstance(ch, dict):
            continue
        start = ch.get("start")
        end = ch.get("end")
        t = str(ch.get("text", "") or "")
        lines.append(f"--- Chunk index {i} (start={start!r}, end={end!r}) ---\n{t}\n")
    return "\n".join(lines)


def _transcript_language_hint_for_llm(analysis_language: Optional[str]) -> str:
    """Short clause appended to user prompts when transcript locale is known."""
    al = (analysis_language or "").strip().lower()
    if al == "fa":
        return "\n\nThe transcript is primarily in Persian (Farsi); respond in the same language as appropriate for the JSON string values."
    if al == "en":
        return "\n\nThe transcript is primarily in English."
    if al == "other":
        return "\n\nThe transcript language may not be English; stay faithful to the source wording."
    return ""


def _validate_speaker_block(row: Any) -> Optional[dict[str, Any]]:
    if not isinstance(row, dict):
        return None
    sp = row.get("speaker")
    if not isinstance(sp, str):
        return None
    speaker = sp.strip().upper().replace(" ", "_").replace("-", "_")
    if speaker not in SPEAKER_ROLE_SET:
        return None
    text = row.get("text")
    if not isinstance(text, str) or not text.strip():
        return None
    conf_raw = row.get("confidence")
    conf: str | float
    if isinstance(conf_raw, str) and conf_raw.strip().lower() in CONFIDENCE_WORDS:
        conf = conf_raw.strip().lower()
    elif isinstance(conf_raw, (int, float)) and 0.0 <= float(conf_raw) <= 1.0:
        conf = float(conf_raw)
    else:
        conf = "medium"
    return {"speaker": speaker, "text": text.strip(), "confidence": conf}


def validate_speaker_guess_output(obj: Any) -> tuple[list[dict[str, Any]], str]:
    """Return speaker_blocks and analysis_note (default note if missing)."""
    default_note = "Speaker roles inferred from transcript text only; not audio diarization."
    blocks: list[dict[str, Any]] = []
    if isinstance(obj, dict):
        raw_blocks = obj.get("speaker_blocks")
        if isinstance(raw_blocks, list):
            for row in raw_blocks[:200]:
                vb = _validate_speaker_block(row)
                if vb:
                    blocks.append(vb)
        note = obj.get("analysis_note")
        if isinstance(note, str) and note.strip():
            return blocks, note.strip()
    return blocks, default_note


def run_speaker_guess_llm(
    chunks: list[dict[str, Any]],
    *,
    analysis_language: Optional[str] = None,
) -> tuple[list[dict[str, Any]], str, Optional[str]]:
    """
    Infer approximate speaker roles from text only. Returns ``speaker_blocks``, ``analysis_note``, truncation note.
    """
    manifest = _build_chunk_manifest(chunks)
    manifest, truncated = _truncate_for_llm(manifest)
    trunc_note = "Transcript truncated for LLM context (prototype limit)." if truncated else None

    system = (
        "You are helping with an internal prototype: infer likely speaker roles from transcript text ONLY. "
        "This is NOT diarization and NOT ground truth. "
        "Respond with a single JSON object: "
        '{"speaker_blocks": [ {"speaker": "HOST"|"GUEST"|"MODERATOR"|"SPEAKER_A"|"SPEAKER_B", '
        '"text": "<verbatim or lightly edited excerpt from transcript>", "confidence": "low"|"medium"|"high" } ], '
        '"analysis_note": "<one sentence explaining uncertainty>" } '
        "Use only the listed speaker values. If unsure, use lower confidence. "
        "Do not claim certainty about who spoke when."
    )
    user = (
        "Infer approximate speaker blocks from the following transcript chunks. "
        "Text-only; no audio.\n\n"
        + manifest
        + _transcript_language_hint_for_llm(analysis_language)
    )
    raw = groq_chat_json(system=system, user=user, temperature=0.3, max_tokens=8192)
    blocks, note = validate_speaker_guess_output(raw)
    return blocks, note, trunc_note


def _normalize_speaker_turn_label(raw: str) -> Optional[str]:
    s = (raw or "").strip()
    m = _SPEAKER_TURN_LABEL_RE.match(s)
    if m:
        return f"Speaker {int(m.group(1))}"
    return None


def normalize_speaker_turns_response(raw: Any, *, fallback_text: str) -> list[dict[str, Any]]:
    """Validate Groq JSON into ``Speaker N`` turns; on empty/invalid, single-speaker fallback."""
    rows: list[dict[str, Any]] = []
    if isinstance(raw, dict):
        arr = raw.get("turns")
        if not isinstance(arr, list):
            arr = raw.get("speaker_turns")
        if isinstance(arr, list):
            for row in arr[:500]:
                if not isinstance(row, dict):
                    continue
                sp = row.get("speaker")
                tx = row.get("text")
                if not isinstance(sp, str) or not isinstance(tx, str):
                    continue
                label = _normalize_speaker_turn_label(sp)
                t = tx.strip()
                if not label or not t:
                    continue
                rows.append({"speaker": label, "text": t})
    if not rows:
        ft = (fallback_text or "").strip()
        if ft:
            return [{"speaker": "Speaker 1", "text": ft}]
        return []
    return rows


def _speakers_system_for_language(analysis_language: str) -> str:
    al = (analysis_language or "").strip().lower()
    if al == "fa":
        return SPEAKERS_SYSTEM_FA
    return SPEAKERS_SYSTEM_EN


def extract_speakers_llm(text: str, language: str) -> tuple[list[dict[str, Any]], Optional[str]]:
    """
    Infer conversational speaker turns from plain text via Groq JSON mode (``GROQ_API_KEY``).

    ``language`` is a normalized analysis locale: ``en``, ``fa``, or ``other`` (English prompts for other).

    Returns ``(turns, truncation_note)`` where each turn is ``{"speaker": "Speaker 1", "text": "..."}``.
    """
    t, truncated = _truncate_for_llm(text or "")
    trunc_note = "Transcript truncated for LLM context (prototype limit)." if truncated else None
    al = (language or "").strip().lower()
    al_norm: str = al if al in ("en", "fa", "other") else "other"
    system = _speakers_system_for_language(al)
    if al == "fa":
        user = (
            "متن زیر را به نوبت‌های گوینده تقسیم کنید.\n\nمتن:\n"
            + t
            + _transcript_language_hint_for_llm("fa")
        )
    else:
        user = (
            "Split the following text into speaker turns per the rules.\n\nTEXT:\n"
            + t
            + _transcript_language_hint_for_llm(al_norm)
        )
    raw = groq_chat_json(system=system, user=user, temperature=0.15, max_tokens=8192)
    turns = normalize_speaker_turns_response(raw, fallback_text=t)
    return turns, trunc_note


DISCUSSION_ANALYSIS_DISCLAIMER = (
    "Speakers inferred from transcript text only; not audio diarization."
)

DISCUSSION_BULLETS_SYSTEM_EN = """You summarize what one speaker said in a discussion transcript excerpt.
Return ONLY valid JSON: {"bullets": ["...", ...]}
Rules:
- 3–8 concise bullet points.
- Use ONLY information explicitly present in the excerpt. Do not invent names, facts, or claims.
- Match the excerpt language (English stays English).
- If the excerpt is very short, use fewer bullets."""

DISCUSSION_BULLETS_SYSTEM_FA = """شما بخشی از رونوشت را که مربوط به یک گوینده است خلاصه می‌کنید.
فقط JSON معتبر برگردانید: {"bullets": ["...", ...]}
قواعد:
- ۳ تا ۸ نکتهٔ کوتاه.
- فقط از خود متن؛ نام، واقعیت یا ادعای جدید اختراع نکنید.
- زبان خروجی همان زبان متن باشد.
- اگر متن بسیار کوتاه است، تعداد نکات را کم کنید."""


def _discussion_bullets_system_for_language(analysis_language: str) -> str:
    al = (analysis_language or "").strip().lower()
    if al == "fa":
        return DISCUSSION_BULLETS_SYSTEM_FA
    return DISCUSSION_BULLETS_SYSTEM_EN


def speaker_block_bullets_llm(speaker_text: str, *, analysis_language: str) -> list[str]:
    """Groq JSON bullets for one speaker block (same language as excerpt)."""
    t = (speaker_text or "").strip()
    if not t:
        return []
    if len(t) > _MAX_FALLACY_CHUNK_CHARS:
        t = t[:_MAX_FALLACY_CHUNK_CHARS]
    al = (analysis_language or "").strip().lower()
    al_norm = al if al in ("en", "fa", "other") else "other"
    system = _discussion_bullets_system_for_language(al)
    if al == "fa":
        user = "بخش زیر از یک گوینده است. فقط بر اساس همین متن نکات را بنویسید.\n\nمتن:\n" + t + _transcript_language_hint_for_llm("fa")
    else:
        user = (
            "The following is one speaker's contribution. Summarize with bullets per the rules.\n\nTEXT:\n"
            + t
            + _transcript_language_hint_for_llm(al_norm)
        )
    raw = groq_chat_json(system=system, user=user, temperature=0.2, max_tokens=2048)
    bullets = raw.get("bullets")
    if not isinstance(bullets, list):
        return []
    out: list[str] = []
    for x in bullets[:12]:
        if isinstance(x, str) and x.strip():
            out.append(x.strip())
    return out


def run_discussion_analysis_llm(
    full_text: str,
    *,
    analysis_language: str,
    source_type: str,
    language_display: Optional[str] = None,
) -> tuple[dict[str, Any], Optional[str]]:
    """
    Pipeline: infer speaker turns, then per-speaker bullet summary + fallacy LLM labels.

    Returns ``(payload, truncation_note)`` where ``payload`` matches the discussion-analysis
    contract (``source_type``, ``language``, ``speakers``, ``analysis_note``).
    """
    st = source_type if source_type in ("youtube", "text") else "text"
    turns, trunc_note = extract_speakers_llm(full_text, language=analysis_language)
    speakers_out: list[dict[str, Any]] = []
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        label = turn.get("speaker")
        block = turn.get("text")
        if not isinstance(label, str) or not isinstance(block, str):
            continue
        label = label.strip()
        block = block.strip()
        if not label or not block:
            continue
        bullets = speaker_block_bullets_llm(block, analysis_language=analysis_language)
        raw_f = groq_fallacy_chunk_json(block, analysis_language=analysis_language)
        labels, _, _ = normalize_fallacy_llm_response(raw_f)
        speakers_out.append(
            {
                "speaker": label,
                "text": block,
                "summary_bullets": bullets,
                "fallacies": labels,
            }
        )
    lang_out = (language_display or "").strip() or analysis_language
    payload: dict[str, Any] = {
        "source_type": st,
        "language": lang_out,
        "speakers": speakers_out,
        "analysis_note": DISCUSSION_ANALYSIS_DISCLAIMER,
    }
    return payload, trunc_note
