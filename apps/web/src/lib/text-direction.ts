/**
 * HTML `dir` for transcript/summary body text from language tags (e.g. en, fa, fa-IR).
 */
export function getTextDir(language: string | null | undefined): "rtl" | "ltr" {
  const l = (language ?? "").trim().toLowerCase();
  if (l === "fa" || l.startsWith("fa-")) return "rtl";
  return "ltr";
}
