"use client";

import { useEffect } from "react";

const SUPPRESS_PATTERNS = [
  /\[Fast Refresh\]/,
  /\[HMR\]/,
];

export function SuppressDevLogs() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (process.env.NEXT_PUBLIC_SUPPRESS_DEV_LOGS === "false") return;

    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      try {
        const str = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
        if (SUPPRESS_PATTERNS.some((p) => p.test(str))) return;
        originalLog.apply(console, args);
      } catch {
        originalLog.apply(console, args);
      }
    };

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r?.message ?? r?.code ?? String(r ?? "");
      if (/Firebase.*auth\/network-request-failed|auth\/network-request-failed/i.test(String(msg))) {
        e.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      console.log = originalLog;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
