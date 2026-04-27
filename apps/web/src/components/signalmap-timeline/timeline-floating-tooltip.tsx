"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

const TIP_EST_H = 78;
const VIEW_MARGIN = 10;
const AXIS_BUFFER = 4;
const POINTER_GAP = 10;
const HALF_EST_PX = 150;

/** Used by other helpers; keep signature stable. */
export function placeTooltipVertical(
  clientX: number,
  clientY: number,
  axisBottom: number
): { place: "above" | "below" } {
  if (typeof window === "undefined") {
    return { place: "above" };
  }
  const vh = window.innerHeight;
  const axisB = Math.max(0, axisBottom);
  const roomAbove = clientY - AXIS_BUFFER - TIP_EST_H - axisB;
  const roomBelow = vh - clientY - VIEW_MARGIN - TIP_EST_H;
  const aboveFits = roomAbove >= 0;
  const belowFits = roomBelow >= 0;
  let place: "above" | "below";
  if (aboveFits && belowFits) {
    place = roomAbove >= roomBelow - 4 ? "above" : "below";
  } else if (aboveFits) {
    place = "above";
  } else if (belowFits) {
    place = "below";
  } else {
    place = roomAbove > roomBelow ? "above" : "below";
  }
  if (place === "above" && clientY - POINTER_GAP - TIP_EST_H < axisB) {
    place = "below";
  }
  return { place };
}

type FloatingTip =
  | {
      kind: "event";
      id: string;
      x: number;
      y: number;
      content: { title: string; date: string | null | undefined };
    }
  | { kind: "cluster"; id: string; x: number; y: number; line: string }
  | { kind: "overlap"; id: string; x: number; y: number; header: string; lines: string[] };

function clampCenterX(clientX: number, halfW: number): number {
  if (typeof window === "undefined") return clientX;
  const vw = window.innerWidth;
  const m = VIEW_MARGIN;
  return Math.max(m + halfW, Math.min(clientX, vw - m - halfW));
}

type Measured = { left: number; top: number };

export function TimelineTooltipPortal({
  tip,
  axisBottomGetter,
  className,
}: {
  tip: FloatingTip | null;
  axisBottomGetter: () => number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Measured | null>(null);

  useLayoutEffect(() => {
    if (!tip) {
      setM(null);
      return;
    }
    const run = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = rect.height || TIP_EST_H;
      const w = rect.width;
      const halfW = w > 0 ? w / 2 : HALF_EST_PX;
      const left = clampCenterX(tip.x, halfW);
      const axisB = Math.max(0, axisBottomGetter());
      const vh = window.innerHeight;

      const roomAbove = tip.y - axisB - POINTER_GAP - h;
      const roomBelow = vh - tip.y - VIEW_MARGIN - h;
      const preferAbove = roomAbove >= 0 && (roomAbove >= roomBelow - 6 || roomBelow < 0);

      let top: number;
      if (preferAbove && roomAbove >= 0) {
        top = Math.max(AXIS_BUFFER, Math.max(axisB + 2, tip.y - POINTER_GAP - h));
        if (top < axisB) top = Math.min(vh - h - VIEW_MARGIN, tip.y + POINTER_GAP);
      } else {
        top = Math.min(vh - h - VIEW_MARGIN, Math.max(AXIS_BUFFER, tip.y + POINTER_GAP, axisB + 2));
      }
      if (top + h > vh - VIEW_MARGIN) top = vh - h - VIEW_MARGIN;
      if (top < AXIS_BUFFER) top = AXIS_BUFFER;

      setM({ left, top });
    };

    const r0 = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(r0);
  }, [tip, axisBottomGetter]);

  if (typeof document === "undefined" || !tip) {
    return null;
  }

  const style: CSSProperties = m
    ? { left: m.left, top: m.top, transform: "translateX(-50%)" }
    : {
        left: clampCenterX(tip.x, HALF_EST_PX),
        top: Math.max(AXIS_BUFFER, tip.y - POINTER_GAP),
        transform: "translate(-50%, -100%)",
      };

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed z-[10050] w-max min-w-0 max-w-xs rounded-md border border-border/90 bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md will-change-[transform,left,top]",
        className
      )}
      style={{
        maxWidth: "min(20rem, calc(100vw - 1.25rem))",
        ...style,
      }}
      role="tooltip"
    >
      {tip.kind === "event" ? (
        <>
          <p className="text-xs font-medium text-foreground">{tip.content.title}</p>
          {tip.content.date?.trim() ? (
            <p className="whitespace-pre-line text-[10px] text-muted-foreground">
              {tip.content.date}
            </p>
          ) : null}
        </>
      ) : tip.kind === "cluster" ? (
        <p className="text-xs leading-snug">{tip.line}</p>
      ) : (
        <div className="max-w-[16rem]">
          <p className="text-[10px] font-medium text-foreground/90">{tip.header}</p>
          <ul className="mt-1 space-y-0.5 border-t border-border/50 pt-1.5 text-[10px] leading-snug text-muted-foreground">
            {tip.lines.map((L, i) => (
              <li key={i} className="pl-0.5">
                {L}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body
  );
}

export type { FloatingTip };
