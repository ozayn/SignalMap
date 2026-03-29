#!/usr/bin/env bash
# Clear Next cache, force-kill 3000/8000, start dev (same as: pnpm dev:fresh).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib-pnpm.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-pnpm.sh"
resolve_pnpm_cmd || exit 1

"${PNPM_CMD[@]}" run clean
lsof -ti:3000 -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
exec "${PNPM_CMD[@]}" dev
