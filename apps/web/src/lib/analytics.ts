declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

/**
 * Send a custom event to Google Analytics.
 * Fails silently if gtag is not available (e.g. analytics not loaded, ad blocker).
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function" || !GA_ID) {
    return;
  }
  const eventParams = { ...params, send_to: GA_ID };
  window.gtag("event", eventName, eventParams);
  if (process.env.NODE_ENV === "development") {
    console.debug("[GA]", eventName, eventParams);
  }
}
