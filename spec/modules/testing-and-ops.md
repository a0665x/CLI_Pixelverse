# Testing and Ops

## 1. 測試分層
### Python
- `tests/test_hermes_integration.py`
- `tests/test_command_deck_browser_smoke.py`
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
- `test_agent_timeline_graphs.mjs`

## 2. 測試重點
- 房間與路徑語意是否穩定
- event stream parsing 是否穩定
- asset / layout / pose helpers 是否可預測
- i18n 與 event summary 是否維持人話化
- offline agent 是否保留 timeline、顯示 heartbeat，且只能由 explicit delete API 清除
- command-deck browser artifact 是否明確覆蓋三種 viewport 的 village-first hierarchy、pixel portrait roster、card/village selection、busy/offline ECG、reduced motion、四語純產品文案與 external payload 標記、主/分身位移、Starting Cabin occupant、家具/group invariance 與零 console/page error

## 2.1 路徑 / 穿牆回歸
- 改 `world_motion.mjs`、`house_layout.mjs`、`room_furniture.mjs`、`global_map/*.yaml` 或門 / 走廊 / 家具 footprint 時，至少跑：
  - `node --test tests/test_world_motion.mjs`
  - `node --test tests/*.mjs`
  - `python3 scripts/render_local_ui_trajectory.py`
- `tests/test_world_motion.mjs` 必須覆蓋：
  - 非門口直線跨房間應失敗，不能因為單點可走就穿過 shared wall。
  - 門旁邊牆面不可切換 `room:<roomKey>` / `corridor` layer；只有貼近 YAML `portal` 的窄門格能切 layer。
  - 跨房間 route 必須包含來源房與目標房的 door threshold，且 routeStaysWalkable 必須為 true。
  - custom floorplan 也要經過 `aisle -> portal -> hub` / `hub -> portal -> aisle`，不能 fallback 成直接穿牆線。
- `tmp/global_map_walkability_mask.png` 是 A* 眼中的 occupancy log：
  - 黑色：牆、隔間、房間外與家具 footprint blocker
  - 白色：free space
  - 灰色：門口 threshold / door visual marker
- 目前「角色縮到 60%」是視覺比例修正，不是 pathfinding 正確性的替代測試。若仍看到穿牆，要優先檢查 door threshold、corridor rect、room anchors、家具 blocker，而不是只改 sprite CSS。
- 仍需要人工在 UI 上觀察角色是否真的只從 PNG 門洞進出；Node 測試與 mask 通過只代表資料層規則成立，不代表彩圖門洞一定已視覺對齊。

## 3. 本地操作入口
- `./run.sh start`：互動選 agent 與 UI exposure mode，並啟動 Docker Compose service
- `PIXELVERSE_AGENT_KIND=hermes PIXELVERSE_EXPOSURE_MODE=tailscale ./run.sh down_up`：非互動重建並啟動 Hermes mode，並指定 exposure mode
- `./run.sh stop`：停止 Docker service 與 legacy local processes
- `./run.sh restart` / `./run.sh down_up`：停止後免互動重啟，沿用上次儲存的 agent kind、UI exposure mode 與完整 runtime floorplan；明確提供 `PIXELVERSE_AGENT_KIND`、`PIXELVERSE_EXPOSURE_MODE` 或 `PIXELVERSE_FLOORPLAN` 時會覆寫沿用值，首次沒有儲存 agent kind 時才回退互動選擇
- `./run.sh status`：列出 container 與 endpoint
- `./run.sh log` / `./run.sh logs`：追 Docker logs
- `./run.sh doctor`：檢查 ports、legacy process、Docker、Compose、API health
- `./run.sh bridge-status`：檢查 Pixelverse API、bridge hook、Hermes hook、local adapter
- `./run.sh install-adapter hermes-cli`：安裝 Hermes CLI wrapper adapter
- `./run.sh install-adapter hermes-hook`：安裝 Hermes gateway hook adapter
- `./run.sh install-adapter all`：同時安裝 Hermes CLI wrapper 與 Hermes hook
- `./run.sh enable-shell-adapter`：讓新 Bash 終端自動載入 repo-local CLI shim
- `./run.sh install-hermes-hook`：安裝 Hermes gateway hook
- `./run.sh test-hook`：送 synthetic lifecycle，刷新 tmp debug artifacts
- `./run.sh smoke-furniture-drag`：用真實 Chromium 重跑家具跨 room 拖曳 / 裁切 browser smoke，輸出 `tmp/furniture_drag_browser_smoke.json/png`
- `python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661`：跑完整 production command-deck acceptance，通過後才更新 README 兩張 repository-owned PNG
- `README.md`：保留手動 curl 範例與 quick start

