import type { NextConfig } from "next";
import path from "path";

// Put .next in node_modules/.cache when project is in Dropbox (avoids sync corruption)
const inDropbox =
  process.cwd().includes("Dropbox") || process.env.DROPBOX_WORKAROUND === "1";
const distDir = inDropbox
  ? path.join(process.cwd(), "node_modules", ".cache", "next")
  : ".next";

const nextConfig: NextConfig = {
  distDir,
};

export default nextConfig;
