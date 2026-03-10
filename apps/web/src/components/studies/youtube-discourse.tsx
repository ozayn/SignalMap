"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DiscoursePoint = { x: number; y: number; text: string } | [number, number, number];

function getPointCoords(p: DiscoursePoint): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };
}

const LABEL_DIRECTIONS: [number, number][] = [
  [1, 0],   // right
  [-1, 0],  // left
  [0, -1],  // up
  [0, 1],   // down
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];

const LABEL_OVERLAP_OFFSETS_2D: [number, number][] = [
  [0, 0],
  [0, 0.06],
  [0, -0.06],
  [0.06, 0],
  [-0.06, 0],
  [0.06, 0.06],
  [0.06, -0.06],
  [-0.06, 0.06],
  [-0.06, -0.06],
  [0, 0.1],
  [0, -0.1],
  [0.1, 0],
  [-0.1, 0],
  [0.1, 0.1],
  [0.1, -0.1],
  [-0.1, 0.1],
  [-0.1, -0.1],
  [0.12, 0],
  [0, 0.12],
  [-0.12, 0],
  [0, -0.12],
  [0.12, 0.06],
  [-0.12, 0.06],
  [0.06, 0.12],
  [0.06, -0.12],
];
const LABEL_OVERLAP_THRESHOLD = 0.12;
const LABEL_BOUNDS_MARGIN = 0.05;

function clampLabelBounds<
  T extends { labelX: number; labelY: number }
>(
  layout: T[],
  rangeX: number,
  rangeY: number,
  minX: number,
  minY: number,
  margin = LABEL_BOUNDS_MARGIN
): T[] {
  return layout
    .filter((item): item is T => item != null)
    .map((item) => {
    const normX = (item.labelX - minX) / rangeX;
    const normY = (item.labelY - minY) / rangeY;
    const clampedNormX = Math.max(margin, Math.min(1 - margin, normX));
    const clampedNormY = Math.max(margin, Math.min(1 - margin, normY));
    return {
      ...item,
      labelX: minX + clampedNormX * rangeX,
      labelY: minY + clampedNormY * rangeY,
    };
  });
}

function computeLabelLayoutOutsideCluster<
  T extends { x: number; y: number; label: string; cluster_id?: number }
>(
  labels: T[],
  points: Array<{ x: number; y: number }>,
  assignments: number[] | null,
  rangeX: number,
  rangeY: number,
  minX: number,
  minY: number,
  overlapThreshold = LABEL_OVERLAP_THRESHOLD
): Array<T & { centroidX: number; centroidY: number; labelX: number; labelY: number }> {
  const safeLabels = labels.filter((l): l is T => l != null && typeof l === "object" && "x" in l && "y" in l && "label" in l);
  if (safeLabels.length === 0) return [];
  const fallbackRadius = Math.max(rangeX, rangeY) * 0.05;
  const placed: { x: number; y: number }[] = [];

  const toNorm = (x: number, y: number) => ({
    x: (x - minX) / rangeX,
    y: (y - minY) / rangeY,
  });
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  return safeLabels.map((cl) => {
    const cx = cl.x;
    const cy = cl.y;
    const clusterId = (cl as { cluster_id?: number }).cluster_id ?? safeLabels.indexOf(cl);

    let radius = fallbackRadius;
    if (assignments && assignments.length >= points.length) {
      const clusterPoints = points.filter((_, i) => assignments[i] === clusterId);
      if (clusterPoints.length > 0) {
        radius = Math.max(
          ...clusterPoints.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))
        );
        if (radius < fallbackRadius * 0.5) radius = fallbackRadius;
      }
    }

    const overlaps = (lx: number, ly: number) =>
      placed.some((p) => dist(toNorm(lx, ly), toNorm(p.x, p.y)) < overlapThreshold);

    const offset = radius * 1.2;
    let labelX = cx + offset;
    let labelY = cy;

    for (let di = 0; di < LABEL_DIRECTIONS.length; di++) {
      const [dx, dy] = LABEL_DIRECTIONS[di]!;
      const tryX = cx + dx * offset;
      const tryY = cy + dy * offset;
      if (!overlaps(tryX, tryY)) {
        labelX = tryX;
        labelY = tryY;
        break;
      }
    }
    placed.push({ x: labelX, y: labelY });

    return {
      ...cl,
      centroidX: cx,
      centroidY: cy,
      labelX,
      labelY,
    };
  });
}

