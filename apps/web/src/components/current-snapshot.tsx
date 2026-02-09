type CurrentSnapshotProps = {
  asOf: string;
  children: React.ReactNode;
};

export function CurrentSnapshot({ asOf, children }: CurrentSnapshotProps) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Current snapshot (as of {asOf})
      </p>
      <div className="text-sm italic text-muted-foreground/90 [&>p]:mb-1.5 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
