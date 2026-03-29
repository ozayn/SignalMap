#!/usr/bin/env bash
# shellcheck source=scripts/lib-pnpm.sh
# Sets PNPM_CMD as array: (pnpm …) or (npx pnpm …) for machines without global pnpm.
resolve_pnpm_cmd() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
  elif command -v npx >/dev/null 2>&1; then
    PNPM_CMD=(npx pnpm)
  else
    echo "pnpm not found. Install Node.js, then either: corepack enable pnpm   or   npm install -g pnpm" >&2
    return 1
  fi
}
