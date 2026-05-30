#!/usr/bin/env bash
# Apply tracked files from this repo to ~/.pi/agent (backs up existing files first).
# Usage: ./scripts/apply.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ ! -d "$AGENT_DEST" ]]; then
  echo "error: repo agent/ missing — run ./scripts/pull.sh first" >&2
  exit 1
fi

backup_dir="${PI_AGENT}/.repo-apply-backup-$(timestamp_utc)"
mkdir -p "$backup_dir"

apply_one() {
  local rel="$1"
  local src="${AGENT_DEST}/${rel}"
  local dest="${PI_AGENT}/${rel}"
  if [[ ! -e "$src" ]]; then
    return 0
  fi
  if [[ -e "$dest" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      echo "[dry-run] would backup & copy: ${rel}"
    else
      mkdir -p "$(dirname "${backup_dir}/${rel}")"
      cp -R "$dest" "${backup_dir}/${rel}"
      rm -rf "$dest"
      if [[ -d "$src" ]]; then
        cp -R "$src" "$dest"
      else
        mkdir -p "$(dirname "$dest")"
        cp "$src" "$dest"
      fi
      echo "applied: ${rel}"
    fi
  else
    if [[ "$DRY_RUN" == true ]]; then
      echo "[dry-run] would copy: ${rel}"
    else
      if [[ -d "$src" ]]; then
        cp -R "$src" "$dest"
      else
        mkdir -p "$(dirname "$dest")"
        cp "$src" "$dest"
      fi
      echo "applied (new): ${rel}"
    fi
  fi
}

for rel in settings.json AGENTS.md cursor-sdk.json README-cursor-cli.md; do
  apply_one "$rel"
done

for dir in extensions extensions.disabled; do
  apply_one "$dir"
done

if [[ "$DRY_RUN" == false ]]; then
  write_manifest "apply"
  echo "backup of previous files: ${backup_dir}"
fi

echo "done → ${PI_AGENT}"
