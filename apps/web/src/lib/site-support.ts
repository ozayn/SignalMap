/**
 * Public support/donation URL.
 * Set `NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL` (e.g. Ko-fi, GitHub Sponsors, Open Collective).
 * If unset, falls back to the project repository.
 */
export function getSignalMapSupportHref(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://github.com/ozayn/SignalMap";
}

/** English-only, shared across footer, navbar, and Methods. Never localized. */
export const SUPPORT_LINK_ARIA = "Support this project (opens in a new tab)" as const;

/** /methods “Support SignalMap” section (English only). */
export const supportMethodsCopy = {
  title: "Support SignalMap",
  body: "SignalMap is an independent research project developed as a personal passion project. If you find it useful, you can support its continued development.",
  linkText: "Support this project",
} as const;
