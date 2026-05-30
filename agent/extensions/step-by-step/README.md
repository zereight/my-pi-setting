# step-by-step

A [Pi](https://github.com/earendil-works/pi) extension for staged, incremental development.

Instead of building everything in one shot, Pi breaks a task into small steps and builds each one on the real project state — pausing after each for you to review, discuss, and adjust before moving on.

## Install

### From this repo (team / my-pi-setting)

Extensions ship under `agent/extensions/`. Apply the tracked agent tree to `~/.pi/agent`:

```bash
git clone <my-pi-setting-repo> && cd my-pi-setting
./scripts/apply.sh          # copies agent/extensions/ including step-by-step
```

Or profile settings only, then extensions:

```bash
./scripts/install.sh
./scripts/apply.sh          # extensions only need this if you skipped apply above
```

In any Pi TUI session: `/reload` (extensions load at session start and on reload).

### Manual copy

```bash
mkdir -p ~/.pi/agent/extensions/step-by-step
cp agent/extensions/step-by-step/index.ts ~/.pi/agent/extensions/step-by-step/index.ts
```

Then `/reload`.

## Usage

### Start a session

```
/step-by-step:start Build a REST API with FastAPI
```

Pi produces a step-by-step plan. Review it, adjust if needed, then confirm.

### Work through steps

For each step, Pi:

1. Reads any relevant skills (if available) for up-to-date instructions
2. Reads your current project files
3. Builds the next small increment
4. Explains what it did and why

Then you review. Ask questions, request changes, discuss tradeoffs, rewrite it yourself — whatever you need. When you're satisfied:

```
/step-by-step:next
```

The conversation is compacted (if needed) and Pi builds the next step.

### Commands

| Command | Description |
|---|---|
| `/step-by-step:start <topic>` | Start a session |
| `/step-by-step:next` | Done reviewing — advance to next step |
| `/step-by-step:skip` | Skip the current step |
| `/step-by-step:skip-to <N>` | Skip from current through step N−1, then start step N |
| `/step-by-step:run-to <N>` | Auto-build steps until N (review pauses at step N) |
| `/step-by-step:pause` | Pause step mode — work freely, plan kept |
| `/step-by-step:resume` | Resume after pause |
| `/step-by-step:stop` | End the session |
| `/step-by-step:show-plan` | Show the full plan with progress |

**Examples**

- On step 2, already have steps 3–5 covered: `/step-by-step:skip-to 6`
- Trust steps 3–7, want to review at 8: `/step-by-step:run-to 8` (**only while reviewing** step 2 — not while Pi is still building)
- Need to fix something unrelated: `/step-by-step:pause`, then `/step-by-step:resume`

**Notes**

- `run-to` requires **reviewing** state (after Pi finishes the current step). Use `skip-to` to jump ahead without building.
- Step transitions queue the next prompt with `deliverAs: "followUp"` so they do not race an in-flight agent turn.

### UI

A progress widget is shown throughout the session:

```
🔨 REST API with FastAPI  [3/8]  ● ● ◐ ○ ○ ○ ○ ○
```

## How it works

The extension is a state machine:

```
IDLE → PLANNING → STEPPING → REVIEWING
                      ↑           │
                      └───────────┘
                      (compact & next / run-to auto)

STEPPING / REVIEWING ──pause──► PAUSED ──resume──► (previous state)
Any active ──stop──► IDLE
```

- **PLANNING** — Pi outlines the steps (descriptions only, no code)
- **STEPPING** — Pi reads the project, builds the next increment, explains it
- **REVIEWING** — You review, discuss, adjust. Move on when ready.

State is persisted in the session, so it survives restarts.

## Design principles

- **Incremental, not top-down** — each step is a small working addition, like how you'd actually build something
- **Review however you want** — read and approve, ask questions, rewrite it yourself, or discuss alternatives
- **Skills-aware** — Pi reads available agent skills for up-to-date instructions when building each step
- **Smart compaction** — only compacts when context usage warrants it

See [DESIGN.md](DESIGN.md) for the full architecture.
