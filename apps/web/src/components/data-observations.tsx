type DataObservationsProps = {
  observations: string[];
  locale?: "en" | "fa";
};

export function DataObservations({ observations, locale = "en" }: DataObservationsProps) {
  if (observations.length === 0) return null;
  const isFa = locale === "fa";
  const summary = isFa ? "آنچه این نمودار در این مجموعه‌داده نشان می‌دهد" : "What this chart shows (in this dataset)";
  return (
    <details className="study-interpretation">
      <summary>
        <span>{summary}</span>
        <span className="study-interpretation-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="study-interpretation-body">
        <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground break-words">
          {observations.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
