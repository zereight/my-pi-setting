# 폴더 스냅샷

[English](../en/versions.md)

Git 히스토리가 기본 버전 관리입니다.

선택적으로 아래 명령으로 `versions/` 아래에 시점 복사본을 둡니다:

```bash
./scripts/pull.sh --snapshot
# 또는
./scripts/snapshot.sh agent
```

## 구조

```
versions/
  agent/
    20260530-130405/   # UTC 타임스탬프
    LATEST             # 최신 스냅샷 id 한 줄
```

## 수동 복원

```bash
cp -R versions/agent/20260530-130405/* agent/
./scripts/apply.sh
```

`versions/agent/20*/` 는 `.gitignore`에 있어 커밋하지 않을 수 있습니다.
