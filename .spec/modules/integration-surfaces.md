# Integration Surfaces

## Confirmed Available Today
- Hermes web dashboard backend: `hermes_cli/web_server.py`
- Public-ish local endpoints already visible in code:
  - `/api/status`
  - `/api/subagents`
  - `/api/sessions`
- Hermes repo contains `tools/subagent_tracker.py`
  - 可以用來表達 child agent 狀態與最近事件

## Gaps
- 主 agent 的即時工具使用事件，目前沒有看到現成 Pixelverse-ready stream
- 若只靠 `/api/status`，可見度足夠做狀態板，但不足以做細粒度工具動畫

## Integration Options
### Option A — Standalone Adapter Only
- 不改 Hermes 主 repo
- 輪詢既有 API + 解析 tracker 檔案
- 風險低，最快看到畫面
- 細節較粗

### Option B — Add Hermes Event Feed
- 在 Hermes repo 補充 event stream / hook / snapshot writer
- Pixelverse 可精準顯示當前工具、步驟、輸出摘要
- 但會碰到現有 dirty working tree，需較慎重

## Recommendation
先做 Option A 的可用 MVP，再視效果決定是否升級到 Option B。
