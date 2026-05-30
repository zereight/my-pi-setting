# recent-skills (Pi extension)

입력창 **바로 위**에 최근 사용한 skill을 가로 칩으로 표시합니다.

## 설치

```bash
./scripts/apply.sh
# Pi TUI
/reload
```

## 동작

- `/skill:name` 또는 `<skill name="...">` 블록으로 호출한 skill만 MRU에 기록 (최대 5개)
- 세션 `appendEntry`로 재시작 후에도 유지
- **Alt+1 … Alt+5**: 해당 슬롯 skill을 `/skill:name ` 형태로 에디터에 프리필 (전송은 직접)
- 모델이 `read`만 한 경우는 기록하지 않음

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/recent-skills` | 최근 목록에서 선택해 프리필 |
| `/recent-skills:clear` | MRU 초기화 |

## 전제

`settings.json`에서 skill이 로드되어 있어야 합니다 (`enableSkillCommands`, `skills` 경로, `.pi/skills` 등).  
global skill을 끈 light 프로필이라도 **프로젝트 skill**은 그대로 동작합니다.
