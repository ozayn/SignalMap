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
  label_matches?: Record<string, string[]>;
  label_strengths?: Record<string, string>;
  /** fallacies + method llm */
  reasoning?: string;
  evidence_spans?: string[];
  confidence?: string | number;
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
    main_topics?: string[];
  } | null;
  speaker_blocks?: Array<{ speaker?: string; text?: string; confidence?: string | number }> | null;
  /** Present when mode was fallacies: which detection method ran */
  method?: "heuristic" | "classifier" | "llm" | null;
};

type InputSource = "youtube" | "paste";

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

/** Flatten chunk `label_matches` into one comma-separated line; strip `phrase:` / `cue:` / `combo:` prefixes. */
function formatMatchedCuesLine(labelMatches: Record<string, string[]> | undefined): string {
  if (!labelMatches) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const kws of Object.values(labelMatches)) {
    if (!Array.isArray(kws)) continue;
    for (const raw of kws) {
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

function buildTranscriptTxt(t: TranscriptPayload): string {
  const lines: string[] = [
    `Title: ${t.title ?? ""}`,
    `Video ID: ${t.video_id}`,
    `Language: ${t.language ?? ""}`,
    `Fallback used: ${t.fallback_used ? "yes" : "no"}`,
    "",
  ];
  const segs = t.segments ?? [];
  if (segs.length > 0) {
    lines.push("--- Segments (timestamped) ---", "");
    for (const seg of segs) {
      const ts = seg.start != null && !Number.isNaN(seg.start) ? `${seg.start.toFixed(2)}s` : "—";
      const line = (seg.text ?? "").replace(/\r?\n/g, " ");
      lines.push(`[${ts}]  ${line}`);
    }
    lines.push("");
  }
  lines.push("--- Transcript ---", "", t.transcript_text ?? "");
  return lines.join("\n");
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
      for (const kw of kws) set.add(kw);
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

/** Fallacy label + strength as one bordered unit; strength is small and muted on the right */
function LabelStrengthGroup({ label, strength }: { label: string; strength: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-md border border-border/45 bg-muted/35">
      <span className="inline-flex min-w-0 items-center break-words px-2 py-1 text-[12px] font-medium leading-snug text-foreground/95">
        {label}
      </span>
      <span className="inline-flex shrink-0 items-center border-l border-border/25 bg-muted/25 px-1 py-0.5 text-[9px] font-medium tabular-nums leading-none text-muted-foreground/55">
        {strength}
      </span>
    </span>
  );
}

/** Light panel for summary sections — no heavy shadow */
function SummarySectionCard({
  title,
  children,
  dense,
}: {
  title: string;
  children: ReactNode;
  /** Lighter chrome for public explore layout */
  dense?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3",
        dense ? "border-border/25 bg-muted/10" : "border-border/40 bg-muted/20"
      )}
    >
      <h3
        className={cn(
          "mb-2 font-semibold uppercase tracking-[0.14em] text-muted-foreground",
          dense ? "text-[9px]" : "mb-3 text-[10px]"
        )}
      >
        {title}
      </h3>
      <div className={cn("leading-snug", dense ? "text-[12px]" : "text-[13px]")}>{children}</div>
    </section>
  );
}

type AnalyzeMode = "frames" | "fallacies" | "summarize_llm" | "speaker_guess_llm";
type FallacyMethod = "heuristic" | "classifier" | "llm";
type ChunkFilterMode = "all" | "labeled" | "by_label";

function formatResultsStatusLine(
  mode: AnalyzeMode,
  labeledChunksInView: number,
  fallacyMethod: FallacyMethod | null | undefined
): string {
  if (mode === "summarize_llm") return "LLM summary (experimental)";
  if (mode === "speaker_guess_llm") return "Speaker guess — transcript only (experimental)";
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
   * Public explore route: fallacies analysis only, hide mode selector,
   * and YouTube uses analyze-only (no separate transcript fetch / preview).
   */
  exploreFallaciesOnly?: boolean;
};

export function YouTubeTranscriptTester({
  exploreFallaciesOnly = false,
}: YouTubeTranscriptTesterProps = {}) {
  const [inputSource, setInputSource] = useState<InputSource>("youtube");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pasteLanguage, setPasteLanguage] = useState("en");
  const [analyzeMode, setAnalyzeMode] = useState<AnalyzeMode>(
    exploreFallaciesOnly ? "fallacies" : "frames"
  );
  const [lastAnalyzeMode, setLastAnalyzeMode] = useState<AnalyzeMode>(
    exploreFallaciesOnly ? "fallacies" : "frames"
  );
  const [fallacyMethod, setFallacyMethod] = useState<FallacyMethod>("heuristic");
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
    if (inputSource === "paste" && pastedText.trim()) {
      return { value: pastedText.trim().length, source: "paste" as const };
    }
    const chunks = analyzeResult?.chunks;
    if (chunks && chunks.length > 0) {
      return { value: sumChunkTextLengths(chunks), source: "chunks" as const };
    }
    return null;
  }, [transcriptResult, analyzeResult?.chunks, inputSource, pastedText]);

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

    const rawMethod = data.method;
    const method =
      rawMethod === "heuristic" || rawMethod === "classifier" || rawMethod === "llm"
        ? rawMethod
        : null;

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
      method,
    };
  }

  async function runFetchTranscript() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube URL.");
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
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube URL.");
      return;
    }

    setLoading("analyze");
    try {
      const res = await fetch("/api/youtube/transcript/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url: trimmed, mode: analyzeMode, method: fallacyMethod }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        setError(formatApiError(res.status, data));
        return;
      }

      setLastAnalyzeMode(analyzeMode);
      setAnalyzeResult(parseAnalyzePayload(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(null);
    }
  }

  async function runAnalyzePastedText() {
    setError(null);
    const t = pastedText.trim();
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
          text: pastedText,
          mode: analyzeMode,
          language: pasteLanguage.trim() || "en",
          method: fallacyMethod,
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

      setLastAnalyzeMode(analyzeMode);
      setAnalyzeResult(parseAnalyzePayload(data));
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

  /** Explore: only show Results + Reference after analysis state exists (API returned payload) */
  const hasAnalysisResult = analyzeResult != null;
  const showExploreAnalysisLayout = !exploreFallaciesOnly || hasAnalysisResult;

  return (
    <div
      className={cn(
        "min-w-0",
        exploreFallaciesOnly && "overflow-x-hidden",
        !exploreFallaciesOnly && "flex flex-col gap-10"
      )}
    >
      <div
        className={cn(
          "grid items-start",
          exploreFallaciesOnly
            ? showExploreAnalysisLayout
              ? "w-full grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(232px,280px)] lg:gap-x-10 lg:gap-y-8"
              : "w-full grid-cols-1 gap-3"
            : "gap-12 xl:grid-cols-12 xl:gap-10 2xl:gap-14"
        )}
      >
        {/* Explore: compact source band (full width), then 2-col results below */}
        {exploreFallaciesOnly && (
          <section className="col-span-full min-w-0 lg:col-span-2">
            <div className="rounded-xl border border-border/20 bg-muted/[0.04] px-4 py-4 sm:px-5 sm:py-4">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Source
              </p>
              <div className="inline-flex max-w-full flex-wrap rounded-full border border-border/30 bg-background/60 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setInputSource("youtube");
                    setError(null);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    inputSource === "youtube"
                      ? "bg-muted/80 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  YouTube
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputSource("paste");
                    setError(null);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    inputSource === "paste"
                      ? "bg-muted/80 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Paste
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <span className="text-[10px] text-muted-foreground">Fallacy method</span>
                <div className="flex flex-wrap gap-1 rounded-lg border border-border/40 bg-muted/10 p-0.5">
                  {(["heuristic", "classifier", "llm"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFallacyMethod(m)}
                      disabled={loading !== null}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                        fallacyMethod === m
                          ? "bg-muted/80 text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "heuristic" ? "Heuristic" : m === "classifier" ? "Classifier" : "LLM"}
                    </button>
                  ))}
                </div>
                <TranscriptFallacyMethodNote method={fallacyMethod} className="mt-2" />
              </div>

              <div className="mt-3 space-y-3">
                {inputSource === "youtube" ? (
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="min-w-0 w-full flex-1 space-y-1 sm:min-w-0">
                      <span className="text-[10px] text-muted-foreground">Video URL</span>
                      <input
                        id="yt-url-explore"
                        type="url"
                        name="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=…"
                        className="w-full min-w-0 rounded-lg border border-border/35 bg-background px-3 py-2.5 text-[15px] placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-ring/35 sm:py-2 sm:text-sm"
                        autoComplete="off"
                        disabled={loading !== null}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={runAnalyzeTranscript}
                      disabled={loading !== null}
                      className="w-full shrink-0 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 sm:w-auto sm:min-w-[9rem] sm:py-2"
                    >
                      {loading === "analyze" ? "Analyzing…" : "Analyze"}
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0 space-y-3">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[5.5rem_1fr] sm:items-end sm:gap-2">
                      <label className="min-w-0 space-y-1">
                        <span className="text-[10px] text-muted-foreground">Lang</span>
                        <input
                          type="text"
                          value={pasteLanguage}
                          onChange={(e) => setPasteLanguage(e.target.value)}
                          placeholder="en"
                          disabled={loading !== null}
                          className="w-full min-w-0 rounded-lg border border-border/35 bg-background px-2 py-1.5 text-xs font-mono"
                        />
                      </label>
                      <label className="min-w-0 space-y-1">
                        <span className="text-[10px] text-muted-foreground">Transcript</span>
                        <textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          rows={4}
                          placeholder="Paste text…"
                          disabled={loading !== null}
                          className="min-h-[5.5rem] max-h-40 w-full min-w-0 resize-y rounded-lg border border-border/35 bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/55"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={runAnalyzePastedText}
                      disabled={loading !== null}
                      className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 sm:w-auto sm:min-w-[10rem] sm:py-2"
                    >
                      {loading === "analyze" ? "Analyzing…" : "Analyze"}
                    </button>
                  </div>
                )}
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
          <p className="col-span-full px-1 text-center text-[13px] leading-relaxed text-muted-foreground">
            Add a YouTube URL or paste a transcript, then run analysis.
          </p>
        )}

        {/* Internal: left input rail */}
        {!exploreFallaciesOnly && (
        <aside className="min-w-0 space-y-4 xl:col-span-2 xl:max-w-[220px]">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
            Input
          </h2>

          <div className="inline-flex w-full rounded-lg border border-border/45 p-0.5">
            <button
              type="button"
              onClick={() => {
                setInputSource("youtube");
                setError(null);
              }}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                inputSource === "youtube"
                  ? "bg-muted/70 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              YouTube
            </button>
            <button
              type="button"
              onClick={() => {
                setInputSource("paste");
                setError(null);
              }}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                inputSource === "paste"
                  ? "bg-muted/70 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paste
            </button>
          </div>

          {inputSource === "youtube" ? (
            <div className="space-y-1">
              <label htmlFor="yt-url" className="text-[10px] text-muted-foreground">
                Video URL
              </label>
              <input
                id="yt-url"
                type="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-border/40 bg-muted/10 px-2.5 py-1.5 text-[13px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40"
                autoComplete="off"
                disabled={loading !== null}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label htmlFor="paste-lang" className="text-[10px] text-muted-foreground">
                  Language
                </label>
                <input
                  id="paste-lang"
                  type="text"
                  value={pasteLanguage}
                  onChange={(e) => setPasteLanguage(e.target.value)}
                  placeholder="en"
                  disabled={loading !== null}
                  className="w-full rounded-lg border border-border/40 bg-muted/10 px-2.5 py-1 text-[12px] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="paste-body" className="text-[10px] text-muted-foreground">
                  Text
                </label>
                <textarea
                  id="paste-body"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={4}
                  placeholder="Paste text…"
                  disabled={loading !== null}
                  className="w-full resize-y rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2 text-[13px] leading-snug min-h-[88px] max-h-[200px] placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          )}

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
                className="w-full rounded-lg border border-border/40 bg-muted/10 px-2 py-1.5 text-[13px]"
              >
                <option value="frames">frames</option>
                <option value="fallacies">fallacies</option>
                <option value="summarize_llm">summarize_llm (Groq)</option>
                <option value="speaker_guess_llm">speaker_guess_llm (Groq)</option>
              </select>
            </div>
          )}

          {!exploreFallaciesOnly && analyzeMode === "fallacies" && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground">Fallacy method</span>
              <div className="flex flex-wrap gap-1 rounded-lg border border-border/40 bg-muted/10 p-0.5">
                {(["heuristic", "classifier", "llm"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFallacyMethod(m)}
                    disabled={loading !== null}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                      fallacyMethod === m
                        ? "bg-muted/80 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "heuristic" ? "Heuristic" : m === "classifier" ? "Classifier" : "LLM"}
                  </button>
                ))}
              </div>
              <TranscriptFallacyMethodNote method={fallacyMethod} />
            </div>
          )}

          <div className="flex flex-col gap-1.5 pt-0.5">
            {inputSource === "youtube" ? (
              <>
                {!exploreFallaciesOnly && (
                  <button
                    type="button"
                    onClick={runFetchTranscript}
                    disabled={loading !== null}
                    className="w-full rounded-lg border border-border/50 bg-foreground px-3 py-1.5 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-40"
                  >
                    {loading === "transcript" ? "Fetching…" : "Fetch"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={runAnalyzeTranscript}
                  disabled={loading !== null}
                  className={`w-full rounded-lg border px-3 py-1.5 text-[13px] font-medium disabled:opacity-40 ${
                    exploreFallaciesOnly
                      ? "border-border/50 bg-foreground text-background hover:opacity-90"
                      : "border-border/45 bg-transparent text-foreground hover:bg-muted/35 font-normal"
                  }`}
                >
                  {loading === "analyze"
                    ? "Analyzing…"
                    : exploreFallaciesOnly
                      ? "Run fallacy analysis"
                      : "Analyze"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={runAnalyzePastedText}
                disabled={loading !== null}
                className="w-full rounded-lg border border-border/50 bg-foreground px-3 py-1.5 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-40"
              >
                {loading === "analyze"
                  ? "Analyzing…"
                  : exploreFallaciesOnly
                    ? "Run fallacy analysis"
                    : "Run analysis"}
              </button>
            )}
          </div>

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

          {inputSource === "youtube" && transcriptResult && !exploreFallaciesOnly && (
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
        </aside>
        )}

        {/* Center: chunk analysis + Reference (explore: only after analysis) */}
        {showExploreAnalysisLayout && (
          <>
        <main
          className={cn(
            "min-w-0 space-y-6 sm:space-y-8",
            exploreFallaciesOnly && "px-0.5 sm:px-0",
            exploreFallaciesOnly ? "lg:min-h-0" : "xl:col-span-8 xl:min-h-[50vh]"
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-end justify-between gap-3 border-b pb-4 sm:gap-4 sm:pb-6",
              exploreFallaciesOnly ? "border-border/15" : "border-border/25"
            )}
          >
            <div className={cn("min-w-0", !exploreFallaciesOnly && "space-y-2")}>
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  className={cn(
                    "font-semibold tracking-tight text-foreground",
                    exploreFallaciesOnly ? "text-xl sm:text-2xl" : "text-2xl"
                  )}
                >
                  {exploreFallaciesOnly ? "Results" : "Analysis"}
                </h2>
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
                  {chunksUseMediaTiming
                    ? "Timed segments from the video track."
                    : analyzeResult
                      ? "Sections follow pasted paragraph structure."
                      : inputSource === "paste"
                        ? "Paste runs as plain text; chunks are logical sections."
                        : "Run analysis to inspect labeled segments."}
                </p>
              )}
            </div>
            {analyzeResult && (
              <span className="shrink-0 max-w-[min(100%,20rem)] text-right text-[11px] leading-snug text-muted-foreground/75">
                {formatResultsStatusLine(lastAnalyzeMode, labeledChunksInView, statusFallacyMethod)}
              </span>
            )}
          </div>

          {!analyzeResult && !exploreFallaciesOnly && (
            <div
              className={cn(
                "text-center",
                "rounded-2xl border border-dashed border-border/35 bg-muted/[0.12] px-8 py-16"
              )}
            >
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground">
                {inputSource === "youtube" ? (
                  <>Analyze a YouTube link or switch to Paste to load plain text.</>
                ) : (
                  <>Paste transcript text to analyze — paragraph breaks suggest section boundaries.</>
                )}
              </p>
            </div>
          )}

          {analyzeResult && (
            <>
              <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-5">
                <div className="min-w-0 space-y-1">
                  <label className="text-[9px] font-normal uppercase tracking-wider text-muted-foreground/60">
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
                    className="w-full min-w-0 max-w-[min(100%,20rem)] rounded-md border border-border/25 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground shadow-none outline-none transition-colors hover:border-border/35 hover:bg-muted/15 focus:border-border/40 focus:ring-0 focus-visible:border-border/45 focus-visible:ring-1 focus-visible:ring-muted-foreground/15 focus-visible:ring-offset-0"
                  >
                    <option value="all">All chunks</option>
                    <option value="labeled">Labeled only</option>
                    <option value="by_label">By label…</option>
                  </select>
                </div>
                {chunkFilterMode === "by_label" && (
                  <div className="min-w-0 flex-1 space-y-1 sm:flex-initial">
                    <label className="text-[9px] font-normal uppercase tracking-wider text-muted-foreground/60">
                      Label
                    </label>
                    <select
                      value={filterByLabel}
                      onChange={(e) => setFilterByLabel(e.target.value)}
                      className="w-full min-w-0 max-w-full rounded-md border border-border/25 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground shadow-none outline-none transition-colors hover:border-border/35 hover:bg-muted/15 focus:ring-0 focus-visible:border-border/45 focus-visible:ring-1 focus-visible:ring-muted-foreground/15 focus-visible:ring-offset-0 sm:min-w-[160px] sm:max-w-[min(100%,24rem)]"
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

              <div
                className={cn(
                  "min-w-0",
                  exploreFallaciesOnly
                    ? "space-y-7 lg:max-h-[min(70vh,calc(100vh-14rem))] lg:space-y-8 lg:overflow-y-auto lg:pr-1"
                    : "max-h-[calc(100vh-12rem)] space-y-10 overflow-y-auto pr-1"
                )}
              >
                {filteredChunks.length === 0 ? (
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

                        {lastAnalyzeMode === "fallacies" && analyzeResult?.method === "llm" && (ch.labels?.length ?? 0) === 0 && (
                          <p className="pt-3 text-[11px] leading-snug text-muted-foreground/65">
                            No fallacy labels for this chunk (LLM).
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

                        {lastAnalyzeMode === "fallacies" && analyzeResult?.method === "llm" && (ch.reasoning || ch.evidence_spans?.length) ? (
                          <div className="mt-4 space-y-2 border-t border-border/10 pt-4">
                            {ch.reasoning ? (
                              <div>
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                                  Reasoning
                                </p>
                                <p className="text-[12px] leading-relaxed text-muted-foreground/90">{ch.reasoning}</p>
                              </div>
                            ) : null}
                            {ch.evidence_spans && ch.evidence_spans.length > 0 ? (
                              <div>
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
                                  Evidence spans
                                </p>
                                <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground/90">
                                  {ch.evidence_spans.map((ev, ei) => (
                                    <li key={ei}>{ev}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {ch.confidence !== undefined && ch.confidence !== null && ch.confidence !== "" ? (
                              <p className="text-[11px] text-muted-foreground/75">
                                <span className="font-medium text-muted-foreground/85">Confidence:</span>{" "}
                                {String(ch.confidence)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-5 border-t border-border/10 pt-6">
                          <p className="text-[15px] leading-[1.75] text-foreground/95 break-words whitespace-pre-wrap sm:text-[16px] sm:leading-[1.8]">
                            {ch.text ?? ""}
                          </p>
                        </div>

                        {matchedCuesLine.length > 0 &&
                          !(lastAnalyzeMode === "fallacies" && analyzeResult?.method === "llm") && (
                          <div
                            className={cn(
                              "mt-5 border-t pt-4",
                              exploreFallaciesOnly ? "border-border/10" : "border-border/15"
                            )}
                          >
                            <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground/65">
                              Matched cues
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
          )}
        </main>

        {/* Right: sticky summary */}
        <aside
          className={cn(
            "min-w-0 space-y-3 sm:space-y-4",
            exploreFallaciesOnly &&
              "lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pl-0.5",
            !exploreFallaciesOnly &&
              "space-y-5 xl:sticky xl:top-6 xl:col-span-2 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pl-1"
          )}
        >
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
            {exploreFallaciesOnly ? "Reference" : "Summary"}
          </h2>

          <div className={cn("space-y-3", exploreFallaciesOnly && "space-y-2.5")}>
            <SummarySectionCard title="Source" dense={exploreFallaciesOnly}>
              {inputSource === "youtube" ? (
                <dl className="space-y-2.5">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-[10px] text-muted-foreground">Input</dt>
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

            <SummarySectionCard title="Analysis" dense={exploreFallaciesOnly}>
              <dl className="space-y-2.5">
                {analyzeResult ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {inputSource === "paste" || exploreFallaciesOnly ? "Analysis mode" : "Mode"}
                      </dt>
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
                        {inputSource === "paste" || exploreFallaciesOnly ? "Chunk count" : "Chunks"}
                      </dt>
                      <dd className="tabular-nums font-mono text-[12px]">{analyzeResult.chunks.length}</dd>
                    </div>
                    {transcriptLengthChars ? (
                      <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                        <dt className="text-[10px] text-muted-foreground">
                          {inputSource === "paste" || exploreFallaciesOnly ? "Transcript length" : "Length"}
                        </dt>
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
                {analyzeResult?.analysis_note &&
                (lastAnalyzeMode.endsWith("_llm") ||
                  (lastAnalyzeMode === "fallacies" && analyzeResult?.method === "llm")) ? (
                  <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                    <dt className="text-[10px] text-muted-foreground">Note</dt>
                    <dd className="text-[10px] leading-relaxed text-muted-foreground">
                      {analyzeResult.analysis_note}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </SummarySectionCard>

            {analyzeResult?.llm_summarize && (
              <SummarySectionCard title="LLM summary" dense={exploreFallaciesOnly}>
                {analyzeResult.llm_summarize.summary_short ? (
                  <p className="mb-3 text-[12px] leading-relaxed text-foreground/90">
                    {analyzeResult.llm_summarize.summary_short}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No short summary returned.</p>
                )}
                {analyzeResult.llm_summarize.main_topics && analyzeResult.llm_summarize.main_topics.length > 0 ? (
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
              </SummarySectionCard>
            )}

            {analyzeResult?.speaker_blocks && analyzeResult.speaker_blocks.length > 0 && (
              <SummarySectionCard title="Speaker blocks (approx.)" dense={exploreFallaciesOnly}>
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
              <SummarySectionCard title="Fallacy counts" dense={exploreFallaciesOnly}>
                {analyzeResult.analysis_supported === false ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {analyzeResult.analysis_note ??
                      "Fallacies analysis is not available for this transcript language."}
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-[10px] text-muted-foreground">
                      {analyzeResult.method === "llm"
                        ? "Chunks per label (LLM prototype)."
                        : analyzeResult.method === "classifier"
                          ? "Classifier not implemented."
                          : "Chunks per label (heuristic)."}
                    </p>
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
              <SummarySectionCard title="Frame labels" dense={exploreFallaciesOnly}>
                {labelSummary.length > 0 ? (
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
                  "rounded-xl border px-3 py-2.5",
                  exploreFallaciesOnly ? "border-border/20 bg-transparent" : "border-border/35 bg-transparent"
                )}
              >
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Export
                </h3>
                <div className="flex flex-col gap-1.5">
                  {transcriptResult ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            `youtube-transcript-${transcriptResult.video_id}.txt`,
                            buildTranscriptTxt(transcriptResult),
                            "text/plain;charset=utf-8"
                          )
                        }
                        className="text-left text-[12px] text-foreground underline-offset-4 hover:underline"
                      >
                        Transcript (.txt)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            `youtube-transcript-${transcriptResult.video_id}.json`,
                            JSON.stringify(buildTranscriptJsonExport(transcriptResult), null, 2),
                            "application/json;charset=utf-8"
                          )
                        }
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
        </aside>
          </>
        )}
      </div>
    </div>
  );
}
