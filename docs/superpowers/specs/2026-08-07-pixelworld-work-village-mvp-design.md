# PixelWorld 工作村莊 MVP 設計

- 日期：2026-08-07
- 狀態：設計已由使用者確認，等待書面規格複核
- 實作位置：`pixelworld_mvp/`
- 後續整合目標：CLI_Pixelverse hook／SSE 世界狀態

## 1. 摘要

在 `pixelworld_mvp/` 建立一個獨立執行的 Phaser 3、TypeScript、Vite 像素世界 MVP。畫面是一座小型、單張、連續的「工作村莊」，不是由房間 YAML 切換的辦公室，也不是跟隨單一角色的 RPG。

村莊使用固定全局視角，同時呈現 main agent、subagents、三棟功能建築與四個開放工作區。開發者從測試面板觸發 Working、Tool Using、Clone Agent、Idle 等狀態，Agent 經 A* 導航前往對應工作站，抵達後播放行為動畫並顯示狀態標籤或對話氣泡。測試面板與未來 Codex hooks 共用標準事件介面，因此整合時只替換事件來源，不重寫世界行為。

本 MVP 只製作室外世界。第二階段才讓 Agent 進入建築，並以不移動全局鏡頭的室內浮層查看建築內各 Agent 的狀態。

## 2. 目標

1. 一眼看懂每個 Agent 在哪裡、正在做什麼、是否等待或受阻。
2. 用可重複操作的測試面板驗證所有 hook 對應的移動與行為。
3. 保留並明確驗證 A* 導航、碰撞、前後遮擋和多人工作位分配。
4. 讓狀態按鈕和真實 hook 使用同一份資料契約，降低後續整合成本。
5. 用現有角色與可用家具先完成可玩的視覺垂直切片，再由使用者驗收世界方向。
6. 讓固定全局視角在 Agent clone 增多時仍適合觀察整個系統。

## 3. 非目標

第一階段不包含：

- CLI_Pixelverse 後端、SSE、hook 或 session 的正式接線。
- 可進入的室內場景、門轉場或室內角色控制。
- 跟隨 Agent 的相機、自由捲動的大型地圖或玩家 RPG 操作。
- 登入、資料庫、網路多人連線或永久世界儲存。
- 完整遊戲 NPC、任務、戰鬥、物品與對話樹。
- 重構既有 CLI_Pixelverse 世界實作。

`pixelworld_mvp/build_world_guide.md` 是美術、碰撞與 Phaser 架構參考；本規格經使用者確認後覆寫其中「相機跟隨」、「第一階段室內」與「玩家自由控制」要求。

## 4. 已選技術方案

採用 Phaser 3 + TypeScript + Vite + HTML5 Canvas，搭配純 TypeScript 的四方向網格 A*。

選擇原因：

- 和指南及既有網頁型 CLI_Pixelverse 的整合方向一致。
- Phaser 已能處理 Tilemap 碰撞、深度排序、Canvas UI 與 pixel-perfect 相機。
- MVP 不需要 Godot 的編輯器、匯出流程與 Web 嵌入橋接成本。
- 導航、路由和工作位分配可以寫成不依賴 Scene 的純邏輯模組，便於測試與後續搬移。

未選方案：

- Godot 4：2D 導航與場景系統完整，但對此獨立 Web MVP 過重，後續還需額外處理與現有前端的通訊和嵌入。
- 延伸現有 DOM/CSS 世界：可直接沿用既有 UI，但不利於 Tilemap、碰撞、逐物件 Y-sort 和大量 sprite 動畫。

## 5. 世界與相機

### 5.1 固定全局畫面

- 村莊採單張連續室外地圖，基礎 tile 為 16×16 px。
- 邏輯世界基準為 40×22 tiles，即 640×352 px。
- 啟動與視窗縮放時重新計算整數倍縮放，使用 nearest-neighbor、關閉 antialiasing 並啟用 pixel rounding。
- 相機固定涵蓋整張村莊，不跟隨、平移或自動聚焦任何 Agent。
- 畫面比例不吻合時保留 letterbox；不得裁掉村莊以填滿視窗。
- 測試面板在寬螢幕停靠 Canvas 右側；空間不足時折疊成不遮擋主要村莊的開關。
- MVP 不提供手動平移或縮放；除錯層也必須維持完整村莊視角。手動放大只列為未來無障礙功能。

### 5.2 村莊配置

