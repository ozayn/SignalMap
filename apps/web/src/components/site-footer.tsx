"use client";

import { getSignalMapSupportHref, SUPPORT_LINK_ARIA } from "@/lib/site-support";

export function SiteFooter() {
  const href = getSignalMapSupportHref();
  return (
    <footer className="site-footer" role="contentinfo" lang="en">
      <div className="nav-container site-footer-inner">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="site-footer-link"
          aria-label={SUPPORT_LINK_ARIA}
        >
          Support this project
        </a>
      </div>
    </footer>
  );
}
