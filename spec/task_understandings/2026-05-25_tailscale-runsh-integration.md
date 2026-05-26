# Task Understanding — Tailscale Run.sh Integration

## 任務
檢查 `hermes-pixelverse` 專案的 spec 與啟動流程，讓 `./run.sh` 在啟動 4321 UI 後自動把服務掛到 Tailscale，並驗證重啟後可用網址。

## 這次完成的事
- 先依 spec 入口閱讀 `agent.md`、`map.md`、`project_herness.md`、`PROJECT_MAP.md`
- 補讀 `architecture/system-overview.md`、`modules/runtime-backend.md`、`modules/testing-and-ops.md`、`modules/integration-and-events.md`
- 在 `run.sh` 新增 Tailscale 自動曝光設定：
  - `PIXELVERSE_TAILSCALE_ENABLE`（預設 `1`）
  - `PIXELVERSE_TAILSCALE_PORT`（預設 `10000`）
- `start_service()` 在本地 4321 健康後會自動執行 `tailscale serve --bg --https=10000 http://127.0.0.1:4321`
- `status` / `doctor` / `--help` 也補上 Tailscale 相關資訊

## 驗證結果
- `bash -n run.sh` 通過
- `PIXELVERSE_AGENT_KIND=hermes PIXELVERSE_TAILSCALE_ENABLE=1 PIXELVERSE_TAILSCALE_PORT=10000 ./run.sh down_up` 成功
- 本地健康檢查：`http://127.0.0.1:4321/health` 成功
- Tailscale 健康檢查：`https://agx-monitor.tail9e662c.ts.net:10000/health` 成功

## 關鍵結論
- 這台機器已經在 Tailscale tailnet 中，節點是 `agx-monitor.tail9e662c.ts.net`
- 443 / 8443 已被其他服務占用，所以 Pixelverse 走 10000 最安全，不會覆蓋現有 serve/funnel
- 目前是 **tailnet only** 的 `tailscale serve`，不是公開網路的 `funnel`
