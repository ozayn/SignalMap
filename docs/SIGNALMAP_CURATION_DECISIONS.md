# SignalMap event curation — decision report (2026-03)

This pass implements the inventory/curation plan in `SIGNALMAP_EVENTS_REPORT.md`: canonical alignment between dot and band seeds, explicit **importance** on every dot-timeline event, a small API overlay filter, and a few high-value adds.

## Rules used

| importance | Default visibility (dot/band) |
|------------|------------------------------|
| **3** | Landmarks — shown when zoomed out; `minImportanceForViewPortion` allows 3 only at wide view |
| **2** | “More context” — visible at medium zoom (or with “Show more events” / `importanceDetail="all"`) |
| **1** | Detail / footnote — only when well zoomed in, or with “Show more events” |

Dot timeline: every entry in `SIGNALMAP_TIMELINE_SEED` now sets **`importance: 1 \| 2 \| 3`**. The former `ID_TIER` table in `importance.ts` was **removed**; `getEventImportance()` is `e.importance ?? 2`.

## Band ↔ dot id alignment (merged naming)

| Former band id | Canonical id | Note |
|----------------|-------------|------|
| `b-oil-shock-73` | **`g-1973-embargo`** | Same episode as dot |
| `b-ir-rev` | **`ir-rev-79`** | Same as dot |
| `b-ir-iq` | **`ir-iq-war`** | Single **period** on band; dot keeps `ir-iq-war-start` + `ir-iq-war-end` |
| `b-jcpoa` | **`ir-jcpoa-era`** | Period 2015-07-14 — 2018-05-08; dot uses point events `ir-jcpoa` + `ir-jcpoa-exit` |
| `b-max-pressure` | **`ir-sanctions-max-pressure`** | Phase label |
| `b-covid` | **`g-covid-pandemic-era`** | WHO pandemic window; dot anchor point `g-covid-pheic` |
| `b-ukraine-war` | **`g-ukraine-invasion-ongoing`** | Ongoing **period**; dot has invasion-day point `g-ukraine-22` |
| `b-cold-war`, `b-bretton-woods` | *unchanged* | No 1:1 single dot with same shape (periods vs. different point anchors) |

`b-cold-war` / `b-bretton-woods` kept **as-is** to avoid conflating multi-decade **periods** with single-day dot markers (`g-cold-start`, `g-bretton-woods`).

## Iran API JSON (`events_iran.json`)

- **`include_in_iran_core: false`** (still in file for future tooling; **excluded** from `load_events_iran_json()` default list):
  - **ir-002** — Raisi elected (redundant with pre-2021 `iran_core` + timeline)
  - **ir-003** — Raisi sworn
  - **ir-009** — Anniversary statement (chronicle noise)
  - **ir-018, ir-019** — **scenario / speculative** rows (excluded from default chart overlays; retain in JSON for non-default use)

**Kept in default iran_core load:** e.g. Natanz, Mahsa Amini start, Kerman, Iran–Israel 2024, Raisi crash, Russia partnership, 2025–2026 unrest (subject to re-review as facts evolve).

## Dot seed: removed / added / downgraded (summary)

- **Removed:** `g-china-wto-join-note` (Doha) — **merged** into `g-china-wto` description (Doha date in prose).
- **Added:** `g-opec-plus-2016` (2016-11-30), **importance 2** — OPEC+ coordination anchor after 2014–2016 down-cycle.
- **All other ids retained**; noisy or “footnote” events stay with **importance 1** (e.g. `g-oil-negative`, `g-y2k`, `g-wto-95`, `ir-nuc-natanz`, `ir-rial-stress-18`).

## Chart overlay (GDP macro)

- **`gdp-composition-macro-events`:** added **2016-11** macro row for **OPEC+** to align with `g-opec-plus-2016` on the dot timeline.

## Kept (no id change, representative)

- Major anchors: 1973 oil embargo, 1979 revolution, hostages, Iran–Iraq start/end, JCPOA, JCPOA exit, Soleimani, WLF, 2008 Lehman, 2022 Ukraine, COVID PHEIC, Gaza 2023, etc.
- Iran–Iraq: two **point** events on the dot view remain (start + ceasefire) by design; band shows one **span**.

## Merged (naming or narrative)

- China WTO “Doha” duplicate → folded into `g-china-wto`.
- Band point events listed above now **share** dot ids where 1:1 `point` events.

## Downgraded (importance 1, not deleted)

- Examples: WTI negative print (`g-oil-negative`), LTCM, Black Monday, Y2K, WTO establishment, Natanz 2020 illustrative, rial stress anchor, Germany reunification, dot-com peak — remain for zoomed-in or “all importance” mode.

## Added (new ids)

- **`g-opec-plus-2016`** (dot) + GDP macro 2016 row.
- (API) No new public ids; curation is filter + alignment.

## Ambiguous / follow-up

- **Iran 2021–2026** JSON rows: facts and sensitivity change quickly; which rows stay in default `iran_core` should be reviewed quarterly.
- **OPEC+ “first deal”** date: multiple Vienna rounds; 2016-11-30 used as a single **macro anchor**; refine to first ministerial if you add sub-month precision.
- **Unifying** API `load_events` world layers with dot seed into one **machine-readable registry** (single `CANONICAL_EVENTS` array) is still the next engineering step; this pass aligns web seeds + one loader hook.

## Files touched

- `apps/web/src/lib/signalmap-timeline/seed.ts` — importances, OPEC+ event, WTO note removal
- `apps/web/src/lib/signalmap-timeline/importance.ts` — drop `ID_TIER`, data-driven importance
- `apps/web/src/lib/signalmap-band-timeline/seed.ts` — band ids + descriptions
- `apps/api/src/signalmap/data/events_iran.json` — `include_in_iran_core` flags
- `apps/api/src/signalmap/data/events_iran_loader.py` — respect flag
- `apps/web/src/lib/gdp-composition-macro-events.ts` — OPEC+ 2016
- `docs/SIGNALMAP_CURATION_DECISIONS.md` (this file)

