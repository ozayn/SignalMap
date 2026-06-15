"use client";

type Point = { date: string; value: number };

export type DirectionMeaning = "higher_better" | "lower_better";

export type ChartDirectionMeta = {
  directionMeaning: DirectionMeaning;
  directionPill: string;
};

/** Clear direction cues for US Living Standards affordability/outcome charts. */
export const US_LS_CHART_DIRECTION = {
  medianIncome: {
    directionMeaning: "higher_better",
    directionPill: "↑ Higher = generally better",
  },
  priceToIncome: {
    directionMeaning: "lower_better",
    directionPill: "↓ Lower = more affordable",
  },
  hoursOfWork: {
    directionMeaning: "lower_better",
    directionPill: "↓ Lower = more affordable",
  },
} as const satisfies Record<string, ChartDirectionMeta>;

/** Interpretive questions for charts without a single directional reading. */
export const US_LS_CHART_PROMPTS = {
  productivityCompensation: "Are productivity gains translating into worker compensation?",
  healthSpending: "Is higher spending associated with better outcomes?",
} as const;

const CUE_TOOLTIP = "Interpretive aids, not causal claims.";

export function computeTrendSummary(
  points: Point[],
  meaning: DirectionMeaning
): string | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]!.value;
  const last = sorted[sorted.length - 1]!.value;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === last) return null;

  if (meaning === "lower_better") {
    return last < first
      ? "Over selected range: more affordable"
      : "Over selected range: less affordable";
  }
  return last > first ? "Over selected range: improved" : "Over selected range: declined";
}

type ChartDirectionCueProps = {
  meta: ChartDirectionMeta;
  points?: Point[];
  className?: string;
};

export function ChartDirectionCue({ meta, points, className = "" }: ChartDirectionCueProps) {
  const trend = points ? computeTrendSummary(points, meta.directionMeaning) : null;
  const wrapClass = className ? ` ${className}` : "";

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1${wrapClass}`}>
      <span
        title={CUE_TOOLTIP}
        className="inline-flex rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] leading-snug text-muted-foreground"
      >
        {meta.directionPill}
      </span>
      {trend ? <span className="text-[11px] text-muted-foreground">{trend}</span> : null}
    </div>
  );
}

type ChartInterpretivePromptProps = {
  question: string;
  className?: string;
};

export function ChartInterpretivePrompt({ question, className = "" }: ChartInterpretivePromptProps) {
  const wrapClass = className ? ` ${className}` : "";

  return (
    <p className={`text-[11px] leading-snug text-muted-foreground${wrapClass}`}>
      <span
        title={CUE_TOOLTIP}
        className="inline-flex rounded-full border border-border/60 bg-muted/30 px-2 py-0.5"
      >
        Question: {question}
      </span>
    </p>
  );
}
