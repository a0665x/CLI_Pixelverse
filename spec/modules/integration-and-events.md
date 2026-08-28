# Integration and Events

## 1. 外部整合面
### Hermes Runtime
- `PIXELVERSE_HERMES_WEB_BASE`
- `PIXELVERSE_HERMES_GATEWAY_HEALTH`
- `PIXELVERSE_HERMES_ENABLE`（`auto|1|0`）
- Hermes status / subagents / sessions 輪詢來源

### Bridge / Hook
- lifecycle 事件經 `bridge.py` 與 `hooks/pixelverse/` 注入世界
- `agent:start`：主代理進入 thinking / think_lab
- `agent:step`：主代理進入 working，使用 `target_room` 或 tool taxonomy 決定房間
- `agent:end`：主代理回 idle / standby_dock
- hook context 可帶 `target_room`，目前 test-hook 會明確傳入，避免靠字串推斷

### Universal Bridge Client
- `agent_bridges/pixelverse_client.py` 是不綁特定 agent runtime 的標準 client。
- 任何 agent 只要能執行 Python 或 HTTP POST，就可以用 `/api/event` / `/api/heartbeat` 推送狀態。
- CLI 範例：
  - `python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex`
  - `python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file`
  - `python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main`
- CLI shim 與 container placeholder 統一使用 `${agent_kind}-main` 作為 stable id，避免同一框架在 UI 產生兩個角色。
- CLI wrapper 執行期間每 15 秒送一次 `/api/heartbeat`；可用 `PIXELVERSE_HEARTBEAT_SECONDS` 調整。這必須小於 backend `PIXELVERSE_STALE_AFTER`，否則長時間 session 仍會被標成 offline。
- wrapper 的週期 heartbeat 會帶 `preserve_phase=true`：它只刷新 liveness，不可覆蓋較新的 thinking / planning / tool lifecycle 終點。第三方 bridge 若只需要宣告在線，也應使用此模式。
- CLI wrapper 未指定 `--agent` 時會使用 `${agent_type}-cli:${pid}` 作為 per-process id，並將 `process_id` 傳給後端；同時開啟多個終端 instance 時，world registry 會自動產生多個 Pixel 角色。若需要固定名稱，可傳 `PIXELVERSE_INSTANCE_NAME`。
- `./run.sh enable-shell-adapter` 會在 `~/.bashrc` 加入受管理的 activation 行，讓新 Bash 終端直接執行 `codex` 時自動走 repo-local shim。activation 會一併預設 `PIXELVERSE_URL`、`PIXELVERSE_BRIDGE_URL`、`PIXELVERSE_STATE_DIR`，避免每個新 shell 都要手動補環境變數。
- `install-adapter codex` 會生成 git-ignored `.codex/hooks.json`。它與 `scripts/codex_pixelverse_hook.py` 將 Codex `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`SubagentStart/Stop`、`Stop` 轉成 Pixelverse 事件。Codex 初次載入 repo hook 時，需在 `/hooks` 畫面信任 hook 定義。
- `install-codex-hook [project-root]` 只把 Codex project hook 安裝到指定 repo / 目前目錄，hook command 使用 CLI_Pixelverse 內的絕對 script path，因此外部 repo 不需要複製 `scripts/codex_pixelverse_hook.py`。
- 公開 onboarding 以 clone 根目錄推導 `PIXELVERSE_ROOT`，不得依賴特定 username 或 `/home/a0665x/...`。生成的 activation 與 hook command 可以包含當前 clone 的絕對路徑，但共用 README 與範本不可固定該路徑。
- `install-codex-hook` 必須安全合併合法的既有 `.codex/hooks.json`、保持冪等，且在 malformed JSON 或 Pixelverse command 衝突時停止。任何內容變更先建立備份，再 atomic replace；不得靜默覆寫使用者 hooks。
- MCP onboarding 回傳的 activation 指引必須使用 MCP server 所在 Pixelverse clone 的絕對 `.pixelverse-service/activate.sh` 路徑，讓使用者在其他 repository 呼叫時仍有效。
- Codex `SubagentStart` 會同時更新主代理為 `collaborating / clone_bay`，並用 spawned child id 建立 local `role=subagent` 角色；`SubagentStop` 會讓同一 child 回到 `idle / clone_bay` 待命。若 hook payload 沒有明確 child id，adapter 會用 session/model fallback，但同時多個同模型分身可能無法完全區分。
- Codex hooks 沒有獨立的 skill lifecycle event；目前只有使用者 prompt 顯式含 `$skill` 或 `/skill` 時，可可靠映射為 `invoking_skill`。模型內部靜默讀取 `SKILL.md` 無法從原生 hook 精準辨識。
- 已經啟動的原生 CLI process 無法 retroactive attach；使用者需先 `source .pixelverse-service/activate.sh`，再啟動新的 CLI session。
- 非 Hermes service 啟動時會先建立 `source_placeholder=true` 的 `${agent_kind}-main` 待接線角色。placeholder 超過 stale 門檻後保持 idle / awaiting_attach；真正 attach 過的 CLI 若 heartbeat 中斷，才轉為 offline / stale。
- 新手 Codex 首次接通順序為：`PIXELVERSE_AGENT_KIND=codex ./run.sh down_up` -> `source .pixelverse-service/activate.sh` -> `bridge-status` -> `which codex` -> 啟動新 Codex process -> `/hooks` 信任 repo-local hook。Codex mode 的 `down_up/start` 會自動執行 adapter 安裝與 shell adapter 啟用；可用 `PIXELVERSE_AUTO_ENABLE_SHELL_ADAPTER=0` 關閉自動寫入 Bash startup。
- 若只是要在目前 shell 內快速接線，可直接 `source /path/to/CLI_Pixelverse/.pixelverse-service/activate.sh && codex`。這會保證 wrapper 與 Pixelverse server URL 都先接好，但完整 tool/subagent hook 仍需要目標 repo 內的 `.codex/hooks.json`。
- 公開環境變數使用 `PIXELVERSE_BRIDGE_PORT`、`PIXELVERSE_BRIDGE_URL` 與 `PIXELVERSE_AGENT_*`。

### Agent hook adapter strategy
- `run.sh install-adapter <target>` 是統一入口，但底層不應收斂成單一 shell hook。不同 agent runtime 的可觀測點不同，必須用 adapter profile 分流。
- Repo-local hook profile：適合 Codex。`install-adapter codex` 產生 `.codex/hooks.json`，由 `scripts/codex_pixelverse_hook.py` 接收原生 hook payload，能拿到 `PreToolUse`、`PostToolUse`、`SubagentStart/Stop`、`Stop` 等細節。
- CLI wrapper profile：適合 Gemini CLI（官方 `gemini` command）、Claude Code、Antigravity、Ollama、generic CLI，或尚未提供原生 hook schema 的 agent。wrapper 能保證 process start/heartbeat/complete/error，但 per-tool lifecycle 只能靠 wrapper 解析 stdout、agent 自行呼叫 `pixelverse_client.py`，或後續新增 agent-specific hook。
- Gateway hook profile：適合 Hermes/OpenWebUI 這種有 service pipeline 的 runtime。它應安裝到 gateway/API server 裡，才能看到 tool progress、reasoning 與 run lifecycle；單純 CLI wrapper 無法看到 OpenWebUI 內部工具事件。
- MCP onboarding profile：適合 MCP-capable agent。`scripts/pixelverse_mcp_server.py` 提供 install/status/emit-event 工具，但仍沿用 HTTP `/api/event` contract，不建立第二套 world state。
- 評估結論：保留 shell script 作「安裝與啟動 orchestrator」是合理的；不要把所有 hook 行為寫死在同一支 `.sh`。正確抽象是 `adapter target -> profile -> normalized Pixelverse event`。
- 後續若新增 agent，應先判斷它屬於 `repo_hook`、`cli_wrapper`、`gateway_hook`、`mcp_emit` 哪一類，再補 profile 與測試。只有能提供工具名稱/phase 的 adapter，才標記為 high-fidelity hook。

### Adapter fidelity levels
- High fidelity：有原生 lifecycle/tool hook，可可靠分類 `Read/Edit/Write/Bash/Web/MCP/Subagent`，例如 Codex repo hook。
- Medium fidelity：有 gateway 或 service callback，可取得 tool progress/reasoning/run lifecycle，但需要修改或安裝到該 runtime，例如 Hermes gateway hook。
- Low fidelity：只有 process wrapper，只能知道 start/working/heartbeat/complete/error；若要細部房間，需要 agent 主動 emit event 或 adapter 額外解析工具輸出。

### MCP Onboarding DX Layer
- `scripts/pixelverse_mcp_server.py` 提供 dependency-free stdio MCP server，讓 MCP-capable agent 在 clone repo 後可直接取得 onboarding 工具。
- MCP tools：
  - `pixelverse_onboard`：包裝 adapter 安裝、`bridge-status` 與 shell activation 指引。
  - `pixelverse_install_adapter`：包裝 `./run.sh install-adapter <target>`。
  - `pixelverse_bridge_status`：包裝 `./run.sh bridge-status`。
  - `pixelverse_emit_event`：沿用 `PixelverseClient` 發送標準 `/api/event`。
- MCP 僅是 DX 包裝層，不建立第二套 world state protocol；HTTP `/api/event` 與 `/api/heartbeat` 仍是穩定整合契約。

### Hermes Adapter
- `agent_bridges/hermes_adapter.py` 是 Hermes CLI wrapper adapter。
- 它會在 wrapped command 前後送出 process-level lifecycle：start -> working -> complete/error。
- 安裝方式：`./run.sh install-adapter hermes-cli`。
- 使用方式：`./.pixelverse-service/bin/pixelverse-hermes chat`。
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
- relay 目標由 `PIXELVERSE_URL` 控制，預設 `http://127.0.0.1:5660`；可用 `PIXELVERSE_ENABLE=0` 關閉。
- 修改後必須重啟 `HermesAgent_OpenWebUI/run.sh`，因為這是 Hermes gateway/API server process 內的程式碼。
- Pixelverse 後端本身現在可在 `agent_kind != hermes` 時仍併入 Hermes 狀態，只要 `PIXELVERSE_HERMES_ENABLE` 沒有被顯式關閉。

