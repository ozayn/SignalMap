import Link from "next/link";

import { YouTubeTranscriptTester } from "./youtube-transcript-tester";

export default function InternalYouTubeTranscriptPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-10 min-w-0 overflow-x-hidden">
      <header className="mb-10 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Internal</p>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">Transcript analysis</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          YouTube fetch and analyze, or paste plain text. Modes:{" "}
          <span className="font-mono text-[13px]">frames</span>,{" "}
          <span className="font-mono text-[13px]">fallacies</span> (with{" "}
          <span className="font-mono text-[13px]">method</span>: heuristic, classifier, or LLM),{" "}
          <span className="font-mono text-[13px]">summarize_llm</span>,{" "}
          <span className="font-mono text-[13px]">speaker_guess_llm</span>. Groq-backed modes need{" "}
          <span className="font-mono text-[13px]">GROQ_API_KEY</span> on the API. Proxied to the API; not in public
          navigation.{" "}
          <Link
            href="/learning#transcript-fallacy-analysis"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Learning: methods &amp; limitations
          </Link>
          .
        </p>
      </header>
      <YouTubeTranscriptTester />
    </div>
  );
}
