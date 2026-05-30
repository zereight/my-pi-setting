#!/usr/bin/env bash
# Terminal checks before manual Pi TUI E2E (docs/manual-e2e-two-phase.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if ! npm run verify:install; then
	echo "e2e-preflight: warn — verify:install failed (often missing pi install); continuing SDK smoke…" >&2
fi

if [[ -n "${CURSOR_API_KEY:-}" ]]; then
	npm run smoke:cursor
else
	SMOKE_USE_PI_AUTH=1 npm run smoke:cursor
fi

echo "e2e-preflight: PASS — continue in Pi TUI (see docs/manual-e2e-two-phase.md)"
