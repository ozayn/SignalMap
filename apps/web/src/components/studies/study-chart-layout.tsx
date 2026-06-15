import { cn } from "@/lib/utils";

type LayoutClassName = { className?: string };

/** Side-by-side pair on lg+; single column on mobile. */
export function StudyChartGrid({ children, className }: React.PropsWithChildren<LayoutClassName>) {
  return <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2", className)}>{children}</div>;
}

/** Vertical stack of chart blocks within a section. */
export function StudyChartRow({ children, className }: React.PropsWithChildren<LayoutClassName>) {
  return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
}

/** Full-width chart block with optional subtitle. */
export function StudyChartFull({
  children,
  title,
  className,
}: React.PropsWithChildren<LayoutClassName & { title?: React.ReactNode }>) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : null}
      {children}
    </div>
  );
}

/** One cell in a comparison grid or stacked group. */
export function StudyChartCell({
  children,
  title,
  className,
}: React.PropsWithChildren<LayoutClassName & { title?: React.ReactNode }>) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : null}
      {children}
    </div>
  );
}

/**
 * Related charts side-by-side when x-domains align; otherwise stacked full-width.
 * Pass `paired={Boolean(sharedTimeRange)}` from sharedSectionTimeRange().
 */
export function StudyComparisonGroup({
  children,
  paired,
  className,
}: React.PropsWithChildren<LayoutClassName & { paired: boolean }>) {
  if (paired) {
    return <StudyChartGrid className={className}>{children}</StudyChartGrid>;
  }
  return <StudyChartRow className={className}>{children}</StudyChartRow>;
}
