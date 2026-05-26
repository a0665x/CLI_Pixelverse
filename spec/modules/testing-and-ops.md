# Testing and Ops

## 1. 測試分層
### Python
- `tests/test_hermes_integration.py`
- 偏向後端整合與資料語意

### Node / MJS
- `test_world_motion.mjs`
- `test_agent_pose.mjs`
- `test_house_layout_connected.mjs`
- `test_main_agent_events.mjs`
- `test_realtime_stream.mjs`
- `test_scene_fx.mjs`
- `test_ui_state.mjs`
- `test_frontend_kenney.mjs`
- `test_room_layout_semantics.mjs`
- `test_agent_walk_cycle.mjs`
- `test_frontend_i18n.mjs`

## 2. 測試重點
- 房間與路徑語意是否穩定
- event stream parsing 是否穩定
- asset / layout / pose helpers 是否可預測
- i18n 與 event summary 是否維持人話化

## 3. 本地操作入口
- `./run.sh start`：互動選 agent 並啟動 Docker Compose service
- `PIXELVERSE_AGENT_KIND=hermes ./run.sh down_up`：非互動重建並啟動 Hermes mode
- `./run.sh stop`：停止 Docker service 與 legacy local processes
- `./run.sh restart` / `./run.sh down_up`：停止後重啟，會重新 assign agent kind
- `./run.sh status`：列出 container 與 endpoint
- `./run.sh log` / `./run.sh logs`：追 Docker logs
- `./run.sh doctor`：檢查 ports、legacy process、Docker、Compose、API health
- `./run.sh bridge-status`：檢查 Pixelverse API、bridge hook、Hermes hook、local adapter
- `./run.sh install-adapter hermes-cli`：安裝 Hermes CLI wrapper adapter
- `./run.sh install-adapter hermes-hook`：安裝 Hermes gateway hook adapter
- `./run.sh install-adapter all`：同時安裝 Hermes CLI wrapper 與 Hermes hook
- `./run.sh install-hermes-hook`：安裝 Hermes gateway hook
- `./run.sh test-hook`：送 synthetic lifecycle，刷新 tmp debug artifacts
- `README.md`：保留手動 curl 範例與 quick start

## 4. Universal bridge / adapter 用法
### 通用 client
```bash
python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex
python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file
python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main
```

### Hermes CLI wrapper
```bash
./run.sh install-adapter hermes-cli
./.pixelverse-service/bin/hermes-pixelverse -- hermes chat
```

`hermes_adapter.py` 只能包住 CLI process 的 start/working/complete/error。若要 OpenWebUI/Hermes gateway 內部 tool event，需安裝 Hermes hook：

```bash
./run.sh install-adapter hermes-hook
~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/run.sh restart
```

## 5. `test-hook` 用法
### 隨機測試
```bash
./run.sh test-hook
```

### 固定目標房間
```bash
PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
PIXELVERSE_TEST_HOOK_TARGET=tool_forge ./run.sh test-hook
PIXELVERSE_TEST_HOOK_TARGET=session_archive ./run.sh test-hook
```

支援值：
- `blueprint_lab`
- `tool_forge`
- `response_studio`
- `clone_bay`
- `session_archive`

### 放慢 UI 動畫觀察
```bash
PIXELVERSE_TEST_HOOK_DELAY=5 PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
```

預設 delay 是 3 秒。若 UI 還沒走完就回 idle，可以加大 `PIXELVERSE_TEST_HOOK_DELAY`。

## 6. Debug artifacts
每次 `./run.sh test-hook` 都會覆蓋以下檔案，不會累積塞滿 tmp：

- `tmp/latest_test_hook_route.json`
  - scenario、目標房間、工具序列、event sequence、agent plan
- `tmp/latest_world_snapshot.json`
  - synthetic events 送完後的 `/api/world` snapshot
- `tmp/pixelverse_debug_log.json`
  - map rooms/corridors/doors/furniture blockers
  - world snapshot
  - 每個 agent 的 role/task/start/work/return rooms
  - outbound/return route points
  - door anchors: aisle / portal / hub
  - walkable 檢查結果
- `tmp/local_ui_trajectory.jpg`
  - 最新任務路線圖
  - 多 agent 場景會用不同顏色虛線

## 7. 分身測試判讀
`PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook` 會建立：

- `henry-main`
  - `think_lab -> clone_bay -> standby_dock`
- `synthetic-subagent-1`
  - `clone_bay -> tool_forge -> clone_bay`

若 `synthetic-subagent-1` 收到 completed/idle，會留在 clone bay 待命。
若分身任務沒有明確 stop/delete/completed，server 會保留該角色；超過 stale 門檻後會標示 offline，但仍保留在 `/api/world`。

## 8. 驗證標準
- 改動 schema 時，要先補測試再改實作
- 改動房間語意或移動規則時，要補純函式測試
- 改動文案時，要檢查中英文 fallback 是否都還可讀
- 任何可視化升級都不能犧牲資料可解釋性
- 修改 `run.sh` 後至少跑 `bash -n run.sh`
- 修改 frontend route/layout 後至少跑 `node --test tests/*.mjs`
- 修改 backend/schema 後至少跑 `python3 -m pytest -q -o faulthandler_timeout=10`
