# render-mermaid (Pi extension)

`render_chart` (`@miclivs/pi-charts`)와 같은 패턴으로 **Mermaid 소스 → PNG/SVG** 를 Pi TUI에 인라인 표시합니다.

## 설치

```bash
# 레포 → ~/.pi/agent
./scripts/apply.sh

# Pi TUI
/reload
```

## 전제: mmdc CLI

```bash
npm install -g @mermaid-js/mermaid-cli
# 또는: brew install mermaid-cli
mmdc --version
```

Extension 자체는 **npm 런타임 의존성 없음** — `mmdc`만 PATH에 있으면 됩니다.

## 도구

| 도구 | 설명 |
|------|------|
| `render_mermaid` | `source` (Mermaid 문법) → `.mermaid/output/*.png` + TUI 인라인 이미지 |

## 설정

프로젝트 루트 `.mermaid/settings.json` (최초 실행 시 자동 생성):

```json
{
  "saveToDisk": true,
  "format": "png",
  "theme": "neutral",
  "background": "transparent",
  "width": 1200,
  "maxWidthCells": 90
}
```

## 사용 예 (Pi TUI)

> my-pi-setting 레포 아키텍처를 mermaid로 그려서 render_mermaid로 보여줘

LLM이 `render_mermaid`를 호출하면 터미널에 PNG가 뜹니다 (Kitty/iTerm 이미지 프로토콜 지원 시).

## Cursor Agent

Cursor SDK 브리지에서는 extension 도구가 안 붙을 수 있습니다. **Pi TUI**에서 사용하세요.
