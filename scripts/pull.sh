#!/usr/bin/env bash
# Copy versionable files from ~/.pi/agent into this repo.
# Usage: ./scripts/pull.sh [--snapshot]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

SNAPSHOT=false
if [[ "${1:-}" == "--snapshot" ]]; then
  SNAPSHOT=true
fi

if [[ ! -d "$PI_AGENT" ]]; then
  echo "error: PI_AGENT not found: $PI_AGENT" >&2
  exit 1
fi

copy_agent_tree "$PI_AGENT" "$AGENT_DEST"
write_manifest "pull"

if [[ "$SNAPSHOT" == true ]]; then
  ts="$(timestamp_utc)"
  snap="${VERSIONS_ROOT}/agent/${ts}"
  mkdir -p "$snap"
  copy_agent_tree "$PI_AGENT" "$snap"
  echo "${ts}" > "${VERSIONS_ROOT}/agent/LATEST"
  echo "snapshot: ${snap}"
fi

echo "pulled → ${AGENT_DEST}"
echo "manifest: ${MANIFEST}"
