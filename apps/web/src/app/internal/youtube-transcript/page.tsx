import { YouTubeTranscriptTester } from "./youtube-transcript-tester";

export default function InternalYouTubeTranscriptPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-10 min-w-0 overflow-x-hidden">
      <header className="mb-10 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Internal</p>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">Transcript analysis</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          YouTube fetch and analyze, or paste plain text. Modes: <span className="font-mono text-[13px]">frames</span> /{" "}
          <span className="font-mono text-[13px]">fallacies</span>. Proxied to the API; not in public navigation.
        </p>
      </header>
      <YouTubeTranscriptTester />
    </div>
  );
}
