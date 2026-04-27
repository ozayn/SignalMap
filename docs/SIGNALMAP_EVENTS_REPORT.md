# SignalMap events & timeline axis — audit report (2026)

## Part A — Timeline year axis (tick density)

**Where the logic lives:** `apps/web/src/lib/signalmap-timeline/viewport.ts` — `buildYearAxisTicks()` (shared by **dot** and **band** timelines).

**How step size is chosen (after this change):**

1. **Visibility window:** `startMs` / `endMs` (pans with the viewport), `contentWidthPx` (from `ResizeObserver` on the track).
2. **Tier** `full` | `medium` | `strong` from `pickZoomTier(viewPortion, spanViewMs)` (unchanged intent: very zoomed in → `strong`).
3. **Candidate year steps** are **1, 2, 5, 10, 20, 50, 100** (Jan-1 grid), **trimmed by tier** so e.g. `strong` does not try 50y first.
4. **First step that fits wins** — but steps are tried in **ascending** order (fine → coarse), so the **densest** grid that still satisfies:
   - at most `maxFitting` ticks (from width / `minLabelPx`, cap 36 by default), and
   - minimum pixel gap between consecutive tick centers ≥ `0.88 * minLabelPx`.
5. **Defaults:** `minLabelPx` floor **42** (was effectively 56), `maxLabelCount` **36** (was 28), so wide layouts can show more year labels without overlap.
6. **Recompute:** any change to view range, zoom, or width re-runs `useMemo` that calls `buildYearAxisTicks` in the components.

**Before / after (illustrative):**

| View | Before (typical) | After (typical) |
|------|------------------|-----------------|
| **Wide** (~full domain, ~110y visible, ~800px) | First passing coarse grid often **100y** or **50y** (coarse-first loop) | Tries **1y** → … → first fit often **5y–20y** |
| **Medium** (~30–50y in view) | Could stop at **20y** when **10y** would fit | Prefers **10y** or **5y** when gap allows |
| **Close** (< ~15y) | **1y / 2y** when possible | Same, with slightly more room from smaller `minLabelPx` |

---

## Part B — Event inventory (web + API)

| # | File / source | ~Count | Categories / types | Date range (approx) | Used by | EN/FA |
|---|---------------|--------|--------------------|------------------------|---------|--------|
| 1 | `apps/web/src/lib/signalmap-timeline/seed.ts` — `SIGNALMAP_TIMELINE_SEED` | **~57** point/span events (explicit `importance` 1/2/3) | `global` \| `iran` \| `oil` \| `fx` \| `war` | 1914 → present | Dots study (`global_events_timeline`, dev) + `SignalMapTimeline` default | `title_en` / `title_fa` on every item |
| 2 | `apps/web/src/lib/signalmap-band-timeline/seed.ts` — `BAND_TIMELINE_SEED` | **9** (periods + points) | `global`…`policy` swimlanes | 1944 → 2026+ | Band study `timeline-bands` | Ids **aligned** with dot where 1:1; see `docs/SIGNALMAP_CURATION_DECISIONS.md` |
| 3 | `apps/api/src/signalmap/data/events_iran.json` | **19** | `type` e.g. `political` | 2021+ (loader combines with Python pre-2021 lists) | FastAPI `/api/events` for **chart overlays** when `study_id` + `layers` match | English titles/descriptions in file |
| 4 | `apps/api/.../events_timeline.py` + `events_iran_loader.py` | Merged list (JSON + in-code lists) | World + Iran layers | Varies by layer | API events feed | EN (API) |
| 5 | `apps/web` — `components/events-timeline` + `events_timeline` study | Loaded from API | `events_timeline` | 1900+ | Reference list study | Depends on API payload |
| 6 | Hardcoded / TS | e.g. `gdp-composition-macro-events`, geopolitical markers in study code | Varies | — | Specific charts | Mix |

**Search tips used:** `events_*.json`, `eventLayers` in `studies.ts`, `SIGNALMAP_TIMELINE_SEED`, `BAND_TIMELINE_SEED`, `/api/events`, `buildTimelineNodes`.

**Total (rough):** ~57 (dots) + 9 (band) are **independent client seeds**; **19+** API Iran modern events; plus merged server timeline and per-study layers.

---

## Part C — Consistency (same real-world event)

