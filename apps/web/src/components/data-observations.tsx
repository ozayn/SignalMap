import { Card, CardContent } from "@/components/ui/card";

type DataObservationsProps = {
  observations: string[];
};

export function DataObservations({ observations }: DataObservationsProps) {
  if (observations.length === 0) return null;
  return (
    <Card className="mt-3 border-border bg-muted/30 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-2 text-sm font-medium text-foreground/90">
          What this chart shows (in this dataset)
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground break-words">
          {observations.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
