# ADR-001: `my-pi-setting`에서 Pi 설정 버전 관리

[English](001-versioned-pi-settings-repo.md)

## 상태

Accepted

## 날짜

2026-05-30

## 배경

Pi agent 설정은 `~/.pi/agent/`에 있으며 light/orchestrator 프로필, 확장 on/off, Cursor SDK 환경 등으로 자주 바뀝니다. 팀과 미래의 나를 위해 공유·리뷰 가능한 복사본이 필요하지만, 시크릿·세션 데이터는 포함하면 안 됩니다.

## 결정

1. **안전하고 이식 가능한** 파일만 `agent/`에 미러링한다.
2. 일상 이력은 **git**; 선택적으로 `versions/agent/<UTC>/` 폴더 스냅샷.
3. `scripts/pull.sh`(머신 → 레포), `scripts/apply.sh`(레포 → 머신)로 동기화.
4. `.gitignore`로 auth, 토큰, 세션, 캐시, 대용량 모델 리스트 제외.

## 검토한 대안

- **`~/.pi/agent` 심볼릭 링크**: 시크릿·세션이 작업 트리에 섞여 기각.
- **수동 복사만**: drift 빠름 → pull 스크립트 필요.
- **단일 tarball**: git diff/리뷰에 불리 → 기각.

## 결과

- 로컬에서 Pi 변경 후 `./scripts/pull.sh` → 커밋.
- 새 머신: clone → `./scripts/apply.sh` → `shell/pi-cursor.zsh` / `PI_CURSOR_SETTING_SOURCES` 설정.
- Orchestrator: `agent/settings/orchestrator.json` 또는 `agent/variants/` — 시크릿은 커밋하지 않음.
