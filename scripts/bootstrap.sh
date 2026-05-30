#!/usr/bin/env bash
set -euo pipefail

PI_SETTING_REPO="${PI_SETTING_REPO:-}"
PI_SETTING_REF="${PI_SETTING_REF:-main}"
PROFILE="${PI_SETTING_PROFILE:-light}"
CLONE_DIR="${PI_SETTING_CLONE_DIR:-${HOME}/.local/share/my-pi-setting}"
INSTALL_LOCAL=0

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap.sh [options]

Clone (or use local checkout), checkout a ref, and run install.sh.

Options:
  --local              Use this repo directory (no git clone)
  --repo <git-url>     Clone URL (required for remote bootstrap)
  --ref <ref>          Branch or tag (default: main)
  --profile <name>     light | orchestrator (default: light)
  --dir <path>         Clone directory (default: ~/.local/share/my-pi-setting)
  -h, --help           Show this help

Examples:
  PI_SETTING_REPO=https://github.com/you/my-pi-setting.git ./scripts/bootstrap.sh

  git clone ... && cd my-pi-setting
  ./scripts/bootstrap.sh --local

  PI_SETTING_REF=v0.1.0 ./scripts/bootstrap.sh --local
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      INSTALL_LOCAL=1
      shift
      ;;
    --repo)
      PI_SETTING_REPO="${2:?missing value for --repo}"
      shift 2
      ;;
    --ref)
      PI_SETTING_REF="${2:?missing value for --ref}"
      shift 2
      ;;
    --profile)
      PROFILE="${2:?missing value for --profile}"
      shift 2
      ;;
    --dir)
      CLONE_DIR="${2:?missing value for --dir}"
      shift 2
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

if ! command -v pi >/dev/null 2>&1; then
  echo "error: pi is not on PATH. Install from https://pi.dev/" >&2
  exit 1
fi

if [[ "${INSTALL_LOCAL}" -eq 1 ]]; then
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
else
  if [[ -z "${PI_SETTING_REPO}" ]]; then
    echo "error: set PI_SETTING_REPO or pass --repo <url>" >&2
    usage >&2
    exit 1
  fi
  if [[ -d "${CLONE_DIR}/.git" ]]; then
    echo "Updating ${CLONE_DIR} (${PI_SETTING_REF})"
    git -C "${CLONE_DIR}" fetch --tags origin
    git -C "${CLONE_DIR}" checkout "${PI_SETTING_REF}"
    git -C "${CLONE_DIR}" pull --ff-only origin "${PI_SETTING_REF}" 2>/dev/null || true
  else
    echo "Cloning ${PI_SETTING_REPO} → ${CLONE_DIR}"
    git clone --depth 1 --branch "${PI_SETTING_REF}" "${PI_SETTING_REPO}" "${CLONE_DIR}" 2>/dev/null \
      || git clone "${PI_SETTING_REPO}" "${CLONE_DIR}" && git -C "${CLONE_DIR}" checkout "${PI_SETTING_REF}"
  fi
  REPO_ROOT="${CLONE_DIR}"
fi

"${REPO_ROOT}/scripts/install.sh" --profile "${PROFILE}" --shell

if ! pi install npm:pi-cursor-sdk 2>/dev/null; then
  echo "note: run 'pi install npm:pi-cursor-sdk' if the cursor provider package is missing"
fi

cat <<EOF

Bootstrap complete (${REPO_ROOT}, ref=${PI_SETTING_REF}, profile=${PROFILE}).
Pin a release: PI_SETTING_REF=v0.1.0 ./scripts/bootstrap.sh --local
EOF
