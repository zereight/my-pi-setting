#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_AGENT_DIR="${PI_AGENT_DIR:-${HOME}/.pi/agent}"
PROFILE="light"
INSTALL_SHELL=0
DRY_RUN=0
SKIP_BACKUP=0

usage() {
  cat <<'EOF'
Usage: ./scripts/install.sh [options]

Sync versioned Pi agent settings from this repo into ~/.pi/agent.

Options:
  --profile <light|orchestrator>   Settings profile (default: light)
  --shell                   Print how to source shell/pi-cursor.zsh in ~/.zshrc
  --dry-run                 Show actions without writing files
  --skip-backup             Do not backup existing settings.json
  -h, --help                Show this help

Examples:
  ./scripts/install.sh
  ./scripts/install.sh --profile orchestrator
  PI_SETTING_REF=v0.1.0 git checkout v0.1.0 && ./scripts/install.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:?missing value for --profile}"
      shift 2
      ;;
    --shell)
      INSTALL_SHELL=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "${PROFILE}" in
  light | orchestrator) ;;
  *)
    echo "error: unknown profile: ${PROFILE} (use light or orchestrator)" >&2
    exit 1
    ;;
esac

SETTINGS_SRC="${REPO_ROOT}/agent/settings/${PROFILE}.json"
AGENTS_SRC="${REPO_ROOT}/agent/AGENTS.md"
VERSION="$(tr -d '[:space:]' <"${REPO_ROOT}/VERSION")"

if [[ ! -f "${SETTINGS_SRC}" ]]; then
  echo "error: missing ${SETTINGS_SRC}" >&2
  exit 1
fi

run() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

echo "my-pi-setting ${VERSION} → profile=${PROFILE}"

run mkdir -p "${PI_AGENT_DIR}"

if [[ -f "${PI_AGENT_DIR}/settings.json" && "${SKIP_BACKUP}" -eq 0 ]]; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  BACKUP="${PI_AGENT_DIR}/settings.json.bak-${STAMP}"
  echo "backup: ${PI_AGENT_DIR}/settings.json → ${BACKUP}"
  run cp "${PI_AGENT_DIR}/settings.json" "${BACKUP}"
fi

echo "settings: ${SETTINGS_SRC} → ${PI_AGENT_DIR}/settings.json"
run cp "${SETTINGS_SRC}" "${PI_AGENT_DIR}/settings.json"

echo "agents: ${AGENTS_SRC} → ${PI_AGENT_DIR}/AGENTS.md"
run cp "${AGENTS_SRC}" "${PI_AGENT_DIR}/AGENTS.md"

if command -v pi >/dev/null 2>&1; then
  case "${PROFILE}" in
    light | orchestrator)
      echo "pi install: npm:pi-dynamic-workflows (https://github.com/Michaelliv/pi-dynamic-workflows)"
      run pi install npm:pi-dynamic-workflows
      echo "pi install: npm:pi-ask-user-question (https://github.com/Michaelliv/pi-ask-user-question)"
      run pi install npm:pi-ask-user-question
      echo "pi install: npm:@miclivs/pi-charts (https://github.com/Michaelliv/pi-charts)"
      run pi install npm:@miclivs/pi-charts
      ;;
  esac
fi

if [[ "${PROFILE}" == "orchestrator" ]]; then
  WORKER_PKG="${REPO_ROOT}/pi-cursor-worker"
  if [[ -d "${WORKER_PKG}" ]]; then
    echo "pi-cursor-worker: npm run build"
    run bash -c "cd \"${WORKER_PKG}\" && npm run build"
    if command -v pi >/dev/null 2>&1; then
      echo "pi install: ${WORKER_PKG}"
      run pi install "${WORKER_PKG}"
    else
      echo "warn: pi not on PATH — run: pi install ${WORKER_PKG}"
    fi
  fi
fi

MARKER="${PI_AGENT_DIR}/.my-pi-setting-version"
echo "marker: ${VERSION} (${PROFILE}) → ${MARKER}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] write ${MARKER}"
else
  printf '%s %s\n' "${VERSION}" "${PROFILE}" >"${MARKER}"
fi

if [[ "${INSTALL_SHELL}" -eq 1 ]]; then
  SOURCE_LINE="[[ -f \"${REPO_ROOT}/shell/pi-cursor.zsh\" ]] && source \"${REPO_ROOT}/shell/pi-cursor.zsh\""
  cat <<EOF

Add to ~/.zshrc (or keep a clone path stable and source from there):

  ${SOURCE_LINE}

Then: source ~/.zshrc
EOF
fi

cat <<EOF

Done.
  pi --version
  pi-cursor          # if shell snippet is sourced
  ./scripts/install.sh --profile orchestrator   # Pi orchestrates + cursor_worker

Extensions (step-by-step, render-mermaid):
  ./scripts/apply.sh
  # then in Pi TUI: /reload
  # render-mermaid: npm i -g @mermaid-js/mermaid-cli  (mmdc on PATH)
EOF
