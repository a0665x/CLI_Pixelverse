# 可攜式接線、室內導航與 Agent 詳情設計

日期：2026-08-28
狀態：已由使用者批准
範圍：公開 onboarding、Pixelworld 室內移動、Village-first Agent Roster

## 目標

1. 任何 GitHub 使用者都能從任意 clone 路徑啟動 Pixelverse，並在另一個 repository 安全安裝 Codex hook。
2. Agent 在所有房間以一致速度移動，不穿越隔板或非互動家具，且家具編輯後立即重新尋路。
3. 點擊 Roster 卡片或村莊人物時，開啟同一份 Agent 詳情；桌面版版面可調整且不遮蔽內容。

## 已批准的產品決策

- 桌面使用右側 Agent detail drawer；窄螢幕與手機改用 modal dialog。
- 桌面可調整 top status 高度、Agent Roster 高度及 detail drawer 寬度。
- `chair`、`office-chair`、`sofa` 只能由指定互動點進入，不能作為通行捷徑。
- `bed` 只有 `offline`／`sleeping` Agent 可由指定睡眠點進入；床體本身仍是障礙物。
- 中、英、日、韓產品文案必須依目前 locale 完整切換，不混用語言。

## 子系統一：可攜式 onboarding 與安全 hook 安裝

### 路徑模型

公開文件先在 Pixelverse clone 根目錄取得：

```bash
export PIXELVERSE_ROOT="$(pwd -P)"
```

跨 repository 指令一律使用 `"$PIXELVERSE_ROOT/run.sh"` 與
`"$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"`。生成的 activation 與 hook command
可以包含當前機器解析出的絕對路徑，但該內容不得被當成可提交的共用設定。

### 安裝階段

README 將流程分成四種生命週期：

1. Pixelverse clone 後一次性啟動與 adapter 建立。
2. 每個目標 repository 一次的 `install-codex-hook`。
3. 每個目前 shell 一次的 `source` activation。
4. 可選的 Bash startup 自動 activation。

### Hook 合併策略

- 目標沒有 `.codex/hooks.json`：建立檔案。
- 目標已有合法 JSON：保留未知頂層欄位、事件及 hook，加入缺少的 Pixelverse hook。
- 已有相同 Pixelverse command：視為已安裝，重複執行不新增第二份。
- 已有疑似 Pixelverse hook 但 command 指向不同位置，或 JSON 無法解析：停止並回報，不覆寫。
- 有內容變更時先建立同目錄備份，再以 temporary file + atomic replace 寫回。

MCP onboarding 必須回傳由 `scripts/pixelverse_mcp_server.py` 所在 repository 推導出的絕對 activation path。

## 子系統二：距離驅動與防穿模導航

### 單一速度模型

ingress 與工作巡邏共用同一個 cells-per-second 常數。每條路徑先計算相鄰點的歐氏距離與累積距離：

```text
duration_ms = total_distance_cells / cells_per_second * 1000
```

插值依累積距離尋找目前 segment，不再使用固定 `720ms` 或 `path.length` 代表距離。

### 阻擋與互動政策

- 所有具有 opaque bounds 的 furniture、surface、wall item、divider、plant 與 bed 預設阻擋。
- 只有 floor visual 完全不阻擋。
- seating furniture 與 bed 的 footprint 仍阻擋一般 A*；只有符合狀態的目標 Agent 能進入單一 interaction point。
- functional station 的目標是相鄰 interaction point，不開放整個 furniture footprint。
- 角色腳部 footprint 會轉成 blocker inflation margin，避免 sprite 邊緣切入家具像素。

### 動態重規劃

導航輸入由目前 `InteriorDefinition` 與家具幾何計算，不保留跨 layout revision 的舊 blocker。
新增、移動、旋轉、縮放、prefab paste、undo／redo、save reload 都必須改變 navigation signature，
使 occupant assignment 與 route 重新計算。無路可走時留在最後合法點，回傳 `blocked` 診斷狀態，禁止直線 fallback 或 teleport。

## 子系統三：Agent detail 與可調整 Village-first 版面

### 互動模型

Roster card click／Enter／Space 與 village character click 都呼叫同一個 `activateAgentDetail()`：

```text
resolve canonical Agent -> select -> focus village -> open detail -> remember trigger
```

關閉後焦點回到觸發元素。詳情顯示 portrait、identity、role、live/pixel state、ECG、task、room、tool/hook、
process/session identity、recent events 與 last seen。外部 payload 保持原文並標記為 external data。

### Responsive 呈現

- Desktop：右側 drawer，村莊保留可見且有保證的最小尺寸。
- Narrow/mobile：使用 modal dialog，不顯示不實用的 splitter。
- Escape、close button 與 backdrop 可關閉；focus trap 與 focus restore 必須成立。

### 版面狀態

新增 versioned layout state，包含 `topHeight`、`rosterHeight`、`detailWidth`。
正規化函式依 viewport 套用 min/max，確保村莊最小高度／寬度。Pointer、鍵盤方向鍵及雙擊 reset
共用同一 controller；合法狀態持久化，malformed storage 保留原值並回到安全預設。

### ECG 與語言

- idle：平穩低頻。
- working／busy：提高頻率與有限振幅。
- offline／dead：停止或接近平線。
- reduced motion：保留靜態狀態差異，不持續動畫。
- 產品自有內容只從 `en-US`、`zh-TW`、`ja-JP`、`ko-KR` 的完整 bundle 取得。

## 錯誤與安全邊界

- Hook 安裝失敗不能破壞既有 hooks；輸出 exact target、backup 或停止原因。
- Pathfinding 無解不等於允許直線移動。
- Layout resize 不可讓相鄰區域互蓋，也不可使控制項無法到達。
- 不新增第二套 runtime state、Agent identity 或 locale fallback。

## 驗收總覽

- 在不同 username／clone path 的 temporary workspace 完成 onboarding，並證明既有 hooks 原樣保留。
- 相同幾何距離在不同房間耗時一致；每個 motion sample 的 feet bounds 不與非目標 blocker 相交。
- 家具編輯與 reload 後立即改道；無路時停在合法位置。
- 1440×900、1024×768、800×450 與手機寬度無遮蔽、無水平頁面 overflow。
- Roster 與 village character 開啟同一 Agent detail，鍵盤、focus restore、splitter persistence 及四語皆通過。

## 實作拆分

為降低交叉風險，實作分成三份可獨立驗收的計畫：

1. `2026-08-28-portable-codex-onboarding.md`
2. `2026-08-28-interior-collision-motion.md`
3. `2026-08-28-responsive-agent-detail-layout.md`
