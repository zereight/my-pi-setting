#!/usr/bin/env bash
# Shared paths for pi settings sync (source from pull.sh / apply.sh / snapshot.sh)
set -euo pipefail

PI_AGENT="${PI_AGENT:-$HOME/.pi/agent}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DEST="${REPO_ROOT}/agent"
VERSIONS_ROOT="${REPO_ROOT}/versions"
MANIFEST="${REPO_ROOT}/manifest.json"

# Relative paths under ~/.pi/agent that are safe to version (no secrets / no huge caches)
AGENT_TRACKED_PATHS=(
  settings.json
  AGENTS.md
  cursor-sdk.json
  README-cursor-cli.md
  settings.json.heavy-20260530.bak
  settings.json.pre-cursor-cli.bak
  settings.json.before-reset-20260526
  extensions
  extensions.disabled
)

ENV_EXAMPLE="${REPO_ROOT}/env/pi-shell.example.zsh"

timestamp_utc() {
  date -u +"%Y%m%d-%H%M%S"
}

write_manifest() {
  local action="$1"
  local ts
  ts="$(timestamp_utc)"
  # shellcheck disable=SC2016
  python3 - "$MANIFEST" "$action" "$ts" "$PI_AGENT" <<'PY'
import json, sys
from pathlib import Path

path, action, ts, pi_agent = sys.argv[1:5]
data = {}
if Path(path).is_file():
    data = json.loads(Path(path).read_text())
data.update({
    "lastAction": action,
    "lastUpdatedUtc": ts,
    "piAgentSource": pi_agent,
    "trackedAgentPaths": [
        "settings.json",
        "AGENTS.md",
        "cursor-sdk.json",
        "README-cursor-cli.md",
        "extensions/",
        "extensions.disabled/",
        "variants/",
    ],
})
Path(path).write_text(json.dumps(data, indent=2) + "\n")
PY
}

copy_agent_tree() {
  local src_root="$1"
  local dest_root="$2"
  mkdir -p "${dest_root}/variants"
  for rel in "${AGENT_TRACKED_PATHS[@]}"; do
    local src="${src_root}/${rel}"
  if [[ ! -e "$src" ]]; then
      continue
    fi
    if [[ "$rel" == settings.json.heavy-* ]] || [[ "$rel" == settings.json.pre-* ]] || [[ "$rel" == settings.json.before-* ]]; then
      local base
      base="$(basename "$rel")"
      cp -R "$src" "${dest_root}/variants/${base}"
    elif [[ -d "$src" ]]; then
      rm -rf "${dest_root}/${rel}"
      cp -R "$src" "${dest_root}/${rel}"
    else
      mkdir -p "$(dirname "${dest_root}/${rel}")"
      cp "$src" "${dest_root}/${rel}"
    fi
  done
  # Friendly aliases for variant files
  if [[ -f "${dest_root}/variants/settings.json.heavy-20260530.bak" ]]; then
    cp "${dest_root}/variants/settings.json.heavy-20260530.bak" "${dest_root}/settings.heavy.json"
  fi
  if [[ -f "${dest_root}/variants/settings.json.pre-cursor-cli.bak" ]]; then
    cp "${dest_root}/variants/settings.json.pre-cursor-cli.bak" "${dest_root}/settings.pre-cursor-cli.json"
  fi
  sync_profile_json_files "$dest_root"
}

sync_profile_json_files() {
  local dest_root="$1"
  mkdir -p "${dest_root}/settings"
  if [[ -f "${dest_root}/settings.json" ]]; then
    cp "${dest_root}/settings.json" "${dest_root}/settings/light.json"
  fi
  if [[ -f "${dest_root}/settings.heavy.json" ]]; then
    cp "${dest_root}/settings.heavy.json" "${dest_root}/settings/heavy.json"
  fi
}
