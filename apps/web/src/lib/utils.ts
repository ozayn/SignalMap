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
