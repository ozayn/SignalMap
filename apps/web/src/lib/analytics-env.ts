const CANONICAL_ANALYTICS_HOST = "signalmap.ozayn.com";

function appEnvIsProduction(): boolean {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (appEnv) return appEnv === "production";
  return process.env.NODE_ENV === "production";
}

export function isAnalyticsEnabledOnCurrentHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.trim().toLowerCase();
  if (host !== CANONICAL_ANALYTICS_HOST) return false;
  return appEnvIsProduction();
}

export { CANONICAL_ANALYTICS_HOST };
