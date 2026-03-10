"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DiscoursePoint = { x: number; y: number; text: string } | [number, number, number];

function getPointCoords(p: DiscoursePoint): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };
}

type LabelWithLayout = { x: number; y: number; label: string; cluster_id?: number; displayX: number; displayY: number };

function countPointsInCorner(
  scaledPoints: Array<{ x: number; y: number }>,
  corner: "tl" | "tr" | "bl" | "br",
  w: number,
  h: number,
  pad: number
): number {
  const cx = w / 2;
  const cy = h / 2;
  return scaledPoints.filter((p) => {
    if (corner === "tl") return p.x < cx && p.y < cy;
    if (corner === "tr") return p.x >= cx && p.y < cy;
    if (corner === "bl") return p.x < cx && p.y >= cy;
    return p.x >= cx && p.y >= cy;
  }).length;
}

function layoutLabelsInCorner(
  labels: Array<{ x: number; y: number; label: string; cluster_id?: number }>,
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
  w: number,
  h: number,
  pad: number,
  scaledPoints: Array<{ x: number; y: number }>,
  boxPad = 6
): LabelWithLayout[] {
  if (labels.length === 0) return [];
  const boxH = 22;
  const gap = 6;
  const cornerMargin = 8;
  const corners: Array<"tl" | "tr" | "bl" | "br"> = ["tl", "tr", "bl", "br"];
  const counts = corners.map((c) => countPointsInCorner(scaledPoints, c, w, h, pad));
  const corner = corners[counts.indexOf(Math.min(...counts))]!;
  const sorted = [...labels].sort((a, b) => scaleY(a.y) - scaleY(b.y));
  const result: LabelWithLayout[] = [];
  const totalHeight = sorted.length * boxH + (sorted.length - 1) * gap;

  let startX: number;
  let startY: number;
  if (corner === "tl") {
    startX = pad + cornerMargin;
    startY = pad + 20 + cornerMargin;
  } else if (corner === "tr") {
    startX = w - pad - cornerMargin;
    startY = pad + 20 + cornerMargin;
  } else if (corner === "bl") {
    startX = pad + cornerMargin;
    startY = h - pad - totalHeight - cornerMargin;
  } else {
    startX = w - pad - cornerMargin;
    startY = h - pad - totalHeight - cornerMargin;
  }

  sorted.forEach((cl, i) => {
    const textWidth = Math.max(40, cl.label.length * 7);
    const boxW = textWidth + boxPad * 2;
    const displayX = corner === "tl" || corner === "bl" ? startX + boxW / 2 : startX - boxW / 2;
    const displayY = startY + boxH / 2 + i * (boxH + gap);
    result.push({ ...cl, displayX, displayY });
  });
  return result;
}

