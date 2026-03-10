"use client";

import { useMemo, useState } from "react";

export type DiscoursePoint = { x: number; y: number; text: string } | [number, number, number];

function getPointCoords(p: DiscoursePoint): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };
}

function DiscourseScatter({
  points,
  discourseComments,
  w,
  h,
  xLabel,
  yLabel,
}: {
  points: DiscoursePoint[];
  discourseComments?: string[];
  w: number;
  h: number;
  xLabel: string;
  yLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pad = 24;
  const xs = points.map((p) => getPointCoords(p).x);
  const ys = points.map((p) => getPointCoords(p).y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (v: number) => pad + ((v - minX) / rangeX) * (w - 2 * pad);
  const scaleY = (v: number) => h - pad - ((v - minY) / rangeY) * (h - 2 * pad);

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
      <svg width={w} height={h} className="absolute inset-0">
        {points.map((p, i) => {
          const { x, y } = getPointCoords(p);
          return (
            <circle
              key={i}
              cx={scaleX(x)}
              cy={scaleY(y)}
              r={hovered === i ? 6 : 3}
              style={{ opacity: 0.7 }}
              className="fill-primary/60 hover:fill-primary cursor-pointer transition-all duration-150"
            />
          );
        })}
        <text x={w / 2} y={h - 6} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }}>
          {xLabel}
        </text>
        <text x={14} y={h / 2} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }} transform={`rotate(-90, 14, ${h / 2})`}>
          {yLabel}
        </text>
      </svg>
      <DiscourseScatterTooltip
        points={points}
        discourseComments={discourseComments}
        w={w}
        h={h}
        scaleX={scaleX}
        scaleY={scaleY}
        hovered={hovered}
        setHovered={setHovered}
        pos={pos}
        setPos={setPos}
      />
    </div>
  );
}

function DiscourseScatterTooltip({
  points,
  discourseComments,
  w,
  h,
  scaleX,
  scaleY,
  hovered,
  setHovered,
  pos,
  setPos,
}: {
  points: DiscoursePoint[];
  discourseComments?: string[];
  w: number;
  h: number;
  scaleX: (v: number) => number;
  scaleY: (v: number) => number;
  hovered: number | null;
  setHovered: (v: number | null) => void;
  pos: { x: number; y: number };
  setPos: (v: { x: number; y: number }) => void;
}) {
  return (
    <>
      <div
        className="absolute inset-0"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          let nearest = -1;
          let best = Infinity;
          for (let i = 0; i < points.length; i++) {
            const { x, y } = getPointCoords(points[i]!);
            const cx = scaleX(x);
            const cy = scaleY(y);
            const d = (mx - cx) ** 2 + (my - cy) ** 2;
            if (d < best && d < 400) {
              best = d;
              nearest = i;
            }
          }
          setHovered(nearest >= 0 ? nearest : null);
          setPos({ x: mx, y: my });
        }}
        onMouseLeave={() => setHovered(null)}
      />
      {hovered !== null && points[hovered] && (
        <div
          className="absolute z-10 text-xs"
          style={{
            left: Math.min(pos.x, w - 270),
            top: Math.min(pos.y, h - 100),
            transform: "translate(12px, -12px)",
            background: "white",
            border: "1px solid #ddd",
            padding: 8,
            borderRadius: 6,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            maxWidth: 260,
            pointerEvents: "none",
          }}
        >
          <p className="text-muted-foreground line-clamp-3" dir="rtl">
            {(() => {
              const p = points[hovered]!;
              const comment = Array.isArray(p) && discourseComments ? discourseComments[p[2]] : null;
              return comment ?? (typeof p === "object" && "text" in p ? p.text : null) ?? "(no text)";
            })()}
          </p>
        </div>
      )}
    </>
  );
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 300;

// Lightweight k-means (k=4) on 2D points
function kMeansClusters(
  points: Array<{ x: number; y: number; idx?: number }>,
  k: number,
  maxIter = 20
): number[] {
  const n = points.length;
  if (n === 0) return [];
  const assignments = new Array<number>(n).fill(0);
  const centroids: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < k; i++) {
    const j = Math.floor((i / k) * n);
    centroids.push({ x: points[j]!.x, y: points[j]!.y });
  }
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (p.x - centroids[c]!.x) ** 2 + (p.y - centroids[c]!.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed) break;
    const sums = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < n; i++) {
      const c = assignments[i]!;
      sums[c]!.x += points[i]!.x;
      sums[c]!.y += points[i]!.y;
      sums[c]!.n += 1;
    }
    for (let c = 0; c < k; c++) {
      const s = sums[c]!;
      if (s.n > 0) {
        centroids[c]!.x = s.x / s.n;
        centroids[c]!.y = s.y / s.n;
      }
    }
  }
  return assignments;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0590-\u05ff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function getNgrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

