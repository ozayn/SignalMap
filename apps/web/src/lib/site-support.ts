/**
 * Support link **labels** (English-only). The actual href is resolved server-side — see
 * `site-support-href.ts` (`resolveSignalMapSupportHref`).
 *
 * Env vars for the URL (deployment):
 * - `SIGNALMAP_SUPPORT_URL` — preferred on Railway (runtime, no rebuild).
 * - `NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL` — must be available when `next build` runs unless runtime
 *   lookup via dynamic `process.env[...]` succeeds (see `site-support-href.ts`).
 */

/** English-only, shared across footer, navbar, and Methods. Never localized. */
export const SUPPORT_LINK_ARIA = "Support this project (opens in a new tab)" as const;

/** /methods “Support SignalMap” section (English only). */
export const supportMethodsCopy = {
  title: "Support SignalMap",
  body: "SignalMap is an independent research project developed as a personal passion project. If you find it useful, you can support its continued development.",
  linkText: "Support this project",
} as const;
