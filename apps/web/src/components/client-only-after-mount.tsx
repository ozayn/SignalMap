"use client";

import { useEffect, useState, type ReactNode } from "react";

type ClientOnlyAfterMountProps = {
  children: ReactNode;
  /** Must match server HTML and the first client render (before `useEffect`). */
  fallback?: ReactNode;
};

/**
 * Renders children only after mount so password-manager extensions cannot attach
 * extra attributes to SSR form controls before React hydrates.
 */
export function ClientOnlyAfterMount({ children, fallback = null }: ClientOnlyAfterMountProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
