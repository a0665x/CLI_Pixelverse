# Hermes Pixelverse 開發里程碑與驗收標準

> 目的：把專案拆成可逐步交付、可審核、可中途停下來驗收的明確節點。

## 專案總目標
在 `~/Desktop/AI_AGX_WS/hermes-pixelverse` 建立一個可視化介面，讓使用者可以用像素世界方式觀察：
- 主 Hermes agent 目前狀態
- subagents / branch sessions 的存在與活動
- 目前或最近的工具使用情況
- 點擊角色後的詳細資訊
- 世界、角色、圖示、主題的可客製化設定

---

## Milestone 0 — 需求凍結與整合邊界確認

### 交付內容
- 明確定義 MVP 範圍
- 明確定義 Hermes Pixelverse 與 Hermes 主 repo 的邊界
- 決定第一版採用「獨立專案 + 現有 Hermes API / tracker」模式

### 完成條件
- `product-scope.md` 已列出 MVP / Phase 2 / Out of Scope
- `integration-surfaces.md` 已列出可用 API、已知缺口、Option A / B
- 有一份實作計畫與 approval gate

### 驗收標準
1. 文件中清楚寫出 MVP 至少包含：
   - 主 agent
   - subagents
   - 工具圖示
   - 點擊詳情
   - 客製化設定
2. 文件中清楚寫出：
   - 第一版不必修改 Hermes 主 repo 才能啟動開發
   - 若要更細工具事件流，才進入第二階段整合
3. 使用者能在不看原始碼的情況下理解第一版要做什麼、不做什麼

### 風險閘門
- 若此里程碑未明確，後面容易 scope creep

---

## Milestone 1 — 專案骨架可啟動

### 交付內容
- `hermes-pixelverse` 從參考專案整理成真正可開發的新專案
- 具備前端 / 後端 / 設定檔的基本骨架
- README 能讓人快速啟動專案

### 完成條件
- 專案有清楚的 `frontend/`、`backend/`、`config/` 結構
- 有本機開發啟動指令
- 有範例設定檔
- 保留 upstream 參考來源，不與新程式混在一起

### 驗收標準
1. 專案目錄結構清楚，至少包含：
   - `frontend/`
   - `backend/`
   - `config/`
   - `docs/`
2. `README.md` 至少包含：
   - 專案目的
   - 安裝方式
   - 啟動方式
   - Hermes 來源設定方式
   - mock mode 說明
3. 開發者在乾淨環境依 README 操作後，可以成功啟動前後端其中至少一個可運作的開發模式
4. 設定檔至少可調整：
   - Hermes base URL
   - refresh interval
   - theme
   - agent labels
   - tool icon mapping

### Demo 驗收畫面
- 開啟專案後至少能看到一個靜態或 mock 的 pixel world 基本畫面

---

## Milestone 2 — Hermes 資料接線完成

### 交付內容
- 後端能從 Hermes 現有 API / tracker 抓資料
- 將散落資料整形成 Pixelverse 可直接使用的 world snapshot

### 完成條件
- 有 snapshot fetcher
- 有 world mapper
- 有錯誤處理與 fallback
- 有 mock data 模式

### 驗收標準
1. 後端可從以下來源成功取值至少一部分：
   - `/api/status`
   - `/api/subagents`
   - `/api/sessions`
   - tracker（如有需要）
2. 後端輸出單一統一格式，例如 world snapshot，至少包含：
   - 主 agent 狀態
   - subagent 列表
   - 任務摘要或 session 摘要
   - 工具活動欄位（即使暫時是 coarse-grained）
   - 最後更新時間
3. Hermes 關閉或 API 失敗時：
   - 不會讓整個服務崩潰
   - 前端可收到可解釋的 error / empty 狀態
4. 有測試覆蓋以下情境：
   - 正常回應
   - API timeout / 失敗
   - 空 subagents
   - 不完整欄位

### Demo 驗收畫面
- 呼叫 `/api/world` 或等價 endpoint 時，能看到整理後的 JSON 結果

---

## Milestone 3 — Pixelverse MVP 視覺化完成

### 交付內容
- 前端能把 world snapshot 轉成可視化 pixel scene
- 主 agent 與 subagents 都會顯示在畫面中
- 工具圖示與動作狀態可被看見

### 完成條件
- 有世界容器 / 地圖 / 角色 sprite / tool badge
- 有狀態到動畫或姿態的映射
- 前端能持續刷新或接收串流更新

### 驗收標準
1. 主 agent 至少能顯示下列其中多數狀態：
   - idle
   - thinking
   - working
   - speaking
   - sleeping
   - error
2. 有 subagent 時，畫面上會新增對應角色；無 subagent 時，不會報錯或產生壞畫面
3. 工具活動至少能用 icon / badge / 氣泡顯示：
   - current tool 或 recent tools
4. 即使工具名稱未知，也有 fallback icon 或 generic 狀態
5. 畫面刷新後角色狀態會跟資料同步變化，而不是固定假畫面

### Demo 驗收畫面
- 可以直接看出：
   - 誰是主 agent
   - 有幾個 subagents
   - 大家現在大概在做什麼

---

## Milestone 4 — 點擊檢視與狀態可讀性完成

