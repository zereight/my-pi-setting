# pi-cursor-worker

Pi orchestration with **Cursor SDK** workers (`Agent.prompt` as sub-tasks).

## Quick commands

```bash
npm run build
npm run verify:install          # package + dist + ~/.pi/agent link
npm run smoke:cursor:pi-auth    # SDK smoke (pi /login key)
npm run e2e:preflight           # verify + smoke before manual TUI E2E
npm run pack:check              # npm pack tarball contents (pre-publish)
```

Install into Pi:

```bash
./scripts/install.sh --profile orchestrator   # from my-pi-setting repo root
pi install /path/to/my-pi-setting/pi-cursor-worker
# Pi TUI: /reload
```

## Workflows ([pi-dynamic-workflows](https://github.com/Michaelliv/pi-dynamic-workflows))

```bash
pi install npm:pi-dynamic-workflows   # or: pi install https://github.com/Michaelliv/pi-dynamic-workflows
```

Pi TUI → `/reload` → use the **`workflow`** tool (Pi subagents via `agent()`). Different from **`cursor_worker`** (Cursor SDK).

## Manual E2E (two-phase)

See **[docs/manual-e2e-two-phase.md](docs/manual-e2e-two-phase.md)** — Pi orchestrates (phase 1), `cursor_worker` runs SDK sub-tasks (phase 2).

Reference workflow script (for `cursor_workflow`, step 27+): [examples/e2e-two-phase.workflow.mjs](examples/e2e-two-phase.workflow.mjs).
