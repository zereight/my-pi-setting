# Release guide

[한국어](../ko/RELEASE.md)

This repo is **configuration**, not a hosted service. Distribution is **git tags**.

## Versioning

| File | Role |
|------|------|
| `VERSION` | Current semver (no `v` prefix) |
| `CHANGELOG.md` | Human-readable history |
| Git tag `v*.*.*` | Pinned install for the team |

Follow [semver](https://semver.org/):

- **Patch** — typo/docs, non-breaking tuning in JSON profiles
- **Minor** — new profile, new template, new shell helper (backward compatible)
- **Major** — removed profile, renamed paths, breaking install contract

## Maintainer checklist

```bash
git status
./scripts/install.sh --dry-run
```

1. Run `./scripts/release.sh 0.1.1`
2. Update `CHANGELOG.md`
3. Commit and tag:

```bash
git add VERSION CHANGELOG.md
git commit -m "Release v0.1.1."
git tag v0.1.1
git push origin main --tags
```

4. Tell the team:

```bash
cd ~/.local/share/my-pi-setting && git fetch --tags && git checkout v0.1.1 && ./scripts/install.sh
```

## Installed marker

After install, `~/.pi/agent/.my-pi-setting-version` contains:

```text
0.1.0 light
```

Use it to verify which profile is active.
