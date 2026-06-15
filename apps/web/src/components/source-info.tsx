import { SourceTextWithLinks } from "@/components/chart-source-footer";

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
    <details className="study-interpretation">
      <summary>
        <span>{title}</span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body">
        <div className="grid gap-4 sm:grid-cols-2 min-w-0">
          {items.map((item) => {
            const linkContext = [item.sourceDetail, item.sourceName].filter(Boolean).join(" ");
            return (
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
                {item.sourceDetail ? (
                  <span className="text-muted-foreground/90">
                    {" "}
                    (<SourceTextWithLinks text={item.sourceDetail} contextText={linkContext} />)
                  </span>
                ) : null}
              </p>
              {item.unitLabel ? (
                <p className="text-sm text-muted-foreground">
                  <span className="snapshot-style-title">Unit</span>:{" "}
                  <SourceTextWithLinks text={item.unitLabel} contextText={linkContext} />
                  {item.unitNote ? (
                    <span className="text-muted-foreground/80">
                      {" "}
                      — <SourceTextWithLinks text={item.unitNote} contextText={linkContext} />
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            );
          })}
        </div>
        {note ? (
          <p className="mt-3 text-xs text-muted-foreground/80 break-words">
            <SourceTextWithLinks text={note} />
          </p>
        ) : null}
      </div>
    </details>
  );
}
