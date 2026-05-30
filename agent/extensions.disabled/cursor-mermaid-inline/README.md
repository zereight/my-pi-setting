# cursor-mermaid-inline (local)

Inlines Mermaid ASCII into **assistant** messages on `message_end`.

## Why

- `npm:pi-mermaid` renders ASCII only in **Pi TUI** (`registerMessageRenderer`).
- In **Cursor agent chat**, you often see only a second custom message with `%% mermaid-hash` and the mermaid source — no flow preview.

## Setup

1. Listed in `~/.pi/agent/settings.json` → `extensions`.
2. Keep `npm:pi-mermaid` only if you use Pi TUI; for Cursor chat, **remove** `npm:pi-mermaid` from `packages` to avoid duplicate mermaid blocks.
3. `/reload` or restart Pi.

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `PI_MERMAID_INLINE` | on | `0` / `false` disables |
| `PI_MERMAID_INLINE_TUI` | off | `1` = also append in interactive Pi TUI (may duplicate pi-mermaid) |

## Verify

Ask the agent for a ` ```mermaid ` block. The assistant message should end with:

```markdown
### Mermaid (ASCII)

```text
┌───┐
...
```
```
