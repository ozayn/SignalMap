import type { NextConfig } from "next";

/** Build-time visibility (Railway build logs): NEXT_PUBLIC must be set when `next build` runs to be inlined. */
console.log(
  "[signalmap web build] NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL configured:",
  Boolean(process.env.NEXT_PUBLIC_SIGNALMAP_SUPPORT_URL?.trim())
);

/**
 * Deployment note (Railway / rolling releases):
 * This app does not define Next.js Server Actions (`"use server"` / bound `formAction`).
 * If logs show "Failed to find Server Action … older or newer deployment", the client
 * bundle is usually out of sync with the server (stale tab, CDN, or zero-downtime swap).
 * Short action ids like "x" or "1" often come from malformed probes (bots), not app code.
 * Recovery: full reload. See `src/app/error.tsx` for a user-facing hint on that message.
 *
 * If you run multiple instances and ever see mismatched keys across replicas, set
 * `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time (see Next.js "failed-to-find-server-action").
 *
 * Behind a reverse proxy with a different host, you may need:
 * `experimental.serverActions.allowedOrigins` (see Next.js docs) so same-origin checks pass.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/studies/usd-toman", destination: "/studies/iran-fx-regime", permanent: true },
      { source: "/studies/iran_fx_spread", destination: "/studies/iran-fx-regime", permanent: true },
    ];
  },
};

export default nextConfig;
