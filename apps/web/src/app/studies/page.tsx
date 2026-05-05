"use client";

import { useMemo, useState } from "react";
import {
  getBrowseRowsForGroup,
  getVisibleStudies,
  isStudyListedForDeployment,
  STUDY_BROWSE_GROUP_ORDER,
  STUDY_BROWSE_GROUP_TITLES,
  type StudyCountry,
  type StudyGroup,
  type StudyTheme,
} from "@/lib/studies";
import { StudyCard, StudyListRow } from "@/components/study-card";
import {
  getSignalTags,
  getStudySearchHaystack,
  studyMatchesBrowseFilters,
  STUDY_COUNTRY_OPTIONS,
  STUDY_THEME_OPTIONS,
} from "@/lib/study-browse";

type ViewMode = "grouped" | "grid" | "list";

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "grouped", label: "Grouped" },
  { id: "grid", label: "Grid" },
  { id: "list", label: "List" },
];

export default function StudiesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<Set<StudyCountry>>(() => new Set());
  const [themeFilter, setThemeFilter] = useState<Set<StudyTheme>>(() => new Set());

  const indexed = useMemo(() => {
    return getVisibleStudies().map((study) => ({
      study,
      haystack: getStudySearchHaystack(study),
      signalTags: getSignalTags(study),
    }));
  }, []);

  const filtered = useMemo(() => {
    return indexed.filter(({ study, haystack }) =>
      studyMatchesBrowseFilters(study, {
        search,
        haystack,
        countries: countryFilter,
        themes: themeFilter,
      })
    );
  }, [indexed, search, countryFilter, themeFilter]);

  const filteredIds = useMemo(() => new Set(filtered.map((x) => x.study.id)), [filtered]);

  const hasActiveFilters =
    search.trim().length > 0 || countryFilter.size > 0 || themeFilter.size > 0;

  const toggleCountry = (id: StudyCountry) => {
    setCountryFilter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleTheme = (id: StudyTheme) => {
    setThemeFilter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCountryFilter(new Set());
    setThemeFilter(new Set());
  };

  return (
    <div className="studies-container py-12">
      <header className="mb-4">
        <h1
          className="font-semibold tracking-[-0.01em] text-[#111827] dark:text-[#e5e7eb]"
          style={{ fontSize: "clamp(22px, 2.5vw, 30px)" }}
        >
          Studies
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-snug text-[#9ca3af] dark:text-[#94a3b8]">
          Explore SignalMap studies by theme, country, or signal.
        </p>
      </header>

      <div className="mb-8 space-y-3 border-b border-[#f1f5f9] dark:border-[#1f2937] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-[#e5e7eb] dark:border-[#374151] p-0.5 bg-[#fafafa] dark:bg-[#0f172a]"
            role="group"
            aria-label="Studies layout: grouped, grid, or list"
          >
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === opt.id
                    ? "bg-white dark:bg-[#1e293b] text-[#111827] dark:text-[#e5e7eb] shadow-sm"
                    : "text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#e5e7eb]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-xl">
          <label htmlFor="studies-search" className="sr-only">
            Search studies
          </label>
          <input
            id="studies-search"
            name="studies_search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, topics, countries…"
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] px-3 py-2 text-sm text-[#111827] dark:text-[#e5e7eb] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#111827]/15 dark:focus:ring-[#e5e7eb]/20"
          />
          <p className="mt-1 text-[10px] leading-snug text-[#9ca3af]/90 dark:text-[#94a3b8]/80">
            Search supports English and Persian.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-start">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] mr-0.5">Country</span>
            {STUDY_COUNTRY_OPTIONS.map(({ id, label }) => {
              const on = countryFilter.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCountry(id)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? "border-[#111827] dark:border-[#e5e7eb] bg-[#f3f4f6] dark:bg-[#1f2937] text-[#111827] dark:text-[#e5e7eb]"
                      : "border-[#e5e7eb] dark:border-[#374151] text-[#6b7280] dark:text-[#9ca3af] hover:border-[#cbd5e1] dark:hover:border-[#64748b]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] mr-0.5">Theme</span>
            {STUDY_THEME_OPTIONS.map(({ id, label }) => {
              const on = themeFilter.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTheme(id)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? "border-[#111827] dark:border-[#e5e7eb] bg-[#f3f4f6] dark:bg-[#1f2937] text-[#111827] dark:text-[#e5e7eb]"
                      : "border-[#e5e7eb] dark:border-[#374151] text-[#6b7280] dark:text-[#9ca3af] hover:border-[#cbd5e1] dark:hover:border-[#64748b]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-[#6b7280] dark:text-[#9ca3af] underline underline-offset-2 hover:text-[#111827] dark:hover:text-[#e5e7eb]"
            >
              Clear
            </button>
          ) : null}
        </div>

        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] tabular-nums">
          Showing {filtered.length} of {indexed.length} studies
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] py-8">
          No studies match these filters. Try clearing search or toggling fewer filters.
        </p>
      ) : viewMode === "grid" ? (
        <div className="studies-grid">
          {filtered.map(({ study, signalTags }) => (
            <StudyCard key={study.id} study={study} signalTags={signalTags} />
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div className="studies-study-list">
          {filtered.map(({ study, signalTags }) => (
            <StudyListRow key={study.id} study={study} signalTags={signalTags} />
          ))}
        </div>
      ) : (
        <div>
          {STUDY_BROWSE_GROUP_ORDER.map((group: StudyGroup, sectionIndex) => {
            const meta = STUDY_BROWSE_GROUP_TITLES[group];
            const listed = indexed
              .map((x) => x.study)
              .filter((s) => isStudyListedForDeployment(s));
            const rows = getBrowseRowsForGroup(listed, group).filter(({ study }) => filteredIds.has(study.id));
            if (rows.length === 0) return null;
            return (
              <section key={group} className={sectionIndex === 0 ? "" : "pt-14"}>
                <div className="mb-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2
                      className="font-semibold tracking-[-0.01em] text-[#111827] dark:text-[#e5e7eb]"
                      style={{ fontSize: "clamp(17px, 2vw, 19px)" }}
                    >
                      {meta.title}
                    </h2>
                    {group === "discourse" ? (
                      <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-medium leading-none text-[#6b7280] dark:bg-[#1f2937] dark:text-[#9ca3af]">
                        In progress
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-[#9ca3af] dark:text-[#94a3b8]"
                  >
                    {meta.description}
                  </p>
                </div>
                <div className="studies-grid">
                  {rows.map(({ study, order }) => {
                    const row = indexed.find((x) => x.study.id === study.id);
                    const signalTags = row?.signalTags ?? getSignalTags(study);
                    return (
                      <StudyCard
                        key={`${study.id}--${group}--${order}`}
                        study={study}
                        signalTags={signalTags}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
