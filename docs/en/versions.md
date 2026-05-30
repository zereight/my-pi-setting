# Folder snapshots

[한국어](../ko/versions.md)

Git history is the primary version control for this repo.

Optional **folder snapshots** are created with:

```bash
./scripts/pull.sh --snapshot
# or
./scripts/snapshot.sh agent
```

## Layout

```
versions/
  agent/
    20260530-130405/   # UTC timestamp
    LATEST             # one line: newest snapshot id
```

## Manual restore

```bash
cp -R versions/agent/20260530-130405/* agent/
./scripts/apply.sh
```

`versions/agent/20*/` may be gitignored (see `.gitignore`).
