import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STUDIES } from "@/lib/studies";

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

      <div className="space-y-4">
        {STUDIES.map((study) => (
          <Card key={study.id} className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Study {study.number}
                  </p>
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
    </div>
  );
}
