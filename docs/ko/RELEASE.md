# 릴리스 가이드

[English](../en/RELEASE.md)

이 레포는 **설정 저장소**입니다. 배포는 **git tag**로 합니다.

## 버전 규칙

| 파일 | 역할 |
|------|------|
| `VERSION` | 현재 semver (`v` 접두사 없음) |
| `CHANGELOG.md` | 변경 이력 |
| Git tag `v*.*.*` | 팀이 고정 설치할 버전 |

[semver](https://semver.org/) 기준:

- **Patch** — 문서/오타, JSON 프로필의 비호환 없는 조정
- **Minor** — 새 프로필, 템플릿, 셸 헬퍼 (하위 호환)
- **Major** — 프로필 삭제, 경로 변경, install 계약 파괴

## 메인테이너 체크리스트

```bash
git status
./scripts/install.sh --dry-run
```

1. `./scripts/release.sh 0.1.1` 실행
2. `CHANGELOG.md` 갱신
3. 커밋 및 태그:

```bash
git add VERSION CHANGELOG.md
git commit -m "Release v0.1.1."
git tag v0.1.1
git push origin main --tags
```

4. 팀에 안내:

```bash
cd ~/.local/share/my-pi-setting && git fetch --tags && git checkout v0.1.1 && ./scripts/install.sh
```

## 설치 마커

설치 후 `~/.pi/agent/.my-pi-setting-version` 예:

```text
0.1.0 light
```

활성 프로필 확인용.
