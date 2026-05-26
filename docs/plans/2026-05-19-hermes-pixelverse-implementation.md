# Hermes Pixelverse Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在 `~/Desktop/AI_AGX_WS/hermes-pixelverse` 建立一個可執行的像素化監控介面，能觀察主 Hermes agent、subagents、狀態與工具活動。

**Architecture:** 採用獨立專案模式，前端負責像素世界渲染，後端負責聚合 Hermes 現有 API 與 tracker 狀態。MVP 不先侵入 Hermes 主 repo；若需要更細事件流，再做第二階段整合。

**Tech Stack:** React + TypeScript + Vite、Node adapter 或 FastAPI adapter、WebSocket/SSE、JSON config、Vitest/Playwright or pytest（依實作決定）。

---

## Phase 0 — Discovery and Safety

### Task 1: Freeze references and document upstream sources
**Objective:** 把參考來源與本機依賴路徑固定下來，避免後續整合時混亂。

**Files:**
- Modify: `.spec/PROJECT_MAP.md`
- Create: `docs/reference/upstreams.md`

**Steps:**
1. 記錄 `hermes-miniverse`、`miniverse`、本機 Hermes repo 路徑。
2. 記錄現有可用 API：`/api/status`、`/api/subagents`、`/api/sessions`。
3. 記錄 Hermes 主 repo 目前 dirty working tree，避免未經確認直接修改。

### Task 2: Decide adapter boundary
**Objective:** 決定 Pixelverse 是否只讀 Hermes API，或同時讀 tracker 檔案。

**Files:**
- Modify: `.spec/modules/integration-surfaces.md`
- Create: `docs/adr/0001-adapter-boundary.md`

**Steps:**
1. 比較 API-only 與 API+tracker 方案。
2. 選定 MVP 用 API+tracker。
3. 明確寫出未來 event feed patch 為可選升級。

---

## Phase 1 — Project Skeleton

### Task 3: Replace bridge-only repo structure with app workspace
**Objective:** 把目前 clone 下來的 bridge 參考 repo整理成真正的新專案骨架。

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `backend/` 下的 adapter 程式
- Create: `package.json` or monorepo root scripts
- Modify: `README.md`

**Steps:**
1. 保留 upstream bridge 參考檔案到 `references/upstream/hermes-miniverse/` 或 `archive/`。
2. 建立新的 frontend/backend 目錄。
3. 建立 root scripts：dev、build、lint。
4. 更新 README 為 Pixelverse 專案說明。

### Task 4: Add local config model
**Objective:** 讓場景與 Hermes 來源可客製化。

**Files:**
- Create: `config/pixelverse.example.json`
- Create: `frontend/src/types/config.ts`
- Create: `backend/config.py` 或 `backend/config.ts`

**Steps:**
1. 定義 Hermes base URL、刷新頻率、agent sprite、tool icon mapping、theme。
2. 支援本地覆寫設定。
3. 加入 schema validation。

---

## Phase 2 — Hermes Data Adapter

### Task 5: Implement Hermes snapshot fetcher
**Objective:** 定期抓取 Hermes 的 status / subagents / sessions。

**Files:**
- Create: `backend/hermes_client.*`
- Create: `backend/services/snapshot_service.*`
- Test: `backend/tests/test_snapshot_service.*`

**Steps:**
1. 寫 failing tests，模擬 Hermes API responses。
2. 實作 API client。
3. 把狀態整形成單一 snapshot。
4. 驗證 API 失敗時有 graceful fallback。

### Task 6: Convert Hermes snapshot into world entities
**Objective:** 將 Hermes / subagent 狀態轉成像素世界角色與事件。

**Files:**
- Create: `backend/services/world_mapper.*`
- Test: `backend/tests/test_world_mapper.*`

**Steps:**
1. 主 agent 映射成世界主角。
2. subagents 映射成分身角色。
3. tool name 映射成 icon/action 狀態。
4. 生成前端易用 world-state payload。

### Task 7: Expose realtime endpoint
**Objective:** 讓前端持續收到最新世界狀態。

