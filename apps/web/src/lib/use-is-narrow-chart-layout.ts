"use client";

import { useEffect, useState } from "react";

/** Tailwind `md` breakpoint (768px): below = phone / narrow tablet chart layout. */
const NARROW_QUERY = "(max-width: 767px)";

export function useIsNarrowChartLayout(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return narrow;
}
