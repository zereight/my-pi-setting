# my-pi-setting

[한국어](../ko/README.md) · [Documentation index](../README.md)

Portable, **version-controlled** snapshot of Pi agent configuration (`~/.pi/agent`) for teammates and future you.

## Layout

| Path | Purpose |
|------|---------|
| `agent/settings/light.json` | Light profile (`install.sh` default) |
| `agent/settings/orchestrator.json` | Orchestrator profile (includes `cursor_worker`) |
| `agent/settings.json` | **Live** light snapshot from last `./scripts/pull.sh` |
| `agent/AGENTS.md` | Agent instructions |
| `agent/extensions/` · `extensions.disabled/` | Extensions |
| `agent/variants/` | `settings.json.*.bak` backups |
| `shell/pi-cursor.zsh` | `pi-light` / `pi-cursor` |
| `versions/agent/<UTC>/` | Optional folder snapshots (may be gitignored) |
| `manifest.json` | Last pull/apply timestamp |

**Excluded:** `auth.json`, tokens, `sessions/`, model lists, caches (see `.gitignore`).

## Day-to-day (after changing Pi on your Mac)

```bash
./scripts/pull.sh          # ~/.pi/agent → agent/
git add -A && git status   # review, then commit
```

Optional folder snapshot:

```bash
./scripts/pull.sh --snapshot   # e.g. versions/agent/20260530-040552/
```

Details: [versions.md](versions.md)

## Install on another machine / for teammates

**Profile only** (recommended):

```bash
git clone <this-repo> && cd my-pi-setting
./scripts/install.sh                    # light
./scripts/install.sh --profile orchestrator
./scripts/install.sh --shell            # prints ~/.zshrc source line
```

**Full tree** (includes extensions):

```bash
./scripts/apply.sh
```

In Pi TUI run `/reload` once (extensions load at session start and on reload).

### step-by-step extension

Staged development with review between steps (`agent/extensions/step-by-step/`).

| Step | Command |
|------|---------|
| Team install | `./scripts/apply.sh` → Pi TUI `/reload` |
| Start | `/step-by-step:start <topic>` |
| Advance | `/step-by-step:next` (after review) |
| Bulk skip / auto-build | `skip-to`, `run-to` (`run-to` only while **reviewing**) |
| Detour | `pause` / `resume` / `stop` |

Full reference: [agent/extensions/step-by-step/README.md](../../agent/extensions/step-by-step/README.md)

Remote + tag:

```bash
PI_SETTING_REPO=https://github.com/zereight/my-pi-setting.git ./scripts/bootstrap.sh
PI_SETTING_REF=v0.1.0 ./scripts/bootstrap.sh --local
```

## Versioning

| Method | Description |
|--------|-------------|
| **Git** | Primary — commit after each `pull` for diffs |
| **Semver** | `VERSION` + `git tag v0.1.0` + `CHANGELOG.md` |
| **Folders** | `versions/agent/<UTC>/` — optional, often gitignored |

Release process: [RELEASE.md](RELEASE.md) · `./scripts/release.sh`

## Profiles

| Profile | File | Purpose |
|---------|------|---------|
| **light** | `agent/settings/light.json` | Daily coding (`PI_CURSOR_SETTING_SOURCES=project`) |
| **orchestrator** | `agent/settings/orchestrator.json` | light + `pi-cursor-worker` / `cursor_worker` |

Cursor CLI mode: `agent/README-cursor-cli.md`, `agent/AGENTS.md`

## Security

Never commit API keys or `auth.json`. If something leaked, **rotate credentials** and remove from git history.
