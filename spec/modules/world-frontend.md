# World Frontend

## 1. 前端檔案層次
### Shell
- `public/index.html` — HTML 結構、世界容器、HUD、面板、全域 CSS

### Orchestrator
- `public/app.mjs` — snapshot/stream 接收、agent lifecycle、DOM/scene 更新、互動入口

### Scene Helpers
- `house_layout.mjs` — 房間與門位
- `world_motion.mjs` — 路徑、朝向、步態節奏
- `agent_pose.mjs` — 姿態與互動錨點
- `room_furniture.mjs` — 共享家具座標、可視家具、家具 blockers、互動站位點
- `scene_fx.mjs` — 房間 / 區域 / 道具特效
- `kenney_assets.mjs` — 開放資產映射

### UI Helpers
- `ui_strings.mjs` — 多語 copy 與人話化摘要
- `ui_state.mjs` — camera / draggable panel 狀態
- `realtime.mjs` — SSE 支援與解析
- `main_agent_events.mjs` — 主代理事件摘要視覺

## 2. 目前前端真實狀況
- `index.html` 內嵌 CSS 約千行等級，仍偏厚
- `app.mjs` 約千行等級，是現階段最胖的整合層
- helper 模組已拆出，但 shell 與 orchestration 仍需再瘦身
- world map 採用「中央共享走廊 + 上下房間貼合」的一體式辦公平面
- route debug JPG 與 UI 共用 `house_layout.mjs` / `room_furniture.mjs`，避免地圖與路徑規劃分裂

## 3. 路徑規劃現況
- `world_motion.mjs` 使用 grid-based A*。
- walkable map 由房間矩形、中央走廊、門口 threshold、家具 blockers 組成。
- 跨房間 route 必須經過三段門口 anchor：
  - `aisle`：房內門前
  - `portal`：門線
  - `hub`：走廊側門前
- `room_furniture.mjs` 會把家具中心轉成 interaction stand point；agent 應站在家具旁，不應站在 blocker 中心。
- `tmp/pixelverse_debug_log.json` 是排查路徑規劃的主要證據來源。

## 4. 視覺優先序
1. 主代理
2. 房間語意
3. 主要事件
4. 分身 / sessions
5. 裝飾與 ambience

## 5. 更直觀的設計標準
- 房間標籤要先說功能，再說美術名稱
- agent 氣泡要優先表達「正在做什麼」而不是長句敘事
- path / facing / pose 要幫助理解，不只是動畫效果
- summary panel 要濃縮成 decision-support，而不是重印 API
- 若畫面擁擠，先砍面板與裝飾，不先砍主代理語意
- 不要把房間排成零散孤島；使用者要一眼看出這是一個完整室內平面
- 多 agent 路線要能在 debug JPG 中分色，但 UI 中不一定顯示路線軌跡

## 6. 與 Star Office 的差異化
- Hermes Pixelverse 更像工程 runtime 世界，不是單純像素辦公室
- 房間名稱與事件語意綁定 Hermes 工作流
- 視覺參考的是敘事方法，不是 copy 美術模板

## 7. 建議下一步
- 把 `index.html` CSS 拆成可維護樣式檔
- 把 `app.mjs` 分成 state adapter、scene renderer、panel controller
- 為 mobile / narrow viewport 定義更激進的資訊裁切規則