type LaidOutLabel = {
  label: string;
  cluster_id?: number;
  centroidX: number;
  centroidY: number;
  labelX: number;
  labelY: number;
  displayX: number;
  displayY: number;
  centroidDisplayX: number;
  centroidDisplayY: number;
};

function computeClusterLabelLayout(
  labels: Array<{ x: number; y: number; label: string; cluster_id?: number }>,
  points: Array<{ x: number; y: number }>,
  assignments: number[] | null,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  scaleX: (v: number) => number,
  scaleY: (v: number) => number
): LaidOutLabel[] {
  const safeLabels = (labels ?? []).filter(
    (l): l is { x: number; y: number; label: string; cluster_id?: number } =>
      l != null && typeof l === "object" && typeof l.x === "number" && typeof l.y === "number" && typeof l.label === "string"
  );
  if (safeLabels.length === 0) return [];
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  let layout = computeLabelLayoutOutsideCluster(
    safeLabels,
    points,
    assignments,
    rangeX,
    rangeY,
    minX,
    minY
  );
  layout = resolveLabelOverlap(layout, rangeX, rangeY, minX, minY);
  layout = clampLabelBounds(layout, rangeX, rangeY, minX, minY);
  return layout.map((item) => ({
    ...item,
    displayX: scaleX(item.labelX),
    displayY: scaleY(item.labelY),
    centroidDisplayX: scaleX(item.centroidX),
    centroidDisplayY: scaleY(item.centroidY),
  }));
}