### UI exposure
- 預設 UI port 是 `5660`。
- 啟動時 exposure mode 可選 `localhost`、`tailscale`、`ngrok`。
- `tailscale` 由 host-side `run.sh` 呼叫 `tailscale serve`；container 內 UI 只讀取並顯示 URL。
- `ngrok` 目前讀取 `PIXELVERSE_NGROK_URL`；若沒有設定，UI 會標示不可用。
- UI header 提供 exposure selector 與 copy URL button；切換會寫入 `/api/exposure` 的 runtime state，不會直接啟停 host tunnel process。

## 4. Universal bridge / adapter 用法
### 通用 client
```bash
python3 -m agent_bridges.pixelverse_client start --agent-type codex --agent codex-main --name Codex
python3 -m agent_bridges.pixelverse_client tool --agent-type gemini-cli --agent gemini-main --tool-names search,read_file
python3 -m agent_bridges.pixelverse_client complete --agent-type claude-code --agent claude-main
```

### Codex hook telemetry
```bash
./run.sh install-adapter codex
./run.sh enable-shell-adapter
```

新 Bash 終端中的 `codex` 會建立 per-PID Pixel 角色。首次啟動 Codex 後，在 `/hooks` 信任 repo-local hook，才能讓 tool、subagent 與顯式 `$skill` prompt 自動推播到 Pixelverse。`PIXELVERSE_AGENT_KIND=codex ./run.sh down_up` 會自動安裝 Codex adapter 並啟用新 Bash shell adapter；其他 repo 若需要高精度 Codex hook，可在該 repo 執行 `/path/to/CLI_Pixelverse/run.sh install-codex-hook`。

### Adapter profile 驗證
- `codex` 走 repo-local hook profile，驗證重點是 `.codex/hooks.json` 是否存在、Codex `/hooks` 是否已信任、`Read/Edit/Write/Bash` 等工具是否進入對應房間。
- `gemini-cli`、`claude-code`、`antigravity`、`ollama`、`generic` 目前主要走 CLI wrapper profile，驗證重點是 wrapper 是否在 `$PATH`、是否有 per-PID agent、heartbeat 是否使用 `preserve_phase=true`。Gemini CLI 對應官方 `gemini` command。
- `hermes-hook` 走 gateway hook profile，驗證重點是 Hermes gateway/OpenWebUI 是否已重啟，tool progress 是否真的 emit 到 `PIXELVERSE_URL`。
- `pixelverse_mcp_server.py` 走 MCP onboarding profile，驗證重點是 MCP tool 能 install adapter、讀 bridge status、並透過 `/api/event` 發送標準事件。

MCP onboarding stdio smoke test：

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual-test","version":"0.1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | python3 scripts/pixelverse_mcp_server.py
```

### Hermes CLI wrapper
```bash
./run.sh install-adapter hermes-cli
./.pixelverse-service/bin/pixelverse-hermes chat
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

## 6. Browser smoke tests
### Command deck、Hook、Starting Cabin 與 canonical furniture
先以實際 compose port 啟動/驗證 service，再跑固定 clone-bay scenario 與 production browser：

