import { Card, CardContent } from "@/components/ui/card";

export type SourceInfoItem = {
  label: string;
  sourceName: string;
  /** Optional URL for the source (opens in new tab). */
  sourceUrl?: string;
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
    <Card className="mt-3 border-border bg-muted/30 overflow-hidden">
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 min-w-0">
          {items.map((item) => (
            <div key={item.label} className="space-y-0.5 min-w-0 break-words">
              <p className="text-sm font-medium text-foreground/90">{item.label}</p>
              <p className="text-sm text-muted-foreground">
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    {item.sourceName}
                  </a>
                ) : (
                  item.sourceName
                )}
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
          <p className="mt-3 text-xs text-muted-foreground/80 break-words">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}
