import "server-only";

const FALLBACK_SUPPORT_HREF = "https://github.com/ozayn/SignalMap";

const NEXT_PUBLIC_SUPPORT_KEY = "NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL" as const;

/**
 * Read `NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL` in a way that can still see **runtime**
 * `process.env` on the server (e.g. Railway injects vars at container start).
 *
 * Next.js replaces **static** `process.env.NEXT_PUBLIC_*` references at **build** time.
 * If that var was empty during `next build`, the inlined value stays empty even when
 * Railway sets it at runtime — unless we read via a dynamic key so the bundler leaves
 * a real `process.env` lookup on Node.
 */
function readNextPublicSupportUrlRuntime(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const dynamic = process.env[NEXT_PUBLIC_SUPPORT_KEY]?.trim();
  if (dynamic) return dynamic;
  return process.env.NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL?.trim();
}

/**
 * Resolve the public support/donation URL on the server at **request time**.
 *
 * Precedence:
 * 1. `SIGNALMAP_SUPPORT_URL` — server-only; always read at runtime (best for Railway runtime env).
 * 2. `NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL` — prefer dynamic env read (see above), then static.
 * 3. Fallback — GitHub repo.
 */
export function resolveSignalMapSupportHref(): string {
  const runtimeDedicated = process.env.SIGNALMAP_SUPPORT_URL?.trim();
  if (runtimeDedicated) return runtimeDedicated;
  const nextPublic = readNextPublicSupportUrlRuntime();
  if (nextPublic) return nextPublic;
  return FALLBACK_SUPPORT_HREF;
}

/** Safe fields for `/debug/support-url` when `ENABLE_SUPPORT_URL_DEBUG=1`. No secrets. */
export function getSupportUrlDiagnostics(): {
  SIGNALMAP_SUPPORT_URL_configured: boolean;
  NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_configured_bracket: boolean;
  NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_configured_direct: boolean;
  NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_length: number;
  NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_host_preview: string | null;
  resolved_href: string;
  using_github_fallback: boolean;
  github_fallback_literal: string;
  notes: string[];
} {
  const bracket =
    typeof process !== "undefined" ? process.env[NEXT_PUBLIC_SUPPORT_KEY]?.trim() : undefined;
  const direct = process.env.NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL?.trim();
  const sig = process.env.SIGNALMAP_SUPPORT_URL?.trim();
  const resolved = resolveSignalMapSupportHref();
  let hostPreview: string | null = null;
  if (bracket) {
    try {
      hostPreview = new URL(bracket).hostname;
    } catch {
      hostPreview = "(unparseable)";
    }
  }
  return {
    SIGNALMAP_SUPPORT_URL_configured: Boolean(sig),
    NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_configured_bracket: Boolean(bracket),
    NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_configured_direct: Boolean(direct),
    NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_length: bracket?.length ?? 0,
    NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL_host_preview: hostPreview,
    resolved_href: resolved,
    using_github_fallback: resolved === FALLBACK_SUPPORT_HREF,
    github_fallback_literal: FALLBACK_SUPPORT_HREF,
    notes: [
      "NEXT_PUBLIC_* is often inlined at next build; if Railway only sets it at runtime, use SIGNALMAP_SUPPORT_URL or pass NEXT_PUBLIC_* as a Docker build-arg.",
      "Bracket vs direct: if bracket is true and direct is false after deploy, runtime env is visible only via dynamic lookup.",
    ],
  };
}
