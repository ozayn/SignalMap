<!-- This file defines authoritative context for AI-assisted development (Cursor, etc.) -->

# SignalMap — context document for new chat

## 1) Project identity & goals

- **SignalMap** is a research/educational app for exploring macroeconomic and audience signals (oil, FX, gold, events, follower growth) with event overlays and clear methodology notes.
- It is **not**: a forecasting tool, a causal-inference platform, or a real-time trading/sentiment product.
- **Epistemic stance**: educational only. No causal claims, no predictions. Charts and studies describe patterns and methods; "In simple terms" and "Learning note" components reinforce this. Event overlays are contextual anchors, not explanations.

## 2) Architecture & repo structure

- **Monorepo**: `apps/api` (FastAPI), `apps/web` (Next.js). Root has Dockerfiles, railway config, pnpm workspace.
- **FastAPI** (`apps/api`): `main.py` wires routes; `jobs.py` holds cache/job logic and platform-specific cache-first logic. Connectors (wayback_instagram, wayback_twitter, wayback_youtube, etc.) talk to external sources. **DB** (`db.py`): Postgres when `DATABASE_URL` is set; tables include `wayback_snapshot_cache`, `wayback_jobs`, `wayback_job_snapshots`, `signal_points`. No study registry on the backend.
- **Next.js** (`apps/web`): App Router; pages under `app/studies`, `app/learning`. API routes under `app/api/*` **proxy** to FastAPI (same-origin, no direct backend URL in browser). No caching or business logic in Next.js API routes; they are thin proxies.
- **Deployment**: Railway (or similar); API and web can be separate services. DB required for Wayback jobs and cache.

## 3) Studies model

- Studies are **frontend-only** and **registry-driven**. Single source of truth: `apps/web/src/lib/studies.ts` — array of study metadata (id, number, title, timeRange, primarySignal, concepts, eventLayers, visible, etc.).
- One dynamic route: `app/studies/[studyId]/page.tsx`. Study type is determined by `primarySignal.kind` (e.g. oil_brent, follower_growth_dynamics, events_timeline). No backend route per study; backend exposes signal/event/wayback APIs that the study page calls based on primarySignal.
- Shared UI: TimelineChart, EventsTimeline, LearningNote, ConceptsUsed, InSimpleTerms. Some studies use study-specific components (e.g. FollowerGrowthChart for Study 10).

## 4) Wayback follower growth (Study 10)

- **Study 10**: "Follower growth dynamics" — exploratory, descriptive only. Uses Wayback Machine snapshots of follower/subscriber counts (irregular time series) and fits simple growth models (linear, exponential, logistic) for education, not prediction.
- **Platforms**: Instagram, YouTube, X/Twitter. All three must use the same cache-first contract and normalized response shape.
- Data source: `wayback_snapshot_cache` when available; otherwise one controlled live fetch that seeds the cache. Educational intent is stated in LearningNote and InSimpleTerms (no causality, no prediction).

## 5) Cache-first design (critical)

- **Cache** lives in Postgres: table `wayback_snapshot_cache` (platform, canonical_url, timestamp, plus platform-specific metric columns). Same table for Instagram, YouTube, Twitter.
- **Cache-first behavior** (same for all three platforms): (1) If cache has ≥1 row for (platform, canonical_url) and `force_live` is false → return cached data only; source=cache; wayback_calls=0. (2) If cache is empty and `force_live` is false → perform one live Wayback fetch (list + fetch up to limit), upsert into cache, return source=live. (3) If `force_live` is true → perform one live fetch, upsert, return source=mixed if cache had rows else live. Do **not** retry aggressively, do **not** make multiple Wayback calls per request, do **not** block the response on long backfills.
- **Normalized API**: GET `/api/wayback/{instagram|youtube|twitter}/cache-first`. Query params: `handle` (preferred), deprecated `username`/`input`, optional `force_live`, `limit`. Response: platform, handle, canonical_url, source (cache|live|mixed), snapshots[], meta (cache_hit, cache_rows, wayback_calls, rate_limited, notes, last_cached_at). Snapshots: timestamp (ISO-8601), followers, snapshot_url; empty snapshots = [].
- **Jobs** (POST …/jobs, background runners in jobs.py) also read/write `wayback_snapshot_cache` and `wayback_job_snapshots`. They are separate from the cache-first request path; cache-first must remain a single-request, one-batch-max flow. Internet Archive rate limits apply (~15 req/min); job runners use delays; cache-first avoids repeated live calls.

## 6) Current task

- **Goal**: Make all Wayback follower-growth endpoints (Instagram, YouTube, Twitter) consistent, cache-first, and research-grade. This has been largely implemented: normalized handle/force_live/limit, shared response shape, Twitter cache-first added, Next.js thin proxies, Study 10 using handle and new response (snapshots, meta).
- **Constraints**: Do not change DB schema in this task. Do not add caching or business logic in Next.js API routes. Do not refactor unrelated studies. Do not break the epistemic stance (educational, no causality, no prediction). Keep cache-first to a single live batch per request when cache is empty or force_live is true.
