# API and Schema Standards

## 1. World Snapshot 核心欄位
### 頂層
- `server_time_ms`
- `agents`
- `events`
- `webhooks`
- `hermes`
- `stats`

### Agent 核心欄位
- `agent`
- `name`
- `role`
- `state`
- `status_label`
- `task`
- `tool_label`
- `tool_icon`
- `room_key`
- `room_label`
- `room_icon`
- `x`, `y`
- `activity_hint`
- `age_seconds`
- `is_stale`
- `recent_actions`
- `room_key_hint`，可選，用於 debug target-room routing

### Agent role
- `main_agent`：主代理
- `subagent`：分身代理
- `branch_session`：分支工作階段

### Event / Action 擴充欄位
- `agent_type`：來源 agent 類型，例如 `codex`、`gemini-cli`、`claude-code`、`ollama`、`hermes`、`generic`
- `target_room`：可選，合法值為 `think_lab`、`blueprint_lab`、`tool_forge`、`response_studio`、`standby_dock`、`clone_bay`、`session_archive`
- `tool_name`：單一工具
- `tool_names`：工具序列
- `tool_phase`：`started` / `completed`
- `preview`：短摘要，不作 machine routing 依賴

### Bridge client 契約
- 通用入口是 `POST /api/event` 與 `POST /api/heartbeat`。
- `agent_bridges/pixelverse_client.py` 只負責產生標準 payload，不直接修改 world state。
- Adapter 應優先明確送 `target_room`；無法判定時才讓 backend 使用 tool/state fallback。
- Adapter 不應自行刪除 agent；分身與 branch session 的消失必須由 explicit delete/stop API 另行設計。

## 2. 契約原則
- 欄位名稱穩定優先
- 前端不可自行猜測缺失的核心狀態
- 新增欄位可以是 additive；移除或改名需同步 spec 與前端
- humanized copy 可以調整，但 machine-meaning 欄位應維持穩定
- 若 agent lifecycle 沒有明確 delete event，API 不應讓 agent 消失

## 3. Fallback 規則
- 未知工具：至少回傳原始名稱 + 通用 icon / label
- 未知狀態：至少退回 `idle` / `offline` 類可讀語意
- 未知事件：保留事件名與摘要，不可靜默捨棄
- 來源暫時中斷：以 stale / offline 顯示，不可誤判為完成
- `target_room` 缺失時，才 fallback 到 role/state/tool text mapping

## 4. 前後端邊界
- backend 擁有 state normalization 與 room classification 的真相
- frontend 擁有視覺優先級、copy 組裝、動線呈現
- 若某條規則兩邊都要用，先在 spec 定義，再拆成共享測試或 helper
- `house_layout.mjs` / `room_furniture.mjs` 是 UI 與 debug trajectory 的共享真相；不要另建第二份 map
