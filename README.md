# my-pi-setting

Versioned **Pi agent** configuration (`~/.pi/agent`) for sharing with your team and your future self.

| Language | Guide |
|----------|--------|
| **한국어** | [docs/ko/README.md](docs/ko/README.md) |
| **English** | [docs/en/README.md](docs/en/README.md) |

## Quick start

```bash
./scripts/pull.sh          # machine → repo (after local Pi changes)
./scripts/install.sh       # repo → ~/.pi/agent (light profile)
./scripts/apply.sh         # extensions: step-by-step, entry-point-lab, render-mermaid
```

**Teammate setup:** clone → `./scripts/install.sh` → `./scripts/apply.sh` → open Pi TUI → `/reload`. See [docs/ko/README.md](docs/ko/README.md) · [step-by-step](agent/extensions/step-by-step/README.md).

More: [docs/README.md](docs/README.md) · [CHANGELOG.md](CHANGELOG.md) · [docs/decisions/](docs/decisions/)
