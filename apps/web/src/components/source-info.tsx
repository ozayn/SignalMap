import { Card, CardContent } from "@/components/ui/card";

export type SourceInfoItem = {
  label: string;
  sourceName: string;
  sourceDetail?: string;
  unitLabel?: string;
  unitNote?: string;
};

type SourceInfoProps = {
  title?: string;
  items: SourceInfoItem[];
  note?: string;
};

export function SourceInfo({
  title = "Sources & units",
  items,
  note,
}: SourceInfoProps) {
  return (
    <Card className="mt-3 border-border bg-muted/30">
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <p className="text-sm font-medium text-foreground/90">{item.label}</p>
              <p className="text-sm text-muted-foreground">
                {item.sourceName}
                {item.sourceDetail && (
                  <span className="text-muted-foreground/90"> ({item.sourceDetail})</span>
                )}
              </p>
              {item.unitLabel && (
                <p className="text-xs text-muted-foreground">
                  Unit: {item.unitLabel}
                  {item.unitNote && (
                    <span className="text-muted-foreground/80"> — {item.unitNote}</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
        {note && (
          <p className="mt-3 text-xs text-muted-foreground/80">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}
