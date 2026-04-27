# SignalMap caching policy (API + web proxy)

## Backend (FastAPI, in-process `ttl_cache`)

| Layer | Behavior |
|--------|----------|
| **Signal bundles** | Key `signal:<name>:vN:<start>:<end>` (or variant), TTL **6h** (`CACHE_TTL = 21600`), unless noted. Recompute only on miss or after invalidation. |
| **WDI raw rows** | Key `wdi_rows:<ISO3>:<indicator_id>`, TTL **6h**. Shared by all bundles that need the same indicator; avoids N HTTP calls per request on cache miss. Invalidated with `wdi_rows:` when the weekly WDI refresh job runs. |
| **USD→Toman merged open** | Key `internal:fx_merged:usd_toman_open:v1` + official annual cache; 6h; filled by ingest/daily job; slices by date are cheap. |
| **Brent “market” snapshot** | Separate 1h key for latest quote. |
| **Jobs** | Weekly WDI job invalidates `wdi_rows:`, WDI-backed `signal:…` prefixes (e.g. dutch, M2, gdp global comparison, ISI, oil-economy overview, …), and related internal FX where applicable. |

**Payload size (order of magnitude):** full-history USD→Toman open JSON ~**200KB+**; WDI annual bundles are **small** (tens of KB). Slow paths on miss: **WDI HTTP** and **FX merge** (archive + FRED + Bonbast).

## Next.js BFF (`apps/web/src/app/api/signals/...`)

| Policy | `fetch` `revalidate` (s) | Response `Cache-Control` |
|--------|-------------------------|-----------------------------|
| `fxDaily` (usd-toman, usd-irr-dual) | 120 | `public, s-maxage=120, stale-while-revalidate=60` |
| `oilEconomy` | 600 | `public, s-maxage=600, stale-while-revalidate=120` |
| `wdiAnnual` (Dutch, GDP comparison, M2, …) | 1800 | `public, s-maxage=1800, stale-while-revalidate=300` |
| **Errors (4xx/5xx)** | — | `no-store` |

Helpers: `apps/web/src/lib/signal-api-proxy.ts`. Browsers and CDNs may cache **GET** JSON for short periods; data freshness still governed by API TTL + revalidation.

## Study pages

- `study/[id]` is a **client** page; fetches from **`/api/signals/...`** (BFF), not the Python origin directly. No `force-dynamic` on the page shell for studies.
- **High-frequency series (USD→Toman):** chart **display** may downsample long spans on the client; full series still used for KPIs where needed.

## What not to cache for long

- Live **Brent tick** / intraday.
- **Wayback / YouTube** dynamic jobs: keep `no-store` or very short revalidate on those routes.

## Versioning

- Signal cache keys include **`v1` / `v2` / `v4`** in code when the response shape or stitch logic changes—bump to avoid serving stale structure after deploy.
