import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Block `/internal/*` on production builds. Local `next dev` uses NODE_ENV=development.
 * Optional escape hatch (not recommended): set ALLOW_INTERNAL_ROUTES=1 in the deployment env.
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  const allow =
    process.env.ALLOW_INTERNAL_ROUTES === "1" ||
    process.env.ALLOW_INTERNAL_ROUTES === "true";
  if (allow) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/internal/:path*"],
};
