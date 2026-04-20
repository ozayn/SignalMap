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
      {deployMismatch ? (
        <p className="text-foreground font-medium">This page is out of sync with the server.</p>
      ) : (
        <p className="text-muted-foreground">Something went wrong.</p>
      )}
      {deployMismatch ? (
        <div className="text-sm text-muted-foreground max-w-prose space-y-2">
          <p>
            That usually happens right after we ship an update, while a tab still has an older copy of the app loaded.
            Your work is fine; the page just needs to pick up the latest version.
          </p>
          <p>
            Refresh this page (or use <span className="text-foreground">Reload page</span> below). If it still
            happens, copy the URL from the address bar and open it in a new tab. As a last resort, try a private
            window or clear cached data for this site.
          </p>
        </div>
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