### 交付內容
- 使用者點擊角色可看到詳細資訊
- 畫面不只好看，也要能實際回答「現在在幹嘛」

### 完成條件
- 有 inspector panel / side panel / modal
- 主 agent 與 subagent 顯示不同但一致的資訊模型
- 有 last updated 與 data source 提示

### 驗收標準
1. 點主 agent 時至少可看到：
   - agent 名稱
   - 目前狀態
   - 當前任務摘要
   - 最近工具活動
   - 最後更新時間
2. 點 subagent 時至少可看到：
   - subagent 名稱或 ID
   - goal / current task
   - current tool
   - 活動狀態
   - 最近事件或 idle duration
3. 若資料缺漏，UI 會顯示 `unknown` / `unavailable` 等可理解標籤，而不是空白壞掉
4. 使用者從 inspector 中可以判斷目前 agent 是否忙碌、卡住、待命或錯誤

### Demo 驗收畫面
- 點角色後，能回答一句話：
  - 「Hermes 正在做什麼？」
  - 「這個分身在處理哪件事？」

---

## Milestone 5 — 客製化能力完成

### 交付內容
- 世界與角色不再是寫死
- 使用者可透過設定檔調整外觀與顯示規則

### 完成條件
- 支援 theme / sprite / label / icon mapping 的設定
- 文件說明如何新增或覆寫設定

### 驗收標準
1. 不改程式碼，只改設定檔即可調整至少以下項目：
   - 主 agent 名稱
   - 顏色或 sprite 樣式
   - 世界主題
   - 工具 icon 對應
   - 是否顯示某些標籤
2. 若設定檔格式錯誤：
   - 後端或前端會給出可理解錯誤
   - 不會默默失敗到無法排查
3. 文件中有至少一組完整自訂範例
4. 未來新增新工具名時，不需改核心邏輯也能補圖示映射

### Demo 驗收畫面
- 切換一份設定後，畫面主題或角色風格有明顯改變

---

## Milestone 6 — 穩定性與可交付版本

### 交付內容
- 進入可日常使用的版本
- 補齊 loading / empty / offline / error 狀態
- 有基本測試與發版前檢查

### 完成條件
- 可在 Hermes 開/關兩種狀態下運作
- 有基本測試命令
- 有 build / run / verify 文件

### 驗收標準
1. 以下場景都能合理呈現：
   - Hermes 未啟動
   - Hermes 啟動但沒有 subagents
   - Hermes 有多個 subagents
   - API 暫時失敗
   - 設定檔錯誤
2. 有至少一套可重複執行的驗證命令，例如：
   - frontend tests
   - backend tests
   - build
3. 不會因為單一 API 欄位缺失就讓整個 UI 崩掉
4. 首次進入畫面時，3 秒內能看到 loading 或 mock/empty 狀態，不會白屏

### Demo 驗收畫面
- 不管 Hermes 狀態如何，畫面都「有回應、可理解、可診斷」

---

## Milestone 7 — 進階整合：Hermes 主 repo 細粒度事件流（需批准）

### 交付內容
- 補上主 agent 真正的工具事件流
- Pixelverse 可更精準顯示當下工具切換與步驟動畫

### 前置批准
- 使用者明確同意修改：
  `~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent`

### 完成條件
- Hermes core 新增非破壞性 event feed / hook / snapshot writer 之一
- Pixelverse 讀得到主 agent 細事件
- UI 能把事件流視覺化

### 驗收標準
1. Pixelverse 能比 Milestone 3 更精準顯示：
   - 當前工具
   - 工具切換順序
   - 近期步驟摘要
2. 若 event feed 不可用，系統仍能退回 Milestone 3 的 coarse-grained 模式
3. 對 Hermes 主 repo 的修改有清楚隔離，避免污染既有功能
4. 有文件說明如何啟用 / 關閉此進階整合

### Demo 驗收畫面
- 使用工具時，角色狀態與工具圖示切換更即時、更細緻

---

## 建議的驗收節奏

### 第一輪可驗收點
- Milestone 0 + 1 完成後
- 你可確認：方向對不對、骨架是否合理

### 第二輪可驗收點
- Milestone 2 + 3 完成後
- 你可確認：是否已經「看得到 Hermes 在做事」

### 第三輪可驗收點
- Milestone 4 + 5 完成後
- 你可確認：是否已經「真的好用，而且可客製」

### 第四輪可驗收點
- Milestone 6 完成後
- 你可確認：是否足夠穩定可日用

### 額外批准點
- Milestone 7 開始前
- 你只需要決定是否允許我動 Hermes 主 repo

---

## 最小可交付版本（推薦先做到這裡）
若要先快速做出有感版本，建議把第一個可交付版本定義為：
- 完成 Milestone 0 ~ 4
- 先不做 Hermes core patch

這樣你就已經能：
- 看到主 agent
- 看到 subagents
- 看到工具活動提示
- 點擊查看狀態
- 理解我現在在做什麼

---

## 專案成功判斷一句話
如果你打開 Pixelverse 後，能在 5 秒內回答下面三個問題，這個專案就算成功：
1. Hermes 現在有沒有在忙？
2. 它現在大概在做哪件事？
3. 有沒有分身在同時處理別的工作？
