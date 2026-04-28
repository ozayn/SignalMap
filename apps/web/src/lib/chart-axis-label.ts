/**
 * Typography and spacing for ECharts y-axis **names** (titles), distinct from tick labels.
 * Used for on-screen charts and PNG export (same `setOption` path).
 */
/** Slightly larger than tick labels for hierarchy on screen and PNG export. */
export const CHART_Y_AXIS_NAME_FONT_SIZE = 16;
export const CHART_Y_AXIS_TICK_FONT_SIZE = 13;
/**
 * Distance from axis line to the axis name (ECharts `nameGap`).
 * Slightly generous so y-axis titles clear tick labels and the plot when using `nameLocation: "middle"`.
 */
export const CHART_Y_AXIS_NAME_GAP = 44;
/** Extra vertical gap per wrapped line (beyond the first) so multiline titles don’t collide with ticks. */
export const CHART_Y_AXIS_NAME_GAP_PER_EXTRA_LINE = 20;
/** Extra space between tick numerals and the axis line / neighbor content (`axisLabel.margin`). */
export const CHART_Y_AXIS_LABEL_MARGIN = 16;

/** Prefer keeping one line under this length (Latin / mixed; FA lines may still wrap visually). */
export const CHART_Y_AXIS_NAME_TARGET_LINE_CHARS = 36;

export const chartYAxisNameTextStyle = (color: string) =>
  ({
    color,
    fontSize: CHART_Y_AXIS_NAME_FONT_SIZE,
    fontWeight: 500 as const,
    align: "center" as const,
    lineHeight: 22,
    /** Keeps rotated titles from sitting flush against the chart edge. */
    padding: [4, 6, 4, 6] as [number, number, number, number],
  }) satisfies {
    color: string;
    fontSize: number;
    fontWeight: 500;
    align: "center";
    lineHeight: number;
    padding: [number, number, number, number];
  };

/** Increase `nameGap` when the axis title uses explicit newlines so ECharts leaves room for wrapped text. */
export function yAxisNameGapForMultilineTitle(formattedName: string): number {
  const lines = formattedName.split("\n").filter((s) => s.length > 0).length;
  return CHART_Y_AXIS_NAME_GAP + Math.max(0, lines - 1) * CHART_Y_AXIS_NAME_GAP_PER_EXTRA_LINE;
}

/**
 * Greedy wrap by spaces to a max width (characters). Does not break words unless a single word exceeds max.
 */
function greedyWrapWords(line: string, maxChars: number): string[] {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: string[] = [];
  let cur = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    const next = `${cur} ${w}`;
    if (next.length <= maxChars) cur = next;
    else {
      out.push(cur);
      cur = w;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Pack semantic chunks (already split on `;`, etc.) into lines ≤ maxChars where possible.
 */
function packChunksToLines(chunks: string[], maxChars: number): string[] {
  const lines: string[] = [];
  for (const chunk of chunks) {
    const c = chunk.trim();
    if (!c) continue;
    if (c.length <= maxChars) {
      if (lines.length === 0 || lines[lines.length - 1]!.length + c.length + 2 > maxChars) {
        lines.push(c);
      } else {
        lines[lines.length - 1] = `${lines[lines.length - 1]!}; ${c}`;
      }
      continue;
    }
    lines.push(...greedyWrapWords(c, maxChars));
  }
  return lines.filter(Boolean);
}

function splitOnSemanticDelimiters(text: string): string[] | null {
  const t = text.trim();
  // Strong breaks: semicolon (EN/FA), em/en dash sections
  if (/[;؛]/.test(t)) {
    const parts = t.split(/\s*[;؛]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  if (/\s[—–]\s/.test(t)) {
    const parts = t.split(/\s+[—–]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  return null;
}

/**
 * Splits titles across lines for rotated y-axes: prefers semantic breaks (`;`, `—`),
 * then `Metric (unit)`, then greedy word wrap. Keeps short titles on one line.
 */
export function formatYAxisNameMultiline(raw: string): string {
  const t = raw.trim();
  if (!t) return t;

  const maxLen = CHART_Y_AXIS_NAME_TARGET_LINE_CHARS;

  if (t.length <= maxLen) {
    return splitShortWithParen(t);
  }

  const semantic = splitOnSemanticDelimiters(t);
  if (semantic && semantic.length >= 2) {
    const packed = packChunksToLines(semantic, maxLen);
    return packed.slice(0, 5).join("\n");
  }

  const parenSplit = splitLeadRestParen(t);
  if (parenSplit) {
    const { lead, tail } = parenSplit;
    const block = `${lead}\n${tail}`;
    if (block.length <= maxLen * 2 + 1 && tail.length <= maxLen + 8) {
      return block;
    }
    const lines = [`${lead}`, tail.length <= maxLen ? tail : greedyWrapWords(tail, maxLen).join("\n")];
    return lines.flatMap((x) => x.split("\n")).slice(0, 5).join("\n");
  }

  return greedyWrapWords(t, maxLen)
    .slice(0, 5)
    .join("\n");
}

/** `Metric (tail)` → two lines when tail is non-empty and total string is long enough. */
function splitLeadRestParen(t: string): { lead: string; tail: string } | null {
  const idx = t.indexOf(" (");
  if (idx <= 0) return null;
  const lead = t.slice(0, idx).trimEnd();
  const tail = t.slice(idx).trim();
  if (!lead || !tail) return null;
  return { lead, tail };
}

/** Legacy: split first ` (` only when moderately long. */
function splitShortWithParen(t: string): string {
  const idx = t.indexOf(" (");
  if (idx <= 0) return t;
  const lead = t.slice(0, idx).trimEnd();
  const tail = t.slice(idx).trim();
  if (!lead || !tail) return t;
  if (t.length < 26) return t;
  return `${lead}\n${tail}`;
}
