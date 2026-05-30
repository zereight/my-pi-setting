# Cursor CLI mode (Pi TUI)

Configured **2026-05-25** to treat `pi` as a terminal front-end for **Cursor SDK local agents**, similar to `cursor` / `Agent.prompt` with `local: { cwd }`.

## What changed

| Item | Before | Now |
|------|--------|-----|
| `settings.json` packages | 8+ npm packages | `npm:pi-cursor-sdk` only |
| `settings.json` extensions | pi-setup + agent-memory + mermaid | `[]` (empty) |
| Auto extensions | agent-mode, harness, memory, mermaid | moved to `extensions.disabled/` |
| `PI_CURSOR_SETTING_SOURCES` | `project,user,plugins` | `all` (rules + MCP + plugins + user settings) |
| Project `.pi/settings.json` | pi-autocontext | `{}` |
| Subagents / API models | opencode-go + cursor fallback | removed from settings |
| Backup | — | `settings.json.pre-cursor-cli.bak` |

## Launch

```bash
source ~/.zshrc
pi-cursor          # same as: pi --model cursor/composer-2.5
pi -p "..."        # one-shot print mode
```

Requires `CURSOR_API_KEY` or `/login` → Cursor API key in Pi.

## Still active

- `~/.pi/agent/cursor-sdk.json` — fast mode defaults for Composer (`composer-2.5`: fast off).
- Pi compaction, theme, retry — session UX only.
- Auto-discovered extensions: **none** (`extensions/` empty; former extensions in `extensions.disabled/`, including `zmux.ts`).

## Rollback

```bash
cp ~/.pi/agent/settings.json.pre-cursor-cli.bak ~/.pi/agent/settings.json
mv ~/.pi/agent/extensions.disabled/* ~/.pi/agent/extensions/
```

Restore `.zshrc` `PI_CURSOR_SETTING_SOURCES` and `PI_TOOL_PRUNER_EXTRA_ALLOW` manually if needed.

## Do not run blindly

`pnpm pi:sync` from `pi-setup` re-applies the full extension/package template and **reverts** this profile.
