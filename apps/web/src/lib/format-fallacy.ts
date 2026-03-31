/**
 * Display helpers for transcript fallacy analysis (backend uses snake_case keys).
 */

/** Convert a fallacy key like `burden_shifting` → `Burden Shifting`. */
export function formatFallacyKey(key: string): string {
  const t = key.trim();
  if (!t) return "";
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Compact confidence label for UI: numeric scores map to High / Medium / Low;
 * existing text labels (low/medium/high, weak/strong) are title-cased and preserved in spirit.
 */
export function formatFallacyConfidenceDisplay(
  confidence?: string | number | null,
  confidenceScore?: number | null,
): string | null {
  if (typeof confidenceScore === "number" && !Number.isNaN(confidenceScore)) {
    if (confidenceScore >= 0.85) return "High";
    if (confidenceScore >= 0.65) return "Medium";
    return "Low";
  }
  if (typeof confidence === "number" && !Number.isNaN(confidence) && confidence >= 0 && confidence <= 1) {
    if (confidence >= 0.85) return "High";
    if (confidence >= 0.65) return "Medium";
    return "Low";
  }
  if (typeof confidence === "string") {
    const s = confidence.trim().toLowerCase();
    if (s === "low" || s === "medium" || s === "high") {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (s === "weak" || s === "strong") {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (confidence.trim()) return confidence.trim();
  }
  return null;
}