村莊中央以 Arrival／Queue Plaza 串接三棟建築和四個開放區域。道路形成環狀與短支路，任一功能區至少有一條可用路徑，重要建築提供備用 approach anchor。

三棟建築：

| 建築 | 第一階段外部功能 | 主要狀態 | 第二階段室內意義 |
| --- | --- | --- | --- |
| Knowledge & Planning Hall | 書架、文件桌、戶外白板 | Read、Grep、Glob、LS、Todo、Planning | 檔案、計畫與推理觀察 |
| Build Workshop | 電腦、工作桌、終端機架 | Edit、Write、Patch、Bash、Terminal | 程式修改與命令執行觀察 |
| Collaboration & Signal Station | 訊號台、dispatch pad、通訊設備 | Skill、Subagent、Web、MCP、GitHub、Responding | 工具、subagent 與輸出觀察 |

四個開放區域：

| 區域 | 功能 | 主要狀態 |
| --- | --- | --- |
| Arrival／Queue Plaza | 出生、初始化、排隊 | SessionStart、Awaiting Input |
| Thinking Garden | 草地、花圃、短距離思考步行 | Thinking、UserPromptSubmit |
| Lounge Lawn | 長椅、沙發、樹蔭 | Idle、Completed、Sleeping、Stop |
| Repair Corner | 維修工具、警告燈、故障設備 | Blocked、Error、Offline、Self-healing |

房屋數量固定為三棟；新增 hook 優先對應既有建築內的新工作站或開放區，不為每個 hook 新建房屋。

## 6. 事件契約與資料模型

### 6.1 標準世界事件

測試面板與正式 hooks 都轉換成 `AgentWorldEvent`：

```ts
type WorldEventKind =
  | 'session_start'
  | 'think'
  | 'plan'
  | 'read'
  | 'edit'
  | 'tool'
  | 'web'
  | 'clone'
  | 'respond'
  | 'await'
  | 'blocked'
  | 'self_heal'
  | 'idle'
  | 'offline'
  | 'heartbeat'
  | 'unknown';

interface AgentWorldEvent {
  eventId: string;
  timestamp: number;
  source: 'demo' | 'hook';
  agentId: string;
  agentRole: 'main' | 'subagent';
  kind: WorldEventKind;
  phase: string;
  activityLabel: string;
  detail?: string;
  toolName?: string;
}
```

`eventId` 用來去重；`kind` 決定世界路由；`phase` 和 `activityLabel` 決定狀態標籤。`detail` 只承載已在事件來源端清理、可安全顯示的短訊息；第一階段氣泡預設使用路由模板，不直接顯示 `detail`。世界邏輯不得依賴 demo 按鈕名稱。

### 6.2 行為路由

```ts
interface BehaviorRoute {
  destinationId?: string;
  preserveLocation: boolean;
  action: AgentAction;
  bubblePolicy: 'none' | 'transient' | 'persistent';
  bubbleText: string;
  priority: number;
}
```

`BehaviorRouter` 只將事件轉成目的地、動畫和顯示規則，不直接操作 sprite 或尋路。Heartbeat 使用 `preserveLocation: true`，不得取消目前路線或工作行為。

`AgentAction` 固定包含 `arrive`、`ponder`、`plan`、`read`、`type`、`terminal`、`signal`、`dispatch`、`respond`、`queue`、`repair`、`rest`、`offline` 和 `pulse`。新增動作必須先加入此 union，再由 `ActionController` 提供明確實作。

### 6.3 工作站

```ts
interface StationDefinition {
  id: string;
  zoneId: string;
  approachAnchors: GridPoint[];
  interactionAnchors: InteractionSlot[];
  queueAnchors: GridPoint[];
  action: AgentAction;
  interiorSceneId?: string;
}
```

每個 interaction slot 包含位置、面向和對應 prop。第二階段可以把同一 station 的目的地改為門，並使用 `interiorSceneId` 開啟室內狀態浮層，而不更動事件路由契約。

## 7. 元件責任

