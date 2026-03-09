type LatestValueBannerProps = {
  label: string;
  value: number | string;
  unit?: string;
  date?: string;
  /** Optional prefix before value (e.g. "$" for currency). */
  valuePrefix?: string;
  /** When true, no bottom margin (for inline use in header row). */
  inline?: boolean;
};

export default function LatestValueBanner({ label, value, unit, date, valuePrefix = "", inline = false }: LatestValueBannerProps) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;

  const displayValue =
    typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : String(value);

  return (
    <div className={`text-right text-sm text-muted-foreground shrink-0 whitespace-nowrap ${inline ? "" : "mb-2"}`}>
      Latest {label}: <strong>{valuePrefix}{displayValue}</strong>
      {unit ? ` ${unit}` : ""}
      {date ? ` (${date})` : ""}
    </div>
  );
}
