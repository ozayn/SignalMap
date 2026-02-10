import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudyById } from "@/lib/studies";

const SECTIONS: { title: string; description: string; studyIds: string[]; startHere?: string }[] = [
  {
    title: "Foundations (signals)",
    description: "Core price and exchange-rate series that anchor later analysis.",
    studyIds: ["iran", "usd-toman", "oil-and-fx"],
    startHere: "iran",
  },
  {
    title: "Context (timelines)",
    description: "Reference timelines for events and long-range price context.",
    studyIds: ["events_timeline", "global_oil_1900"],
    startHere: "events_timeline",
  },
  {
    title: "Burden & adjustment (methods)",
    description: "Inflation-adjusted and PPP-based measures of economic burden.",
    studyIds: ["real_oil_price", "iran_oil_ppp", "iran_real_wage_cpi"],
  },
  {
    title: "Comparisons & constraints",
    description: "Cross-country comparisons and capacity under constraints.",
    studyIds: ["iran_oil_ppp_turkey", "iran_oil_export_capacity", "iran_fx_spread"],
  },
  {
    title: "Audience dynamics (growth & networks)",
    description: "Follower growth and simple growth models.",
    studyIds: ["follower_growth_dynamics"],
  },
];

export default function StudiesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Studies
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Longitudinal research on emotion, language, and interaction in public discourse.
        </p>
      </div>

      <div className="space-y-10">
        {SECTIONS.map((section) => {
          const studies = section.studyIds
            .map((id) => getStudyById(id))
            .filter((s): s is NonNullable<typeof s> => s != null && s.visible !== false);
          if (studies.length === 0) return null;
          return (
            <section key={section.title} className="space-y-4">
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  {section.title}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {section.description}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {studies.map((study) => (
                  <Card key={study.id} className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Study {study.number}
                            </p>
                            {section.startHere === study.id && (
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 border border-border rounded px-1.5 py-0.5">
                                Start here
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-lg font-medium mt-0.5">
                            {study.title}
                          </CardTitle>
                        </div>
                        <Link
                          href={`/studies/${study.id}`}
                          className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground/30 rounded-md px-3 py-1.5 shrink-0 transition"
                        >
                          View
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {study.timeRange[0]} — {study.timeRange[1]}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        {study.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
