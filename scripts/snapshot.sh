#!/usr/bin/env bash
# Create a dated copy under versions/<folder>/ without changing agent/ canonical tree.
# Usage: ./scripts/snapshot.sh [agent]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

FOLDER="${1:-agent}"
ts="$(timestamp_utc)"

case "$FOLDER" in
  agent)
    snap="${VERSIONS_ROOT}/agent/${ts}"
    mkdir -p "$snap"
    if [[ -d "$AGENT_DEST" ]]; then
      cp -R "$AGENT_DEST/." "$snap/"
    else
      copy_agent_tree "$PI_AGENT" "$snap"
    fi
    echo "${ts}" > "${VERSIONS_ROOT}/agent/LATEST"
    ;;
  *)
    echo "error: unknown folder '${FOLDER}' (supported: agent)" >&2
    exit 1
    ;;
esac

write_manifest "snapshot-${FOLDER}"
echo "snapshot: ${snap}"
