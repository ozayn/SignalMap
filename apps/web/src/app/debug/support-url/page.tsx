import { notFound } from "next/navigation";
import { getSupportUrlDiagnostics } from "@/lib/site-support-href";

export const dynamic = "force-dynamic";

/**
 * Temporary diagnostic page. `ENABLE_SUPPORT_URL_DEBUG` only controls **visibility** of this route
 * (404 when unset/0). It does not change `resolveSignalMapSupportHref()` used by nav/footer.
 */
export default function SupportUrlDebugPage() {
  if (process.env.ENABLE_SUPPORT_URL_DEBUG !== "1") {
    notFound();
  }

  const d = getSupportUrlDiagnostics();

  return (
    <div className="page-container font-mono text-sm">
      <h1 className="mb-4 font-sans text-xl font-semibold">Support URL diagnostics</h1>
      <p className="mb-4 max-w-2xl text-muted-foreground">
        Gated by <code className="rounded bg-muted px-1">ENABLE_SUPPORT_URL_DEBUG=1</code>. Remove{" "}
        <code className="rounded bg-muted px-1">app/debug/support-url</code> when done.
      </p>
      <pre className="overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
        {JSON.stringify(d, null, 2)}
      </pre>
    </div>
  );
}