// Persian + English stopwords for comment analysis
const STOPWORDS = new Set([
  "و", "در", "به", "از", "که", "این", "را", "با", "است", "برای", "آن", "یک", "خود", "تا", "کند", "بر", "هم", "یا", "بود", "شد", "هر", "ما", "شود", "او", "آنها", "اگر", "نه", "همه", "دو", "هست", "من", "چه", "همین", "همان", "ای", "هم", "و", "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can",
]);

function filterStopwords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t));
}

const MAX_LABEL_LENGTH = 20;

function computeClusterLabel(comments: string[]): string {
  const wordCounts = new Map<string, number>();
  const bigramCounts = new Map<string, number>();
  const trigramCounts = new Map<string, number>();

  for (const c of comments) {
    if (typeof c !== "string") continue;
    const tokens = filterStopwords(tokenize(c));
    for (const w of tokens) {
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
    for (const bg of getNgrams(tokens, 2)) {
      bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
    }
    for (const tg of getNgrams(tokens, 3)) {
      trigramCounts.set(tg, (trigramCounts.get(tg) ?? 0) + 1);
    }
  }

  const pickBest = (map: Map<string, number>): string => {
    let best = "";
    let bestCount = 0;
    for (const [phrase, cnt] of map) {
      if (cnt > bestCount && phrase.length > 1) {
        bestCount = cnt;
        best = phrase;
      }
    }
    return best;
  };

  const trigram = pickBest(trigramCounts);
  if (trigram && trigram.length <= MAX_LABEL_LENGTH) return trigram;
  const bigram = pickBest(bigramCounts);
  if (bigram && bigram.length <= MAX_LABEL_LENGTH) return bigram;
  const word = pickBest(wordCounts);
  if (word) return word.length > MAX_LABEL_LENGTH ? word.slice(0, MAX_LABEL_LENGTH) : word;
  return "(cluster)";
}

function cleanLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label;
  return label.slice(0, MAX_LABEL_LENGTH);
}

