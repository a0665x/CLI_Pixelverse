# Runtime Backend

## 1. 核心檔案
- `pixelverse_server.py`
- `bridge.py`
- `pixelverse_fastapi.py`
- `hooks/miniverse/handler.py`
- `run.sh`
- `docker-compose.yml`
- `scripts/container_entrypoint.sh`

## 2. 各檔案責任
### `pixelverse_server.py`
- 提供靜態檔與 API
- 維護 `WorldState` / `AgentState`
- 對 Hermes 狀態源做 polling
- 將 raw state 轉成可顯示 snapshot
- 提供 SSE stream 給前端
- local agent 支援 `role`: `main_agent`、`subagent`、`branch_session`
- 支援 `target_room` / `room_key` hint，避免單靠 tool name 猜房間

### `bridge.py`
- 接 Hermes lifecycle
- 把 event 轉成 world heartbeat / action
- 在完成時觸發通知
- 維持與 Miniverse-compatible 路由的橋接
- `agent:start` / `agent:step` 會 relay `target_room`

### `pixelverse_fastapi.py`
- FastAPI / Swagger 入口
- 包裝 `pixelverse_server.WORLD`
- 提供 `/api/world`、`/api/world/stream`、`/api/event`、`/api/heartbeat`、`/api/act`
- `/api/event` 支援 `role` 與 `target_room`，可給 Codex/Gemini/Claude/Ollama/Generic agents 最小化接入

### `hooks/miniverse/`
- 承接 Hermes hook 事件
- 提供 relay handler 與 hook 定義

## 3. Agent 生命週期
- `WorldState.agents` 是 local in-memory registry；agent 建立後不會自動刪除。
- 若 agent 收到 completed/idle/status end，會留在世界中並以 idle 呈現。
- 若 agent 沒有收到明確 stop/delete/completed，會保留最後狀態；超過 `PIXELVERSE_STALE_AFTER` 後 snapshot 會把非 offline agent 標成 offline，但仍保留角色。
- 目前沒有 delete agent endpoint；這是為了忠實呈現「曾經建立且未被清除」的 agent。
- `clone_bay` synthetic test 會建立 `synthetic-subagent-1`，角色 `role=subagent`，完成後回 clone bay 待命。

## 4. Docker service
- `./run.sh start|restart|down_up` 以 Docker Compose 啟動。
- `docker-compose.yml` 將 `4321` 暴露給 UI/API，`4567` 暴露給 bridge hook。
- `PIXELVERSE_AGENT_KIND` 決定 source mode：`codex`、`gemini-cli`、`claude-code`、`ollama`、`hermes`、`generic`。
- Docker image 是 build-copy 模式；改 frontend/backend 後需要 `./run.sh down_up` 讓容器吃到新碼。

## 5. 目前後端特色
- 快速可跑、部署簡單
- humanization 與 room inference 已內建
- 不必修改 Hermes 主 repo 即可驗證方向
- 支援 OpenAPI/Swagger，用 `/docs` 檢視最小測試 API

## 6. 目前後端風險
- 單檔集中太多責任
- presenter logic、domain logic、HTTP handling 混在一起
- 一旦事件類型擴增，容易在 monolith 中失控
- local in-memory registry 重啟會清空；若要長期追蹤 agent lifecycle，需要後續加 persistence

## 7. 後端重構標準
- routing 與資料語意分離
- schema 穩定優先於 copy 調整
- 未知 state / tool / event 必須有 fallback
- 一律輸出可讀欄位，不讓前端猜測核心語意
- 新增 agent lifecycle 行為時，要同時更新 `spec/modules/integration-and-events.md` 與測試
