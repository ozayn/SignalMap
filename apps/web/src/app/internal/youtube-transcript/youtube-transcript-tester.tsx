"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { TranscriptFallacyMethodNote } from "@/components/transcript-fallacy-method-note";
import { cn } from "@/lib/utils";

type Segment = {
  text?: string;
  start?: number;
  duration?: number;
};

type TranscriptPayload = {
  video_id: string;
  title: string | null;
  language: string | null;
  transcript_text: string;
  segments: Segment[];
  cached: boolean;
  fallback_used?: boolean;
  chunks?: Record<string, unknown>[];
};

type AnalyzeChunk = {
  start?: number;
  end?: number;
  text?: string;
  segment_count?: number;
  labels?: string[];
  /** Per label: heuristic cue strings or LLM explanation (string or one-element array). */
  label_matches?: Record<string, string[] | string>;
  label_strengths?: Record<string, string>;
};

type AnalyzePayload = {
  video_id: string;
  title: string | null;
  language: string | null;
  cached: boolean;
  chunks: AnalyzeChunk[];
  summary?: Record<string, number>;
  fallback_used?: boolean;
  analysis_supported?: boolean;
  analysis_note?: string | null;
  llm_summarize?: {
    summary_short?: string;
    summary_bullets?: string[];
    summary_paragraphs?: string[];
    main_topics?: string[];
    /** Normalized request: bullets | paragraphs */
    summary_format?: string;
    /** Normalized request: short | medium | long */
    summary_length?: string;
    /** True when the transcript was clipped to the prototype char limit before summarization */
    input_truncated?: boolean;
    /** Present when input_truncated; echoed in analysis_note as well */
    truncation_note?: string | null;
  } | null;
  speaker_blocks?: Array<{ speaker?: string; text?: string; confidence?: string | number }> | null;
  /** speakers mode: LLM turns with Speaker 1, Speaker 2, … */
  speaker_turns?: Array<{ speaker?: string; text?: string }> | null;
  /** discussion_analysis: per-speaker text, bullets, fallacy labels */
  discussion_analysis?: {
    source_type?: string;
    language?: string;
    analysis_note?: string;
    speakers?: Array<{
      speaker?: string;
      text?: string;
      summary_bullets?: string[];
      fallacies?: string[];
    }>;
  } | null;
  /** Present when mode was fallacies: which detection method ran */
  method?: "heuristic" | "classifier" | "llm" | null;
  /** Full transcript when the analyze request included a YouTube fetch; optional for back-compat */
  transcript_text?: string;
  segments?: Segment[];
};

/** Pasted transcript language hint for /api/transcript/analyze-text (matches API contract). */
type PasteAnalysisLanguage = "en" | "fa";

type SummaryFormatOption = "bullets" | "paragraphs";
type SummaryLengthOption = "short" | "medium" | "long";

type DetectedInputKind = "youtube" | "text";

/**
 * Single-line input only: if it looks like a YouTube URL or bare 11-char video id, return a URL string
 * for the API; otherwise null (treat input as plain transcript text). Multiline input is always text.
 */
function detectYouTubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lines = t.split(/\r?\n/);
  if (lines.slice(1).some((line) => line.trim().length > 0)) return null;
  const line = lines[0].trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(line)) {
    return `https://www.youtube.com/watch?v=${line}`;
  }
  const candidate = /^https?:\/\//i.test(line) ? line : `https://${line}`;
  const fromPattern = candidate.match(
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  );
  if (fromPattern) return candidate;
  try {
    const u = new URL(candidate);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    const yt =
      h === "youtube.com" ||
      h === "m.youtube.com" ||
      h === "music.youtube.com" ||
      h === "youtu.be" ||
      h.endsWith(".youtube.com");
    if (!yt) return null;
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return candidate;
    if (h === "youtu.be" && u.pathname.replace(/^\//, "").length >= 11) return candidate;
  } catch {
    return null;
  }
  return null;
}

function formatApiError(status: number, data: Record<string, unknown>): string {
  const detail = data.detail;
  if (typeof detail === "string") {
    if (status === 400) return `Invalid URL: ${detail}`;
    if (status === 422) return `Request failed: ${detail}`;
    if (status === 503) return `Blocked / fetch failed: ${detail}`;
    return detail;
  }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const o = detail as { message?: string; title?: string };
    const bits = [o.message, o.title].filter(Boolean);
    if (bits.length) {
      const prefix =
        status === 503
          ? "Blocked / proxy failure"
          : status === 422
            ? "No usable transcript or bad request"
            : status === 400
              ? "Invalid URL"
              : "Error";
      return `${prefix}: ${bits.join(" — ")}`;
    }
  }
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) =>
      typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d)
    );
    return msgs.join("; ") || `Error ${status}`;
  }
  if (status === 400) return "Invalid YouTube URL.";
  if (status === 422) return "No transcript, transcript too short, or unsupported mode.";
  if (status === 503) return "YouTube blocked the request or proxy failed. Check API logs and proxy env.";
  return `Request failed (${status}).`;
}

