"use client";

import { useEffect } from "react";

const FAST_REFRESH_PATTERN = /\[Fast Refresh\]/;

export function SuppressDevLogs() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      const str = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
      if (FAST_REFRESH_PATTERN.test(str)) return;
      originalLog.apply(console, args);
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  return null;
}
