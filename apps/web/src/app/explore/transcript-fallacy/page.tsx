import Link from "next/link";
import { YouTubeTranscriptTester } from "@/app/internal/youtube-transcript/youtube-transcript-tester";

export default function TranscriptFallacyExplorePage() {
  return (
    <div
      className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-12"
      dir="ltr"
    >
      <header className="mx-auto mb-9 max-w-xl text-center sm:mb-11">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Explore</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight">
          Transcript analysis
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          For YouTube, fetch captions first, then run fallacy detection (heuristic or LLM) or an experimental Groq
          summary. Paste plain transcript text to analyze without fetching.{" "}
          <Link
            href="/learning#transcript-fallacy-analysis"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Learning
          </Link>{" "}
          covers limits and comparing methods.
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
