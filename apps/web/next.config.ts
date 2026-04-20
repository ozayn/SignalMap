import type { NextConfig } from "next";

/**
 * Deployment note (Railway / rolling releases):
 * This app does not define Next.js Server Actions (`"use server"` / bound `formAction`).
 * If logs show "Failed to find Server Action … older or newer deployment", the client
 * bundle is usually out of sync with the server (stale tab, CDN, or zero-downtime swap).
 * Recovery: full reload. See `src/app/error.tsx` for a user-facing hint on that message.
 *
 * Behind a reverse proxy with a different host, you may need:
 * `experimental.serverActions.allowedOrigins` (see Next.js docs) so same-origin checks pass.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
