import Link from "next/link";
import { YouTubeTranscriptTester } from "@/app/internal/youtube-transcript/youtube-transcript-tester";

export default function TranscriptFallacyExplorePage() {
  return (
    <div className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-12">
      <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Explore</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight">
          Transcript fallacy analysis
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Compare fallacy-style tags on transcript chunks using heuristic rules, a future classifier, or an LLM — all
          experimental. Choose a method below; short explanations update with your selection.{" "}
          <Link
            href="/learning#transcript-fallacy-analysis"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Learning: transcript fallacy analysis
          </Link>{" "}
          has longer notes on strengths, limits, and why methods disagree.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/explore" className="underline underline-offset-4 transition-colors hover:text-foreground">
            ← Explore
          </Link>
        </p>
      </header>
      <YouTubeTranscriptTester exploreFallaciesOnly />
    </div>
  );
}
