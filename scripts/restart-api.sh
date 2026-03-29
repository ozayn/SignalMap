#!/usr/bin/env bash
# Graceful restart API only (port 8000), then pnpm --filter api dev.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib-pnpm.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-pnpm.sh"
resolve_pnpm_cmd || exit 1

lsof -ti:8000 | xargs kill -TERM 2>/dev/null || true
sleep 3
exec "${PNPM_CMD[@]}" --filter api dev
