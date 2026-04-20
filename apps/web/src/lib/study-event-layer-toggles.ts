/**
 * Shared rules for which event API layers / overlay markers are shown on study charts.
 * Defaults live in `StudyDetailPage` state (all off); toggles only opt in.
 */

export type StudyEventLayerToggleState = {
  showIranEvents: boolean;
  showWorldEvents: boolean;
  showSanctionsEvents: boolean;
  showOpecEvents: boolean;
  showGlobalMacroOil: boolean;
  showPresidentialTerms: boolean;
};

export type StudyEventLayerVisibilityOpts = {
  /** When true, `iran_presidents` is allowed if `showPresidentialTerms` is on. */
  allowPresidentialLayer?: boolean;
};

/**
 * Whether a single event `layer` should contribute overlays for the current toggle state.
 * Unknown layers are hidden (strict OFF).
 */
export function isStudyEventLayerVisible(
  layer: string | undefined,
  toggles: StudyEventLayerToggleState,
  opts?: StudyEventLayerVisibilityOpts
): boolean {
  if (!layer) return false;
  switch (layer) {
    case "iran_core":
      return toggles.showIranEvents;
    case "world_core":
    case "world_1900":
      return toggles.showWorldEvents;
    case "sanctions":
      return toggles.showSanctionsEvents;
    case "opec_decisions":
      return toggles.showOpecEvents;
    case "global_macro_oil":
      return toggles.showGlobalMacroOil;
    case "iran_presidents":
      return !!opts?.allowPresidentialLayer && toggles.showPresidentialTerms;
    default:
      return false;
  }
}

/** Filters `study.eventLayers` (and optionally appends global macro) for `/api/events` requests. */
export function studyEventLayersForFetch(
  studyEventLayers: string[] | undefined,
  toggles: StudyEventLayerToggleState,
  opts: {
    allowPresidentialLayer: boolean;
    /** When true, append `global_macro_oil` if toggled on even when missing from study config. */
    appendGlobalMacroOilIfMissing: boolean;
    studyUsesGlobalMacroOilLayer: boolean;
  }
): string[] {
  const base = [...(studyEventLayers ?? [])];
  let layers = base.filter((layer) =>
    isStudyEventLayerVisible(layer, toggles, { allowPresidentialLayer: opts.allowPresidentialLayer })
  );
  if (
    opts.appendGlobalMacroOilIfMissing &&
    toggles.showGlobalMacroOil &&
    opts.studyUsesGlobalMacroOilLayer &&
    !layers.includes("global_macro_oil")
  ) {
    layers = [...layers, "global_macro_oil"];
  }
  return layers;
}
