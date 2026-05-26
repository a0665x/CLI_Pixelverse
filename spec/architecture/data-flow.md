# Data Flow

## 1. 主流程
1. Hermes lifecycle / hook / bridge 產生事件
2. `bridge.py` 將事件轉成 heartbeat、act、webhook、message relay
3. `pixelverse_server.py` 更新 `WorldState`
4. server 整合本地 agents + Hermes 狀態來源
5. server 輸出 `/api/world` 與 `/api/world/stream`
6. `public/app.mjs` 消費 snapshot / stream 並更新場景

## 2. 後端資料責任
### Input side
- `POST /api/heartbeat`：同步主代理狀態
- `POST /api/act`：追加 thought / tool / status / speak / message
- `POST /api/webhook`：註冊 relay 位置

### Enrichment side
- `normalize_state()`：狀態歸一化
- `classify_room()`：依 state / task / role 分派房間
- `humanize_tool_name()` / `humanize_task_summary()`：將工具與任務變成人話
- HermesSource：補抓 subagents、sessions、整體連線狀態

### Output side
- `/api/world`：完整快照
- `/api/world/stream`：SSE 事件流
- `/api/inbox`：最小訊息收件箱

## 3. 前端資料責任
- `realtime.mjs`：組 stream URL、解析 SSE 訊息
- `app.mjs`：管理 snapshot lifecycle 與 DOM / scene 更新
- `ui_strings.mjs`：多語 copy、本地化 tool summary、房間 copy
- `main_agent_events.mjs`：將最新事件轉成更聚焦的主代理視覺提示

## 4. 資料到畫面的翻譯規則
- state 不是直接顯示原字串，而是影響房間、氣泡、姿態、路徑
- task 不是原樣堆在畫面，而是先做 humanized summary
- role 影響角色落點：主代理 / 分身 / branch session 不共享同一套擺位
- stale / offline 必須有明顯退化表現，不能默默消失

## 5. 目前最應守住的邊界
- backend 決定資料語意與欄位
- frontend 決定世界敘事與視覺優先級
- asset mapping 可調，但不能反向污染 world schema