**Files:**
- Create: `backend/server.*`
- Create: `backend/routes/world.*`
- Test: `backend/tests/test_world_route.*`

**Steps:**
1. 提供 `/api/world` snapshot endpoint。
2. 提供 `/ws` 或 `/api/world/stream`。
3. 加入 mock mode 方便無 Hermes 狀態時開發。

---

## Phase 3 — Pixel Frontend MVP

### Task 8: Build pixel world shell
**Objective:** 先把世界畫面、地圖、角色容器做出來。

**Files:**
- Create: `frontend/src/components/world/WorldCanvas.tsx`
- Create: `frontend/src/components/world/TileMap.tsx`
- Create: `frontend/src/components/world/AgentSprite.tsx`
- Create: `frontend/src/styles/pixel.css`

**Steps:**
1. 建立固定像素世界與房間區塊。
2. 主 agent 放在主工作區。
3. subagents 放在分身區或任務桌。
4. 加入基本 walk/idle/think/work 動畫狀態。

### Task 9: Build tool icon overlays
**Objective:** 在角色周圍顯示現在/最近使用工具的像素提示。

**Files:**
- Create: `frontend/src/components/world/ToolBadge.tsx`
- Create: `frontend/src/lib/toolIcons.ts`
- Test: `frontend/src/lib/toolIcons.test.ts`

**Steps:**
1. tool name 對應到 icon/sprite。
2. 顯示 current_tool 與 recent events。
3. 對未知工具提供 fallback icon。

### Task 10: Build inspect panel on click
**Objective:** 點角色就能看到詳細狀態。

**Files:**
- Create: `frontend/src/components/panels/AgentInspector.tsx`
- Create: `frontend/src/state/ui.ts`

**Steps:**
1. 點主 agent 顯示當前 task、status、最近事件。
2. 點 subagent 顯示 goal、current_tool、idle time、event history。
3. 顯示資料更新時間與來源。

---

## Phase 4 — Customizability and Polishing

### Task 11: Theme and sprite customization
**Objective:** 讓使用者能調整風格，不只是固定畫面。

**Files:**
- Create: `frontend/src/themes/*.ts`
- Create: `assets/sprites/`
- Create: `docs/customization.md`

**Steps:**
1. 主題色、地圖樣式、角色色可切換。
2. 工具 icon mapping 可自訂。
3. Agent 名稱、標籤、顯示規則可配置。

### Task 12: Add empty/error/loading states
**Objective:** 確保 Hermes 沒開、API 掛掉、無分身時也好理解。

**Files:**
- Modify: frontend world/status components
- Test: frontend state tests

**Steps:**
1. 無連線狀態顯示睡眠/離線世界。
2. 無 subagents 顯示單人工作場景。
3. backend error 轉成人類可讀提示。

---

## Phase 5 — Optional Hermes Core Integration

### Task 13: Add richer tool event feed to Hermes core
**Objective:** 若 MVP 顯示不夠細，再補主 agent 真正工具流。

**Files:**
- Possible Modify: `~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent/...`
- Possible Add: tracker / hook / event endpoint files

**Steps:**
1. 先與使用者確認批准修改現有 Hermes repo。
2. 優先做非破壞性 event writer 或 stream endpoint。
3. Pixelverse 讀取更細粒度事件後，升級工具動畫與 timeline。

---

## Verification Checklist
- [ ] 專案可在本機啟動
- [ ] 無 Hermes 時可跑 mock mode
- [ ] 有 Hermes 狀態時能顯示主 agent
- [ ] 有 delegate_task 時能顯示 subagents
- [ ] 點擊角色能看詳情
- [ ] 至少能顯示目前或最近工具活動
- [ ] 設定檔可客製至少名稱、顏色、圖示映射、主題

## Approval Gates
1. **已可直接做**：新專案建立、UI/adapter 開發、讀 Hermes 現有 API
2. **建議先確認**：是否允許我修改現有 Hermes 主 repo 來輸出更細工具事件