```bash
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=localhost ./run.sh down_up
PIXELVERSE_TEST_HOOK_DELAY=5 PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661
```

若 `.pixelverse-service/compose.env` 記錄的 `PIXELVERSE_PORT` 不是 `5661`，最後一行必須改成該實際 port。Smoke 使用 system Chromium/CDP，等待 top-level/iframe fonts、canvas 與 world status layer ready 後才注入固定 main/subagent scenario。它驗證：

- 1440×900、1024×768、800×450 narrow 的實際 DOM bounds；roster 與 village 同時可見、零 overlap，且 village 面積較大
- 第一層每個 agent 有 pixel portrait card，卡片點擊與 village iframe 使用同一 agent selection
- busy 與 offline ECG signal、`prefers-reduced-motion` 靜態語意，以及 name/task 的 external-copy markers
- `en-US`、`zh-TW`、`ja-JP`、`ko-KR` 各自同步更新 shell、roster、village 與 accessible copy，不混用產品語言
- main `clone_bay -> standby_dock`、subagent `clone_bay -> tool_forge` 的 rendered transform 正向位移，不接受只有文字/room label 的 false-pass
- Starting Cabin (`rest-cabin`) 已打開、main agent occupant label 與 representative furniture 同時存在
- explicit Save、reload、v2 group store，以及透過 catalog 把同一 group 從 14×9 compact `rest-cabin` 放入 18×12 work-office `maker-workshop` 後 width/height、aspect ratio、rotation、member spacing 不變
- browser console error 與 page exception 都是空陣列

機器可讀輸出固定為 `tmp/command_deck_browser_smoke.json`。只有所有 assertion 通過，candidate PNG 才會 atomic promote 為：

- `docs/assets/command-deck-village.png`
- `docs/assets/starting-cabin-agent.png`

### 家具跨房間拖曳 / 裁切
```bash
./run.sh smoke-furniture-drag
```

此測試會用 Playwright + host Chromium 開啟目前 UI，進入 Move Furniture，把 `file_library` 的家具拖到 `response_studio` 右下角，並驗證：
- drop 後 `data-room-key` 與 parent district 都變成目標 room
- 拖曳過程出現 body-level ghost
- Save Layout 被啟用但測試不會點 Save，因此不會污染 server layout
- 家具有一部分超出目標 room card，且 `.district` / `.district-props` 沒有 hidden clipping
- console 沒有 JS page error

輸出：
- `tmp/furniture_drag_browser_smoke.json`
- `tmp/furniture_drag_browser_smoke.png`

可調參數：
```bash
PIXELVERSE_SMOKE_BASE_URL=http://127.0.0.1:5660 ./run.sh smoke-furniture-drag
PIXELVERSE_SMOKE_HEADED=1 PIXELVERSE_SMOKE_SLOW_MO_MS=150 ./run.sh smoke-furniture-drag
PIXELVERSE_SMOKE_SOURCE_ROOM=file_library PIXELVERSE_SMOKE_TARGET_ROOM=response_studio ./run.sh smoke-furniture-drag
```

## 7. Debug artifacts
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
  - 每段 outbound/return 的 runtime `route_evidence`（server event id、source/destination room 與正向座標位移）
- `tmp/local_ui_trajectory.jpg`
  - 最新任務路線圖
  - 多 agent 場景會用不同顏色虛線
- `tmp/global_map_walkability_mask.png`
  - A* 規劃器眼中的灰階 occupancy 圖
  - 黑色代表牆、隔間、房間外與家具 footprint blocker
  - 白色代表 free space；灰色代表門口 threshold

## 8. 分身測試判讀
`PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook` 會建立：

- `henry-main`
  - `think_lab -> clone_bay -> standby_dock`
- `synthetic-subagent-1`
  - `clone_bay -> tool_forge -> clone_bay`

