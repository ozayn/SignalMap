"use client";

type MonetaryDisplayMode = "nominal" | "real";

export type NominalRealToggleProps = {
  mode: MonetaryDisplayMode;
  onChange: (mode: MonetaryDisplayMode) => void;
  /** FA layout: parent should set `dir="rtl"` on a wrapper when true. */
  isFa?: boolean;
  className?: string;
};

/**
 * Segmented control: nominal vs US-CPI–deflated “real” USD (base year fixed in app logic).
 */
export function NominalRealToggle({ mode, onChange, isFa, className }: NominalRealToggleProps) {
  const nominal = isFa ? "اسمی" : "Nominal";
  const real = isFa ? "واقعی (تعدیل‌شده با تورم)" : "Real (inflation-adjusted)";
  return (
    <div className={`inline-flex overflow-hidden rounded-md border border-border ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onChange("nominal")}
        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
          mode === "nominal"
            ? "bg-primary text-primary-foreground"
            : "bg-transparent text-muted-foreground hover:bg-muted/60"
        }`}
      >
        {nominal}
      </button>
      <button
        type="button"
        onClick={() => onChange("real")}
        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
          mode === "real"
            ? "bg-primary text-primary-foreground"
            : "bg-transparent text-muted-foreground hover:bg-muted/60"
        }`}
      >
        {real}
      </button>
    </div>
  );
}
