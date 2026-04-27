"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

const TIP_EST_H = 78;
const VIEW_MARGIN = 10;
const AXIS_BUFFER = 4;
const POINTER_OFFSET = 10;
const HALF_EST_PX = 150;

type FloatingTip =
  | { kind: "event"; id: string; x: number; y: number; content: { title: string; date: string } }
  | { kind: "cluster"; id: string; x: number; y: number; line: string };

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
  if (place === "above" && clientY - POINTER_OFFSET - TIP_EST_H < axisB) {
    place = "below";
  }
  return { place };
}

function clampCenterX(clientX: number, halfW: number): number {
  if (typeof window === "undefined") {
    return clientX;
  }
  const vw = window.innerWidth;
  const m = VIEW_MARGIN;
  return Math.max(m + halfW, Math.min(clientX, vw - m - halfW));
}

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
  const [left, setLeft] = useState<number | null>(null);
  const [place, setPlace] = useState<"above" | "below">("above");

  useLayoutEffect(() => {
    if (!tip) {
      setLeft(null);
      return;
    }
    const ab = axisBottomGetter();
    const p = placeTooltipVertical(tip.x, tip.y, ab);
    setPlace(p.place);
    const w = ref.current?.getBoundingClientRect().width ?? 0;
    const half = w > 0 ? w / 2 : HALF_EST_PX;
    setLeft(clampCenterX(tip.x, half));
  }, [tip, axisBottomGetter]);

  if (typeof document === "undefined" || !tip) {
    return null;
  }

  const yStyle: CSSProperties =
    place === "above"
      ? { top: Math.max(AXIS_BUFFER, tip.y - POINTER_OFFSET) }
      : { top: tip.y + POINTER_OFFSET };
  const transform = place === "above" ? "translate(-50%, -100%)" : "translateX(-50%)";

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed z-[10050] w-max min-w-0 max-w-xs rounded-md border border-border/90 bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md will-change-[transform,left,top]",
        className
      )}
      style={{
        maxWidth: "min(20rem, calc(100vw - 1.25rem))",
        left: left ?? clampCenterX(tip.x, HALF_EST_PX),
        ...yStyle,
        transform,
      }}
      role="tooltip"
    >
      {tip.kind === "event" ? (
        <>
          <p className="text-xs font-medium text-foreground">{tip.content.title}</p>
          <p className="text-[10px] text-muted-foreground">{tip.content.date}</p>
        </>
      ) : (
        <p className="text-xs leading-snug">{tip.line}</p>
      )}
    </div>,
    document.body
  );
}

export type { FloatingTip };
