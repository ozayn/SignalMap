"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FeedbackKind = "shared" | "copied" | "error" | null;

/**
 * Small inline Share control for study pages.
 *
 * Behavior:
 * - If ``navigator.share`` is available (most mobile browsers + installed PWAs),
 *   invokes the native share sheet with title/text/url.
 * - Otherwise falls back to ``navigator.clipboard.writeText`` (and a hidden
 *   textarea ``execCommand("copy")`` fallback if the clipboard API is blocked).
 * - Shows transient feedback ("Shared" / "Link copied") for ~2s.
 *
 * The button intentionally renders the same on SSR and first client paint
 * (icon + "Share" label) — capability detection happens only at click time so
 * there is no hydration mismatch.
 */
export function StudyShareButton({
  title,
  text,
  buildUrl,
  label = "Share",
  copiedLabel = "Link copied",
  sharedLabel = "Shared",
  errorLabel = "Share failed",
  ariaLabel,
  className,
  dir,
}: {
  title: string;
  text?: string;
  /** Builds the URL at click time so latest query/hash state is captured. */
  buildUrl: () => string;
  label?: string;
  copiedLabel?: string;
  sharedLabel?: string;
  errorLabel?: string;
  ariaLabel?: string;
  className?: string;
  dir?: "ltr" | "rtl";
}) {
  const [feedback, setFeedback] = useState<FeedbackKind>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFeedbackTransient = useCallback((kind: FeedbackKind) => {
    setFeedback(kind);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2000);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  const handleClick = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = buildUrl();

    const nav = window.navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };

    if (typeof nav.share === "function") {
      const data: ShareData = { title, url };
      if (text) data.text = text;
      try {
        if (typeof nav.canShare === "function" && !nav.canShare(data)) {
          throw new Error("canShare returned false");
        }
        await nav.share(data);
        setFeedbackTransient("shared");
        return;
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") {
          /* user cancelled the share sheet — no feedback needed */
          return;
        }
      }
    }

    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "true");
        ta.setAttribute("aria-hidden", "true");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setFeedbackTransient("copied");
    } catch {
      setFeedbackTransient("error");
    }
  }, [buildUrl, title, text, setFeedbackTransient]);

  const visibleLabel =
    feedback === "shared"
      ? sharedLabel
      : feedback === "copied"
        ? copiedLabel
        : feedback === "error"
          ? errorLabel
          : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel ?? label}
      className={
        className ??
        "study-header-meta hover:text-foreground inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
      }
      dir={dir}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="11.49" />
      </svg>
      <span aria-live="polite">{visibleLabel}</span>
    </button>
  );
}
