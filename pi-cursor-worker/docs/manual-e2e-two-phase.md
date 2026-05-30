# Manual E2E: Two-Phase Workflow (Pi TUI)

Pi orchestrates; Cursor SDK workers execute sub-tasks. This checklist verifies that split **in Pi TUI** (not Cursor Agent / `pi-cursor-sdk` as the main loop).

## What “two-phase” means

| Phase | Who runs | What happens |
|-------|----------|----------------|
| **1 — Orchestrate** | Pi (native TUI + non-Cursor main provider) | User goal → Pi plans → Pi calls `cursor_worker` (or `cursor_workflow`) |
| **2 — Execute** | Cursor SDK (`Agent.prompt`) | Each worker call runs a Cursor local agent; results return to Pi |

If `defaultProvider` is `cursor` (`pi-cursor-sdk`), you get **double orchestration** — Pi and Cursor both act as main loops. For this E2E, use a **native provider** for phase 1.

## Prerequisites

- Pi **0.78+** (`@earendil-works/pi-coding-agent`)
- Cursor SDK API key: `pi /login` → **Use an API key** → **Cursor**, or `export CURSOR_API_KEY=…`
- Local package built: `cd pi-cursor-worker && npm run build`
- Package installed: `pi install /path/to/my-pi-setting/pi-cursor-worker`

## Pre-flight (terminal, before TUI)

From `pi-cursor-worker/`:

```bash
npm run e2e:preflight
```

Or manually:

```bash
npm run verify:install
npm run smoke:cursor:pi-auth    # uses ~/.pi/agent/auth.json when env key is unset
# or: export CURSOR_API_KEY=… && npm run smoke:cursor
```

All commands must exit **0** before opening Pi TUI.

## Phase 1 — Load extension in Pi TUI

1. **Orchestrator settings** — main provider must **not** be `cursor` / `pi-cursor-sdk`. Example: copy `agent/settings/light.json`, set `"defaultProvider"` to your native provider (e.g. `anthropic`, `openai`), and add the local package to `packages`:

   ```json
   "packages": [
     "npm:pi-cursor-sdk",
     "npm:pi-dynamic-workflows",
     "../../Documents/my-pi-setting/pi-cursor-worker"
   ]
   ```

   Apply with `./scripts/install.sh` or merge into `~/.pi/agent/settings.json`.

2. Start Pi TUI in this repo (or any cwd you will pass to workers).

3. Run **`/reload`**. Extension load must succeed (no import errors).

4. Confirm **`cursor_worker`** is available (active tools or ask: “list tools that mention cursor”).

5. **Smoke in TUI (single worker):**

   > Call `cursor_worker` with prompt: `Say ok only`

   - **Wired (steps 13+):** text reply `ok` (or model output), not `{ stub: true }`.
   - **Stub only:** text `ok` with `details.stub === true` — SDK path not wired yet; finish steps 13–17 first.

## Phase 2 — Two sequential worker calls (minimal two-phase E2E)

Paste into Pi TUI (adjust paths if needed):

```text
Two-phase check — use cursor_worker twice, in order:

1) prompt: "List file names under pi-cursor-worker/src (basenames only, one per line)."
2) prompt: "From the previous list, reply with only the count of .ts files as a single integer."

After both complete, summarize: step-1 output, step-2 integer, and whether each call succeeded.
```

### Pass criteria

| Check | Expected |
|-------|----------|
| Pi invoked `cursor_worker` **twice** | Two tool calls in transcript |
| Phase 2 uses phase 1 output | Second prompt references first result (or Pi passes context) |
| No auth errors | No `CURSOR_API_KEY` / authentication messages |
| Worker results are substantive | Not empty; not generic SDK stack traces |

### Fail signals

- Extension failed on `/reload` → run `npm run build`, fix `extensions/cursor-worker.ts` import path.
- `Cursor API key missing` → `/login` or `CURSOR_API_KEY`.
- Only stub `ok` with `stub: true` → wire `cursor_worker` to `runCursorPromptAsync` (step 13).
- Main loop is Cursor provider → switch orchestrator `defaultProvider` (see phase 1).

## Phase 2b — `cursor_workflow` (after step 27)

When `cursor_workflow` exists, run one workflow script that calls `cursor_worker` at least twice. Example on disk:

`examples/e2e-two-phase.workflow.mjs`

In Pi TUI:

```text
Run cursor_workflow with the script from pi-cursor-worker/examples/e2e-two-phase.workflow.mjs
(args: {}). Report the returned JSON.
```

Pass: workflow completes; JSON includes both worker outputs; at least one `cursor_worker` call in the run.

## Recording results (optional)

| Step | Date | Pi version | Pass? | Notes |
|------|------|------------|-------|-------|
| Pre-flight | | | | |
| Phase 1 `/reload` | | | | |
| Phase 2 two `cursor_worker` | | | | |
| Phase 2b `cursor_workflow` | | | | |

## Related automation

| Command | Purpose |
|---------|---------|
| `npm run verify:install` | Package manifest, dist, settings.json link |
| `npm run smoke:cursor` | SDK `Agent.prompt` once (no Pi TUI) |
| `npm run e2e:preflight` | verify + smoke before manual TUI |
