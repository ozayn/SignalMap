"use client";

import { useEffect, useMemo } from "react";

function isLikelyDeployMismatch(error: Error & { digest?: string }): boolean {
  const cause = (error as Error & { cause?: unknown }).cause;
  const msg = [error.message, error.digest, cause != null ? String(cause) : ""].filter(Boolean).join(" ");
  return msg.includes("Failed to find Server Action") || msg.includes("older or newer deployment");
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const deployMismatch = useMemo(() => isLikelyDeployMismatch(error), [error]);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-4 min-w-0 w-full">
      <p className="text-muted-foreground">Something went wrong.</p>
      {deployMismatch ? (
        <p className="text-sm text-foreground max-w-prose">
          This often happens after a new deployment while an older tab is still open. Try a full page reload (refresh),
          then use the app again. If it persists, clear the site cache or open the site in a private window.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5"
        >
          Try again
        </button>
        {deployMismatch ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90"
          >
            Reload page
          </button>
        ) : null}
      </div>
    </div>
  );
}