| Topic | Dot seed id | Band seed id | Notes |
|-------|-------------|--------------|--------|
| 1973 oil shock | `g-1973-embargo` | `g-1973-embargo` | **Same id** (curation 2026) |
| Iran revolution | `ir-rev-79` | `ir-rev-79` | **Same id** |
| Iran–Iraq war | `ir-iq-war-start` + `ir-iq-war-end` | `ir-iq-war` (one period) | Dots: start/end; band: one span |
| JCPOA | `ir-jcpoa` (point) + `ir-jcpoa-exit` | `ir-jcpoa-era` (period) | Point vs. US-in-deal **period** |
| Max pressure | — (narrative / `ir-jcpoa-exit`) | `ir-sanctions-max-pressure` | Explict band **period** id |
| COVID / Ukraine | `g-covid-pheic` + `g-ukraine-22` (points) | `g-covid-pandemic-era` + `g-ukraine-invasion-ongoing` (periods) | Point vs. span |

**Standardization:** Band ↔ dot id alignment and importance rules: **`docs/SIGNALMAP_CURATION_DECISIONS.md`**. The `lib/signalmap-events/` barrel re-exports both seeds; a single deduped `CANONICAL_EVENTS[]` is still a future step.

---

## Part D — Noise & importance

**Rules in data:** `importance: 1 | 2 | 3` on **every** dot seed event and on band events; `getEventImportance()` uses `e.importance ?? 2` (no `ID_TIER` table after curation 2026).

**UI:**

- **Default:** `minImportanceForViewPortion()` so at **wide** zoom only **3**; zooming in reveals **2** then **1**.
- **“Show more events”** checkbox on **both** `timeline-global-events` and `timeline-bands` study pages sets `importanceDetail="all"` → `minImportance = 1` at the current zoom (more markers/bands).
- **Chart API overlays** are **not** yet filtered by a shared “importance 3 only” flag (would require API + schema changes).

**Events removed / downgraded:** None bulk-removed in this pass (avoid breaking references); use the checkbox + future registry dedupe.

---

## Part E — Missing anchors

**Added in this pass:** None (seeds already include Lehman 2008, JCPOA, Ukraine, etc.). **Suggested next adds** (small set): e.g. **1991 Soviet dissolution** (global), **2016 OPEC+ frame** (oil) — add to `SIGNALMAP_TIMELINE_SEED` + optional band period with same titles when registry merges.

---

## Part F — Shared registry

- **Module:** `apps/web/src/lib/signalmap-events/`  
  - `types.ts` — `SignalMapEventRecord` (canonical field set).  
  - `index.ts` — re-exports `SIGNALMAP_TIMELINE_SEED`, `BAND_TIMELINE_SEED`, and shared types.  
- **Next step:** One deduped `CANONICAL_EVENTS: SignalMapEventRecord[]` and thin seeds that only `id` + overrides.

---

## Part G — Studies / files touched in this work

- **Axis:** `viewport.ts` (tick algorithm + defaults).  
- **Props:** `SignalMapTimeline` + `SignalMapBandTimeline` — `importanceDetail`.  
- **Page:** `studies/[studyId]/page.tsx` — checkbox + wiring.  
- **Registry:** `lib/signalmap-events/*` (new).

---

## Totals by category (client seeds only, approximate)

- **Dot seed:** categories `global` / `iran` / `oil` / `fx` / `war` as tagged in `seed.ts` (see file for exact distribution; ~57 events).
- **Band seed:** 9 events across 6 swimlanes + `policy` (see `BAND_LANE_ORDER`).

---

## Duplicate / inconsistent (summary)

- **Same story, two ids** between band and dot (e.g. revolution, oil 1973) — **documented in Part C**; fix = canonical registry ids + aliases.

---

## Events removed

- **None** in this change set.

---

## New rules (importance)

- **3:** Landmarks; visible by default when zoomed out.  
- **2:** Context; appear at medium zoom (default mode).  
- **1:** Detail; appear when zoomed in, or when **“Show more events”** is checked.

---

## Verification checklist

- [x] `npx tsc` in `apps/web` passes.  
- [x] EN/FA for new checkbox uses `L(isFa, en, fa)` in correct order.  
- [ ] Manually: wide band view shows **more** year labels than before; no overlapping labels.  
- [ ] Manually: “Show more events” increases visible low-importance items.  

---

*Generated as part of the SignalMap event/timeline pass; update when the canonical JSON registry lands.*
