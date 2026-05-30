# my-pi-setting

[English](../en/README.md) · [문서 인덱스](../README.md)

Pi agent 설정(`~/.pi/agent`)을 **버전 관리**해서 팀·미래의 나에게 공유하는 레포입니다.

## 레이아웃

| 경로 | 용도 |
|------|------|
| `agent/settings/light.json` | Light 프로필 (`install.sh` 기본) |
| `agent/settings/heavy.json` | Heavy 프로필 (`enableSkillCommands: false` 등) |
| `agent/settings.json` | 현재 머신에서 pull한 **실제** light 스냅샷 |
| `agent/AGENTS.md` | 에이전트 지침 |
| `agent/extensions/` · `extensions.disabled/` | 확장 |
| `agent/variants/` | `settings.json.*.bak` 백업 |
| `shell/pi-cursor.zsh` | `pi-light` / `pi-heavy` / `pi-cursor` |
| `templates/bankx/.pi/` | BankX 프로젝트용 `.pi/settings.json` |
| `versions/agent/<UTC>/` | 선택적 폴더 스냅샷 (git 제외 가능) |
| `manifest.json` | 마지막 pull/apply 시각 |

시크릿·세션은 **제외**: `auth.json`, 토큰, `sessions/`, 모델 리스트 등 (`.gitignore` 참고).

## 일상 워크플로 (본인 Mac에서 설정 바꾼 뒤)

```bash
./scripts/pull.sh          # ~/.pi/agent → agent/
git add -A && git status   # 확인 후 커밋
```

선택: 폴더 단위 시점 백업

```bash
./scripts/pull.sh --snapshot   # versions/agent/20260530-040552/
```

자세한 스냅샷: [versions.md](versions.md)

## 다른 머신 / 팀원 설치

**프로필만** 깔기 (권장):

```bash
git clone <this-repo> && cd my-pi-setting
./scripts/install.sh                    # light
./scripts/install.sh --profile heavy
./scripts/install.sh --shell            # ~/.zshrc에 source 줄 안내
```

**전체 트리** 복원 (extensions 포함):

```bash
./scripts/apply.sh
```

Pi TUI에서 `/reload` 한 번 (확장은 세션 시작·reload 때 로드됨).

### step-by-step 확장

단계별로 짜고 스텝마다 리뷰하는 Pi 확장 (`agent/extensions/step-by-step/`).

| 단계 | 명령 |
|------|------|
| 팀원 설치 | `./scripts/apply.sh` → Pi TUI `/reload` |
| 시작 | `/step-by-step:start <주제>` |
| 다음 | `/step-by-step:next` (리뷰 후) |
| 일괄 스킵 / 자동 빌드 | `skip-to`, `run-to` (자동은 **reviewing** 중만) |
| 잠깐 빠져나오기 | `pause` / `resume` / `stop` |

자세한 명령·예시: [agent/extensions/step-by-step/README.md](../../agent/extensions/step-by-step/README.md)

원격 + 태그:

```bash
PI_SETTING_REPO=https://github.com/zereight/my-pi-setting.git ./scripts/bootstrap.sh
PI_SETTING_REF=v0.1.0 ./scripts/bootstrap.sh --local
```

## 버저닝

| 방식 | 설명 |
|------|------|
| **Git** | 기본. `pull` 후 커밋하면 diff로 추적 |
| **Semver** | `VERSION` + `git tag v0.1.0` + `CHANGELOG.md` |
| **폴더** | `versions/agent/<UTC>/` — `.gitignore`로 제외 가능 |

릴리스: [RELEASE.md](RELEASE.md) · `./scripts/release.sh`

## 프로필

| | Light | Heavy |
|---|--------|--------|
| 파일 | `agent/settings/light.json` | `agent/settings/heavy.json` |
| 쉘 | `PI_CURSOR_SETTING_SOURCES=project` | `PI_CURSOR_SETTING_SOURCES=all` |

Cursor CLI 모드: `agent/README-cursor-cli.md`, `agent/AGENTS.md`

## 보안

API 키·`auth.json`은 커밋하지 마세요. 실수로 넣었으면 **키 로테이션** 후 git history에서 제거하세요.
