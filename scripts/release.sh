#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${REPO_ROOT}/VERSION"
CHANGELOG="${REPO_ROOT}/CHANGELOG.md"

usage() {
  cat <<'EOF'
Usage: ./scripts/release.sh <new-version>

Bump VERSION, remind to update CHANGELOG, create git tag v<version>.

Example:
  ./scripts/release.sh 0.1.1
EOF
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

NEW_VERSION="$1"
CURRENT="$(tr -d '[:space:]' <"${VERSION_FILE}")"

if [[ ! "${NEW_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must be semver (e.g. 0.1.1)" >&2
  exit 1
fi

echo "${NEW_VERSION}" >"${VERSION_FILE}"
echo "VERSION: ${CURRENT} → ${NEW_VERSION}"
echo ""
echo "Next:"
echo "  1. Edit ${CHANGELOG} (## ${NEW_VERSION})"
echo "  2. git add VERSION CHANGELOG.md agent/ shell/ scripts/ templates/"
echo "  3. git commit -m \"Release v${NEW_VERSION}.\""
echo "  4. git tag v${NEW_VERSION} && git push origin main --tags"
