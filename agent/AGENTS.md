# Pi (light)

- Provider: `pi-cursor-sdk` + `PI_CURSOR_SETTING_SOURCES=project` (see `~/.zshrc`).
- Global skills: none (`~/.agents/skills` not loaded — saves ~42k tokens).
- BankX repo: `.pi/settings.json` whitelists `zereight-mode` + `drawio-skill` only.

## BankX in this monorepo

| Need | Command |
|------|---------|
| Rigorous RN work | `/skill:zereight-mode` then your task (or type `/zereight-mode` in Cursor Agent) |
| Diagrams | `/skill:drawio-skill` or ask for a diagram |
| Full Cursor rules + all skills | `pi-heavy` (still light `settings.json`; restore heavy file for old packages) |

`zereight-mode` uses `disable-model-invocation: true` — not in the skill catalog; invoke explicitly.

Restore full Pi stack: `cp ~/.pi/agent/settings.json.heavy-20260530.bak ~/.pi/agent/settings.json`

## Workflows (light)

- Package: `npm:pi-dynamic-workflows` — multi-agent `workflow` tool (fan-out / pipeline).
- In Pi TUI: ask for a workflow, or `/reload` after install. Not available in Cursor SDK bridge.
