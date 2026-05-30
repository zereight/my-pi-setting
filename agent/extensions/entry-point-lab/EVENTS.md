# Pi extension event hooks (step 6)

Source: `@earendil-works/pi-coding-agent/docs/extensions.md` — Lifecycle Overview.

Register with `pi.on("event_name", async (event, ctx) => { ... })` inside the default export factory.

## Prompt → agent loop (most common)

| Event | When | Typical use | Return value |
|-------|------|-------------|--------------|
| `input` | User submits text (before skills/templates) | Transform prompt, slash-like shortcuts | `{ action: "transform" \| "handled" \| ... }` |
| `before_agent_start` | After submit, before agent loop | Inject context message, tweak `systemPrompt` | `{ message?, systemPrompt? }` |
| `agent_start` | Start of one user prompt's agent run | Counters, UI reset | — |
| `turn_start` | Each LLM turn (may repeat with tools) | Per-turn logging | — |
| `context` | Before each LLM request | Filter/prune messages | `{ messages }` |
| `before_provider_request` | Payload built, before HTTP | Debug/replace provider payload | new payload or `undefined` |
| `after_provider_response` | Response headers received | Logging | — |
| `tool_execution_start` | Tool run begins | UI spinner | — |
| `tool_call` | Tool invoked (can block) | Permission gates (`rm -rf`) | `{ block: true, reason }` |
| `tool_execution_update` | Streaming tool output | Progress UI | — |
| `tool_result` | Tool finished | Redact/modify results | `{ result }` |
| `tool_execution_end` | Tool finalized | Cleanup | — |
| `turn_end` | Turn complete | Stats | — |
| `message_start` / `message_update` / `message_end` | Message lifecycle | Streaming UI, cost overlay | `{ message }` on `message_end` |
| `agent_end` | Agent idle after prompt | Notifications (`notify.ts`) | — |

## Startup / session lifecycle

| Event | When | `event.reason` (if any) | Typical use |
|-------|------|-------------------------|-------------|
| `session_start` | Pi start, reload, new/resume/fork session | `startup`, `reload`, `new`, `resume`, `fork` | Restore state, `appendEntry` replay |
| `resources_discover` | After `session_start` | `startup`, `reload` | Extra skill/prompt/theme paths |
| `session_before_switch` | Before `/new` or `/resume` | `new`, `resume` | Confirm destructive switch | `{ cancel: true }` |
| `session_before_fork` | Before `/fork` or `/clone` | — | Cancel fork | `{ cancel: true }` |
| `session_shutdown` | Extension runtime torn down | `quit`, `reload`, `new`, `resume`, `fork` | Cleanup |
| `session_before_compact` | Before compaction | — | Custom summary / cancel | `{ cancel }` or `{ compaction }` |
| `session_compact` | After compaction | — | Post-process summary |
| `session_before_tree` | Before `/tree` nav | — | Custom branch summary | `{ cancel }` or `{ summary }` |
| `session_tree` | After tree navigation | — | — |

## Model / thinking

| Event | When | Typical use |
|-------|------|-------------|
| `model_select` | Model changed (UI or API) | Status bar |
| `thinking_level_select` | Thinking level changed | Clamp/disable UI |

## Other

| Event | When | Typical use |
|-------|------|-------------|
| `user_bash` | User runs bash outside agent tools | Interactive shell hook |

## Used by `step-by-step` (this repo)

| Event | Role |
|-------|------|
| `before_agent_start` | Planning/stepping/reviewing system prompts |
| `agent_end` | Plan confirm UI, stepping→reviewing, redundant step parse |
| `context` | Strip stale `step-by-step-context` when idle or paused |
| `session_start` | Restore persisted step state |

## Order sketch (one user prompt)

```
input → before_agent_start → agent_start
  → (turn_start → context → provider → tools* → turn_end)*
  → agent_end
```