// Grid-based density contours (lightweight, no d3-contour)
function computeContourPaths(
  points: Array<{ x: number; y: number }>,
  gridSize: number,
  thresholdRatio: number
): string[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const grid: number[][] = Array.from({ length: gridSize + 2 }, () =>
    Array(gridSize + 2).fill(0)
  );
  const sigma = 0.15;
  for (const p of points) {
    const gx = ((p.x - minX) / rangeX) * gridSize + 1;
    const gy = ((p.y - minY) / rangeY) * gridSize + 1;
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        const i = Math.round(gx) + di;
        const j = Math.round(gy) + dj;
        if (i >= 0 && i <= gridSize + 1 && j >= 0 && j <= gridSize + 1) {
          const dx = (gx - i) / gridSize;
          const dy = (gy - j) / gridSize;
          grid[j]![i]! += Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        }
      }
    }
  }
  const maxD = Math.max(...grid.flat());
  const thresh = maxD * thresholdRatio;
  const above = grid.map((row, j) =>
    row.map((v, i) => (v >= thresh ? 1 : 0))
  );
  const cellW = rangeX / gridSize;
  const cellH = rangeY / gridSize;
  const key = (i: number, j: number) => `${i},${j}`;
  const paths: string[] = [];
  const seen = new Set<string>();
  for (let j = 1; j <= gridSize; j++) {
    for (let i = 1; i <= gridSize; i++) {
      if (above[j]![i]! === 0) continue;
      const k = key(i, j);
      if (seen.has(k)) continue;
      const stack: [number, number][] = [[i, j]];
      const region: [number, number][] = [];
      while (stack.length > 0) {
        const [ci, cj] = stack.pop()!;
        if (ci < 1 || ci > gridSize || cj < 1 || cj > gridSize) continue;
        if (above[cj]![ci]! === 0) continue;
        const ck = key(ci, cj);
        if (seen.has(ck)) continue;
        seen.add(ck);
        region.push([ci, cj]);
        stack.push([ci + 1, cj], [ci - 1, cj], [ci, cj + 1], [ci, cj - 1]);
      }
      if (region.length === 0) continue;
      const boundaryEdges: Array<[string, string]> = [];
      const regionSet = new Set(region.map(([a, b]) => key(a, b)));
      for (const [ci, cj] of region) {
        if (!regionSet.has(key(ci - 1, cj))) {
          boundaryEdges.push([
            `${(minX + (ci - 1) * cellW).toFixed(4)},${(minY + (cj - 1) * cellH).toFixed(4)}`,
            `${(minX + (ci - 1) * cellW).toFixed(4)},${(minY + cj * cellH).toFixed(4)}`,
          ]);
        }
        if (!regionSet.has(key(ci + 1, cj))) {
          boundaryEdges.push([
            `${(minX + ci * cellW).toFixed(4)},${(minY + cj * cellH).toFixed(4)}`,
            `${(minX + ci * cellW).toFixed(4)},${(minY + (cj - 1) * cellH).toFixed(4)}`,
          ]);
        }
        if (!regionSet.has(key(ci, cj - 1))) {
          boundaryEdges.push([
            `${(minX + (ci - 1) * cellW).toFixed(4)},${(minY + (cj - 1) * cellH).toFixed(4)}`,
            `${(minX + ci * cellW).toFixed(4)},${(minY + (cj - 1) * cellH).toFixed(4)}`,
          ]);
        }
        if (!regionSet.has(key(ci, cj + 1))) {
          boundaryEdges.push([
            `${(minX + ci * cellW).toFixed(4)},${(minY + cj * cellH).toFixed(4)}`,
            `${(minX + (ci - 1) * cellW).toFixed(4)},${(minY + cj * cellH).toFixed(4)}`,
          ]);
        }
      }
      const edgeMap = new Map<string, string[]>();
      for (const [a, b] of boundaryEdges) {
        if (!edgeMap.has(a)) edgeMap.set(a, []);
        edgeMap.get(a)!.push(b);
        if (!edgeMap.has(b)) edgeMap.set(b, []);
        edgeMap.get(b)!.push(a);
      }
      let start = "";
      for (const [s] of edgeMap) {
        start = s;
        break;
      }
      if (!start) continue;
      const poly: string[] = [];
      let cur = start;
      let prev = "";
      do {
        poly.push(cur);
        const nexts = edgeMap.get(cur)!.filter((n) => n !== prev);
        prev = cur;
        cur = nexts[0] ?? cur;
      } while (cur !== start && poly.length < 500);
      if (poly.length > 2) {
        paths.push(
          "M " + poly.map((p) => p.replace(",", " ")).join(" L ") + " Z"
        );
      }
    }
  }
  return paths;
}

