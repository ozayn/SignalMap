"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const current = theme === "system" ? resolvedTheme : theme;
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition"
      aria-label="Toggle theme"
    >
      {current === "dark" ? "Light" : "Dark"}
    </button>
  );
}
