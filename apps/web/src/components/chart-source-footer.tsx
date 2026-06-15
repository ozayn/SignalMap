"use client";

import { useMemo } from "react";
import { localizeChartNumericDisplayStringSafe } from "@/lib/chart-numerals-fa";
import { STUDY_CHART_SOURCE_WRAP_CLASS } from "@/lib/chart-study-typography";
import { linkifySourceFooter, SOURCE_FOOTER_LINK_CLASS } from "@/lib/source-footer-links";

type ChartSourceFooterProps = {
  line: string;
  className?: string;
  locale?: "en" | "fa";
};

/** Live chart source line with clickable FRED / WDI codes. Export PNG uses plain text separately. */
export function ChartSourceFooter({
  line,
  className = STUDY_CHART_SOURCE_WRAP_CLASS,
  locale = "en",
}: ChartSourceFooterProps) {
  const segments = useMemo(() => linkifySourceFooter(line), [line]);
  const numeralLocale = locale === "fa" ? "fa" : "en";

  return (
    <p className={className} dir="ltr">
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={`${seg.href}-${i}`}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className={SOURCE_FOOTER_LINK_CLASS}
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{localizeChartNumericDisplayStringSafe(seg.text, numeralLocale)}</span>
        )
      )}
    </p>
  );
}

type SourceTextWithLinksProps = {
  text: string;
  className?: string;
  /** Optional sibling copy (e.g. sourceDetail) used to resolve country ISO3 for WDI links. */
  contextText?: string;
};

/** Inline source / unit text with the same FRED / WDI link rules (e.g. Sources & units). */
export function SourceTextWithLinks({ text, className, contextText }: SourceTextWithLinksProps) {
  const segments = useMemo(() => linkifySourceFooter(text, contextText), [text, contextText]);

  if (segments.length === 0) return null;

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={`${seg.href}-${i}`}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className={SOURCE_FOOTER_LINK_CLASS}
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
