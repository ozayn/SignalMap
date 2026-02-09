/**
 * Fetch JSON from the same-origin API. All requests go through Next.js API routes,
 * which proxy to the backend. This avoids CORS issues when using a custom domain.
 */
export async function fetchJson<T = unknown>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    let msg = `API returned ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body === "object") {
        const detail = (body as { detail?: string }).detail ?? (body as { error?: string }).error;
        if (typeof detail === "string") msg = detail;
        const hint = (body as { hint?: string }).hint;
        if (typeof hint === "string") msg += ` (${hint})`;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