### Notification
- `agent:end` 可觸發完成通知
- 現有腳本會走 `henry-notify` / email 路徑

## 2. 事件類型語意
- `heartbeat`：主代理仍在線；`preserve_phase=true` 時不得覆蓋最近 lifecycle phase
- `thought`：規劃 / 推理中間態
- `tool`：工具開始或完成
- `status`：狀態切換
- `speak`：對外說話氣泡
- `message`：收件箱或代理間訊息
- `subagent.*` / `hermes.session`：分身與 session 補充事件
- `agent.tool.started` / `agent.completed`：generic API 產生的 local agent lifecycle 事件

### Route lifecycle contract
- 每個 phase event 都是一次路徑規劃：事件對應的 `target_room` 是新的終點，角色到達後停留，直到下一個 phase event。
- `start` -> `thinking` / `think_lab`
- `thought`、`reasoning.available`、`plan`、`planning` -> `planning` / `blueprint_lab`
- `tool.started`、`tool.completed` -> `working` / 工具對應房間；工具完成不代表整個 session 完成
- 無明確 `state` 的 `status` -> 沿用目前 phase，不可自行回待命
- 只有 `end`、`done`、`completed`、`complete` 或明確 `state=idle` -> `idle` / `standby_dock`

## 3. Agent role / target room schema
### 常用欄位
- `agent`：穩定 agent id，例如 `henry-main`、`synthetic-subagent-1`
- `name`：顯示名稱
- `role`：`main_agent`、`subagent`、`branch_session`
- `state`：`idle`、`thinking`、`planning`、`working`、`offline`
- `pixel_state`：可選細緻 UI 狀態，包含讀檔/搜尋、編輯/寫檔、終端指令、瀏覽/外部工具、協作、skill、tool、coding、responding、blocked、自癒、等待輸入、初始化與休眠
- `process_id` / `instance_name`：可選 CLI instance 錨點
- `task` / `tool_name` / `tool_names`：任務摘要或工具序列
- `target_room`：明確目標房間，例如 `file_library`、`code_workbench`、`terminal_bay`、`tool_forge`、`clone_bay`

