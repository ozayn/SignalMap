type CurrentSnapshotProps = {
  asOf: string;
  children: React.ReactNode;
  locale?: "en" | "fa";
};

export function CurrentSnapshot({ asOf, children, locale = "en" }: CurrentSnapshotProps) {
  const isFa = locale === "fa";
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-2.5 min-w-0 overflow-hidden">
      <p className="mb-2 snapshot-style-title">
        {isFa ? `تصویر وضعیت فعلی (تا ${asOf})` : `Current snapshot (as of ${asOf})`}
      </p>
      <div className="text-sm italic text-muted-foreground/90 break-words [&>p]:mb-1.5 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
