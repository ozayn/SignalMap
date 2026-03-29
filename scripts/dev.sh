#!/usr/bin/env bash
# Start Next.js (3000) and FastAPI (8000). Requires: pnpm install, apps/api/.venv with deps.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib-pnpm.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-pnpm.sh"
resolve_pnpm_cmd || exit 1

exec "${PNPM_CMD[@]}" dev
