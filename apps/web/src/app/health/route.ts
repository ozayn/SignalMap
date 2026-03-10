import { NextResponse } from "next/server";

/** Simple healthcheck for Railway. Returns 200 immediately. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