### Codex hook tool taxonomy
- `Read`、`Grep`、`Glob`、`LS` -> `reading_files` / `file_library`
- `Edit`、`MultiEdit`、`Write`、`apply_patch`、`patch` -> `editing_files` / `code_workbench`
- `Bash`、`terminal`、`execute_code` -> `shell_command` / `terminal_bay`
- `WebFetch`、`WebSearch`、`browser_*`、`mcp__*`、`github_*` -> `browsing` 或 `external_tool` / `tool_forge`
- `TodoWrite`、`todo` -> `planning` / `blueprint_lab`
- `Task`、`delegate_task` -> `collaborating` / `clone_bay`

### 房間判定優先序
1. `offline` state -> `offline_corner`
2. 有合法 `target_room` / `room_key` hint 且非 idle -> 使用該房間
3. `role=subagent` -> `clone_bay`
4. `role=branch_session` -> `session_archive`
5. tool taxonomy / state / tool text fallback mapping
6. idle -> `standby_dock`

### 分身保留行為
- 分身如果被建立，就會留在 `WorldState.agents`。
- 收到 completed/idle 時，分身回到 clone bay 待命。
- Codex child 的 `SubagentStart`、child `PreToolUse` / `PostToolUse` 與 `SubagentStop` 必須沿用同一 stable child id；child tool event 不可退回主代理 id。
- active 分身若有合法 `target_room`，其公開 `x/y` 必須使用該 room 的位置；只有 idle 分身固定回 clone bay slot。
- 每次跨 room 的 server state transition 可附加 optional `route_evidence`，包含實際 source/destination position、`position_changed` 與 server event id；這是 backend state displacement evidence，不宣稱 browser animation 已完成。
- local Codex subagents 由 `/api/event` 進入 `WorldState.agents`，因此 `stats.subagent_count` 需同時計入 local `role=subagent` 與 Hermes `subagent_agents`。
- 未收到 stop/delete/completed 時，分身保留最後狀態；超過 stale 門檻後會顯示 offline，但不會從 `/api/world` 消失。
- UI 可透過 `DELETE /api/agents?agent=<id>` 手動清除 local offline agent；API 會再次驗證 offline 狀態，避免誤刪仍在線角色。
- Hermes source、Ollama source 等外部來源合併角色不在 local registry 中，不能透過這個 API 刪除。

## 4. Synthetic test-hook mapping
- `blueprint_lab` -> `search_files,read_file`
- `tool_forge` -> `patch,terminal`
- `response_studio` -> `reply,draft_response`
- `clone_bay` -> `delegate_task`，並建立 `synthetic-subagent-1`
- `session_archive` -> `session_search,history`

`clone_bay` 場景包含兩個 agent plan：
- `henry-main`: `think_lab -> clone_bay -> standby_dock`
- `synthetic-subagent-1`: `clone_bay -> tool_forge -> clone_bay`

`test-hook` 只有在上述兩個 plan 都具備 server event id、正向座標位移與至少兩個不同 route points 時才成功；只改文字或 room label 必須失敗。

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