若 `synthetic-subagent-1` 收到 completed/idle，會留在 clone bay 待命。
若分身任務沒有明確 stop/delete/completed，server 會保留該角色；超過 stale 門檻後會標示 offline，但仍保留在 `/api/world`。
local offline agent 可在 timeline 手動刪除；server 會拒絕刪除仍在線或等待接線的 agent。

`test-hook` 是 hard acceptance gate：bridge/API event 無法送達、預期 agent 缺失、room sequence 不符、runtime event id 缺失、座標沒有正向位移，或 route 只有單點時都會以 non-zero 結束。執行前會記錄目前最大 server event id，只有本次執行之後產生的 evidence 才能通過，舊 snapshot 不可 false-pass；direct/container curl 也都有 connect/overall timeout，避免 transport stall 無限等待。`clone_bay` 必須同時驗證主代理與 `synthetic-subagent-1`，不能以文字或 room label 變更替代 movement evidence。

Bridge `/hook` 的 HTTP 200 只代表 event 已進入非同步 relay queue，不代表 `/api/world` 已套用完成。送出 final `agent:end` 後，`test-hook` 會在 bounded deadline 內輪詢 `/api/world`，直到看到本次 baseline event id 之後、`henry-main` 從 scenario target room 回到 `standby_dock` 的正向座標位移 evidence，才進入 snapshot renderer acceptance。可用 `PIXELVERSE_TEST_HOOK_EVIDENCE_TIMEOUT` / `PIXELVERSE_TEST_HOOK_EVIDENCE_INTERVAL` 調整 deadline 與 poll interval；timeout 或 snapshot transport error 都必須 non-zero 且顯示等待的 exact route。

`test-hook`、status 與其他 runtime commands 會同時從 `.pixelverse-service/compose.env` 載入已儲存的 `PIXELVERSE_PORT` 與 `PIXELVERSE_BRIDGE_PORT`；shell 顯式環境變數仍優先。這可確保重新開 shell 後的 smoke command 連到實際 compose host ports，而不是退回 5660/4567 defaults。

## 9. 驗證標準
- 改動 schema 時，要先補測試再改實作
- 改動房間語意或移動規則時，要補純函式測試
- 改動文案時，要檢查中英文 fallback 是否都還可讀
- 任何可視化升級都不能犧牲資料可解釋性
- 修改 `run.sh` 後至少跑 `bash -n run.sh`
- 修改 frontend route/layout 後至少跑 `node --test tests/*.mjs`
- 修改 backend/schema 後至少跑 `python3 -m pytest -q -o faulthandler_timeout=10`

## 10. 下一階段 acceptance gates

### Portable onboarding
- 在不同 temporary username/clone path 執行 README 流程，並從另一個 repository 安裝 Codex hook。
- 靜態掃描 README 與公開腳本不得包含 `/home/a0665x`。
- installer 對既有合法 hooks 採安全合併且冪等；malformed/conflicting hooks 原始 bytes 不變。
- MCP onboarding 從任意 current working directory 回傳 Pixelverse clone 的絕對 activation path。

### Interior collision and motion
- 相同幾何距離在 ingress 與不同房間巡邏的耗時一致。
- 每個 motion sample 的 Agent feet clearance 不與非目標 opaque bounds 相交。
- chair/office-chair/sofa 只允許指定 seat target；bed 只允許 offline/sleeping target，皆不可作捷徑。
- 家具 move/rotate/scale、prefab paste、undo/redo 與 reload 後 route 立即重算；無解時停在最後合法點並回報 blocked。

### Responsive Agent detail
- Browser smoke 覆蓋 1440×900、1024×768、800×450 與 390×844。
- Roster click/keyboard 與 village character activation 開啟相同 Agent detail；Escape close 後 focus restore。
- Desktop 三個 splitter persistence/reset 正常，narrow/mobile 使用 dialog 且無 splitter。
- 每個 viewport 與 en-US/zh-TW/ja-JP/ko-KR 都必須零 region overlap、零水平 overflow、零混語、零 console/page error。
