# Hermes Pixelverse — PROJECT_MAP

## 1. 專案一句話
Hermes Pixelverse 是把 **Hermes Agent 執行狀態、分身協作、工作階段流動**，轉譯成 world-first 像素空間的可視化專案。

## 2. 目前重整後的判讀順序
1. [architecture/system-overview.md](architecture/system-overview.md)
2. [architecture/data-flow.md](architecture/data-flow.md)
3. [modules/world-frontend.md](modules/world-frontend.md)
4. [modules/runtime-backend.md](modules/runtime-backend.md)
5. [conventions/visual-and-doc-standards.md](conventions/visual-and-doc-standards.md)
6. [references/star-office-adaptation.md](references/star-office-adaptation.md)

## 3. 漸進式披露地圖
### Level 0 — Agent 快速入口
- [agent.md](agent.md)
- [map.md](map.md)
- [project_herness.md](project_herness.md)

### Level 1 — 架構全景
- [architecture/system-overview.md](architecture/system-overview.md)
- [architecture/data-flow.md](architecture/data-flow.md)

### Level 2 — 模組責任
- [modules/product-scope.md](modules/product-scope.md)
- [modules/world-frontend.md](modules/world-frontend.md)
- [modules/runtime-backend.md](modules/runtime-backend.md)
- [modules/integration-and-events.md](modules/integration-and-events.md)
- [modules/testing-and-ops.md](modules/testing-and-ops.md)

### Level 3 — 標準與參考
- [conventions/visual-and-doc-standards.md](conventions/visual-and-doc-standards.md)
- [conventions/api-and-schema-standards.md](conventions/api-and-schema-standards.md)
- [references/star-office-adaptation.md](references/star-office-adaptation.md)

## 4. 專案骨架
### Runtime / API
- `pixelverse_server.py` — world state、agent lifecycle、room classification、Hermes 狀態整合
- `pixelverse_fastapi.py` — FastAPI / Swagger API、SSE stream、static UI 入口
- `bridge.py` — Hermes hook / lifecycle 轉 relay，負責推動世界狀態與 target_room
- `agent_bridges/` — 通用 Pixelverse bridge client 與 Hermes CLI adapter
- `hooks/miniverse/` — hook 進入點與 relay handler
- `run.sh` / `docker-compose.yml` — Docker service 啟停、agent selection、adapter 安裝、test-hook、debug artifacts

### Frontend World
- `public/index.html` — 單頁容器 + 大量內嵌 CSS + HUD / panels
- `public/app.mjs` — 前端 orchestration，負責資料接收、DOM 更新、agent view lifecycle
- `public/house_layout.mjs` — 中央走廊一體式房間平面
- `public/room_furniture.mjs` — 家具座標、blockers、interaction stand points
- `public/world_motion.mjs` — A* 路徑規劃、門口 anchors、walkability
- `public/*.mjs` — 姿態、文案、事件、FX、資產映射等專責模組

### Verification / Notes
- `tests/` — Python + Node/MJS 測試
- `tmp/local_ui_trajectory.jpg` — 最新 test-hook route 圖
- `tmp/pixelverse_debug_log.json` — 最新 test-hook per-agent route/debug log
- `docs/reference/2026-05-22-star-office-reference-notes.md` — Star Office 實際拆解筆記
- `spec/` — 本次重新梳理後的正式理解入口

## 5. 目前最重要的產品標準
1. **先一眼讀懂，再談華麗。**
2. **主代理永遠是首屏焦點。**
3. **房間語意要對應工作語意，而不是只對應裝飾。**
4. **前後端欄位契約穩定，畫面表現可迭代。**
5. **借鏡 Star Office 的敘事方法，不照抄其美術與人格。**

## 6. 當前重構焦點
- 讓畫面優先回答「誰在做什麼、在哪裡、是否卡住」
- 把 `public/index.html` 與 `public/app.mjs` 持續拆薄
- 明確定義 world state schema，避免 UI 與資料語意混在一起
- 保留 `.spec/` 僅作相容入口，正式文件以 `spec/` 為準
- `./run.sh --help` 必須能查到 service、test-hook target、debug artifact 的基本用法