| 元件 | 單一責任 | 主要依賴 |
| --- | --- | --- |
| `WorldScene` | 組裝世界、更新 Phaser 物件 | 世界設定與各控制器 |
| `WorldDefinition`／loader | 提供地形、障礙物、建築、區域與工作站資料 | 靜態 TypeScript/JSON 設定 |
| `TestPanel` | 選擇 Agent、送出 demo 事件、開關除錯層 | `EventIngress` |
| `EventIngress` | 驗證、去重並標準化事件 | `BehaviorRouter` |
| `BehaviorRouter` | 將事件映射成 `BehaviorRoute` | 路由設定 |
| `NavigationGrid` | 從地圖建立可走與不可走網格 | 世界設定 |
| `AStarPathfinder` | 計算四方向路徑 | `NavigationGrid` |
| `StationAllocator` | 分配工作位、備用入口與等待位 | 工作站設定、occupancy |
| `AgentController` | 跟隨 waypoint、切換面向與移動動畫 | pathfinder、allocator |
| `ActionController` | 抵達後播放 typing、reading、repair 等循環 | agent sprite、station |
| `DepthOcclusionSystem` | 管理 foot-Y 深度與大型前景透明度 | sortable sprites |
| `StatusOverlaySystem` | 顯示持續標籤、短暫氣泡與建築摘要 | Agent 狀態、occupancy |
| `InteriorInspectorModel` | 預留建築內 Agent 聚合資料 | occupancy；第一階段無可視室內 |

世界 Scene 不直接包含 hook 判斷、A* 演算法或建築專屬條件。各模組以明確資料介面溝通，純邏輯模組可以不啟動 Phaser 就完成測試。

## 8. 事件到世界行為的資料流

```text
TestPanel
  → AgentWorldEvent(source=demo)
  → EventIngress 驗證與去重
  → BehaviorRouter 選擇目的地、行為、氣泡
  → StationAllocator 分配 interaction/queue anchor
  → AStarPathfinder 計算路徑
  → AgentController 移動與方向動畫
  → ActionController 執行工作循環
  → StatusOverlaySystem 更新 Agent／建築狀態
```

正式整合只將第一步替換為：

```text
Codex hook／WorldState／SSE
  → hook adapter
  → AgentWorldEvent(source=hook)
```

後續所有步驟保持不變。

## 9. 狀態與目的地映射

| 事件／狀態 | 目的地 | 抵達行為 | 顯示方式 |
| --- | --- | --- | --- |
| SessionStart／Initializing | Arrival Plaza | 出現、環顧 | 4 秒「開始工作」氣泡 |
| UserPromptSubmit／Thinking | Thinking Garden | 短距離踱步或思考 | 持續狀態 chip、4 秒氣泡 |
| Todo／Planning | Knowledge Hall 白板 | 指向白板、記事 | 持續 chip、4 秒氣泡 |
| Read／Grep／Glob／LS | Knowledge Hall 文件桌 | 閱讀、翻頁 | 持續 chip、4 秒氣泡 |
| Edit／Write／Patch | Build Workshop 電腦 | 打字 | 持續 chip、4 秒氣泡 |
| Bash／Terminal／Tool Using | Build Workshop 終端架 | 操作終端 | 持續 chip、4 秒氣泡 |
| Web／MCP／GitHub | Signal Station 訊號台 | 操作通訊設備 | 持續 chip、4 秒氣泡 |
| Task／Clone／Subagent | Signal Station dispatch pad | 生成或派遣 subagent | 生成效果、4 秒氣泡 |
| Responding | Signal Station 通訊桌 | 傳送輸出 | 持續 chip、4 秒氣泡 |
| Awaiting Input | Queue Plaza | 排隊、查看入口 | 持續氣泡直到狀態改變 |
| Blocked／Error／Offline | Repair Corner | 維修、警告動畫 | 持續氣泡直到狀態改變 |
| Self-healing | Repair Corner | 修復動畫 | 持續 chip、4 秒氣泡 |
| Stop／Completed／Idle | Lounge Lawn | 坐下、休息 | 持續 chip、4 秒氣泡 |
| Heartbeat／Preserve Phase | 原位置 | 僅狀態脈衝 | 無氣泡、不重新尋路 |
| 未知事件 | 原位置 | 保留現有行為 | 面板警告，不打斷 Agent |

## 10. 測試面板

測試面板是第一階段的事件來源與驗收工具，不是正式產品操作 UI。

功能：

- Agent selector：預設選 main agent，也可點擊世界中的 Agent 或從清單選 subagent。
- 狀態按鈕：SessionStart、Think、Plan、Read、Edit/Write、Bash/Tool、Web/MCP、Clone Agent、Await、Blocked、Self-heal、Respond、Idle/Stop、Offline、Heartbeat。
- Clone Agent：建立唯一 `agentId` 的 subagent，先在 dispatch pad 出現，再接受獨立事件。
- 事件紀錄：顯示最近事件、分配目的地、路徑結果與錯誤。
- Debug toggles：導航網格、碰撞遮罩、A* waypoint、工作位、queue anchor、depth baseline、occlusion polygon。
- Reset Demo：只重設 MVP 執行狀態，不修改設定或專案檔案。

