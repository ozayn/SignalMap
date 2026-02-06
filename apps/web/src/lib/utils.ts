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
  return hslColor.replace(")", `, ${alpha})`).replace("hsl(", "hsla(");
}