function UmapDensityContours({
  points,
  discourseComments,
  clusterLabels,
  w,
  h,
}: {
  points: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string }>;
  w: number;
  h: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pad = 24;
  if (points.length === 0) return null;
  const coords = points.map((p, i) => {
    const { x, y } = getPointCoords(p);
    const idx = Array.isArray(p) ? p[2] : undefined;
    return { x, y, idx: idx ?? i };
  });
  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (v: number) => pad + ((v - minX) / rangeX) * (w - 2 * pad);
  const scaleY = (v: number) => h - pad - ((v - minY) / rangeY) * (h - 2 * pad);

  const pointsKey = points.map((p) => {
    const { x, y } = getPointCoords(p);
    return `${x},${y}`;
  }).join("|");
  const useApiLabels = clusterLabels && clusterLabels.length > 0;
  const { clusters, labels, contourPaths } = useMemo(() => {
    const contourPaths = computeContourPaths(
      coords.map((c) => ({ x: c.x, y: c.y })),
      40,
      0.25
    );
    if (useApiLabels) {
      return { clusters: [] as number[], labels: [] as string[], contourPaths };
    }
    try {
      const pts = coords.map((c) => ({ x: c.x, y: c.y, idx: c.idx }));
      const assignments = kMeansClusters(pts, 4);
      const commentsRef = discourseComments ?? [];
      const labels: string[] = [];
      for (let c = 0; c < 4; c++) {
        const indices = pts
          .map((p, i) => (assignments[i] === c ? p.idx : -1))
          .filter((i) => i >= 0);
        const comments = indices
          .filter((i) => i >= 0 && i < commentsRef.length)
          .map((i) => commentsRef[i])
          .filter((c): c is string => typeof c === "string");
        labels.push(cleanLabel(computeClusterLabel(comments)));
      }
      return { clusters: assignments, labels, contourPaths };
    } catch {
      return { clusters: [] as number[], labels: [] as string[], contourPaths };
    }
  }, [pointsKey, useApiLabels, discourseComments]);

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
      <svg width={w} height={h} className="absolute inset-0">
        {/* 1. Contours */}
        <g transform={`translate(${pad},${pad}) scale(${(w - 2 * pad) / rangeX},${-(h - 2 * pad) / rangeY}) translate(${-minX},${-minY})`}>
          {contourPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="lightblue"
              fillOpacity={0.15}
              stroke="none"
            />
          ))}
        </g>
        {/* 2. Scatter points */}
        {points.map((p, i) => {
          const { x, y } = getPointCoords(p);
          return (
            <circle
              key={i}
              cx={scaleX(x)}
              cy={scaleY(y)}
              r={hovered === i ? 6 : 3}
              style={{ opacity: 0.7 }}
              className="fill-primary/60 hover:fill-primary cursor-pointer transition-all duration-150"
            />
          );
        })}
        {/* 3. Cluster labels */}
        {useApiLabels
          ? (clusterLabels ?? []).map((cl, i) => (
              <g key={i} transform={`translate(${scaleX(cl.x)},${scaleY(cl.y)})`}>
                <rect
                  x={-60}
                  y={-8}
                  width={120}
                  height={16}
                  rx={4}
                  fill="white"
                  fillOpacity={0.9}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "#333",
                    opacity: 0.9,
                  }}
                >
                  {cl.label}
                </text>
              </g>
            ))
          : [0, 1, 2, 3].map((c) => {
              const members = coords.filter((_, i) => clusters[i] === c);
              if (members.length === 0) return null;
              const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
              const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
              return (
                <g key={c} transform={`translate(${scaleX(cx)},${scaleY(cy)})`}>
                  <rect
                    x={-60}
                    y={-8}
                    width={120}
                    height={16}
                    rx={4}
                    fill="white"
                    fillOpacity={0.9}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      fill: "#333",
                      opacity: 0.9,
                    }}
                  >
                    {labels[c]}
                  </text>
                </g>
              );
            })}
        <text x={w / 2} y={h - 6} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }}>
          UMAP dimension 1
        </text>
        <text x={14} y={h / 2} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }} transform={`rotate(-90, 14, ${h / 2})`}>
          UMAP dimension 2
        </text>
      </svg>
      <DiscourseScatterTooltip
        points={points}
        discourseComments={discourseComments}
        w={w}
        h={h}
        scaleX={scaleX}
        scaleY={scaleY}
        hovered={hovered}
        setHovered={setHovered}
        pos={pos}
        setPos={setPos}
      />
    </div>
  );
}

export function YoutubeDiscourseMaps({
  pointsPca,
  pointsUmap,
  discourseComments,
  clusterLabels,
}: {
  pointsPca: DiscoursePoint[];
  pointsUmap: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string }>;
}) {
  const hasPca = pointsPca.length > 0;
  const hasUmap = pointsUmap.length > 0;

  if (!hasPca && !hasUmap) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {hasPca && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Discourse map (TF-IDF + PCA)</h3>
          <p className="text-xs text-muted-foreground">
            Each point represents one comment. Points closer together share similar vocabulary.
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Axes:</span> X — Principal component 1 (largest variance direction). Y — Principal component 2.
          </p>
          <DiscourseScatter
            points={pointsPca}
            discourseComments={discourseComments}
            w={CHART_WIDTH}
            h={CHART_HEIGHT}
            xLabel="Principal component 1"
            yLabel="Principal component 2"
          />
        </div>
      )}
      {hasUmap && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Discourse map (TF-IDF + UMAP)</h3>
          <p className="text-xs text-muted-foreground">
            UMAP preserves local similarity between comments.
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Axes:</span> X — UMAP dimension 1. Y — UMAP dimension 2. Note: UMAP axes are abstract coordinates rather than interpretable variables.
          </p>
          <DiscourseScatter
            points={pointsUmap}
            discourseComments={discourseComments}
            w={CHART_WIDTH}
            h={CHART_HEIGHT}
            xLabel="UMAP dimension 1"
            yLabel="UMAP dimension 2"
          />
        </div>
      )}
      {hasUmap && (
        <div className="space-y-2 md:col-span-2">
          <h3 className="text-sm font-medium">UMAP with density contours</h3>
          <p className="text-xs text-muted-foreground">
            Density contours highlight regions of similar comments. Cluster labels show the most frequent phrase in each k-means cluster (k=4).
          </p>
          <UmapDensityContours
            points={pointsUmap}
            discourseComments={discourseComments}
            clusterLabels={clusterLabels}
            w={CHART_WIDTH}
            h={CHART_HEIGHT}
          />
        </div>
      )}
    </div>
  );
}
