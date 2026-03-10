import { getStudyById } from "@/lib/studies";
import type { StudyMeta } from "@/lib/studies";
import { StudyCard } from "@/components/study-card";

/** Map primarySignal.kind to display tags for the Signals row. */
function getSignalTags(study: StudyMeta): string[] {
  const tags: string[] = [];
  const kind = study.primarySignal.kind;
  if (
    kind === "oil_brent" ||
    kind === "oil_and_fx" ||
    kind === "gold_and_oil" ||
    kind === "real_oil" ||
    kind === "oil_ppp_iran" ||
    kind === "oil_export_capacity" ||
    kind === "oil_production_major_exporters" ||
    kind === "oil_trade_network" ||
    kind === "oil_geopolitical_reaction"
  ) {
    tags.push("Oil");
  }
  if (kind === "fx_usd_toman" || kind === "oil_and_fx" || kind === "fx_usd_irr_dual") {
    tags.push("FX");
  }
  if (kind === "gold_and_oil") tags.push("Gold");
  if (kind === "events_timeline") tags.push("Events");
  if (kind === "follower_growth_dynamics") tags.push("Growth");
  if (kind === "wage_cpi_real") tags.push("Wage");
  if (kind === "oil_trade_network") tags.push("Trade");
  if (study.eventLayers && study.eventLayers.length > 0 && !tags.includes("Events")) {
    tags.push("Events");
  }
  return [...new Set(tags)];
}

const SECTIONS: { title: string; description: string; studyIds: string[] }[] = [
  {
    title: "Foundations (signals)",
    description: "Core price and exchange-rate series that anchor later analysis.",
    studyIds: ["iran", "usd-toman", "oil-and-fx"],
  },
  {
    title: "Context (timelines)",
    description: "Reference timelines for events and long-range price context.",
    studyIds: ["events_timeline", "global_oil_1900", "oil_geopolitical_reaction"],
  },
  {
    title: "Burden & adjustment (methods)",
    description: "Inflation-adjusted and PPP-based measures of economic burden.",
    studyIds: ["real_oil_price", "iran_oil_ppp", "iran_real_wage_cpi"],
  },
  {
    title: "Comparisons & constraints",
    description: "Cross-country comparisons and capacity under constraints.",
    studyIds: ["iran_oil_ppp_turkey", "iran_oil_export_capacity", "oil_major_exporters", "iran_fx_spread"],
  },
  {
    title: "Audience dynamics (growth & networks)",
    description: "Follower growth, simple growth models, and network prototypes.",
    studyIds: ["follower_growth_dynamics", "oil_trade_network"],
  },
];

export default function StudiesPage() {
  return (
    <div className="studies-container py-12">
      <header className="mb-8">
        <h1
          className="font-semibold tracking-[-0.01em] text-[#111827] dark:text-[#e5e7eb]"
          style={{ fontSize: "clamp(22px, 2.5vw, 30px)" }}
        >
          Studies
        </h1>
        <p
          className="mt-1 text-[#6b7280] dark:text-[#9ca3af]"
          style={{ fontSize: "clamp(12px, 1.2vw, 14px)" }}
        >
          Longitudinal research on emotion, language, and interaction in public discourse.
        </p>
      </header>

      <div>
        {SECTIONS.map((section, sectionIndex) => {
          const studies = section.studyIds
            .map((id) => getStudyById(id))
            .filter((s): s is NonNullable<typeof s> => s != null && s.visible !== false);
          if (studies.length === 0) return null;
          return (
            <section key={section.title} className={sectionIndex === 0 ? "" : "section-block"}>
              <div
                className={`${sectionIndex === 0 ? "mt-9 " : ""}border-b border-[#f1f5f9] dark:border-[#1f2937] pb-1.5 mb-3.5`}
              >
                <h2
                  className="font-semibold text-[#111827] dark:text-[#e5e7eb]"
                  style={{ fontSize: "clamp(16px, 1.8vw, 18px)" }}
                >
                  {section.title}
                </h2>
                <p
                  className="mt-0.5 text-[#6b7280] dark:text-[#9ca3af]"
                  style={{ fontSize: "clamp(12px, 1.2vw, 14px)" }}
                >
                  {section.description}
                </p>
              </div>
              <div className="studies-grid">
                {studies.map((study) => (
                  <StudyCard
                    key={study.id}
                    study={study}
                    signalTags={getSignalTags(study)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