function DiscourseScatter({
  points,
  discourseComments,
  clusterLabels,
  clusterAssignments,
  onPointClick,
  title,
  w,
  h,
  xLabel,
  yLabel,
  colorPalette = PALETTE_KMEANS,
}: {
  points: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterAssignments?: number[];
  onPointClick?: (pointIndex: number, clusterId: number) => void;
  title?: string;
  w: number;
  h: number;
  xLabel: string;
  yLabel: string;
  colorPalette?: string[];
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

  const opacities = useMemo(() => {
    const coords = points.map((p) => getPointCoords(p));
    const radius = Math.max(rangeX, rangeY) * 0.03;
    const densities = computeDensity(coords, radius);
    const minD = Math.min(...densities);
    const maxD = Math.max(...densities);
    const rangeD = maxD - minD || 1;
    return densities.map((d) => 0.25 + ((d - minD) / rangeD) * 0.65);
  }, [points, rangeX, rangeY]);

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const nX = 5;
    const nY = 5;
    for (let i = 1; i < nX; i++) {
      const x = pad + (i / nX) * (w - 2 * pad);
      lines.push(<line key={`v${i}`} x1={x} y1={pad} x2={x} y2={h - pad} stroke="#f0f0f0" strokeWidth={1} />);
    }
    for (let j = 1; j < nY; j++) {
      const y = pad + (j / nY) * (h - 2 * pad);
      lines.push(<line key={`h${j}`} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#f0f0f0" strokeWidth={1} />);
    }
    return lines;
  }, [w, h, pad]);

  const { effectiveLabels, assignmentsForColor } = useMemo(() => {
    const pts = points.map((p, i) => {
      const { x, y } = getPointCoords(p);
      const idx = Array.isArray(p) ? p[2] : i;
      return { x, y, idx };
    });

    if (clusterLabels && clusterLabels.length > 0) {
      const assignments =
        clusterAssignments && clusterAssignments.length >= points.length
          ? clusterAssignments
          : points.map((p) => {
              const { x, y } = getPointCoords(p);
              let best = 0;
              let bestD = Infinity;
              clusterLabels.forEach((cl, j) => {
                const d = (x - cl.x) ** 2 + (y - cl.y) ** 2;
                if (d < bestD) {
                  bestD = d;
                  best = (cl as { cluster_id?: number }).cluster_id ?? j;
                }
              });
              return best;
            });
      return { effectiveLabels: clusterLabels, assignmentsForColor: assignments };
    }

    if (points.length >= 2 && discourseComments) {
      try {
        const assignments = kMeansClusters(pts, 4);
        const commentsRef = discourseComments;
        const labels: Array<{ x: number; y: number; label: string; cluster_id: number }> = [];
        for (let c = 0; c < 4; c++) {
          const members = pts.filter((_, i) => assignments[i] === c);
          if (members.length === 0) continue;
          const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
          const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
          const comments = members
            .map((m) => m.idx)
            .filter((i) => i >= 0 && i < commentsRef.length)
            .map((i) => commentsRef[i])
            .filter((c): c is string => typeof c === "string");
          labels.push({ x: cx, y: cy, label: cleanLabel(computeClusterLabel(comments)), cluster_id: c });
        }
        return { effectiveLabels: labels, assignmentsForColor: assignments };
      } catch {
        return { effectiveLabels: [], assignmentsForColor: null };
      }
    }
    return { effectiveLabels: [], assignmentsForColor: null };
  }, [clusterLabels, clusterAssignments, points, discourseComments]);

  const scaledPoints = useMemo(
    () => points.map((p) => ({ x: scaleX(getPointCoords(p).x), y: scaleY(getPointCoords(p).y) })),
    [points, scaleX, scaleY]
  );
  const laidOutLabels = useMemo(
    () =>
      effectiveLabels && effectiveLabels.length > 0
        ? layoutLabelsInCorner(effectiveLabels, scaleX, scaleY, w, h, pad, scaledPoints)
        : [],
    [effectiveLabels, scaleX, scaleY, w, h, pad, scaledPoints]
  );

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
      <svg width={w} height={h} className="absolute inset-0">
        {laidOutLabels.length > 0 && (
          <defs>
            <filter id="scatterLabelShadow">
              <feDropShadow dx={0} dy={1} stdDeviation={1.5} floodColor="rgba(0,0,0,0.15)" />
            </filter>
          </defs>
        )}
        {title && (
          <text x={10} y={18} fontSize={11} fill="#555" style={{ fontWeight: 500 }}>
            {title}
          </text>
        )}
        <g>{gridLines}</g>
        {points.map((p, i) => {
          const { x, y } = getPointCoords(p);
          const fill =
            assignmentsForColor && i < assignmentsForColor.length
              ? getClusterColor(assignmentsForColor[i], colorPalette)
              : POINT_COLOR;
          return (
            <circle
              key={i}
              cx={scaleX(x)}
              cy={scaleY(y)}
              r={hovered === i ? 6 : POINT_RADIUS}
              fill={fill}
              style={{ opacity: hovered === i ? 1 : opacities[i] ?? 0.5 }}
              className="cursor-pointer transition-all duration-150"
            />
          );
        })}
        {laidOutLabels.map((cl, i) => {
          const textWidth = Math.max(40, cl.label.length * 7);
          const boxW = textWidth + 12;
          const boxH = 22;
          const clusterId = (cl as { cluster_id?: number }).cluster_id ?? i;
          const accentColor = getClusterColor(clusterId, colorPalette);
          return (
            <g key={i} transform={`translate(${cl.displayX},${cl.displayY})`} style={{ pointerEvents: "none" }}>
              <rect
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                rx={6}
                fill="rgba(255,255,255,0.55)"
                stroke={accentColor}
                strokeWidth={2}
                filter="url(#scatterLabelShadow)"
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: "#333" }}
              >
                {cl.label}
              </text>
            </g>
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
        clusterAssignments={assignmentsForColor ?? clusterAssignments}
        onPointClick={onPointClick}
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
  clusterAssignments,
  onPointClick,
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
  clusterAssignments?: number[];
  onPointClick?: (pointIndex: number, clusterId: number) => void;
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
        className={`absolute inset-0 ${onPointClick ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (hovered !== null && onPointClick && clusterAssignments && hovered < clusterAssignments.length) {
            const clusterId = clusterAssignments[hovered];
            if (clusterId >= 0) onPointClick(hovered, clusterId);
          }
        }}
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
            right: 12,
            top: 12,
            left: "auto",
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

const CHART_HEIGHT_PCA_UMAP = 360;
const CHART_HEIGHT_DENSITY = 420;
const CHART_WIDTH_GRID = 400;
const CHART_WIDTH_FULL = 848;

const POINT_RADIUS = 2.5;
const POINT_OPACITY = 0.55;
const POINT_COLOR = "#111";
const DENSITY_POINT_RADIUS = 3;

const PALETTE_KMEANS = ["#0284c7", "#c026d3", "#65a30d", "#ea580c", "#6366f1", "#0d9488", "#dc2626", "#9333ea"];
const PALETTE_HDBSCAN = ["#0e7490", "#a21caf", "#15803d", "#c2410c", "#4f46e5", "#0f766e", "#b91c1c", "#7e22ce"];
const PALETTE_MINILM = ["#0369a1", "#be185d", "#4d7c0f", "#d97706", "#4338ca", "#0d9488", "#e11d48", "#6d28d9"];
const NOISE_COLOR = "#94a3b8";

function getClusterColor(clusterId: number, palette: string[] = PALETTE_KMEANS): string {
  if (clusterId < 0) return NOISE_COLOR;
  return palette[clusterId % palette.length] ?? "#111";
}

function useContainerWidth(maxWidth = CHART_WIDTH_FULL) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(maxWidth);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && w > 0) setWidth(Math.min(w, maxWidth));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [maxWidth]);
  return { ref, width };
}

function computeDensity(
  points: Array<{ x: number; y: number }>,
  radius: number
): number[] {
  return points.map((p, i) => {
    let count = 0;
    for (let j = 0; j < points.length; j++) {
      const dx = p.x - points[j]!.x;
      const dy = p.y - points[j]!.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) count++;
    }
    return count;
  });
}

function DensityUmapScatter({
  points,
  discourseComments,
  clusterLabels,
  clusterAssignments,
  title,
  w,
  h,
  colorPalette = PALETTE_HDBSCAN,
}: {
  points: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterAssignments?: number[];
  title?: string;
  w: number;
  h: number;
  colorPalette?: string[];
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

  const pointsKey = coords.map((c) => `${c.x},${c.y}`).join("|");
  const radius = Math.max(rangeX, rangeY) * 0.03;
  const densities = useMemo(() => computeDensity(coords, radius), [pointsKey, radius]);
  const minD = Math.min(...densities);
  const maxD = Math.max(...densities);
  const rangeD = maxD - minD || 1;
  const densityNorm = densities.map((d) => (d - minD) / rangeD);
  const opacities = densityNorm.map((n) => 0.25 + n * 0.65);

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const nX = 5;
    const nY = 5;
    for (let i = 1; i < nX; i++) {
      const x = pad + (i / nX) * (w - 2 * pad);
      lines.push(<line key={`v${i}`} x1={x} y1={pad} x2={x} y2={h - pad} stroke="#f0f0f0" strokeWidth={1} />);
    }
    for (let j = 1; j < nY; j++) {
      const y = pad + (j / nY) * (h - 2 * pad);
      lines.push(<line key={`h${j}`} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#f0f0f0" strokeWidth={1} />);
    }
    return lines;
  }, [w, h, pad]);

  const useApiLabels = clusterLabels && clusterLabels.length > 0;
  const { clusters, labels, topClusterLabels, clientAssignments } = useMemo(() => {
    if (useApiLabels && clusterLabels) {
      const radius = Math.max(rangeX, rangeY) * 0.1;
      const withSize = clusterLabels.map((cl) => {
        const count = coords.filter((c) => {
          const dx = c.x - cl.x;
          const dy = c.y - cl.y;
          return Math.sqrt(dx * dx + dy * dy) < radius;
        }).length;
        return { ...cl, count };
      });
      const sorted = [...withSize].sort((a, b) => b.count - a.count).slice(0, 4);
      return { clusters: [] as number[], labels: [] as string[], topClusterLabels: sorted, clientAssignments: null as number[] | null };
    }
    try {
      const pts = coords.map((c) => ({ x: c.x, y: c.y, idx: c.idx }));
      const assignments = kMeansClusters(pts, 4);
      const commentsRef = discourseComments ?? [];
      const clusterData: Array<{ cx: number; cy: number; label: string; size: number; cluster_id: number }> = [];
      for (let c = 0; c < 4; c++) {
        const members = coords.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const indices = members.map((m) => m.idx);
        const comments = indices
          .filter((i) => i >= 0 && i < commentsRef.length)
          .map((i) => commentsRef[i])
          .filter((c): c is string => typeof c === "string");
        clusterData.push({ cx, cy, label: cleanLabel(computeClusterLabel(comments)), size: members.length, cluster_id: c });
      }
      const sorted = [...clusterData].sort((a, b) => b.size - a.size).slice(0, 4);
      return { clusters: assignments, labels: [] as string[], topClusterLabels: sorted, clientAssignments: assignments };
    } catch {
      return { clusters: [] as number[], labels: [] as string[], topClusterLabels: [], clientAssignments: null };
    }
  }, [pointsKey, useApiLabels, discourseComments, clusterLabels, rangeX, rangeY]);

  const assignmentsForColor = useMemo(() => {
    if (clusterAssignments && clusterAssignments.length >= points.length) {
      return clusterAssignments;
    }
    if (clusterLabels && clusterLabels.length > 0) {
      const centroids = clusterLabels.map((cl) => ({
        x: cl.x,
        y: cl.y,
        id: (cl as { cluster_id?: number }).cluster_id ?? clusterLabels.indexOf(cl),
      }));
      return points.map((p) => {
        const { x, y } = getPointCoords(p);
        let best = 0;
        let bestD = Infinity;
        centroids.forEach((c) => {
          const d = (x - c.x) ** 2 + (y - c.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c.id;
          }
        });
        return best;
      });
    }
    return clientAssignments;
  }, [clusterAssignments, clusterLabels, points, clientAssignments]);

  const densityLabelsForLayout = useMemo(() => {
    return topClusterLabels.map((cl, i) => {
      const x = "cx" in cl ? (cl as { cx: number; cy: number }).cx : (cl as { x: number; y: number }).x;
      const y = "cy" in cl ? (cl as { cx: number; cy: number }).cy : (cl as { x: number; y: number }).y;
      return { x, y, label: cl.label, cluster_id: (cl as { cluster_id?: number }).cluster_id ?? i };
    });
  }, [topClusterLabels]);

  const scaledDensityPoints = useMemo(
    () => coords.map((c) => ({ x: scaleX(c.x), y: scaleY(c.y) })),
    [coords, scaleX, scaleY]
  );
  const laidOutDensityLabels = useMemo(
    () => layoutLabelsInCorner(densityLabelsForLayout, scaleX, scaleY, w, h, pad, scaledDensityPoints),
    [densityLabelsForLayout, scaleX, scaleY, w, h, pad, scaledDensityPoints]
  );

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
      <svg width={w} height={h} className="absolute inset-0">
        <defs>
          <filter id="densityLabelShadow">
            <feDropShadow dx={0} dy={1} stdDeviation={1.5} floodColor="rgba(0,0,0,0.15)" />
          </filter>
        </defs>
        {title && (
          <text x={10} y={18} fontSize={11} fill="#555" style={{ fontWeight: 500 }}>
            {title}
          </text>
        )}
        <g>{gridLines}</g>
        {points.map((p, i) => {
          const { x, y } = getPointCoords(p);
          const fill =
            assignmentsForColor && i < assignmentsForColor.length
              ? getClusterColor(assignmentsForColor[i], colorPalette)
              : POINT_COLOR;
          return (
            <circle
              key={i}
              cx={scaleX(x)}
              cy={scaleY(y)}
              r={hovered === i ? 6 : DENSITY_POINT_RADIUS}
              fill={fill}
              style={{ opacity: hovered === i ? 1 : opacities[i] ?? 0.2 }}
              className="cursor-pointer transition-all duration-150"
            />
          );
        })}
        {laidOutDensityLabels.map((cl, i) => {
          const label = cl.label;
          const clusterId = (cl as { cluster_id?: number }).cluster_id ?? i;
          const accentColor = getClusterColor(clusterId, colorPalette);
          const padX = 6;
          const padY = 3;
          const textWidth = Math.max(40, label.length * 7);
          const boxW = textWidth + padX * 2;
          const boxH = 16 + padY * 2;
          return (
            <g key={i} transform={`translate(${cl.displayX},${cl.displayY})`} style={{ pointerEvents: "none" }}>
              <rect
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                rx={6}
                fill="rgba(255,255,255,0.55)"
                stroke={accentColor}
                strokeWidth={2}
                filter="url(#densityLabelShadow)"
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: "#333" }}
              >
                {label}
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
    .replace(/[^\w\s\u0590-\u06ff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/[0-9]/.test(w));
}

function hasDigits(phrase: string): boolean {
  return /[0-9]/.test(phrase);
}

function isMostlyAscii(phrase: string): boolean {
  const letters = phrase.replace(/[^a-zA-Z\u0600-\u06ff]/g, "");
  if (!letters) return false;
  const asciiCount = (letters.match(/[a-zA-Z]/g) ?? []).length;
  return asciiCount >= letters.length / 2;
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

  const acceptPhrase = (phrase: string): boolean =>
    !hasDigits(phrase) && !isMostlyAscii(phrase) && phrase.length >= 3;

  const pickBest = (map: Map<string, number>): string => {
    let best = "";
    let bestCount = 0;
    for (const [phrase, cnt] of map) {
      if (cnt > bestCount && phrase.length > 1 && acceptPhrase(phrase)) {
        bestCount = cnt;
        best = phrase;
      }
    }
    return best;
  };

  const trigram = pickBest(trigramCounts);
  if (trigram && trigram.length <= MAX_LABEL_LENGTH && !hasDigits(trigram)) return trigram;
  const bigram = pickBest(bigramCounts);
  if (bigram && bigram.length <= MAX_LABEL_LENGTH && !hasDigits(bigram)) return bigram;
  const word = pickBest(wordCounts);
  if (word && !hasDigits(word))
    return word.length > MAX_LABEL_LENGTH ? word.slice(0, MAX_LABEL_LENGTH) : word;
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
              style={{ opacity: 0.6 }}
              className="fill-primary/60 hover:fill-primary cursor-pointer transition-all duration-150"
            />
          );
        })}
        {/* 3. Cluster labels (offset above centroid, render above points) */}
        {useApiLabels
          ? (clusterLabels ?? []).map((cl, i) => (
              <g key={i} transform={`translate(${scaleX(cl.x)},${scaleY(cl.y) - 8})`} style={{ pointerEvents: "none" }}>
                <rect
                  x={-60}
                  y={-8}
                  width={120}
                  height={16}
                  rx={4}
                  fill="rgba(255,255,255,0.55)"
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
                <g key={c} transform={`translate(${scaleX(cx)},${scaleY(cy) - 8})`} style={{ pointerEvents: "none" }}>
                  <rect
                    x={-60}
                    y={-8}
                    width={120}
                    height={16}
                    rx={4}
                    fill="rgba(255,255,255,0.55)"
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

type ClusterStats = { clusters: number; noise_count: number; total: number };
type ModelVariant = {
  points: DiscoursePoint[];
  clusterLabels?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterAssignments?: number[];
  clusterStats?: ClusterStats;
};

function deriveClusterStats(
  points: DiscoursePoint[],
  clusterLabels?: Array<{ cluster_id?: number }>,
  clusterAssignments?: number[]
): ClusterStats {
  const total = points.length;
  if (!clusterAssignments || clusterAssignments.length < total) {
    const clusters = clusterLabels?.length ?? 0;
    return { clusters, noise_count: 0, total };
  }
  const noise_count = clusterAssignments.filter((c) => c < 0).length;
  const clusterIds = new Set(clusterAssignments.filter((c) => c >= 0));
  const clusters = clusterLabels?.length ?? clusterIds.size;
  return { clusters, noise_count, total };
}

function getEffectiveStats(variant: ModelVariant): ClusterStats | undefined {
  if (variant.points.length === 0) return undefined;
  const derived = deriveClusterStats(
    variant.points,
    variant.clusterLabels,
    variant.clusterAssignments
  );
  const api = variant.clusterStats;
  if (api && typeof api.clusters === "number" && typeof api.total === "number") {
    if (api.clusters > 0) return api;
    if (derived.clusters > 0) return derived;
  }
  return derived;
}

function ClusterPanel({
  label,
  comments,
  onClose,
}: {
  label: string;
  comments: string[];
  onClose: () => void;
}) {
  const top5 = comments.slice(0, 5);
  return (
    <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[90vw] border-l border-border bg-background shadow-lg flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h3 className="text-sm font-medium">Cluster: {label}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <p className="text-xs text-muted-foreground">Representative comments:</p>
        {top5.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments in this cluster.</p>
        ) : (
          top5.map((c, i) => (
            <p key={i} className="text-sm text-foreground border-b border-border pb-2 last:border-0" dir="rtl">
              {c || "(no text)"}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function ClusterStatsLine({ stats }: { stats: ClusterStats }) {
  const noisePct = stats.total > 0 ? Math.round((stats.noise_count / stats.total) * 100) : 0;
  return (
    <p className="text-xs text-muted-foreground">
      {stats.clusters} clusters · {noisePct}% noise · {stats.total} comments
    </p>
  );
}

export function YoutubeDiscourseMaps({
  pointsPca,
  pointsUmap,
  pointsTfidf,
  pointsHdbscan,
  pointsMinilm,
  discourseComments,
  clusterLabels,
  clusterLabelsTfidf,
  clusterLabelsHdbscan,
  clusterLabelsMinilm,
  clusterStatsTfidf,
  clusterStatsHdbscan,
  clusterStatsMinilm,
  clusterAssignmentsTfidf,
  clusterAssignmentsHdbscan,
  clusterAssignmentsMinilm,
}: {
  pointsPca?: DiscoursePoint[];
  pointsUmap?: DiscoursePoint[];
  pointsTfidf?: DiscoursePoint[];
  pointsHdbscan?: DiscoursePoint[];
  pointsMinilm?: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsTfidf?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsHdbscan?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsMinilm?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterStatsTfidf?: ClusterStats;
  clusterStatsHdbscan?: ClusterStats;
  clusterStatsMinilm?: ClusterStats;
  clusterAssignmentsTfidf?: number[];
  clusterAssignmentsHdbscan?: number[];
  clusterAssignmentsMinilm?: number[];
}) {
  const [selectedCluster, setSelectedCluster] = useState<{
    label: string;
    comments: string[];
  } | null>(null);

  const tfidf: ModelVariant = {
    points: pointsTfidf ?? pointsUmap ?? [],
    clusterLabels: clusterLabelsTfidf ?? clusterLabels,
    clusterAssignments: clusterAssignmentsTfidf,
    clusterStats: clusterStatsTfidf,
  };

  const hdbscanFallback = useMemo(() => {
    const pts = pointsHdbscan ?? pointsTfidf ?? pointsUmap ?? [];
    if (pts.length < 2 || !discourseComments) return null;
    const hasValidClusters =
      (clusterAssignmentsHdbscan?.length ?? 0) >= pts.length &&
      (clusterAssignmentsHdbscan?.some((c) => c >= 0) ?? false);
    if (hasValidClusters && (clusterLabelsHdbscan?.length ?? 0) > 0) return null;
    try {
      const coords = pts.map((p, i) => {
        const { x, y } = getPointCoords(p);
        const idx = Array.isArray(p) ? p[2] : i;
        return { x, y, idx };
      });
      const assignments = kMeansClusters(coords, 4);
      const labels: Array<{ x: number; y: number; label: string; cluster_id: number }> = [];
      for (let c = 0; c < 4; c++) {
        const members = coords.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const comments = members
          .map((m) => m.idx)
          .filter((i) => i >= 0 && i < discourseComments.length)
          .map((i) => discourseComments[i])
          .filter((c): c is string => typeof c === "string");
        labels.push({ x: cx, y: cy, label: cleanLabel(computeClusterLabel(comments)), cluster_id: c });
      }
      return { labels, assignments };
    } catch {
      return null;
    }
  }, [pointsHdbscan, pointsTfidf, pointsUmap, discourseComments, clusterLabelsHdbscan, clusterAssignmentsHdbscan]);

  const hdbscanPts = pointsHdbscan ?? pointsTfidf ?? pointsUmap ?? [];
  const hdbscanLabels = (clusterLabelsHdbscan?.length ?? 0) > 0 ? clusterLabelsHdbscan : (hdbscanFallback?.labels ?? tfidf.clusterLabels);
  const hdbscanAssignments =
    (clusterAssignmentsHdbscan?.length ?? 0) >= hdbscanPts.length && (clusterAssignmentsHdbscan?.some((c) => c >= 0) ?? false)
      ? clusterAssignmentsHdbscan
      : (hdbscanFallback?.assignments ?? tfidf.clusterAssignments);
  const hdbscanStatsResolved =
    (clusterStatsHdbscan?.clusters ?? 0) > 0
      ? clusterStatsHdbscan
      : hdbscanFallback
        ? { clusters: hdbscanFallback.labels.length, noise_count: 0, total: (pointsHdbscan ?? pointsTfidf ?? pointsUmap ?? []).length }
        : clusterStatsHdbscan;

  const hdbscan: ModelVariant = {
    points: pointsHdbscan ?? pointsUmap ?? [],
    clusterLabels: hdbscanLabels,
    clusterAssignments: hdbscanAssignments,
    clusterStats: hdbscanStatsResolved,
  };

  const minilmFallback = useMemo(() => {
    const pts = pointsMinilm ?? [];
    if (pts.length < 2 || !discourseComments || (clusterLabelsMinilm?.length ?? 0) > 0) return null;
    try {
      const coords = pts.map((p, i) => {
        const { x, y } = getPointCoords(p);
        const idx = Array.isArray(p) ? p[2] : i;
        return { x, y, idx };
      });
      const assignments = kMeansClusters(coords, 4);
      const labels: Array<{ x: number; y: number; label: string; cluster_id: number }> = [];
      for (let c = 0; c < 4; c++) {
        const members = coords.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const comments = members
          .map((m) => m.idx)
          .filter((i) => i >= 0 && i < discourseComments.length)
          .map((i) => discourseComments[i])
          .filter((c): c is string => typeof c === "string");
        labels.push({ x: cx, y: cy, label: cleanLabel(computeClusterLabel(comments)), cluster_id: c });
      }
      return { labels, assignments };
    } catch {
      return null;
    }
  }, [pointsMinilm, discourseComments, clusterLabelsMinilm]);

  const minilmLabels = (clusterLabelsMinilm?.length ?? 0) > 0 ? clusterLabelsMinilm : minilmFallback?.labels ?? [];
  const minilmAssignments =
    (clusterAssignmentsMinilm?.length ?? 0) >= (pointsMinilm ?? []).length && (clusterAssignmentsMinilm?.some((c) => c >= 0) ?? false)
      ? clusterAssignmentsMinilm
      : (minilmFallback?.assignments ?? []);
  const minilmStatsResolved =
    (clusterStatsMinilm?.clusters ?? 0) > 0
      ? clusterStatsMinilm
      : minilmFallback
        ? { clusters: minilmFallback.labels.length, noise_count: 0, total: (pointsMinilm ?? []).length }
        : clusterStatsMinilm;

  const minilm: ModelVariant = {
    points: pointsMinilm ?? [],
    clusterLabels: minilmLabels,
    clusterAssignments: minilmAssignments,
    clusterStats: minilmStatsResolved,
  };

  const tfidfStats = getEffectiveStats(tfidf);
  const hdbscanStats = getEffectiveStats(hdbscan);
  const minilmStats = getEffectiveStats(minilm);

  const makeOnPointClick = (
    variant: ModelVariant
  ): ((pointIndex: number, clusterId: number) => void) | undefined => {
    if (!variant.clusterAssignments || !variant.clusterLabels || !discourseComments) return undefined;
    return (_pointIndex: number, clusterId: number) => {
      const cl = variant.clusterLabels!.find((l) => (l as { cluster_id?: number }).cluster_id === clusterId);
      const label = cl?.label ?? `Cluster ${clusterId}`;
      const indices = variant.clusterAssignments!
        .map((cid, i) => (cid === clusterId ? i : -1))
        .filter((i) => i >= 0);
      const comments = indices.map((i) => discourseComments![i] ?? "").filter((c) => c.trim());
      setSelectedCluster({ label, comments });
    };
  };
  const hasAny =
    (pointsPca?.length ?? 0) > 0 ||
    tfidf.points.length > 0 ||
    hdbscan.points.length > 0 ||
    minilm.points.length > 0;


  if (!hasAny) return null;

  return (
    <div className="relative">
      {selectedCluster && (
        <ClusterPanel
          label={selectedCluster.label}
          comments={selectedCluster.comments}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    <div className="space-y-6">
      {/* Row 1: PCA | Semantic clustering */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(pointsPca?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              PCA projection of comment vectors.
            </p>
            <div style={{ marginTop: 12 }}>
              <DiscourseScatter
                points={pointsPca}
                discourseComments={discourseComments}
                title="PCA projection of comment vectors"
                w={CHART_WIDTH_GRID}
                h={CHART_HEIGHT_PCA_UMAP}
                xLabel="Principal component 1"
                yLabel="Principal component 2"
              />
            </div>
          </div>
        )}
        {minilm.points.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Semantic clustering. Multilingual sentence embeddings + UMAP + HDBSCAN.
            </p>
            {minilmStats && <ClusterStatsLine stats={minilmStats} />}
            <div style={{ marginTop: 12 }}>
              <DiscourseScatter
                points={minilm.points}
                discourseComments={discourseComments}
                clusterLabels={minilm.clusterLabels}
                clusterAssignments={minilm.clusterAssignments}
                onPointClick={makeOnPointClick(minilm)}
                title="Semantic clustering"
                w={CHART_WIDTH_GRID}
                h={CHART_HEIGHT_PCA_UMAP}
                xLabel="UMAP dimension 1"
                yLabel="UMAP dimension 2"
                colorPalette={PALETTE_MINILM}
              />
            </div>
          </div>
        )}
      </div>

      {/* Row 2: TF-IDF + KMeans | TF-IDF + HDBSCAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tfidf.points.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              TF-IDF + UMAP + KMeans (baseline). Fixed k=4 clusters.
            </p>
            {tfidfStats && <ClusterStatsLine stats={tfidfStats} />}
            <div style={{ marginTop: 12 }}>
              <DiscourseScatter
                points={tfidf.points}
                discourseComments={discourseComments}
                clusterLabels={tfidf.clusterLabels}
                clusterAssignments={tfidf.clusterAssignments}
                onPointClick={makeOnPointClick(tfidf)}
                title="TF-IDF + UMAP + KMeans"
                w={CHART_WIDTH_GRID}
                h={CHART_HEIGHT_PCA_UMAP}
                xLabel="UMAP dimension 1"
                yLabel="UMAP dimension 2"
                colorPalette={PALETTE_KMEANS}
              />
            </div>
          </div>
        )}
        {hdbscan.points.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              TF-IDF + UMAP + HDBSCAN. Density-based, variable cluster count.
            </p>
            {hdbscanStats && <ClusterStatsLine stats={hdbscanStats} />}
            <div style={{ marginTop: 12 }}>
              <DiscourseScatter
                points={hdbscan.points}
                discourseComments={discourseComments}
                clusterLabels={hdbscan.clusterLabels}
                clusterAssignments={hdbscan.clusterAssignments}
                onPointClick={makeOnPointClick(hdbscan)}
                title="TF-IDF + UMAP + HDBSCAN"
                w={CHART_WIDTH_GRID}
                h={CHART_HEIGHT_PCA_UMAP}
                xLabel="UMAP dimension 1"
                yLabel="UMAP dimension 2"
                colorPalette={PALETTE_HDBSCAN}
              />
            </div>
          </div>
        )}
      </div>

    </div>
    </div>
  );
}
