# Changelog

All notable changes to this repo are documented here. Install a specific version with:

```bash
git checkout v0.1.0 && ./scripts/install.sh
```

## Unreleased

### Added

- **render-mermaid** extension: `render_mermaid` tool (Mermaid → PNG/SVG via `mmdc`, like `render_chart`)
- **orchestrator** profile + `pi-cursor-worker` package (Cursor `Agent.prompt` sub-tasks)
- npm stack in light profile: `pi-dynamic-workflows`, `pi-ask-user-question`, `@miclivs/pi-charts`
- Architecture docs: `docs/ko/architecture.svg`, `architecture.html`
- Tool output dirs: `.charts/`, `.mermaid/` settings templates (output gitignored)
- **step-by-step** extension: `pause`, `resume`, `stop`, `skip-to`, `run-to`; queue step prompts via `deliverAs: "followUp"` to avoid agent race errors
- Bilingual docs: `docs/ko/`, `docs/en/`, hub `README.md` and `docs/README.md`
- `scripts/pull.sh` — sync `~/.pi/agent` → `agent/` (optional `--snapshot`)
- `scripts/apply.sh` — restore tracked files to `~/.pi/agent`
- `scripts/snapshot.sh` — folder snapshot under `versions/agent/`
- `manifest.json`, `docs/decisions/001-versioned-pi-settings-repo.md`

## 0.1.0 — 2026-05-30

### Added

- Versioned agent profiles: `light` (default) and `heavy`
- `agent/AGENTS.md` for pi-cursor-sdk project-only setting sources
- `shell/pi-cursor.zsh` helpers: `pi-light`, `pi-heavy`, `pi-cursor`
- `scripts/install.sh` and `scripts/bootstrap.sh` for team install
- `templates/bankx/.pi/settings.json` project template
- `scripts/release.sh` semver bump helper
