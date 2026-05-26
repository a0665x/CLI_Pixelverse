# Integration and Events

## 1. 外部整合面
### Hermes Runtime
- `PIXELVERSE_HERMES_WEB_BASE`
- `PIXELVERSE_HERMES_GATEWAY_HEALTH`
- Hermes status / subagents / sessions 輪詢來源

### Bridge / Hook
- lifecycle 事件經 `bridge.py` 與 `hooks/miniverse/` 注入世界
- `agent:start`：主代理進入 thinking / think_lab
- `agent:step`：主代理進入 working，使用 `target_room` 或 tool mapping 決定房間
- `agent:end`：主代理回 idle / standby_dock
- hook context 可帶 `target_room`，目前 test-hook 會明確傳入，避免靠字串推斷

### Universal Bridge Client
- `agent_bridges/pixelverse_client.py` 是不綁特定 agent runtime 的標準 client。
- 任何 agent 只要能執行 Python 或 HTTP POST，就可以用 `/api/event` / `/api/heartbeat` 推送狀態。
- CLI 範例：
  - `python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex`
  - `python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file`
  - `python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main`

### Hermes Adapter
- `agent_bridges/hermes_adapter.py` 是 Hermes CLI wrapper adapter。
- 它會在 wrapped command 前後送出 process-level lifecycle：start -> working -> complete/error。
- 安裝方式：`./run.sh install-adapter hermes-cli`。
- 使用方式：`./.pixelverse-service/bin/hermes-pixelverse -- hermes chat`。
- 若要 Hermes gateway/OpenWebUI 內部的 per-tool lifecycle，需要安裝 hook adapter：`./run.sh install-adapter hermes-hook`，並重啟 Hermes gateway/OpenWebUI 讓 hook reload。

### Hermes OpenWebUI / API Server Relay
- OpenWebUI 連 Hermes 時走 `HermesAgent_OpenWebUI/hermes-agent/gateway/platforms/api_server.py`，不是一般 `gateway/run.py` message pipeline。
- 這條路徑原本只把 `tool_progress_callback` 寫回 OpenWebUI SSE，沒有觸發 `HookRegistry.emit(...)`，所以 Pixelverse hook 收不到真實 OpenWebUI 對話事件。
- 目前已在 Hermes API server 的 `/v1/chat/completions` streaming/non-streaming 與 `/v1/runs` 路徑加入 Pixelverse relay：
  - start -> `think_lab`
  - `tool.started` / `tool.completed` -> tool 名稱推導房間
  - `reasoning.available` -> `blueprint_lab`
  - complete -> `standby_dock`
  - error -> `offline_corner`
- relay 目標由 `PIXELVERSE_URL` 控制，預設 `http://127.0.0.1:4321`；可用 `PIXELVERSE_ENABLE=0` 關閉。
- 修改後必須重啟 `HermesAgent_OpenWebUI/run.sh`，因為這是 Hermes gateway/API server process 內的程式碼。

### Notification
- `agent:end` 可觸發完成通知
- 現有腳本會走 `henry-notify` / email 路徑

## 2. 事件類型語意
- `heartbeat`：主代理仍在線
- `thought`：規劃 / 推理中間態
- `tool`：工具開始或完成
- `status`：狀態切換
- `speak`：對外說話氣泡
- `message`：收件箱或代理間訊息
- `subagent.*` / `hermes.session`：分身與 session 補充事件
- `agent.tool.started` / `agent.completed`：generic API 產生的 local agent lifecycle 事件

## 3. Agent role / target room schema
### 常用欄位
- `agent`：穩定 agent id，例如 `henry-main`、`synthetic-subagent-1`
- `name`：顯示名稱
- `role`：`main_agent`、`subagent`、`branch_session`
- `state`：`idle`、`thinking`、`planning`、`working`、`offline`
- `task` / `tool_name` / `tool_names`：任務摘要或工具序列
- `target_room`：明確目標房間，例如 `tool_forge`、`clone_bay`

### 房間判定優先序
1. `offline` state -> `offline_corner`
2. 有合法 `target_room` / `room_key` hint 且非 idle -> 使用該房間
3. `role=subagent` -> `clone_bay`
4. `role=branch_session` -> `session_archive`
5. state / tool text fallback mapping
6. idle -> `standby_dock`

### 分身保留行為
- 分身如果被建立，就會留在 `WorldState.agents`。
- 收到 completed/idle 時，分身回到 clone bay 待命。
- 未收到 stop/delete/completed 時，分身保留最後狀態；超過 stale 門檻後會顯示 offline，但不會從 `/api/world` 消失。
- 目前沒有 delete endpoint；如果未來要清除 agent，需要新增 explicit delete event/API。

## 4. Synthetic test-hook mapping
- `blueprint_lab` -> `search_files,read_file`
- `tool_forge` -> `patch,terminal`
- `response_studio` -> `reply,draft_response`
- `clone_bay` -> `delegate_task`，並建立 `synthetic-subagent-1`
- `session_archive` -> `session_search,history`

`clone_bay` 場景包含兩個 agent plan：
- `henry-main`: `think_lab -> clone_bay -> standby_dock`
- `synthetic-subagent-1`: `clone_bay -> tool_forge -> clone_bay`

## 5. 事件顯示原則
- 事件要先短，再準
- 同一事件應可同時支援畫面摘要與詳細檢視
- 未知事件要顯示可讀 fallback，不要掉資料
- 事件文案必須服務判讀，不是寫成小說

## 6. 接口演進規則
- 新欄位可以加；既有欄位非必要不要破壞
- 前端依賴的核心欄位要明列在 `conventions/api-and-schema-standards.md`
- bridge 與 server 的 mapping 若改動，先更新 spec 再改碼
- 新增 route/debug 行為時，同步更新 `spec/modules/testing-and-ops.md`
