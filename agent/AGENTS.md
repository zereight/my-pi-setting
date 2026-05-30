# Pi (light)

- Provider: `pi-cursor-sdk` + `PI_CURSOR_SETTING_SOURCES=project` (see `~/.zshrc`).
- Global skills: none (`~/.agents/skills` not loaded — saves ~42k tokens).

## Step-by-step (Pi TUI)

- Extension: `agent/extensions/step-by-step/` — staged builds with review between steps.
- Install for teammates: `./scripts/apply.sh` then `/reload` in Pi (not listed in Cursor Agent slash menu).
- Start: `/step-by-step:start <topic>` · advance: `/step-by-step:next` · bulk: `skip-to`, `run-to` (reviewing only), `pause`, `stop`.
- Docs: `agent/extensions/step-by-step/README.md`

## Mermaid (`render_mermaid`, Pi TUI)

- Extension: `agent/extensions/render-mermaid/` — Mermaid → PNG/SVG inline (like `@miclivs/pi-charts` `render_chart`).
- Install: `./scripts/apply.sh` → `/reload`. Requires `mmdc` on PATH (`npm i -g @mermaid-js/mermaid-cli`).
- Output: `.mermaid/output/` · config: `.mermaid/settings.json`

## Workflows ([pi-dynamic-workflows](https://github.com/Michaelliv/pi-dynamic-workflows))

Pi TUI extension: **`workflow`** tool — fan-out / pipeline via isolated Pi subagents (`agent()` in a JS script).

| Step | Command |
|------|---------|
| Install (npm, recommended) | `pi install npm:pi-dynamic-workflows` |
| Install (git) | `pi install https://github.com/Michaelliv/pi-dynamic-workflows` |
| Activate | Pi TUI → `/reload` |

Orchestrator profile (`./scripts/install.sh --profile orchestrator`) runs the npm install for you when `pi` is on PATH.

**Usage (Pi TUI):** ask in plain language, e.g. “Run a workflow to list `pi-cursor-worker/src` and summarize modules.”

**Not** the same as `cursor_worker` (`pi-cursor-worker` → Cursor SDK). `workflow` uses Pi subagents; `cursor_worker` uses `Agent.prompt`. Not available in Cursor SDK bridge.

## Orchestrator mode (Composer main + `cursor_worker` sub-tasks)

**Main loop:** `cursor` / `composer-2.5` (`pi-cursor-sdk`). **Explicit sub-tasks:** `cursor_worker` (`pi-cursor-worker` → `Agent.prompt`).

| Step | Command |
|------|---------|
| Install profile | `./scripts/install.sh --profile orchestrator` |
| Workflows package | [pi-dynamic-workflows](https://github.com/Michaelliv/pi-dynamic-workflows) — `pi install npm:pi-dynamic-workflows` (included in install script) |
| Link local package | `pi install /path/to/my-pi-setting/pi-cursor-worker` |
| Pi TUI | `/reload` — confirm `cursor_worker` and `workflow` are active |
| Cursor API key | `pi /login` → Use an API key → Cursor (or `CURSOR_API_KEY`) |

- Profile: `agent/settings/orchestrator.json` — same main model as light (`composer-2.5`) **plus** `pi-cursor-worker`.
- Use `cursor_worker` when you want a **separate** Cursor SDK run (research, second pass, parallel sub-task) without stuffing everything into one chat turn.
- Restore light without worker package: `./scripts/install.sh --profile light`
- Manual E2E: `pi-cursor-worker/docs/manual-e2e-two-phase.md`