## 11. A*、碰撞與多人移動

- A* 使用 16×16 tile 的四方向網格，不走對角線，確保路徑和四方向 sprite 動畫一致。
- 建築牆面、樹幹、圍欄、水域、封閉花圃和固定設備是不可走格。
- 樹冠、屋簷和純裝飾不直接成為碰撞區；碰撞以物件底部實體部分為準。
- Agent sprite 使用腳底附近的小 hitbox，身體上半部可與高物件視覺重疊。
- 新的非 Heartbeat 事件到達時，取消舊路線並從當前格重新計算。
- 移動 Agent 不作為 A* 的永久障礙，避免狹窄路段死鎖。
- 每個工作站提供多個 interaction slot；滿員後使用 queue anchor。
- 路徑交會時採輕量、視覺性的局部間距調整；調整幅度不得把 Agent 推進阻擋格，也不得改變最終工作位。
- MVP 至少支援一名 main agent 加十名 subagents 同時活動。

## 12. 深度與環境融合

角色、NPC 和可排序物件以腳底或物件底部的 world Y 作為 depth 基準，而不是固定 global z-index。

高物件拆分為：

1. base/back layer；
2. trunk/wall collision；
3. canopy/roof/arch foreground layer。

角色走到樹後時由樹冠遮擋，走到樹前時顯示在樹幹前。建築屋簷、拱門、柱子和棚架使用相同規則。depth 值加入穩定的次序 tie-breaker，避免相同 Y 座標時閃爍。

當 main agent 或目前選取的 Agent 被大型前景完整遮住超過 500 ms，該前景平滑降至 60% opacity；Agent 離開後恢復 100%。此效果不套用於一般路過的未選取 subagent，以免多 Agent 場景同時閃動。

## 13. 狀態可視化與固定鏡頭

### 13.1 室外 Agent

- 每個可見 Agent 都有持續狀態 chip，以圖示加短文字呈現，例如 `💻 修改程式`。
- main agent 顯示完整名稱與狀態；subagent 使用較緊湊格式。
- 狀態改變時顯示 4 秒對話氣泡。
- Awaiting、Blocked、Error 與 Offline 氣泡持續到狀態改變。
- Heartbeat 只在 chip 上顯示短暫脈衝，不建立氣泡。
- 顯示不能只依賴顏色，所有重要狀態都需圖示或文字。

### 13.2 建築外部聚合

第一階段 Agent 在建築外部工作站保持可見。資料模型同時維護建築 occupancy，為第二階段做準備。

第二階段 Agent 進入建築後，外部建築標示顯示：

- 室內 Agent 總數；
- 聚合狀態，例如 `👥 3 · 💻 2 · 🔧 1`；
- 最高優先級或最新的重要氣泡；
- Blocked／Awaiting 等持續訊息優先於一般 Working 訊息。

同一建築不堆疊每個 Agent 的氣泡。一般訊息以四秒週期顯示最新一則；持續訊息存在時固定顯示最高優先級訊息。

### 13.3 第二階段室內浮層

點擊有室內 Agent 的建築後，在固定村莊旁開啟室內觀察浮層或側欄。浮層列出每個 Agent 的位置、狀態、目前工具與安全摘要。全局相機維持原位，村莊和其他 Agent 仍然可見。

第一階段只保留 `interiorSceneId`、occupancy 與 inspector model，不渲染室內浮層。

## 14. 錯誤處理

| 狀況 | 行為 |
| --- | --- |
| 首選 approach anchor 無路徑 | 依設定順序嘗試備用入口 |
| 所有入口都無路徑 | Agent 留在最後合法位置，顯示「⚠ 無法抵達」，事件紀錄寫明原因；禁止瞬移 |
| interaction slot 滿員 | 分配同站 queue anchor |
| queue 也滿員 | 保持最近合法位置並顯示等待，不覆蓋其他工作位 |
| 新事件在移動中到達 | 非 Heartbeat 事件取消舊路徑並重算；Heartbeat 保留路徑 |
| 未知事件 | 保留位置與行為，在面板記錄 warning |
| 重複 `eventId` | 忽略重複事件，不再次移動 |
| 地圖設定無效 | 啟動前驗證座標、阻擋格、入口和工作位；阻止 Scene 啟動並顯示具體設定錯誤 |
| 素材載入失敗 | 使用明顯 placeholder、記錄資產路徑，世界繼續運作 |
| 視窗尺寸改變 | 重新計算整數縮放與 letterbox，不改變世界位置或 Agent 路徑 |