function ClusterLabels({
  laidOutLabels,
  colorPalette = PALETTE_KMEANS,
  filterId = "scatterLabelShadow",
}: {
  laidOutLabels: LaidOutLabel[];
  colorPalette?: string[];
  filterId?: string;
}) {
  const [overrides, setOverrides] = useState<Record<number, { displayX: number; displayY: number }>>({});
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; labelX: number; labelY: number } | null>(null);
  const captureTargetRef = useRef<SVGElement | null>(null);

  const layoutKey = useMemo(() => laidOutLabels.map((l) => l.label).join("|"), [laidOutLabels]);
  useEffect(() => {
    setOverrides({});
  }, [layoutKey]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, i: number) => {
      e.stopPropagation();
      const label = laidOutLabels[i];
      if (!label) return;
      const base = overrides[i] ?? { displayX: label.displayX, displayY: label.displayY };
      dragStartRef.current = { x: e.clientX, y: e.clientY, labelX: base.displayX, labelY: base.displayY };
      setDraggingIndex(i);
      captureTargetRef.current = e.currentTarget as SVGElement;
      captureTargetRef.current.setPointerCapture(e.pointerId);
    },
    [laidOutLabels, overrides]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIndex === null || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOverrides((prev) => ({
        ...prev,
        [draggingIndex]: {
          displayX: dragStartRef.current!.labelX + dx,
          displayY: dragStartRef.current!.labelY + dy,
        },
      }));
    },
    [draggingIndex]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIndex !== null && captureTargetRef.current) {
        captureTargetRef.current.releasePointerCapture(e.pointerId);
        captureTargetRef.current = null;
        setDraggingIndex(null);
        dragStartRef.current = null;
      }
    },
    [draggingIndex]
  );

  useEffect(() => {
    if (draggingIndex === null) return;
    const onPointerUp = () => {
      captureTargetRef.current = null;
      setDraggingIndex(null);
      dragStartRef.current = null;
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [draggingIndex]);

  if (laidOutLabels.length === 0) return null;
  return (
    <g
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {laidOutLabels.map((cl, i) => {
        const padX = 6;
        const padY = 4;
        const textWidth = Math.max(40, cl.label.length * 7);
        const boxW = textWidth + padX * 2;
        const boxH = 12 + padY * 2;
        const clusterId = cl.cluster_id ?? i;
        const accentColor = getClusterColor(clusterId, colorPalette);
        const displayX = overrides[i]?.displayX ?? cl.displayX;
        const displayY = overrides[i]?.displayY ?? cl.displayY;
        return (
          <g key={i}>
            <line
              x1={cl.centroidDisplayX}
              y1={cl.centroidDisplayY}
              x2={displayX}
              y2={displayY}
              stroke="#999"
              strokeWidth={0.6}
            />
            <g
              transform={`translate(${displayX},${displayY})`}
              data-cluster-label
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{
                cursor: draggingIndex === i ? "grabbing" : "grab",
                pointerEvents: "all",
              }}
            >
              <rect
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                rx={6}
                fill="white"
                stroke={accentColor}
                strokeWidth={1}
                filter={`url(#${filterId})`}
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 12, fontWeight: 500, fill: "#333", pointerEvents: "none" }}
              >
                {cl.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function resolveLabelOverlap<
  T extends { centroidX: number; centroidY: number; labelX: number; labelY: number }
>(
  layout: T[],
  rangeX: number,
  rangeY: number,
  minX: number,
  minY: number,
  overlapThreshold = LABEL_OVERLAP_THRESHOLD
): T[] {
  const safeLayout = layout.filter((item): item is T => item != null);
  if (safeLayout.length === 0) return [];
  const toNorm = (x: number, y: number) => ({
    x: (x - minX) / rangeX,
    y: (y - minY) / rangeY,
  });
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const result: T[] = [];
  for (let i = 0; i < safeLayout.length; i++) {
    const item = safeLayout[i]!;
    let labelX = item.labelX;
    let labelY = item.labelY;

    const overlaps = (lx: number, ly: number) => {
      const norm = toNorm(lx, ly);
      return result.some((placed) => {
        const oNorm = toNorm(placed.labelX, placed.labelY);
        return dist(norm, oNorm) < overlapThreshold;
      });
    };

    for (let oi = 0; oi < LABEL_OVERLAP_OFFSETS_2D.length; oi++) {
      const [dx, dy] = LABEL_OVERLAP_OFFSETS_2D[oi]!;
      const tryX = item.labelX + dx * rangeX;
      const tryY = item.labelY + dy * rangeY;
      if (!overlaps(tryX, tryY)) {
        labelX = tryX;
        labelY = tryY;
        break;
      }
    }

    result.push({ ...item, labelX, labelY } as T);
  }
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

  const pointCoords = useMemo(
    () => points.map((p) => getPointCoords(p)),
    [points]
  );
  const laidOutLabels = useMemo(
    () =>
      computeClusterLabelLayout(
        effectiveLabels ?? [],
        pointCoords,
        assignmentsForColor,
        minX,
        maxX,
        minY,
        maxY,
        scaleX,
        scaleY
      ),
    [effectiveLabels, pointCoords, assignmentsForColor, minX, maxX, minY, maxY, scaleX, scaleY]
  );

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
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
      >
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
          <ClusterLabels laidOutLabels={laidOutLabels} colorPalette={colorPalette} filterId="scatterLabelShadow" />
          <text x={w / 2} y={h - 6} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }}>
            {xLabel}
          </text>
          <text x={14} y={h / 2} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }} transform={`rotate(-90, 14, ${h / 2})`}>
            {yLabel}
          </text>
        </svg>
      </DiscourseScatterTooltip>
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
  children,
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
  children?: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`absolute inset-0 ${onPointClick ? "cursor-pointer" : ""}`}
        onClick={(e) => {
          if ((e.target as Element).closest?.("[data-cluster-label]")) return;
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
      >
        {children}
      </div>
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
      const safeClusterLabels = clusterLabels.filter(
        (cl): cl is NonNullable<typeof cl> => cl != null && typeof cl === "object" && "x" in cl && "y" in cl
      );
      const withSize = safeClusterLabels.map((cl) => {
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
    return topClusterLabels
      .filter((cl): cl is NonNullable<typeof cl> => cl != null && typeof cl === "object")
      .map((cl, i) => {
        const x = "cx" in cl ? (cl as { cx: number; cy: number }).cx : (cl as { x: number; y: number }).x;
        const y = "cy" in cl ? (cl as { cx: number; cy: number }).cy : (cl as { x: number; y: number }).y;
        return { x, y, label: cl.label ?? "", cluster_id: (cl as { cluster_id?: number }).cluster_id ?? i };
      });
  }, [topClusterLabels]);

  const laidOutDensityLabels = useMemo(
    () =>
      computeClusterLabelLayout(
        densityLabelsForLayout,
        coords,
        assignmentsForColor,
        minX,
        maxX,
        minY,
        maxY,
        scaleX,
        scaleY
      ),
    [densityLabelsForLayout, coords, assignmentsForColor, minX, maxX, minY, maxY, scaleX, scaleY]
  );

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
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
      >
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
          <ClusterLabels
            laidOutLabels={laidOutDensityLabels}
            colorPalette={colorPalette}
            filterId="densityLabelShadow"
          />
          <text x={w / 2} y={h - 6} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }}>
            UMAP dimension 1
          </text>
          <text x={14} y={h / 2} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }} transform={`rotate(-90, 14, ${h / 2})`}>
            UMAP dimension 2
          </text>
        </svg>
      </DiscourseScatterTooltip>
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
  const { contourPaths, labelsForLayout, assignmentsForLayout } = useMemo(() => {
    const contourPaths = computeContourPaths(
      coords.map((c) => ({ x: c.x, y: c.y })),
      40,
      0.25
    );
    if (useApiLabels && clusterLabels) {
      const labelsWithId = clusterLabels
        .filter((cl): cl is NonNullable<typeof cl> => cl != null && typeof cl === "object" && "x" in cl && "y" in cl)
        .map((cl, i) => ({
          ...cl,
          cluster_id: (cl as { cluster_id?: number }).cluster_id ?? i,
        }));
      const assignments = coords.map((c) => {
        let best = 0;
        let bestD = Infinity;
        labelsWithId.forEach((cl, j) => {
          const d = (c.x - cl.x) ** 2 + (c.y - cl.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = (cl as { cluster_id?: number }).cluster_id ?? j;
          }
        });
        return best;
      });
      return { contourPaths, labelsForLayout: labelsWithId, assignmentsForLayout: assignments };
    }
    try {
      const pts = coords.map((c) => ({ x: c.x, y: c.y, idx: c.idx }));
      const assignments = kMeansClusters(pts, 4);
      const commentsRef = discourseComments ?? [];
      const labelsForLayout: Array<{ x: number; y: number; label: string; cluster_id: number }> = [];
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
        labelsForLayout.push({ x: cx, y: cy, label: cleanLabel(computeClusterLabel(comments)), cluster_id: c });
      }
      return { contourPaths, labelsForLayout, assignmentsForLayout: assignments };
    } catch {
      return { contourPaths, labelsForLayout: [], assignmentsForLayout: [] as number[] };
    }
  }, [pointsKey, useApiLabels, discourseComments, clusterLabels, coords]);

  const laidOutContourLabels = useMemo(
    () =>
      computeClusterLabelLayout(
        labelsForLayout,
        coords,
        assignmentsForLayout.length > 0 ? assignmentsForLayout : null,
        minX,
        maxX,
        minY,
        maxY,
        scaleX,
        scaleY
      ),
    [labelsForLayout, coords, assignmentsForLayout, minX, maxX, minY, maxY, scaleX, scaleY]
  );

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-border text-muted-foreground" style={{ width: w, height: h }}>
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
      >
        <svg width={w} height={h} className="absolute inset-0">
          <defs>
            <filter id="contourLabelShadow">
              <feDropShadow dx={0} dy={1} stdDeviation={1.5} floodColor="rgba(0,0,0,0.15)" />
            </filter>
          </defs>
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
          {/* 3. Cluster labels (outside cluster, connector line, edge clamping) */}
          <ClusterLabels
            laidOutLabels={laidOutContourLabels}
            colorPalette={PALETTE_HDBSCAN}
            filterId="contourLabelShadow"
          />
          <text x={w / 2} y={h - 6} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }}>
            UMAP dimension 1
          </text>
          <text x={14} y={h / 2} textAnchor="middle" fill="currentColor" style={{ fontSize: 10 }} transform={`rotate(-90, 14, ${h / 2})`}>
            UMAP dimension 2
          </text>
        </svg>
      </DiscourseScatterTooltip>
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

