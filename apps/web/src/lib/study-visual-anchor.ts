import type { PrimarySignal, StudyMeta } from "@/lib/studies";

/** Tiny left accent for study cards: maps primary signal to a stable category. */
export type StudyVisualAnchor =
  | "fx"
  | "oil"
  | "gdp"
  | "timeline"
  | "discourse"
  | "neutral";

export function getStudyVisualAnchor(study: StudyMeta): StudyVisualAnchor {
  const k = study.primarySignal.kind as PrimarySignal["kind"];

  if (k === "fx_iran_currency_regime") return "fx";

  if (
    k === "gold_and_oil" ||
    k === "real_oil" ||
    k.startsWith("oil_") ||
    k === "oil_economy_overview"
  ) {
    return "oil";
  }

  if (k === "gdp_composition" || k === "iran_gdp_accounts_dual" || k === "gdp_global_comparison") {
    return "gdp";
  }

  if (
    k === "events_timeline" ||
    k === "global_events_timeline" ||
    k === "band_events_timeline" ||
    k === "comparative_history_timeline" ||
    k === "iran_dynasties_timeline"
  ) {
    return "timeline";
  }

  if (k === "follower_growth_dynamics" || k === "youtube_comment_analysis") return "discourse";

  return "neutral";
}

/** Tailwind background classes for the accent dot (6–8px circle). */
export function studyVisualAnchorDotClass(anchor: StudyVisualAnchor): string {
  switch (anchor) {
    case "fx":
      return "bg-[#14b8a6] dark:bg-[#2dd4bf]";
    case "oil":
      return "bg-[#f59e0b] dark:bg-[#fbbf24]";
    case "gdp":
      return "bg-[#3b82f6] dark:bg-[#60a5fa]";
    case "timeline":
      return "bg-[#a855f7] dark:bg-[#c084fc]";
    case "discourse":
      return "bg-[#9ca3af] dark:bg-[#94a3b8]";
    default:
      return "bg-[#cbd5e1] dark:bg-[#64748b]";
  }
}
