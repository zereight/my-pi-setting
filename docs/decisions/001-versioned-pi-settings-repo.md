# ADR-001: Versioned Pi settings in `my-pi-setting`

[한국어](001-versioned-pi-settings-repo.ko.md)

## Status

Accepted

## Date

2026-05-30

## Context

Pi agent config lives in `~/.pi/agent/` and changes over time (light vs orchestrator profiles, extensions on/off, Cursor SDK env). We need a shareable, reviewable copy for teammates and future self, without leaking secrets or session data.

## Decision

1. Mirror **safe, portable** files under `agent/` in this repo.
2. Use **git** for day-to-day history; optional `versions/agent/<UTC>/` for point-in-time folder snapshots.
3. Sync via `scripts/pull.sh` (machine → repo) and `scripts/apply.sh` (repo → machine).
4. Exclude auth, tokens, sessions, caches, and large model lists via `.gitignore`.

## Alternatives considered

- **Symlink `~/.pi/agent` → repo**: rejected — mixes secrets and sessions into the working tree.
- **Only manual copies**: rejected — drifts quickly without a pull script.
- **Single monolithic tarball**: rejected — poor diff/review in git.

## Consequences

- After changing Pi locally, run `./scripts/pull.sh` and commit.
- Restoring on a new machine: clone repo, `./scripts/apply.sh`, then set `PI_CURSOR_SETTING_SOURCES` from `env/pi-shell.example.zsh`.
- Orchestrator profile: `agent/settings/orchestrator.json`; variant backups under `agent/variants/` — no committed secrets.