## 15. 素材策略

- 優先重用 `public/assets/kenney-rpg-urban/` 的角色與城市素材；保留其 license／attribution 檔案。
- 工作家具優先使用 `public/assets/appledog-modern-interior/32x32/` 的專案內既有裁切。依 `docs/reference/office-assets.md` 記錄，來源要求對 Apple Dog 署名；成品需保留 attribution。
- 32×32 家具以 16×16 世界網格對齊，不以模糊縮放強塞成 16×16。
- 缺少的樹木、花圃、工作建築構件先由現有可授權素材組合；新增外部素材前必須確認可商用／可修改條款並記錄來源。
- 所有素材使用 nearest-neighbor、整數座標與統一的亮度／飽和度調整規則，避免角色像貼在不同畫風的背景上。
- 不使用或重製 Pokémon 角色、建築、地圖、名稱、音樂或其他受保護內容。

## 16. 測試策略

### 16.1 純邏輯自動測試

- A*：可達路徑、繞障礙、無路徑、起終點相同、不得穿越阻擋格。
- BehaviorRouter：所有面板事件的目的地、行為、bubble policy 與 Heartbeat preserve semantics。
- StationAllocator：空工作位、多工作位、滿員排隊、備用入口與完全滿員。
- EventIngress：欄位驗證、重複事件與未知事件。
- 世界設定驗證：越界 anchor、位於阻擋格的 slot、沒有入口的工作站。

### 16.2 瀏覽器整合測試

- 每個測試按鈕能使選取 Agent 前往正確功能區並進入對應 action loop。
- 移動期間再次觸發事件會改道，Heartbeat 不改道。
- Clone Agent 產生唯一 Agent，並能獨立選取與派遣。
- 固定鏡頭不因任何 Agent 行動而移動。
- 調整視窗後村莊仍完整可見，像素不模糊。
- Browser console 沒有未處理錯誤。

### 16.3 視覺與多人驗收

- Agent 能繞過至少一棵樹、建築角落、花圃與水域。
- 樹前、樹後、屋簷後和拱門前的遮擋關係正確且不閃爍。
- 一名 main agent 加十名 subagents 同時活動時，工作位、排隊和狀態仍可辨識。
- 多 Agent 指派到同一建築時不佔用同一 interaction slot。
- Blocked／Awaiting 訊息不會被一般 Working 氣泡覆蓋。
- Debug overlays 能顯示導航格、阻擋格、路徑、anchors 和 depth baseline。

### 16.4 建置驗證

- `npm install` 成功。
- `npm run build` 成功。
- `npm run dev` 可開啟 MVP。
- 自動化測試命令全部通過。

## 17. 第一階段完成定義

第一階段只有在以下條件全部成立時完成：

1. `pixelworld_mvp/` 是可獨立安裝、啟動與建置的專案。
2. 小型工作村莊以固定全局視角完整呈現三棟建築和四個開放區。
3. 測試面板涵蓋已定義狀態，所有移動均經 A*。
4. 多 Agent、工作位分配、排隊、碰撞、前後遮擋與狀態 UI 通過驗收。
5. Hook adapter 邊界和 `AgentWorldEvent` 契約已存在，但沒有接入正式 CLI_Pixelverse。
6. 第一階段沒有室內場景；室內 occupancy 與浮層所需欄位已預留。
7. 使用者可以先驗收獨立 MVP，再決定第二階段與正式整合。

## 18. 後續階段

第二階段：

- 建立可進入的建築室內模型。
- Agent 進門後從室外 sprite 集合移至室內 occupancy。
- 建築外顯示人數、聚合狀態與優先氣泡。
- 點擊建築開啟室內觀察浮層；固定全局鏡頭不移動。

第三階段：

- 建立 adapter，將 CLI_Pixelverse 現有 hook／WorldState／SSE 資料正規化成 `AgentWorldEvent`。
- 以真實事件來源取代 TestPanel 的 demo 事件。
- 保留 TestPanel 作為開發／診斷模式，不成為正式使用者介面。
