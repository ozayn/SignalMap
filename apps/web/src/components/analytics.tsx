"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAnalyticsEnabledOnCurrentHost } from "@/lib/analytics-env";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let hasLoggedAnalyticsDisabled = false;

export function Analytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!gaId) return;
    const enabled = isAnalyticsEnabledOnCurrentHost();
    if (!enabled) {
      if (process.env.NODE_ENV === "development" && !hasLoggedAnalyticsDisabled) {
        console.log("[analytics] disabled outside production");
        hasLoggedAnalyticsDisabled = true;
      }
      return;
    }

    if (!window.dataLayer) window.dataLayer = [];
    if (typeof window.gtag !== "function") {
      window.gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };
      window.gtag("js", new Date());
      window.gtag("config", gaId, {
        debug_mode: process.env.NEXT_PUBLIC_GA_DEBUG === "true",
      });

      const existing = document.querySelector(`script[data-ga-id="${gaId}"]`);
      if (!existing) {
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
        script.setAttribute("data-ga-id", gaId);
        document.head.appendChild(script);
      }
    }

    if (typeof window.gtag === "function") {
      window.gtag("config", gaId, { page_path: pathname });
    }
  }, [pathname, gaId]);

  return null;
}
