#!/usr/bin/env bash
# Graceful restart: SIGTERM on 3000 and 8000, then pnpm dev (avoids leaked sklearn semaphores).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib-pnpm.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-pnpm.sh"
resolve_pnpm_cmd || exit 1

lsof -ti:3000 -ti:8000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
sleep 3
exec "${PNPM_CMD[@]}" dev