function aggregateLabelCounts(chunks: AnalyzeChunk[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const ch of chunks) {
    for (const lab of ch.labels ?? []) {
      m.set(lab, (m.get(lab) ?? 0) + 1);
    }
  }
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function sumChunkTextLengths(chunks: AnalyzeChunk[]): number {
  return chunks.reduce((n, ch) => n + (ch.text?.length ?? 0), 0);
}

/** Join analysis chunk texts for export when ``transcript_text`` was not returned (older API). */
function joinChunkTextsForTranscriptExport(chunks: AnalyzeChunk[]): string {
  return chunks
    .map((ch) => (ch.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Build a transcript download payload from an analyze response (same shape as fetch-transcript).
 * Returns null when there is nothing meaningful to export.
 */
function transcriptPayloadFromAnalyzePayload(a: AnalyzePayload): TranscriptPayload | null {
  const fromApi = (a.transcript_text ?? "").trim();
  const joined = joinChunkTextsForTranscriptExport(a.chunks ?? []);
  const transcript_text = fromApi || joined;
  if (!transcript_text.trim()) return null;
  const segments = Array.isArray(a.segments) ? a.segments : [];
  return {
    video_id: a.video_id,
    title: a.title,
    language: a.language,
    transcript_text,
    segments,
    cached: a.cached,
    fallback_used: a.fallback_used ?? false,
  };
}

/** Flatten chunk `label_matches` into one comma-separated line; strip `phrase:` / `cue:` / `combo:` prefixes. */
function formatMatchedCuesLine(labelMatches: Record<string, string[] | string> | undefined): string {
  if (!labelMatches) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const kws of Object.values(labelMatches)) {
    const rows = typeof kws === "string" ? [kws] : Array.isArray(kws) ? kws : [];
    for (const raw of rows) {
      const s = String(raw)
        .replace(/^(phrase|cue|combo):/i, "")
        .trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      parts.push(s);
    }
  }
  return parts.join(", ");
}

/** Single display string for one label's `label_matches` entry (heuristic cues or LLM explanation). */
function textFromLabelMatchEntry(
  lab: string,
  labelMatches: Record<string, string[] | string> | undefined,
): string {
  if (!labelMatches) return "";
  const v = labelMatches[lab];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    return v
      .map((s) =>
        String(s)
          .replace(/^(phrase|cue|combo):/i, "")
          .trim()
      )
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

/** True if any label has non-empty `label_matches` text (reasoning to show in the collapsible). */
function hasFallacyReasoningContent(
  labels: string[] | undefined,
  labelMatches: Record<string, string[] | string> | undefined,
): boolean {
  for (const lab of labels ?? []) {
    if (textFromLabelMatchEntry(lab, labelMatches)) return true;
  }
  return false;
}

function formatSecondsAsClock(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return "—";
  const t = Math.floor(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatChunkTimeRange(start: number | undefined, end: number | undefined): string {
  if (start == null || end == null || Number.isNaN(start) || Number.isNaN(end)) return "—";
  return `${formatSecondsAsClock(start)}–${formatSecondsAsClock(end)}`;
}

/** Non-empty string after trim — use to omit summary rows with no real value. */
function meaningfulString(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function downloadBlob(filename: string, data: BlobPart, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(href);
}

function buildTranscriptTxtHeader(t: TranscriptPayload): string {
  return [
    `Title: ${t.title ?? ""}`,
    `Video ID: ${t.video_id}`,
    `Language: ${t.language ?? ""}`,
    `Fallback used: ${t.fallback_used ? "yes" : "no"}`,
    "",
  ].join("\n");
}

/** Timestamped lines only (no full transcript body). */
function buildTranscriptTimestampedTxt(t: TranscriptPayload): string {
  const header = buildTranscriptTxtHeader(t);
  const segs = t.segments ?? [];
  if (segs.length === 0) return header.replace(/\n+$/, "");
  const lines: string[] = [header];
  for (const seg of segs) {
    const clock =
      seg.start != null && !Number.isNaN(seg.start) ? formatSecondsAsClock(seg.start) : "—";
    const line = (seg.text ?? "").replace(/\r?\n/g, " ");
    lines.push(`[${clock}] ${line}`);
  }
  return lines.join("\n");
}

/** Header plus full transcript text only (no per-segment timestamps). */
function buildTranscriptPlainTxt(t: TranscriptPayload): string {
  return `${buildTranscriptTxtHeader(t)}${t.transcript_text ?? ""}`;
}

function transcriptExportFileSlug(t: TranscriptPayload): string {
  const id = (t.video_id ?? "").trim();
  return id || "export";
}

function buildTranscriptJsonExport(t: TranscriptPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    video_id: t.video_id,
    title: t.title,
    language: t.language,
    cached: t.cached,
    fallback_used: t.fallback_used ?? false,
    transcript_text: t.transcript_text,
    segments: t.segments ?? [],
  };
  if (t.chunks !== undefined && t.chunks.length > 0) {
    out.chunks = t.chunks;
  }
  return out;
}

function uniqueSortedLabelsFromChunks(chunks: AnalyzeChunk[]): string[] {
  const s = new Set<string>();
  for (const ch of chunks) {
    for (const lab of ch.labels ?? []) s.add(lab);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function aggregateLabelMatchesFromChunks(chunks: AnalyzeChunk[]): Record<string, string[]> {
  const m = new Map<string, Set<string>>();
  for (const ch of chunks) {
    for (const [lab, kws] of Object.entries(ch.label_matches ?? {})) {
      if (!m.has(lab)) m.set(lab, new Set());
      const set = m.get(lab)!;
      const parts = Array.isArray(kws) ? kws : typeof kws === "string" ? [kws] : [];
      for (const kw of parts) set.add(kw);
    }
  }
  return Object.fromEntries(
    [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lab, set]) => [lab, [...set].sort((a, b) => a.localeCompare(b))])
  );
}

function buildAnalysisJsonExport(a: AnalyzePayload, mode: AnalyzeMode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    mode,
    video_id: a.video_id,
    title: a.title,
    language: a.language,
    cached: a.cached,
    fallback_used: a.fallback_used ?? false,
    chunks: a.chunks,
    labels: uniqueSortedLabelsFromChunks(a.chunks),
    label_matches: aggregateLabelMatchesFromChunks(a.chunks),
  };
  if (a.summary !== undefined && Object.keys(a.summary).length > 0) {
    out.summary = a.summary;
  }
  out.analysis_supported = a.analysis_supported ?? true;
  if (a.analysis_note) {
    out.analysis_note = a.analysis_note;
  }
  if (a.llm_summarize != null) out.llm_summarize = a.llm_summarize;
  if (a.speaker_blocks != null) out.speaker_blocks = a.speaker_blocks;
  if (a.speaker_turns != null) out.speaker_turns = a.speaker_turns;
  if (a.discussion_analysis != null) out.discussion_analysis = a.discussion_analysis;
  if (a.method != null) out.method = a.method;
  return out;
}

/** Label chip — soft tint, intentional, not bulky (frames mode, or fallacies without strength row) */
function FallacyLabelChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center break-words rounded-md border border-border/55 bg-muted/45 px-2.5 py-1 text-[12px] font-medium leading-snug text-foreground/95">
      {label}
    </span>
  );
}

/** Heuristic: weak/strong · LLM: low/medium/high — shown as a small badge on the right */
function formatStrengthBadge(strength: string): string {
  const s = strength.trim().toLowerCase();
  if (s === "low" || s === "medium" || s === "high") {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return strength;
}

/** Fallacy label + strength/confidence as one bordered unit; strength is small and muted on the right */
function LabelStrengthGroup({ label, strength }: { label: string; strength: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-md border border-border/45 bg-muted/35">
      <span className="inline-flex min-w-0 items-center break-words px-2 py-1 text-[12px] font-medium leading-snug text-foreground/95">
        {label}
      </span>
      <span className="inline-flex shrink-0 items-center border-l border-border/25 bg-muted/25 px-1 py-0.5 text-[9px] font-medium tabular-nums leading-none text-muted-foreground/55">
        {formatStrengthBadge(strength)}
      </span>
    </span>
  );
}

/** Collapsible per-label reasoning from `label_matches` (fallacies mode). Renders nothing if no content. */
function FallacyChunkReasoning({
  labels,
  labelMatches,
  labelStrengths,
}: {
  labels: string[];
  labelMatches?: Record<string, string[] | string>;
  labelStrengths?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const out: { label: string; text: string }[] = [];
    for (const lab of labels) {
      const text = textFromLabelMatchEntry(lab, labelMatches);
      if (!text) continue;
      out.push({ label: lab, text });
    }
    return out;
  }, [labels, labelMatches]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground"
      >
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>
      {open ? (
        <div className="mt-2.5 space-y-3 border-l border-border/20 pl-3">
          {rows.map(({ label, text }) => (
            <div key={label}>
              <p className="text-[12px] leading-snug">
                <span className="font-medium text-muted-foreground">{label}</span>
                {labelStrengths?.[label] ? (
                  <span className="ml-1.5 text-[10px] font-medium tabular-nums text-muted-foreground/50">
                    {formatStrengthBadge(labelStrengths[label])}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground/85">{text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Small uppercase section label — Source / Results / Reference / Input */
function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90",
        className
      )}
    >
      {children}
    </p>
  );
}

const inputSurfaceClass =
  "border-border/50 bg-background shadow-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-border/75 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:ring-offset-0 dark:border-border/45";

const textareaSurfaceClass =
  "border-border/50 bg-background shadow-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-border/75 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:ring-offset-0 dark:border-border/45";

function PasteLanguageSelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  value: PasteAnalysisLanguage;
  onChange: (v: PasteAnalysisLanguage) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PasteAnalysisLanguage)}
      className={cn(
        "w-full min-w-0 cursor-pointer rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-[12px] text-foreground shadow-none transition-[border-color,box-shadow] focus:border-border/75 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:ring-offset-0 dark:border-border/45",
        className
      )}
    >
      <option value="en">English</option>
      <option value="fa">Farsi</option>
    </select>
  );
}

/** Light panel for summary sections — no heavy shadow */
function SummarySectionCard({
  title,
  children,
  dense,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  /** Lighter chrome for public explore layout */
  dense?: boolean;
  /** Quieter panels in the reference column */
  tone?: "default" | "sidebar";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3",
        tone === "sidebar"
          ? "border-border/20 bg-muted/[0.05] dark:border-border/20 dark:bg-muted/[0.06]"
          : dense
            ? "border-border/30 bg-muted/10"
            : "border-border/40 bg-muted/20"
      )}
    >
      <h3
        className={cn(
          "font-semibold uppercase tracking-[0.16em]",
          tone === "sidebar" && "mb-2 text-[9px] text-muted-foreground/75",
          tone !== "sidebar" && dense && "mb-2 text-[9px] text-muted-foreground/85",
          tone !== "sidebar" && !dense && "mb-3 text-[10px] text-muted-foreground/85"
        )}
      >
        {title}
      </h3>
      <div
        className={cn(
          "leading-snug",
          dense ? "text-[12px]" : "text-[13px]",
          tone === "sidebar" && "text-[11px] text-muted-foreground/88"
        )}
      >
        {children}
      </div>
    </section>
  );
}

type FallacyMethod = "heuristic" | "classifier" | "llm";

/** Methods exposed in the UI; classifier remains in types/API for future use. */
const VISIBLE_FALLACY_METHODS = ["heuristic", "llm"] as const satisfies readonly FallacyMethod[];

function FallacyMethodSegmented({
  value,
  onChange,
  disabled,
}: {
  value: FallacyMethod;
  onChange: (m: FallacyMethod) => void;
  disabled?: boolean;
}) {
  const selected = value === "classifier" ? "heuristic" : value;
  return (
    <div
      className="flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-1 sm:inline-flex sm:w-auto dark:border-border/35 dark:bg-muted/15"
      role="tablist"
      aria-label="Fallacy detection method"
    >
      {VISIBLE_FALLACY_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={selected === m}
          onClick={() => onChange(m)}
          disabled={disabled}
          className={cn(
            "min-h-[2rem] flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 sm:flex-initial sm:px-2.5",
            selected === m
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "heuristic" ? "Heuristic" : "LLM"}
        </button>
      ))}
    </div>
  );
}

type ExploreAnalysisType = "fallacies" | "summary";

function ExploreAnalysisTypeSegmented({
  value,
  onChange,
  disabled,
}: {
  value: ExploreAnalysisType;
  onChange: (v: ExploreAnalysisType) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-1 sm:inline-flex sm:w-auto dark:border-border/35 dark:bg-muted/15"
      role="tablist"
      aria-label="Analysis type"
    >
      {(["fallacies", "summary"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          disabled={disabled}
          className={cn(
            "min-h-[2rem] flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 sm:flex-initial sm:px-2.5",
            value === v
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v === "fallacies" ? "Fallacies" : "Summary"}
        </button>
      ))}
    </div>
  );
}

function SummaryFormatSegmented({
  value,
  onChange,
  disabled,
}: {
  value: SummaryFormatOption;
  onChange: (v: SummaryFormatOption) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-1 sm:inline-flex sm:w-auto dark:border-border/35 dark:bg-muted/15"
      role="tablist"
      aria-label="Summary format"
    >
      {(["bullets", "paragraphs"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          disabled={disabled}
          className={cn(
            "min-h-[2rem] flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 sm:flex-initial sm:px-2.5",
            value === v
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v === "bullets" ? "Bullets" : "Paragraphs"}
        </button>
      ))}
    </div>
  );
}

function SummaryLengthSegmented({
  value,
  onChange,
  disabled,
}: {
  value: SummaryLengthOption;
  onChange: (v: SummaryLengthOption) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-1 sm:inline-flex sm:w-auto dark:border-border/35 dark:bg-muted/15"
      role="tablist"
      aria-label="Summary length"
    >
      {(["short", "medium", "long"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          disabled={disabled}
          className={cn(
            "min-h-[2rem] flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors disabled:opacity-40 sm:flex-initial sm:px-2.5",
            value === v
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Explore page: primary summary output in the main column (sidebar stays compact). */
function ExploreSummaryResultsMain({
  llm,
}: {
  llm: NonNullable<AnalyzePayload["llm_summarize"]>;
}) {
  return (
    <div className="space-y-8">
      {llm.input_truncated && typeof llm.truncation_note === "string" && llm.truncation_note.trim() ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {llm.truncation_note}
        </p>
      ) : null}
      {llm.summary_short ? (
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
            Overview
          </h3>
          <p className="text-[15px] leading-relaxed text-foreground/95 sm:text-[16px] sm:leading-relaxed">
            {llm.summary_short}
          </p>
        </section>
      ) : (
        <p className="text-[13px] text-muted-foreground">No short summary returned.</p>
      )}
      {llm.summary_bullets && llm.summary_bullets.length > 0 ? (
        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
            Bullets
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-foreground/90">
            {llm.summary_bullets.map((t, ti) => (
              <li key={ti}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {llm.summary_paragraphs && llm.summary_paragraphs.length > 0 ? (
        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
            Paragraphs
          </h3>
          <div className="space-y-4">
            {llm.summary_paragraphs.map((p, pi) => (
              <p key={pi} className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
                {p}
              </p>
            ))}
          </div>
        </section>
      ) : null}
      {llm.main_topics && llm.main_topics.length > 0 ? (
        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
            Main topics
          </h3>
          <ul className="flex flex-wrap gap-2">
            {llm.main_topics.map((t, ti) => (
              <li
                key={ti}
                className="rounded-full border border-border/35 bg-muted/20 px-3 py-1 text-[12px] leading-snug text-foreground/90"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

type AnalyzeMode =
  | "frames"
  | "fallacies"
  | "summarize_llm"
  | "speaker_guess_llm"
  | "speakers"
  | "discussion_analysis";
type ChunkFilterMode = "all" | "labeled" | "by_label";

function formatResultsStatusLine(
  mode: AnalyzeMode,
  labeledChunksInView: number,
  fallacyMethod: FallacyMethod | null | undefined
): string {
  if (mode === "summarize_llm") return "LLM summary (experimental)";
  if (mode === "speaker_guess_llm") return "Speaker guess — transcript only (experimental)";
  if (mode === "speakers") return "Speakers (LLM turns, text-only)";
  if (mode === "discussion_analysis")
    return "Discussion analysis — per-speaker summary & fallacies (LLM)";
  if (mode === "fallacies") {
    const fm = fallacyMethod ?? "heuristic";
    if (fm === "classifier") return "Classifier not available (placeholder)";
    if (fm === "llm") {
      if (labeledChunksInView === 0) return "No fallacy labels (LLM)";
      if (labeledChunksInView === 1) return "1 chunk with fallacy labels (LLM)";
      return `${labeledChunksInView} chunks with fallacy labels (LLM)`;
    }
    if (labeledChunksInView === 0) return "No fallacies detected";
    if (labeledChunksInView === 1) return "1 fallacy detected";
    return `${labeledChunksInView} fallacies detected`;
  }
  if (labeledChunksInView === 0) return "No labels detected";
  if (labeledChunksInView === 1) return "1 labeled chunk";
  return `${labeledChunksInView} labeled chunks`;
}

export type YouTubeTranscriptTesterProps = {
  /**
   * Public explore route: fallacies or LLM summary, hide internal mode dropdown,
   * and YouTube uses analyze-only (no separate transcript fetch / preview).
   */
  exploreFallaciesOnly?: boolean;
};

export function YouTubeTranscriptTester({
  exploreFallaciesOnly = false,
}: YouTubeTranscriptTesterProps = {}) {
  const [unifiedInput, setUnifiedInput] = useState("");
  const [pasteLanguage, setPasteLanguage] = useState<PasteAnalysisLanguage>("en");

  const detectedYoutubeUrl = useMemo(() => detectYouTubeUrl(unifiedInput), [unifiedInput]);
  const detectedKind = useMemo((): DetectedInputKind | null => {
    if (!unifiedInput.trim()) return null;
    return detectedYoutubeUrl ? "youtube" : "text";
  }, [unifiedInput, detectedYoutubeUrl]);
  const [analyzeMode, setAnalyzeMode] = useState<AnalyzeMode>(
    exploreFallaciesOnly ? "fallacies" : "frames"
  );
  const [lastAnalyzeMode, setLastAnalyzeMode] = useState<AnalyzeMode>(
    exploreFallaciesOnly ? "fallacies" : "frames"
  );
  /** Explore page: user picks Fallacies vs Summary first; drives `analyzeMode` (fallacies | summarize_llm). */
  const [exploreAnalysisType, setExploreAnalysisType] = useState<ExploreAnalysisType>("fallacies");
  const [fallacyMethod, setFallacyMethod] = useState<FallacyMethod>("heuristic");
  const [summaryFormat, setSummaryFormat] = useState<SummaryFormatOption>("bullets");
  const [summaryLength, setSummaryLength] = useState<SummaryLengthOption>("medium");
  const [loading, setLoading] = useState<null | "transcript" | "analyze">(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedChunkKey, setCopiedChunkKey] = useState<string | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptPayload | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzePayload | null>(null);
  const [chunkFilterMode, setChunkFilterMode] = useState<ChunkFilterMode>("all");
  const [filterByLabel, setFilterByLabel] = useState<string>("");

  const labelSummary = useMemo(
    () => (analyzeResult?.chunks ? aggregateLabelCounts(analyzeResult.chunks) : []),
    [analyzeResult?.chunks]
  );

  const fallacySummaryEntries = useMemo(() => {
    const s = analyzeResult?.summary;
    if (!s || typeof s !== "object") return [];
    return Object.entries(s)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count: count as number }));
  }, [analyzeResult?.summary]);

  const uniqueLabelsFromChunks = useMemo(() => {
    const s = new Set<string>();
    for (const ch of analyzeResult?.chunks ?? []) {
      for (const lab of ch.labels ?? []) s.add(lab);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [analyzeResult?.chunks]);

  useEffect(() => {
    if (!exploreFallaciesOnly) return;
    setAnalyzeMode(exploreAnalysisType === "summary" ? "summarize_llm" : "fallacies");
  }, [exploreFallaciesOnly, exploreAnalysisType]);

  useEffect(() => {
    if (fallacyMethod === "classifier") setFallacyMethod("heuristic");
  }, [fallacyMethod]);

  useEffect(() => {
    if (chunkFilterMode !== "by_label" || uniqueLabelsFromChunks.length === 0) return;
    if (!filterByLabel || !uniqueLabelsFromChunks.includes(filterByLabel)) {
      setFilterByLabel(uniqueLabelsFromChunks[0]);
    }
  }, [chunkFilterMode, uniqueLabelsFromChunks, filterByLabel, analyzeResult]);

  const filteredChunks = useMemo(() => {
    const chunks = analyzeResult?.chunks ?? [];
    if (chunkFilterMode === "all") return chunks;
    if (chunkFilterMode === "labeled") return chunks.filter((ch) => (ch.labels?.length ?? 0) > 0);
    if (chunkFilterMode === "by_label" && filterByLabel) {
      return chunks.filter((ch) => ch.labels?.includes(filterByLabel));
    }
    return chunks;
  }, [analyzeResult?.chunks, chunkFilterMode, filterByLabel]);

  const labeledChunksInView = useMemo(
    () => filteredChunks.filter((ch) => (ch.labels?.length ?? 0) > 0).length,
    [filteredChunks]
  );

  /** Effective fallacy method for labels: API result when present, else current tab selection. */
  const statusFallacyMethod: FallacyMethod | null =
    lastAnalyzeMode === "fallacies" ? (analyzeResult?.method ?? fallacyMethod) : null;

  const displayTitle = analyzeResult?.title ?? transcriptResult?.title ?? null;
  const displayVideoId = analyzeResult?.video_id ?? transcriptResult?.video_id ?? "";
  const displayLanguage = analyzeResult?.language ?? transcriptResult?.language ?? null;
  const displayCached = analyzeResult?.cached ?? transcriptResult?.cached ?? false;

  const displayFallbackUsed =
    analyzeResult != null
      ? (analyzeResult.fallback_used ?? false)
      : transcriptResult != null
        ? (transcriptResult.fallback_used ?? false)
        : null;

  const transcriptLengthChars = useMemo(() => {
    if (transcriptResult) {
      return { value: transcriptResult.transcript_text.length, source: "transcript" as const };
    }
    if (detectedKind === "text" && unifiedInput.trim()) {
      return { value: unifiedInput.trim().length, source: "paste" as const };
    }
    const chunks = analyzeResult?.chunks;
    if (chunks && chunks.length > 0) {
      return { value: sumChunkTextLengths(chunks), source: "chunks" as const };
    }
    return null;
  }, [transcriptResult, analyzeResult?.chunks, detectedKind, unifiedInput]);

  const chunksUseMediaTiming = Boolean(analyzeResult?.video_id?.trim());

  function parseAnalyzePayload(data: Record<string, unknown>): AnalyzePayload {
    const rawSummary = data.summary;
    const summary =
      rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
        ? (rawSummary as Record<string, number>)
        : {};
    const ls = data.llm_summarize;
    const llm_summarize =
      ls && typeof ls === "object" && !Array.isArray(ls)
        ? (ls as AnalyzePayload["llm_summarize"])
        : null;
    const sb = data.speaker_blocks;
    const speaker_blocks = Array.isArray(sb) ? (sb as NonNullable<AnalyzePayload["speaker_blocks"]>) : null;
    const st = data.speaker_turns;
    const speaker_turns = Array.isArray(st) ? (st as NonNullable<AnalyzePayload["speaker_turns"]>) : null;
    const da = data.discussion_analysis;
    const discussion_analysis =
      da && typeof da === "object" && !Array.isArray(da)
        ? (da as NonNullable<AnalyzePayload["discussion_analysis"]>)
        : null;

    const rawMethod = data.method;
    const method =
      rawMethod === "heuristic" || rawMethod === "classifier" || rawMethod === "llm"
        ? rawMethod
        : null;

    const transcript_text =
      typeof data.transcript_text === "string" ? data.transcript_text : "";
    const segments = Array.isArray(data.segments) ? (data.segments as Segment[]) : [];

    return {
      video_id: String(data.video_id ?? ""),
      title: (data.title as string | null | undefined) ?? null,
      language: (data.language as string | null | undefined) ?? null,
      cached: Boolean(data.cached),
      chunks: Array.isArray(data.chunks) ? (data.chunks as AnalyzeChunk[]) : [],
      summary,
      fallback_used: data.fallback_used === true,
      analysis_supported:
        typeof data.analysis_supported === "boolean" ? data.analysis_supported : true,
      analysis_note: typeof data.analysis_note === "string" ? data.analysis_note : null,
      llm_summarize,
      speaker_blocks,
      speaker_turns,
      discussion_analysis,
      method,
      transcript_text,
      segments,
    };
  }

  async function runFetchTranscript() {
    setError(null);
    const trimmed = detectYouTubeUrl(unifiedInput);
    if (!trimmed) {
      setError("Enter a YouTube link on its own line to fetch captions.");
      return;
    }

    setLoading("transcript");
    try {
      const res = await fetch("/api/youtube/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        setError(formatApiError(res.status, data));
        return;
      }

      const payload = data as unknown as TranscriptPayload;
      setTranscriptResult({
        video_id: String(payload.video_id ?? ""),
        title: payload.title ?? null,
        language: payload.language ?? null,
        transcript_text: String(payload.transcript_text ?? ""),
        segments: Array.isArray(payload.segments) ? payload.segments : [],
        cached: Boolean(payload.cached),
        fallback_used: payload.fallback_used === true,
        chunks: Array.isArray(payload.chunks) ? (payload.chunks as Record<string, unknown>[]) : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(null);
    }
  }

  async function runAnalyzeTranscript() {
    setError(null);
    const trimmed = detectYouTubeUrl(unifiedInput);
    if (!trimmed) {
      setError("Enter a valid YouTube link on its own line, or paste transcript text.");
      return;
    }

    setLoading("analyze");
    try {
      const res = await fetch("/api/youtube/transcript/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          url: trimmed,
          mode: analyzeMode,
          method: fallacyMethod,
          ...(analyzeMode === "summarize_llm"
            ? { summary_format: summaryFormat, summary_length: summaryLength }
            : {}),
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        setError(formatApiError(res.status, data));
        return;
      }

      const parsed = parseAnalyzePayload(data);
      setLastAnalyzeMode(analyzeMode);
      setAnalyzeResult(parsed);
      setTranscriptResult((prev) => {
        if (prev != null) return prev;
        return transcriptPayloadFromAnalyzePayload(parsed);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(null);
    }
  }

  async function runAnalyzePastedText() {
    setError(null);
    const t = unifiedInput.trim();
    if (t.length < 50) {
      setError("Paste at least ~50 characters of transcript text.");
      return;
    }

    setLoading("analyze");
    try {
      const res = await fetch("/api/transcript/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          text: unifiedInput,
          mode: analyzeMode,
          language: pasteLanguage,
          method: fallacyMethod,
          ...(analyzeMode === "summarize_llm"
            ? { summary_format: summaryFormat, summary_length: summaryLength }
            : {}),
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : formatApiError(res.status, data);
        setError(msg);
        return;
      }

      const parsed = parseAnalyzePayload(data);
      setLastAnalyzeMode(analyzeMode);
      setAnalyzeResult(parsed);
      setTranscriptResult((prev) => {
        if (prev != null) return prev;
        return transcriptPayloadFromAnalyzePayload(parsed);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(null);
    }
  }

  const preview = transcriptResult?.segments?.slice(0, 10) ?? [];

  async function copyChunkText(text: string, key: string) {
    const t = text ?? "";
    try {
      await navigator.clipboard.writeText(t);
      setCopiedChunkKey(key);
      window.setTimeout(() => setCopiedChunkKey((k) => (k === key ? null : k)), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  const analysisDownloadSlug = chunksUseMediaTiming
    ? analyzeResult?.video_id || "export"
    : "pasted";

  /** Transcript fetch result, or analyze-derived transcript when fetch was not run first. */
  const transcriptExportPayload = useMemo((): TranscriptPayload | null => {
    if (transcriptResult) return transcriptResult;
    if (analyzeResult) return transcriptPayloadFromAnalyzePayload(analyzeResult);
    return null;
  }, [transcriptResult, analyzeResult]);

  /** Explore: only show Results + Reference after analysis state exists (API returned payload) */
  const hasAnalysisResult = analyzeResult != null;
  const showExploreAnalysisLayout = !exploreFallaciesOnly || hasAnalysisResult;

  /** Explore: last run must match the selected analysis type to show primary results. */
  const exploreResultsMatchSelection = useMemo(() => {
    if (!exploreFallaciesOnly) return true;
    if (exploreAnalysisType === "fallacies") return lastAnalyzeMode === "fallacies";
    return lastAnalyzeMode === "summarize_llm";
  }, [exploreFallaciesOnly, exploreAnalysisType, lastAnalyzeMode]);

  return (
    <div
      className={cn(
        "min-w-0",
        exploreFallaciesOnly && "overflow-x-hidden",
        !exploreFallaciesOnly && "flex flex-col gap-12"
      )}
    >
      <div
        className={cn(
          "grid items-start",
          exploreFallaciesOnly
            ? showExploreAnalysisLayout
              ? "w-full grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(232px,280px)] lg:gap-x-12 lg:gap-y-10"
              : "w-full grid-cols-1 gap-4"
            : "gap-12 xl:grid-cols-12 xl:gap-12 2xl:gap-14"
        )}
      >
        {/* Explore: compact source band (full width), then 2-col results below */}
        {exploreFallaciesOnly && (
          <section className="col-span-full min-w-0 lg:col-span-2">
            <div className="rounded-xl border border-border/25 bg-muted/[0.04] px-4 py-5 sm:px-6 sm:py-5 dark:border-border/20 dark:bg-muted/[0.04]">
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
                  Analysis type
                </p>
                <ExploreAnalysisTypeSegmented
                  value={exploreAnalysisType}
                  onChange={(v) => {
                    setExploreAnalysisType(v);
                    setError(null);
                  }}
                  disabled={loading !== null}
                />
              </div>

              {exploreAnalysisType === "fallacies" ? (
                <div className="mt-5 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
                    Fallacy method
                  </p>
                  <FallacyMethodSegmented
                    value={fallacyMethod}
                    onChange={setFallacyMethod}
                    disabled={loading !== null}
                  />
                  <TranscriptFallacyMethodNote method={fallacyMethod} className="mt-2" />
                  {fallacyMethod === "llm" ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/65">
                      Uses Groq · experimental, not for production decisions.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
                      Format
                    </p>
                    <SummaryFormatSegmented
                      value={summaryFormat}
                      onChange={setSummaryFormat}
                      disabled={loading !== null}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
                      Length
                    </p>
                    <SummaryLengthSegmented
                      value={summaryLength}
                      onChange={setSummaryLength}
                      disabled={loading !== null}
                    />
                  </div>
                  <details className="group rounded-lg border border-border/25 bg-background/30 px-2.5 py-2 dark:border-border/20">
                    <summary className="cursor-pointer list-none text-[11px] font-medium text-muted-foreground marker:content-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                      About summarization
                    </summary>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/65">
                      Uses Groq · experimental, not for production decisions. Output shape depends on format and length
                      above.
                    </p>
                  </details>
                </div>
              )}

              <div className="mt-6 space-y-3 border-t border-border/15 pt-5">
                <label className="block min-w-0 space-y-1.5" htmlFor="unified-input-explore">
                  <span className="text-[10px] font-medium text-muted-foreground">Transcript source</span>
                  <textarea
                    id="unified-input-explore"
                    value={unifiedInput}
                    onChange={(e) => {
                      setUnifiedInput(e.target.value);
                      setError(null);
                    }}
                    rows={5}
                    placeholder="Paste a YouTube URL on one line, or paste transcript text…"
                    disabled={loading !== null}
                    className={cn(
                      "min-h-[6rem] max-h-48 w-full min-w-0 resize-y px-3 py-2.5 text-[15px] leading-relaxed sm:text-sm",
                      textareaSurfaceClass
                    )}
                  />
                </label>
                {unifiedInput.trim() ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground/85">
                    Detected:{" "}
                    {detectedKind === "youtube" ? "YouTube video" : "Text"}
                  </p>
                ) : (
                  <p className="text-[10px] leading-relaxed text-muted-foreground/45">
                    Paste a link or transcript — we detect which it is.
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t border-border/15 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    {detectedKind === "text" ? (
                      <label className="block max-w-[9rem] space-y-1" htmlFor="paste-lang-explore">
                        <span className="text-[10px] font-medium text-muted-foreground">Language</span>
                        <PasteLanguageSelect
                          id="paste-lang-explore"
                          value={pasteLanguage}
                          onChange={setPasteLanguage}
                          disabled={loading !== null}
                          className="py-1.5 text-xs"
                        />
                      </label>
                    ) : detectedKind === "youtube" ? (
                      <p className="max-w-[14rem] pb-0.5 text-[10px] leading-relaxed text-muted-foreground/70">
                        Language is taken from the video captions after analysis.
                      </p>
                    ) : (
                      <p className="max-w-[14rem] pb-0.5 text-[10px] leading-relaxed text-muted-foreground/45">
                        Language applies to pasted text only.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void (detectedYoutubeUrl ? runAnalyzeTranscript() : runAnalyzePastedText());
                    }}
                    disabled={loading !== null}
                    className="w-full shrink-0 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 sm:w-auto sm:min-w-[9rem] sm:py-2"
                  >
                    {loading === "analyze" ? "Analyzing…" : "Analyze"}
                  </button>
                </div>
              </div>

              {loading && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {loading === "transcript" ? "Fetching…" : "Analyzing…"}
                </p>
              )}
              {error && (
                <div
                  role="alert"
                  className="mt-2 border-l-2 border-destructive/40 py-0.5 pl-2.5 text-xs leading-relaxed text-foreground"
                >
                  {error}
                </div>
              )}
            </div>
          </section>
        )}

        {exploreFallaciesOnly && !hasAnalysisResult && loading !== "analyze" && (
          <p className="col-span-full px-1 py-2 text-center text-[13px] leading-relaxed text-muted-foreground">
            Choose fallacies or summary, adjust options, then paste a YouTube link or transcript and run analysis.
          </p>
        )}

        {/* Internal: left input rail */}
        {!exploreFallaciesOnly && (
        <aside className="min-w-0 space-y-5 xl:col-span-2 xl:max-w-[240px]">
          <div className="space-y-5 rounded-xl border border-border/35 bg-muted/[0.05] p-4 sm:p-5 dark:border-border/30 dark:bg-muted/[0.05]">
            <SectionHeading>Transcript source</SectionHeading>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="unified-input-internal" className="text-[10px] font-medium text-muted-foreground">
                YouTube link or transcript
              </label>
              <textarea
                id="unified-input-internal"
                value={unifiedInput}
                onChange={(e) => {
                  setUnifiedInput(e.target.value);
                  setError(null);
                }}
                rows={5}
                placeholder="YouTube URL on one line, or paste transcript text…"
                disabled={loading !== null}
                className={cn(
                  "w-full min-h-[100px] max-h-[220px] resize-y px-2.5 py-2 text-[13px] leading-snug",
                  textareaSurfaceClass
                )}
              />
            </div>
            {unifiedInput.trim() ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground/85">
                Detected: {detectedKind === "youtube" ? "YouTube video" : "Text"}
              </p>
            ) : (
              <p className="text-[10px] leading-relaxed text-muted-foreground/45">
                Paste a link or transcript — we detect which it is.
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border/15 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                {detectedKind === "text" ? (
                  <label htmlFor="paste-lang" className="block max-w-[9rem] space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Language</span>
                    <PasteLanguageSelect
                      id="paste-lang"
                      value={pasteLanguage}
                      onChange={setPasteLanguage}
                      disabled={loading !== null}
                    />
                  </label>
                ) : detectedKind === "youtube" ? (
                  <p className="max-w-[11rem] pb-0.5 text-[10px] leading-relaxed text-muted-foreground/70">
                    Language from captions after analysis.
                  </p>
                ) : (
                  <p className="max-w-[11rem] pb-0.5 text-[10px] leading-relaxed text-muted-foreground/45">
                    Language applies to pasted text only.
                  </p>
                )}
              </div>
              <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:min-w-[7.5rem]">
                {detectedKind === "youtube" ? (
                  <button
                    type="button"
                    onClick={runFetchTranscript}
                    disabled={loading !== null}
                    className="w-full rounded-lg border border-border/50 bg-foreground px-3 py-1.5 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-40"
                  >
                    {loading === "transcript" ? "Fetching…" : "Fetch"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void (detectedYoutubeUrl ? runAnalyzeTranscript() : runAnalyzePastedText());
                  }}
                  disabled={loading !== null}
                  className={cn(
                    "w-full rounded-lg border px-3 py-1.5 text-[13px] font-medium disabled:opacity-40",
                    detectedKind === "text" || detectedKind === null
                      ? "border-border/50 bg-foreground text-background hover:opacity-90"
                      : "border-border/45 bg-transparent font-normal text-foreground hover:bg-muted/35"
                  )}
                >
                  {loading === "analyze"
                    ? "Analyzing…"
                    : detectedKind === "text" || detectedKind === null
                      ? "Run analysis"
                      : "Analyze"}
                </button>
              </div>
            </div>
          </div>

          {!exploreFallaciesOnly && (
            <div className="space-y-1">
              <label htmlFor="analyze-mode" className="text-[10px] text-muted-foreground">
                Mode
              </label>
              <select
                id="analyze-mode"
                value={analyzeMode}
                onChange={(e) => setAnalyzeMode(e.target.value as AnalyzeMode)}
                disabled={loading !== null}
                className={cn(
                  "w-full rounded-lg bg-background px-2 py-1.5 text-[13px]",
                  inputSurfaceClass
                )}
              >
                <option value="frames">frames</option>
                <option value="fallacies">fallacies</option>
                <option value="summarize_llm">summarize_llm (Groq)</option>
                <option value="speaker_guess_llm">speaker_guess_llm (Groq)</option>
                <option value="speakers">speakers (Groq)</option>
                <option value="discussion_analysis">discussion_analysis (Groq)</option>
              </select>
            </div>
          )}

          {!exploreFallaciesOnly && analyzeMode === "summarize_llm" && (
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="summary-format" className="text-[10px] text-muted-foreground">
                  Format
                </label>
                <select
                  id="summary-format"
                  value={summaryFormat}
                  onChange={(e) => setSummaryFormat(e.target.value as SummaryFormatOption)}
                  disabled={loading !== null}
                  className={cn(
                    "w-full min-w-[7rem] rounded-lg bg-background px-2 py-1.5 text-[12px]",
                    inputSurfaceClass
                  )}
                >
                  <option value="bullets">Bullets</option>
                  <option value="paragraphs">Paragraphs</option>
                </select>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="summary-length" className="text-[10px] text-muted-foreground">
                  Length
                </label>
                <select
                  id="summary-length"
                  value={summaryLength}
                  onChange={(e) => setSummaryLength(e.target.value as SummaryLengthOption)}
                  disabled={loading !== null}
                  className={cn(
                    "w-full min-w-[7rem] rounded-lg bg-background px-2 py-1.5 text-[12px]",
                    inputSurfaceClass
                  )}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>
          )}

          {!exploreFallaciesOnly && analyzeMode === "fallacies" && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
                Fallacy method
              </p>
              <FallacyMethodSegmented
                value={fallacyMethod}
                onChange={setFallacyMethod}
                disabled={loading !== null}
              />
              <TranscriptFallacyMethodNote method={fallacyMethod} />
              {fallacyMethod === "llm" ? (
                <p className="text-[10px] leading-relaxed text-muted-foreground/65">
                  Uses Groq · experimental, not for production decisions.
                </p>
              ) : null}
            </div>
          )}

          {loading && (
            <p className="text-[10px] text-muted-foreground">
              {loading === "transcript" ? "Fetching…" : "Analyzing…"}
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="border-l-2 border-destructive/45 py-0.5 pl-2.5 text-[11px] leading-relaxed text-foreground"
            >
              {error}
            </div>
          )}

          {transcriptResult && !exploreFallaciesOnly && (
            <div className="space-y-1.5 border-t border-border/25 pt-3">
              <h3 className="text-[10px] font-medium text-muted-foreground">Preview</h3>
              <div className="max-h-28 space-y-2 overflow-y-auto pr-0.5 text-[11px] leading-snug">
                {preview.length === 0 ? (
                  <p className="text-muted-foreground">No segments.</p>
                ) : (
                  preview.map((seg, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="font-mono text-[9px] tabular-nums text-muted-foreground/80">
                        {seg.start != null ? seg.start.toFixed(2) : "—"}s
                      </div>
                      <p className="whitespace-pre-wrap text-foreground/90">{seg.text ?? ""}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          </div>
        </aside>
        )}

        {/* Center: chunk analysis + Reference (explore: only after analysis) */}
        {showExploreAnalysisLayout && (
          <>
        {exploreFallaciesOnly && hasAnalysisResult ? (
          <div
            className="col-span-full -mt-2 mb-2 h-px w-full bg-border/25 sm:-mt-1 dark:bg-border/20"
            aria-hidden
          />
        ) : null}
        <main
          className={cn(
            "min-w-0 space-y-6 sm:space-y-8",
            exploreFallaciesOnly &&
              "rounded-xl border border-border/25 bg-muted/[0.03] px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6 dark:border-border/20 dark:bg-muted/[0.04]",
            !exploreFallaciesOnly &&
              "rounded-xl border border-border/35 bg-muted/[0.04] px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6 dark:border-border/30 dark:bg-muted/[0.04]",
            exploreFallaciesOnly ? "lg:min-h-0" : "xl:col-span-8 xl:min-h-[50vh]"
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-end justify-between gap-3 border-b pb-4 sm:gap-4 sm:pb-6",
              exploreFallaciesOnly ? "border-border/20" : "border-border/25"
            )}
          >
            <div className={cn("min-w-0", !exploreFallaciesOnly && "space-y-2")}>
              {exploreFallaciesOnly ? (
                <SectionHeading className="mb-3 sm:mb-4">
                  {exploreResultsMatchSelection && lastAnalyzeMode === "summarize_llm"
                    ? "Summary"
                    : "Results"}
                </SectionHeading>
              ) : (
                <SectionHeading className="mb-3 sm:mb-4">Analysis</SectionHeading>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {analyzeResult && (
                  <span
                    className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      chunksUseMediaTiming
                        ? "border-border/50 bg-muted/30 text-muted-foreground"
                        : "border-border/40 bg-muted/25 text-muted-foreground"
                    }`}
                    title="Result source"
                  >
                    {chunksUseMediaTiming ? "Media transcript" : "Document"}
                  </span>
                )}
              </div>
              {!exploreFallaciesOnly && (
                <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                  {lastAnalyzeMode === "speakers"
                    ? "Groq groups the transcript into conversational turns (Speaker 1, Speaker 2, …). Text-only; not diarization."
                    : lastAnalyzeMode === "discussion_analysis"
                      ? "Speaker turns (inferred from text), then per-speaker bullets and fallacy labels. Not audio diarization."
                      : chunksUseMediaTiming
                      ? "Timed segments from the video track."
                      : analyzeResult
                        ? "Sections follow pasted paragraph structure."
                        : detectedKind === "text"
                          ? "Plain text is split into logical sections for analysis."
                          : "Run analysis to inspect labeled segments."}
                </p>
              )}
            </div>
            {analyzeResult && (exploreFallaciesOnly ? exploreResultsMatchSelection : true) && (
              <span className="shrink-0 max-w-[min(100%,20rem)] text-right text-[11px] leading-snug text-muted-foreground/75">
                {formatResultsStatusLine(lastAnalyzeMode, labeledChunksInView, statusFallacyMethod)}
              </span>
            )}
          </div>

          {analyzeResult?.analysis_note ? (
            <p className="-mt-1 mb-4 text-[11px] leading-relaxed text-muted-foreground/80">
              {analyzeResult.analysis_note}
            </p>
          ) : null}

          {!analyzeResult && !exploreFallaciesOnly && (
            <div
              className={cn(
                "text-center",
                "rounded-2xl border border-dashed border-border/35 bg-muted/[0.12] px-8 py-16"
              )}
            >
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Paste a YouTube link on one line, or paste transcript text — then run analysis.
              </p>
            </div>
          )}

          {analyzeResult && exploreFallaciesOnly && !exploreResultsMatchSelection ? (
            <div
              className={cn(
                "rounded-2xl border border-dashed px-6 py-12 text-center",
                exploreFallaciesOnly ? "border-border/25 bg-muted/[0.04]" : "border-border/35 bg-muted/[0.12]"
              )}
            >
              <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Your last run used a different analysis type. Run analysis again to see results that match your current
                selection.
              </p>
            </div>
          ) : analyzeResult ? (
            <>
              {lastAnalyzeMode !== "speakers" &&
              lastAnalyzeMode !== "discussion_analysis" &&
              !(exploreFallaciesOnly && lastAnalyzeMode === "summarize_llm") ? (
              <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-5">
                <div className="min-w-0 space-y-1.5">
                  <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                    Filter
                  </label>
                  <select
                    value={chunkFilterMode}
                    onChange={(e) => {
                      const v = e.target.value as ChunkFilterMode;
                      setChunkFilterMode(v);
                      if (v === "by_label" && uniqueLabelsFromChunks.length && !filterByLabel) {
                        setFilterByLabel(uniqueLabelsFromChunks[0]);
                      }
                    }}
                    className="w-full min-w-0 max-w-[min(100%,20rem)] rounded-md border border-border/40 bg-background px-2 py-1.5 text-[11px] text-muted-foreground shadow-none outline-none transition-colors hover:border-border/50 hover:bg-muted/10 focus:border-border/55 focus:ring-2 focus:ring-ring/20 focus:ring-offset-0 focus-visible:outline-none"
                  >
                    <option value="all">All chunks</option>
                    <option value="labeled">Labeled only</option>
                    <option value="by_label">By label…</option>
                  </select>
                </div>
                {chunkFilterMode === "by_label" && (
                  <div className="min-w-0 flex-1 space-y-1.5 sm:flex-initial">
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                      Label
                    </label>
                    <select
                      value={filterByLabel}
                      onChange={(e) => setFilterByLabel(e.target.value)}
                      className="w-full min-w-0 max-w-full rounded-md border border-border/40 bg-background px-2 py-1.5 text-[11px] text-muted-foreground shadow-none outline-none transition-colors hover:border-border/50 hover:bg-muted/10 focus:border-border/55 focus:ring-2 focus:ring-ring/20 focus:ring-offset-0 focus-visible:outline-none sm:min-w-[160px] sm:max-w-[min(100%,24rem)]"
                    >
                      {uniqueLabelsFromChunks.length === 0 ? (
                        <option value="">No labels</option>
                      ) : (
                        uniqueLabelsFromChunks.map((lab) => (
                          <option key={lab} value={lab}>
                            {lab}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>
              ) : null}

              <div
                className={cn(
                  "min-w-0",
                  exploreFallaciesOnly
                    ? "space-y-7 lg:max-h-[min(70vh,calc(100vh-14rem))] lg:space-y-8 lg:overflow-y-auto lg:pr-1"
                    : "max-h-[calc(100vh-12rem)] space-y-10 overflow-y-auto pr-1"
                )}
              >
                {lastAnalyzeMode === "discussion_analysis" ? (
                  (analyzeResult.discussion_analysis?.speakers?.length ?? 0) > 0 ? (
                    <div className="space-y-6">
                      {analyzeResult.discussion_analysis!.speakers!.map((sp, i) => {
                        const turnKey = `discussion-${i}-${(sp.text ?? "").slice(0, 24)}`;
                        const bullets = sp.summary_bullets ?? [];
                        const fallacies = sp.fallacies ?? [];
                        return (
                          <article
                            key={turnKey}
                            className="rounded-xl border border-border/35 bg-muted/[0.04] px-4 py-5 sm:px-6 dark:border-border/25 dark:bg-muted/[0.06]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/15 pb-3">
                              <h3 className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
                                {sp.speaker ?? "Speaker"}
                              </h3>
                              <button
                                type="button"
                                onClick={() => copyChunkText(sp.text ?? "", turnKey)}
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {copiedChunkKey === turnKey ? "Copied" : "Copy text"}
                              </button>
                            </div>
                            {bullets.length > 0 ? (
                              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-foreground/90">
                                {bullets.map((b, bi) => (
                                  <li key={bi}>{b}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-4 text-[11px] text-muted-foreground">
                                No summary bullets returned.
                              </p>
                            )}
                            <div className="mt-5">
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                                Fallacies (LLM)
                              </p>
                              {fallacies.length > 0 ? (
                                <div className="flex min-w-0 flex-wrap gap-1.5">
                                  {fallacies.map((lab) => (
                                    <FallacyLabelChip key={`${turnKey}-${lab}`} label={lab} />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/80">
                                  No fallacy labels detected for this block.
                                </p>
                              )}
                            </div>
                            <details className="group mt-5 rounded-lg border border-border/30 bg-background/40">
                              <summary className="cursor-pointer list-none px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors marker:content-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                                <span className="underline underline-offset-2">Original text</span>
                              </summary>
                              <div className="border-t border-border/15 px-3 py-3">
                                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90 break-words">
                                  {sp.text ?? ""}
                                </p>
                              </div>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-sm text-muted-foreground">No speaker sections returned.</p>
                  )
                ) : lastAnalyzeMode === "speakers" ? (
                  (analyzeResult.speaker_turns?.length ?? 0) > 0 ? (
                    <div className="space-y-1">
                      {analyzeResult.speaker_turns!.map((turn, i) => {
                        const turnKey = `speaker-turn-${i}-${(turn.text ?? "").slice(0, 24)}`;
                        return (
                          <article
                            key={turnKey}
                            className="flex gap-3 border-b border-border/15 py-4 last:border-b-0 sm:gap-4 sm:py-5"
                          >
                            <div className="w-[7.5rem] shrink-0 pt-0.5 sm:w-[8.5rem]">
                              <p className="font-mono text-[11px] font-medium leading-snug text-foreground/90">
                                {turn.speaker ?? "—"}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-foreground/95 break-words sm:text-[16px] sm:leading-[1.8]">
                                {turn.text ?? ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyChunkText(turn.text ?? "", turnKey)}
                              className="shrink-0 self-start rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {copiedChunkKey === turnKey ? "Copied" : "Copy"}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-sm text-muted-foreground">No speaker turns returned.</p>
                  )
                ) : exploreFallaciesOnly && lastAnalyzeMode === "summarize_llm" ? (
                  analyzeResult.llm_summarize ? (
                    <ExploreSummaryResultsMain llm={analyzeResult.llm_summarize} />
                  ) : (
                    <p className="py-8 text-sm text-muted-foreground">No summary returned.</p>
                  )
                ) : filteredChunks.length === 0 ? (
                  <p className="py-8 text-sm text-muted-foreground">No chunks match this filter.</p>
                ) : (
                  filteredChunks.map((ch, i) => {
                    const chunkKey = chunksUseMediaTiming
                      ? `${ch.start ?? ""}-${ch.end ?? ""}-${i}`
                      : `chunk-${i}-${(ch.text ?? "").slice(0, 24)}`;
                    const chunkLabelIndex = i + 1;
                    const chunkTitle = chunksUseMediaTiming
                      ? formatChunkTimeRange(ch.start, ch.end)
                      : `Chunk ${chunkLabelIndex}`;
                    const matchedCuesLine = formatMatchedCuesLine(ch.label_matches);
                    const showFallacyReasoning =
                      lastAnalyzeMode === "fallacies" &&
                      hasFallacyReasoningContent(ch.labels, ch.label_matches);
                    return (
                      <article
                        key={chunkKey}
                        className={cn(
                          "min-w-0 overflow-hidden rounded-xl border px-4 py-5 sm:px-8 sm:py-7",
                          exploreFallaciesOnly
                            ? "border-border/25 bg-muted/[0.04]"
                            : "rounded-2xl border-border/40 bg-muted/[0.08]"
                        )}
                      >
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/15 pb-4 sm:gap-4">
                          <div className="min-w-0 max-w-full">
                            <div className="flex flex-wrap items-baseline gap-2.5">
                              <h3
                                className={cn(
                                  "font-semibold tracking-tight text-foreground",
                                  chunksUseMediaTiming ? "font-mono text-lg tabular-nums sm:text-xl" : "text-lg sm:text-xl"
                                )}
                              >
                                {chunkTitle}
                              </h3>
                              {chunksUseMediaTiming && ch.segment_count != null ? (
                                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                                  {ch.segment_count} seg.
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyChunkText(ch.text ?? "", chunkKey)}
                            className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {copiedChunkKey === chunkKey ? "Copied" : "Copy"}
                          </button>
                        </header>

                        {lastAnalyzeMode === "fallacies" && (ch.labels?.length ?? 0) === 0 && (
                          <p className="pt-3 text-[11px] leading-snug text-muted-foreground/65">
                            No fallacy signals detected.
                          </p>
                        )}

                        {(ch.labels?.length ?? 0) > 0 && (
                          <div className="pt-4">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                              Labels
                            </p>
                            <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-2">
                              {ch.labels!.map((lab, j) => (
                                <span key={`${i}-${j}-${lab}`} className="inline-flex">
                                  {lastAnalyzeMode === "fallacies" && ch.label_strengths?.[lab] ? (
                                    <LabelStrengthGroup label={lab} strength={ch.label_strengths[lab]} />
                                  ) : (
                                    <FallacyLabelChip label={lab} />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-5 border-t border-border/10 pt-6">
                          <p className="text-[15px] leading-[1.75] text-foreground/95 break-words whitespace-pre-wrap sm:text-[16px] sm:leading-[1.8]">
                            {ch.text ?? ""}
                          </p>
                        </div>

                        {lastAnalyzeMode === "fallacies" &&
                        (ch.labels?.length ?? 0) > 0 &&
                        hasFallacyReasoningContent(ch.labels, ch.label_matches) ? (
                          <FallacyChunkReasoning
                            labels={ch.labels ?? []}
                            labelMatches={ch.label_matches}
                            labelStrengths={ch.label_strengths}
                          />
                        ) : null}

                        {matchedCuesLine.length > 0 && !(lastAnalyzeMode === "fallacies" && showFallacyReasoning) && (
                          <div
                            className={cn(
                              "mt-5 border-t pt-4",
                              exploreFallaciesOnly ? "border-border/10" : "border-border/15"
                            )}
                          >
                            <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground/65">
                              {lastAnalyzeMode === "fallacies" ? "Details" : "Matched cues"}
                            </p>
                            <p className="break-words text-[12px] leading-relaxed text-muted-foreground/85">
                              {matchedCuesLine}
                            </p>
                          </div>
                          )}
                      </article>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </main>

        {/* Right: sticky summary */}
        <aside
          className={cn(
            "min-w-0",
            exploreFallaciesOnly &&
              "lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pl-0.5",
            !exploreFallaciesOnly &&
              "space-y-5 xl:sticky xl:top-6 xl:col-span-2 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pl-1"
          )}
        >
          <div
            className={cn(
              "space-y-3 sm:space-y-4",
              exploreFallaciesOnly &&
                "rounded-lg border border-border/15 bg-muted/[0.02] p-3 sm:p-3.5 dark:border-border/15 dark:bg-muted/[0.03]"
            )}
          >
            <SectionHeading
              className={cn(
                "mb-0",
                exploreFallaciesOnly && "text-[10px] text-muted-foreground/75"
              )}
            >
              {exploreFallaciesOnly
                ? exploreAnalysisType === "summary"
                  ? "Details"
                  : "Reference"
                : "Summary"}
            </SectionHeading>

          <div className={cn("space-y-3 pt-1", exploreFallaciesOnly && "space-y-2.5")}>
            {exploreFallaciesOnly ? (
              <div className="space-y-2.5 text-[11px] leading-snug text-muted-foreground/90">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
                    Source
                  </p>
                  {chunksUseMediaTiming ? (
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground/75">Origin</dt>
                        <dd className="text-right text-foreground/85">YouTube</dd>
                      </div>
                      {meaningfulString(displayTitle) ? (
                        <div>
                          <dt className="text-[10px] text-muted-foreground/70">Title</dt>
                          <dd className="mt-0.5 break-words text-foreground/85">{displayTitle}</dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayVideoId) ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">Video ID</dt>
                          <dd className="break-all text-right font-mono text-[10px] text-foreground/80">
                            {displayVideoId}
                          </dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayLanguage) ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">Language</dt>
                          <dd className="text-right">{displayLanguage}</dd>
                        </div>
                      ) : null}
                      {displayFallbackUsed === true ? (
                        <p className="text-[10px] leading-snug text-muted-foreground/80">
                          Fell back to available track.
                        </p>
                      ) : null}
                      {transcriptResult != null || analyzeResult != null ? (
                        <>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground/75">Cached</dt>
                            <dd className="tabular-nums">{displayCached ? "yes" : "no"}</dd>
                          </div>
                          {displayFallbackUsed !== null ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground/75">Fallback</dt>
                              <dd className="tabular-nums">{displayFallbackUsed ? "yes" : "no"}</dd>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </dl>
                  ) : (
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground/75">Origin</dt>
                        <dd className="text-right text-foreground/85">Pasted</dd>
                      </div>
                      {meaningfulString(displayTitle) ? (
                        <div>
                          <dt className="text-[10px] text-muted-foreground/70">Title</dt>
                          <dd className="mt-0.5 break-words text-foreground/85">{displayTitle}</dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayLanguage) ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">Language</dt>
                          <dd className="text-right">{displayLanguage}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </div>
                <div className="border-t border-border/10 pt-2.5">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
                    This run
                  </p>
                  {analyzeResult ? (
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground/75">Mode</dt>
                        <dd className="font-mono text-[11px] text-foreground/85">
                          {lastAnalyzeMode === "summarize_llm" ? "Summary" : lastAnalyzeMode}
                        </dd>
                      </div>
                      {lastAnalyzeMode === "summarize_llm" && analyzeResult.llm_summarize ? (
                        <>
                          {analyzeResult.llm_summarize.summary_format ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground/75">Format</dt>
                              <dd className="text-[11px] text-foreground/85">
                                {analyzeResult.llm_summarize.summary_format}
                              </dd>
                            </div>
                          ) : null}
                          {analyzeResult.llm_summarize.summary_length ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground/75">Summary length</dt>
                              <dd className="text-[11px] capitalize text-foreground/85">
                                {analyzeResult.llm_summarize.summary_length}
                              </dd>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {lastAnalyzeMode === "fallacies" && statusFallacyMethod ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">Method</dt>
                          <dd className="font-mono text-[11px] text-foreground/85">{statusFallacyMethod}</dd>
                        </div>
                      ) : null}
                      {lastAnalyzeMode !== "summarize_llm" ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">
                            {lastAnalyzeMode === "discussion_analysis"
                              ? "Speakers"
                              : lastAnalyzeMode === "speakers"
                                ? "Turns"
                                : "Chunks"}
                          </dt>
                          <dd className="tabular-nums font-mono text-[11px] text-foreground/85">
                            {lastAnalyzeMode === "discussion_analysis"
                              ? (analyzeResult.discussion_analysis?.speakers?.length ?? 0)
                              : lastAnalyzeMode === "speakers"
                                ? (analyzeResult.speaker_turns?.length ?? 0)
                                : analyzeResult.chunks.length}
                          </dd>
                        </div>
                      ) : null}
                      {transcriptLengthChars ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground/75">Transcript</dt>
                          <dd className="font-mono text-[11px] tabular-nums text-foreground/85">
                            {transcriptLengthChars.value}
                            <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground/80">
                              chars
                            </span>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/80">Run analysis to see stats.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <SummarySectionCard title="Source" dense={false} tone="default">
                  {chunksUseMediaTiming ? (
                    <dl className="space-y-2.5">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-[10px] text-muted-foreground">Origin</dt>
                        <dd className="text-[12px]">YouTube</dd>
                      </div>
                      {meaningfulString(displayTitle) ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[10px] text-muted-foreground">Title</dt>
                          <dd className="break-words text-[12px] leading-snug">{displayTitle}</dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayVideoId) ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[10px] text-muted-foreground">video_id</dt>
                          <dd className="break-all font-mono text-[10px] text-foreground/80">{displayVideoId}</dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayLanguage) ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[10px] text-muted-foreground">Language</dt>
                          <dd className="text-[12px]">{displayLanguage}</dd>
                        </div>
                      ) : null}
                      {displayFallbackUsed === true ? (
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          Fell back to available track.
                        </p>
                      ) : null}
                      {transcriptResult != null || analyzeResult != null ? (
                        <>
                          <div className="flex justify-between gap-2 text-[12px]">
                            <span className="text-muted-foreground">Cached</span>
                            <span className="tabular-nums">{displayCached ? "yes" : "no"}</span>
                          </div>
                          {displayFallbackUsed !== null ? (
                            <div className="flex justify-between gap-2 text-[12px]">
                              <span className="text-muted-foreground">Fallback</span>
                              <span className="tabular-nums">{displayFallbackUsed ? "yes" : "no"}</span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </dl>
                  ) : (
                    <dl className="space-y-2.5">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-[10px] text-muted-foreground">Input type</dt>
                        <dd className="text-[12px]">Pasted transcript</dd>
                      </div>
                      {meaningfulString(displayTitle) ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[10px] text-muted-foreground">Title</dt>
                          <dd className="break-words text-[12px] leading-snug">{displayTitle}</dd>
                        </div>
                      ) : null}
                      {meaningfulString(displayLanguage) ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[10px] text-muted-foreground">Language</dt>
                          <dd className="text-[12px]">{displayLanguage}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </SummarySectionCard>

                <SummarySectionCard title="Analysis" dense={false} tone="default">
                  <dl className="space-y-2.5">
                    {analyzeResult ? (
                      <>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Mode</dt>
                          <dd className="font-mono text-[12px]">{lastAnalyzeMode}</dd>
                        </div>
                        {lastAnalyzeMode === "fallacies" && statusFallacyMethod ? (
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Method</dt>
                            <dd className="font-mono text-[12px]">{statusFallacyMethod}</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">
                            {lastAnalyzeMode === "discussion_analysis"
                              ? "Speakers"
                              : lastAnalyzeMode === "speakers"
                                ? "Turns"
                                : "Chunks"}
                          </dt>
                          <dd className="tabular-nums font-mono text-[12px]">
                            {lastAnalyzeMode === "discussion_analysis"
                              ? (analyzeResult.discussion_analysis?.speakers?.length ?? 0)
                              : lastAnalyzeMode === "speakers"
                                ? (analyzeResult.speaker_turns?.length ?? 0)
                                : analyzeResult.chunks.length}
                          </dd>
                        </div>
                        {transcriptLengthChars ? (
                          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                            <dt className="text-[10px] text-muted-foreground">Length</dt>
                            <dd className="font-mono text-[11px] tabular-nums">
                              {transcriptLengthChars.value}
                              <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
                                chars
                                {transcriptLengthChars.source === "chunks"
                                  ? " · chunks"
                                  : transcriptLengthChars.source === "paste"
                                    ? " · pasted"
                                    : ""}
                              </span>
                            </dd>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Run analysis to see mode and chunk stats.</p>
                    )}
                  </dl>
                </SummarySectionCard>
              </>
            )}

            {analyzeResult?.llm_summarize && (
              <SummarySectionCard
                title={
                  exploreFallaciesOnly && lastAnalyzeMode === "summarize_llm" ? "Summary run" : "LLM summary"
                }
                dense={exploreFallaciesOnly}
                tone={exploreFallaciesOnly ? "sidebar" : "default"}
              >
                {exploreFallaciesOnly && lastAnalyzeMode === "summarize_llm" ? (
                  <>
                    {analyzeResult.llm_summarize.input_truncated &&
                    typeof analyzeResult.llm_summarize.truncation_note === "string" &&
                    analyzeResult.llm_summarize.truncation_note.trim() ? (
                      <p className="mb-2 text-[10px] leading-snug text-muted-foreground/75">
                        {analyzeResult.llm_summarize.truncation_note}
                      </p>
                    ) : null}
                    {(analyzeResult.llm_summarize.summary_format ||
                      analyzeResult.llm_summarize.summary_length) && (
                      <p className="text-[10px] leading-snug text-muted-foreground/70">
                        {[
                          analyzeResult.llm_summarize.summary_format
                            ? `Format: ${analyzeResult.llm_summarize.summary_format}`
                            : null,
                          analyzeResult.llm_summarize.summary_length
                            ? `Length: ${analyzeResult.llm_summarize.summary_length}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] leading-snug text-muted-foreground/65">
                      {exploreResultsMatchSelection
                        ? "Full summary is shown in the main panel."
                        : "Select Summary and run again to view the full summary in the main panel."}
                    </p>
                  </>
                ) : (
                  <>
                    {analyzeResult.llm_summarize.input_truncated &&
                    typeof analyzeResult.llm_summarize.truncation_note === "string" &&
                    analyzeResult.llm_summarize.truncation_note.trim() ? (
                      <p className="mb-3 text-[10px] leading-snug text-muted-foreground/75">
                        {analyzeResult.llm_summarize.truncation_note}
                      </p>
                    ) : null}
                    {(analyzeResult.llm_summarize.summary_format ||
                      analyzeResult.llm_summarize.summary_length) && (
                      <p className="mb-2 text-[10px] leading-snug text-muted-foreground/70">
                        {[
                          analyzeResult.llm_summarize.summary_format
                            ? `Format: ${analyzeResult.llm_summarize.summary_format}`
                            : null,
                          analyzeResult.llm_summarize.summary_length
                            ? `Length: ${analyzeResult.llm_summarize.summary_length}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {analyzeResult.llm_summarize.summary_short ? (
                      <p className="mb-3 text-[12px] leading-relaxed text-foreground/90">
                        {analyzeResult.llm_summarize.summary_short}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No short summary returned.</p>
                    )}
                    {analyzeResult.llm_summarize.summary_paragraphs &&
                    analyzeResult.llm_summarize.summary_paragraphs.length > 0 ? (
                      <div className="mb-3 space-y-3">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                          Paragraphs
                        </p>
                        {analyzeResult.llm_summarize.summary_paragraphs.map((p, pi) => (
                          <p
                            key={pi}
                            className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap"
                          >
                            {p}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {analyzeResult.llm_summarize.main_topics &&
                    analyzeResult.llm_summarize.main_topics.length > 0 ? (
                      <div className="mb-3">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                          Main topics
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-muted-foreground/90">
                          {analyzeResult.llm_summarize.main_topics.map((t, ti) => (
                            <li key={ti}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {analyzeResult.llm_summarize.summary_bullets &&
                    analyzeResult.llm_summarize.summary_bullets.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                          Bullets
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-muted-foreground/90">
                          {analyzeResult.llm_summarize.summary_bullets.map((t, ti) => (
                            <li key={ti}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </SummarySectionCard>
            )}

            {analyzeResult?.speaker_blocks && analyzeResult.speaker_blocks.length > 0 && (
              <SummarySectionCard
                title="Speaker blocks (approx.)"
                dense={exploreFallaciesOnly}
                tone={exploreFallaciesOnly ? "sidebar" : "default"}
              >
                <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
                  Transcript-only inference; not diarization. Not ground truth.
                </p>
                <ul className="space-y-3">
                  {analyzeResult.speaker_blocks.map((b, bi) => (
                    <li
                      key={bi}
                      className="rounded-lg border border-border/30 bg-background/40 px-2.5 py-2 text-[11px] leading-snug"
                    >
                      <span className="font-mono text-[10px] text-foreground/90">{b.speaker ?? "—"}</span>
                      {b.confidence !== undefined && b.confidence !== null && b.confidence !== "" ? (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          ({String(b.confidence)})
                        </span>
                      ) : null}
                      <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground/90">{b.text ?? ""}</p>
                    </li>
                  ))}
                </ul>
              </SummarySectionCard>
            )}

            {analyzeResult && lastAnalyzeMode === "fallacies" && (
              <SummarySectionCard
                title="Fallacy counts"
                dense={exploreFallaciesOnly}
                tone={exploreFallaciesOnly ? "sidebar" : "default"}
              >
                {analyzeResult.analysis_supported === false ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {analyzeResult.analysis_note ??
                      "This fallacy method and language combination is not supported (see API analysis_note)."}
                  </p>
                ) : (
                  <>
                    {!exploreFallaciesOnly ? (
                      <p className="mb-3 text-[10px] text-muted-foreground">
                        {analyzeResult.method === "classifier"
                          ? "Classifier not implemented."
                          : "Chunk count per fallacy label (heuristic or LLM)."}
                      </p>
                    ) : null}
                    {fallacySummaryEntries.length > 0 ? (
                      <ul className="space-y-2">
                        {fallacySummaryEntries.map(({ label, count }) => (
                          <li
                            key={label}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/40 px-2.5 py-2"
                          >
                            <span className="min-w-0 flex-1 break-words text-[11px] leading-snug text-foreground/90">
                              {label}
                            </span>
                            <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        No fallacy labels matched these chunks.
                      </p>
                    )}
                  </>
                )}
              </SummarySectionCard>
            )}

            {analyzeResult && lastAnalyzeMode === "frames" && (
              <SummarySectionCard
                title="Frame labels"
                dense={exploreFallaciesOnly}
                tone={exploreFallaciesOnly ? "sidebar" : "default"}
              >
                {analyzeResult.analysis_supported === false ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {analyzeResult.analysis_note ??
                      "Frame keyword analysis is not available for this transcript language."}
                  </p>
                ) : labelSummary.length > 0 ? (
                  <ul className="space-y-2">
                    {labelSummary.map(({ label, count }) => (
                      <li
                        key={label}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/40 px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 break-words font-mono text-[10px] leading-snug text-foreground/85">
                          {label}
                        </span>
                        <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">No label hits in this run.</p>
                )}
              </SummarySectionCard>
            )}

            {(transcriptResult || analyzeResult) && (
              <div
                className={cn(
                  "rounded-xl border px-3 py-2.5 sm:px-3.5",
                  exploreFallaciesOnly
                    ? "border-border/15 bg-muted/[0.03] dark:bg-muted/[0.04]"
                    : "border-border/35 bg-transparent"
                )}
              >
                <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  Export
                </h3>
                <div className="flex flex-col gap-1.5">
                  {transcriptExportPayload ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const t = transcriptExportPayload;
                          const slug = transcriptExportFileSlug(t);
                          downloadBlob(
                            `youtube-transcript-timestamps-${slug}.txt`,
                            buildTranscriptTimestampedTxt(t),
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="text-left text-[12px] text-foreground underline-offset-4 hover:underline"
                      >
                        Transcript with timestamps (.txt)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const t = transcriptExportPayload;
                          const slug = transcriptExportFileSlug(t);
                          downloadBlob(
                            `youtube-transcript-plain-${slug}.txt`,
                            buildTranscriptPlainTxt(t),
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="text-left text-[12px] text-foreground underline-offset-4 hover:underline"
                      >
                        Plain transcript (.txt)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const t = transcriptExportPayload;
                          const slug = transcriptExportFileSlug(t);
                          downloadBlob(
                            `youtube-transcript-${slug}.json`,
                            JSON.stringify(buildTranscriptJsonExport(t), null, 2),
                            "application/json;charset=utf-8"
                          );
                        }}
                        className="text-left text-[12px] text-foreground underline-offset-4 hover:underline"
                      >
                        Transcript (.json)
                      </button>
                    </>
                  ) : null}
                  {analyzeResult ? (
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(
                          `analysis-${lastAnalyzeMode}-${analysisDownloadSlug}.json`,
                          JSON.stringify(buildAnalysisJsonExport(analyzeResult, lastAnalyzeMode), null, 2),
                          "application/json;charset=utf-8"
                        )
                      }
                      className="text-left text-[12px] text-foreground underline-offset-4 hover:underline"
                    >
                      Analysis (.json)
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          </div>
        </aside>
          </>
        )}
      </div>
    </div>
  );
}