type ClusterSummaryItem = { label: string; size: number; percent: number };

export function YoutubeDiscourseMaps({
  pointsPca,
  pointsUmap,
  pointsTfidf,
  pointsHdbscan,
  pointsMinilm,
  discourseComments,
  clusterLabels,
  clusterLabelsPca,
  clusterLabelsTfidf,
  clusterLabelsHdbscan,
  clusterLabelsMinilm,
  clusterStatsPca,
  clusterStatsTfidf,
  clusterStatsHdbscan,
  clusterStatsMinilm,
  clusterAssignmentsPca,
  clusterAssignmentsTfidf,
  clusterAssignmentsHdbscan,
  clusterAssignmentsMinilm,
  clustersSummaryPca,
  clustersSummaryHdbscan,
  clustersSummaryTfidf,
  clustersSummaryMinilm,
}: {
  pointsPca?: DiscoursePoint[];
  pointsUmap?: DiscoursePoint[];
  pointsTfidf?: DiscoursePoint[];
  pointsHdbscan?: DiscoursePoint[];
  pointsMinilm?: DiscoursePoint[];
  discourseComments?: string[];
  clusterLabels?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsPca?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsTfidf?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsHdbscan?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterLabelsMinilm?: Array<{ x: number; y: number; label: string; cluster_id?: number }>;
  clusterStatsPca?: ClusterStats;
  clusterStatsTfidf?: ClusterStats;
  clusterStatsHdbscan?: ClusterStats;
  clusterStatsMinilm?: ClusterStats;
  clusterAssignmentsPca?: number[];
  clusterAssignmentsTfidf?: number[];
  clusterAssignmentsHdbscan?: number[];
  clusterAssignmentsMinilm?: number[];
  clustersSummaryPca?: ClusterSummaryItem[];
  clustersSummaryHdbscan?: ClusterSummaryItem[];
  clustersSummaryTfidf?: ClusterSummaryItem[];
  clustersSummaryMinilm?: ClusterSummaryItem[];
}) {
  const [selectedCluster, setSelectedCluster] = useState<{
    label: string;
    comments: string[];
  } | null>(null);

  const pca: ModelVariant = {
    points: pointsPca ?? [],
    clusterLabels: clusterLabelsPca,
    clusterAssignments: clusterAssignmentsPca,
    clusterStats: clusterStatsPca,
  };

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
            {clusterStatsPca && <ClusterStatsLine stats={clusterStatsPca} />}
            <div style={{ marginTop: 12 }}>
              <DiscourseScatter
                points={pointsPca ?? []}
                discourseComments={discourseComments}
                clusterLabels={pca.clusterLabels}
                clusterAssignments={pca.clusterAssignments}
                onPointClick={makeOnPointClick(pca)}
                title="PCA projection of comment vectors"
                w={CHART_WIDTH_GRID}
                h={CHART_HEIGHT_PCA_UMAP}
                xLabel="Principal component 1"
                yLabel="Principal component 2"
                colorPalette={PALETTE_KMEANS}
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

      {/* Discourse composition: cluster proportions */}
      {(() => {
        const summary = clustersSummaryHdbscan ?? clustersSummaryTfidf ?? clustersSummaryMinilm ?? [];
        if (summary.length === 0) return null;
        const palette = [...PALETTE_HDBSCAN, ...PALETTE_KMEANS, ...PALETTE_MINILM];
        return (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Discourse composition</h3>
            <div className="flex flex-col gap-2">
              {summary.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-foreground min-w-[140px] shrink-0" dir="auto">
                    {item.label}
                  </span>
                  <div className="flex-1 min-w-0 h-5 rounded-md bg-muted overflow-hidden flex">
                    <div
                      className="h-full rounded-md shrink-0 transition-[width]"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: palette[i % palette.length],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0 tabular-nums w-10 text-right">
                    {item.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}
