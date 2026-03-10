"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = theme === "system" ? resolvedTheme : theme;
  const next = current === "dark" ? "light" : "dark";

  if (!mounted) {
    return (
      <span
        className="theme-toggle-btn inline-block opacity-0"
        style={{ minWidth: 36, minHeight: 28 }}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="theme-toggle-btn"
      aria-label={current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {current === "dark" ? "☀" : "☾"}
    </button>
  );
}
