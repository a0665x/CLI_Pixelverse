# 2026-05-19 Local MVP Bridge

## Goal
在不修改 `HermesAgent_OpenWebUI/hermes-agent` 主體的前提下，先把 `hermes-pixelverse` 做成可跑的最小驗證版。

## Decisions
- 不依賴外網再拉 `miniverse`；目前執行環境 DNS/外網不穩定，改以本地 `pixelverse_server.py` 提供 Miniverse-compatible API。
- 保留 upstream `bridge.py` 與 hook 結構，降低之後切回真正 miniverse server 的成本。
- UI 先做成本地靜態頁，驗證 agent presence / status / click inspector / event log。

## Delivered
- `pixelverse_server.py`
- `public/index.html`
- `scripts/run_local_mvp.sh`
- README 更新為本地 MVP 啟動方式

## Validation Target
- `bridge.py` 連到 `http://localhost:4321`
- Pixelverse world 顯示 Hermes agent
- `agent:start/step/end` hook 事件可驅動畫面狀態變化
