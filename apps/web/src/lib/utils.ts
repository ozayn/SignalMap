import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cssHsl(varName: string, fallbackHsl: string) {
  if (typeof document === "undefined") return fallbackHsl;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw ? `hsl(${raw})` : fallbackHsl;
}

export function cssColor(varName: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw ? raw : fallback;
}

/** Decode HTML entities in text (e.g. &#39; → ', &amp; → &). */
export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== "string") return str || "";
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/** Format date for stat cards. Daily: "Mar 2, 2026". Monthly/annual: "Mar 2026". */
export function formatStatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const includeDay = parts.length >= 3 && /^\d{1,2}/.test(parts[2] ?? "");
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    ...(includeDay ? { day: "numeric" as const } : {}),
  });
}

export function withAlphaHsl(hslColor: string, alpha: number): string {
  if (!hslColor.startsWith("hsl(")) return hslColor;
  // Parse hsl(h s% l%) or hsl(h, s%, l%) and output hsla(h, s%, l%, alpha) for Canvas API
  const match = hslColor.match(/hsl\(\s*(\d+)\s*,?\s*(\d+(?:\.\d+)?%?)\s*,?\s*(\d+(?:\.\d+)?%?)\s*\)/);
  if (match) {
    const [, h, s, l] = match;
    return `hsla(${h}, ${s}, ${l}, ${alpha})`;
  }
  const spaceMatch = hslColor.match(/hsl\(\s*(\d+)\s+(\d+(?:\.\d+)?%?)\s+(\d+(?:\.\d+)?%?)\s*\)/);
  if (spaceMatch) {
    const [, h, s, l] = spaceMatch;
    return `hsla(${h}, ${s}, ${l}, ${alpha})`;
  }
  return hslColor.replace(")", `, ${alpha})`).replace("hsl(", "hsla(");
}
