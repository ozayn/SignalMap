"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NOTE_EN = "Poverty lines are in constant 2021 PPP dollars (inflation-adjusted).";
const NOTE_FA =
  "خطوط فقر بر اساس دلار ثابت (PPP) هستند و اثر تورم در آن‌ها لحاظ شده است.";
const TIP_EN =
  "PPP (Purchasing Power Parity) adjusts for cost of living, allowing comparison of real living standards over time.";
const TIP_FA =
  "برابری قدرت خرید (PPP) تفاوت سطح قیمت‌ها را در نظر می‌گیرد و امکان مقایسه سطح واقعی زندگی را فراهم می‌کند.";

/** ⓘ next to the poverty chart title; hover / focus shows PPP explanation. */
export function PovertyHeadcountPppInfoTrigger({ isFa }: { isFa: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle",
            "text-muted-foreground/80 hover:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          aria-label={isFa ? "توضیح برابری قدرت خرید (PPP)" : "About purchasing power parity (PPP)"}
        >
          <span className="text-[0.7rem] font-sans leading-none select-none" aria-hidden>
            ⓘ
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(20rem,calc(100vw-1.5rem))] text-xs leading-relaxed">
          {isFa ? TIP_FA : TIP_EN}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Muted one-line note: lines are real / PPP-based (World Bank convention). */
export function PovertyHeadcountPppMutedNote({ isFa, className }: { isFa: boolean; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground leading-relaxed max-w-3xl", className)}>
      {isFa ? NOTE_FA : NOTE_EN}
    </p>
  );
}
