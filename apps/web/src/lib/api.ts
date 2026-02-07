const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchJson<T = unknown>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const url = path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
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
