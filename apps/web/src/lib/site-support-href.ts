import "server-only";

const FALLBACK_SUPPORT_HREF = "https://github.com/ozayn/SignalMap";

/**
 * Resolve the public support/donation URL on the server at **request time**.
 *
 * Use this from Server Components / `layout.tsx` only — not from client bundles.
 *
 * Precedence:
 * 1. `SIGNALMAP_SUPPORT_URL` — preferred for deployments where env is injected at **runtime**
 *    (so it works without rebuilding when you change the URL).
 * 2. `NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL` — inlined at **build time**; must be set when `next build` runs.
 * 3. Fallback — project repo (transparent landing until you configure giving).
 */
export function resolveSignalMapSupportHref(): string {
  const runtime = process.env.SIGNALMAP_SUPPORT_URL?.trim();
  if (runtime) return runtime;
  const buildTimePublic = process.env.NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL?.trim();
  if (buildTimePublic) return buildTimePublic;
  return FALLBACK_SUPPORT_HREF;
}
