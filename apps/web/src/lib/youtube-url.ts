/**
 * YouTube URL detection and canonicalization for transcript tools.
 * Keeps a single canonical watch URL: https://www.youtube.com/watch?v=VIDEO_ID
 */

const VIDEO_ID_RE = /[a-zA-Z0-9_-]{11}/;

/** Preferred display / API form (no tracking query params). */
export function canonicalYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Single-line input only: if it looks like a YouTube URL or bare 11-char video id, return a URL string
 * for the API; otherwise null (treat input as plain transcript text). Multiline input is always null.
 */
export function detectYouTubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lines = t.split(/\r?\n/);
  if (lines.slice(1).some((line) => line.trim().length > 0)) return null;
  const line = lines[0].trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(line)) {
    return canonicalYoutubeWatchUrl(line);
  }
  const candidate = /^https?:\/\//i.test(line) ? line : `https://${line}`;
  const fromPattern =
    candidate.match(
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    ) || candidate.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})(?=\?|\/|#|$)/);
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
    if (v && VIDEO_ID_RE.test(v)) return candidate;
    const livePath = u.pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})(?:\/|$)/);
    if (livePath) return candidate;
    if (h === "youtu.be" && u.pathname.replace(/^\//, "").length >= 11) return candidate;
  } catch {
    return null;
  }
  return null;
}

/** 11-char video id from a YouTube URL (watch, youtu.be, live, shorts, embed). */
export function extractYoutubeVideoIdFromUrl(url: string): string | null {
  const m = url.match(
    /(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

/**
 * If `raw` is a single-line recognized YouTube video URL, return canonical watch URL (tracking params stripped).
 * Otherwise null — do not use for plain transcript text.
 */
export function normalizeYouTubeUrlInput(raw: string): string | null {
  const detected = detectYouTubeUrl(raw);
  if (!detected) return null;
  const vid = extractYoutubeVideoIdFromUrl(detected);
  if (!vid) return null;
  return canonicalYoutubeWatchUrl(vid);
}
