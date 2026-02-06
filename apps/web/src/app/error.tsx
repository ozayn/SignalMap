"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-4">
      <p className="text-muted-foreground">Something went wrong.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5"
      >
        Try again
      </button>
    </div>
  );
}
