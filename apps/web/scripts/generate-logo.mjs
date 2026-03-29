#!/usr/bin/env node
/**
 * Fetches logo PNGs from the running dev server and saves to public/.
 * Run with dev server: pnpm dev (in another terminal), then: node scripts/generate-logo.mjs
 * Output: public/logo.png (512), public/logo-192.png, public/logo-32.png
 */
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const base = process.env.BASE_URL || "http://localhost:3000";

const endpoints = [
  ["/favicon.png", "logo-32.png"],
  ["/icon-192", "logo-192.png"],
  ["/icon-512", "logo.png"],
];

async function main() {
  await mkdir(publicDir, { recursive: true });
  console.log(`Fetching from ${base}...`);
  for (const [path, name] of endpoints) {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    await writeFile(join(publicDir, name), Buffer.from(await res.arrayBuffer()));
    console.log(`  ${name}`);
  }
  console.log("Done. Use public/logo.png elsewhere.");
}

main().catch((err) => {
  console.error(err.message);
  console.error("Start dev server first: pnpm dev");
  process.exit(1);
});
