"use client";

import type { ChartAxisYearMode } from "@/lib/chart-axis-year";
import { L } from "@/lib/iran-study-fa";

type Props = {
  value: ChartAxisYearMode;
  onChange: (next: ChartAxisYearMode) => void;
  isFa: boolean;
  size?: "default" | "compact";
  className?: string;
};

export function StudyYearDisplayToggle({ value, onChange, isFa, size = "default", className }: Props) {
  const modes: ReadonlyArray<[ChartAxisYearMode, string, string, string]> = [
    ["gregorian", "Gregorian", "میلادی", "Gregorian"],
    ["jalali", "Iranian", "هجری شمسی", "Iranian (SH)"],
    ["both", "Both", "هر دو", "Both"],
  ];

  const outer =
    size === "compact"
      ? "inline-flex rounded-md border border-border p-0.5 bg-muted/30"
      : "inline-flex rounded-md border border-border overflow-hidden";

  return (
    <div className={[outer, className].filter(Boolean).join(" ")}>
      {modes.map(([mode, enDefault, faLabel, enCompact]) => {
        const label = size === "compact" ? L(isFa, enCompact, faLabel) : L(isFa, enDefault, faLabel);
        const selected = value === mode;
        const cls =
          size === "compact"
            ? `rounded px-2 py-0.5 text-[11px] ${
                selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`
            : `px-2.5 py-1.5 font-medium transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted/60"
              }`;
        return (
          <button key={mode} type="button" onClick={() => onChange(mode)} className={cls}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
