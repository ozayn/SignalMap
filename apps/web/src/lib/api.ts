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
    throw new Error(`API returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}
