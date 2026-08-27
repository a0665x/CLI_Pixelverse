# 下一階段 TODO：可攜式接線、Roster 詳情與室內導航

日期：2026-08-27  
狀態：需求已整理，尚未進入設計／實作  
基線分支：`main`

## 使用者目標

1. GitHub 使用者不依賴開發者本機的 `/home/a0665x/...` 路徑，也能從任意 clone 位置完成 Pixelverse 啟動、Codex wrapper activation 與每個專案的 hook 安裝。
2. 點擊 Agent Roster 的人物卡片即可看到更完整的 Agent 詳情；頂部狀態、Roster、村莊及詳情區之間不可互相遮蓋，桌面版邊界可調整。
3. 所有房間中的人物使用一致的實際移動速度，並依目前家具配置重新尋路。除椅子／辦公椅／沙發外，角色不得穿過任何有實體像素的家具或隔板。

## 已確認的現況與成因

### 1. GitHub／README 可攜性

- README 多數跨專案範例已使用 `/path/to/CLI_Pixelverse`，但仍混有只能從 Pixelverse repo 根目錄執行的 `source .pixelverse-service/activate.sh`，以及 Hermes 段落的 `/home/a0665x/...` 範例。
- `run.sh` 仍有本機 Hermes repo 的 `/home/a0665x/...` 預設值與提示。這些值不能成為公開安裝流程的必要條件。
- `.pixelverse-service/activate.sh` 在每台機器上由 `run.sh` 產生，內含該次 clone 的絕對路徑。這個生成檔可以使用絕對路徑，但不能提交成所有使用者共用的固定路徑。
- `scripts/pixelverse_mcp_server.py` 回傳的 activation 提示仍是相對路徑；使用者位於其他專案時會失效。
- `install-codex-hook` 目前會直接寫入目標專案的 `.codex/hooks.json`。若對方已有 hooks，存在覆寫風險，公開文件必須先警告，後續 installer 應改成拒絕覆寫或安全合併。

### 2. Agent Roster 與版面

- `public/agent_roster_view.mjs` 的 card click／Enter／Space 目前只送出 `{ kind: 'agent', id }`。
- `public/app.mjs::selectCommandDeck()` 會同步選取、Inspector 資料與村莊焦點，但第一層沒有自動打開可見的詳情介面。
- 專案已存在 `openAgentDialog(agent)` 與完整 dialog rendering；目前 Roster 沒有接到這條路徑。村莊角色也只有 speech／event chip 會開 dialog，點人物本體只會選取。
- Village-first CSS 將主畫面固定為 `grid-template-rows: 44px 112px minmax(...)`。頂部 `live-hud` 仍含多行 summary／同步資訊，而 Roster 有實色背景，造成內容伸出後被下一列遮住的風險。
- Roster 高度固定，名稱、狀態、任務與 counts 大量使用 `overflow: hidden`、ellipsis；窄版甚至直接隱藏部分 counts。
- 舊 command-deck resize 結構在 Village-first 第一層被隱藏，現在沒有可操作的 top↔roster、roster↔village 或 detail panel resize handle。

### 3. 室內移動速度與穿模

- `pixelworld_mvp/src/rendering/interiorMotion.ts` 使用固定 `WORK_TRANSITION_MS = 720` 完成每一段巡邏，不論路徑長度。因此長路徑會明顯快於短路徑，不同房間看起來速度不一致。
- ingress 雖以 path 節點數乘 `STEP_MS`，但 fractional interaction point／壓縮路段仍可能讓實際像素距離與時間不完全一致。速度應依幾何距離計算，而不是依房間或固定 transition window。
- 尋路有 A*，也會呼叫 `navigationBlockedCellKeys()`；問題主要在阻擋語意與角色 footprint，而不是完全沒有尋路。
- `furnitureBlocksNavigation()` 預設只把 functional furniture 或 `layer === 'furniture'` 視為 blocker。分類成 `surface`／`wall` 的視覺實體可能不阻擋。
- built-in office prefab 的 divider 目前明確設定 `blocksNavigation: false`，plant 亦為 false；這直接允許角色穿過隔板／盆栽。
- sofa、bed、chair 等既有定義中多項明確為 non-blocking。依本次需求，只有 `chair`、`office-chair`、`sofa` 可允許角色重疊；bed 暫列為 blocker，除非下次確認 offline Agent 仍應躺床。
- 導航目前以角色中心點對格子判斷，沒有將人物腳部寬度／安全間距納入 swept path；即使中心格沒有進 blocker，sprite 仍可能在像素上切過家具邊緣。
- 需確認使用者編輯並儲存的 `activeInterior` 每次都觸發 occupant assignment 與 route 重算，避免家具移動後沿用舊路徑或舊 assignment signature。

## 執行 Backlog

### P0：公開安裝與路徑可攜性

- [ ] 在全新 clone、不同 Linux username、不同 clone 目錄進行 onboarding smoke。
- [ ] README 統一先定義可攜式根目錄，例如在 clone 根目錄執行 `PIXELVERSE_ROOT="$PWD"`，跨 repo 時一律使用 `"$PIXELVERSE_ROOT/run.sh"` 與 `source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"`。
- [ ] 移除公開 README 中所有 `/home/a0665x/...` 與特定工作區假設；Hermes 路徑改成環境變數或 `/path/to/...`。
- [ ] 清楚拆分「一次性安裝」「每個目標 repo 一次」「每個目前 shell 一次」「新 Bash 自動 activation」四種步驟。
- [ ] 修正 MCP onboarding 回傳的相對 activation 路徑，使其使用實際 Pixelverse root 的絕對生成路徑。
- [ ] `install-codex-hook` 遇到既有 `.codex/hooks.json` 時不得靜默覆寫；設計安全合併、備份或明確停止策略。
- [ ] README 加入驗證命令：`command -v codex` 必須先解析到 `.pixelverse-service/bin/codex`，`./run.sh bridge-status` 必須顯示 API／bridge healthy，Codex 首次進入 repo 後需 `/hooks` trust。
- [ ] 測試 GitHub clone 中不包含 `.pixelverse-service/activate.sh` 的開發者機器絕對路徑。

### P0：統一室內速度與障礙物導航

- [ ] 將 ingress 與工作巡邏改成同一個「距離 ÷ 固定 cells-per-second」時間模型；房間尺寸與 route 節點數不得改變人物速度。
- [ ] path interpolation 使用累積幾何距離，不以 `path.length` 或固定 720ms 當作速度代理。
- [ ] 建立明確的 navigation policy：`chair`、`office-chair`、`sofa` 是唯一預設可重疊／入座的家具類型。
- [ ] desk、table、cabinet、bookcase、computer、display、plant、divider／partition、wall item、bed 及其他有實體 opaque bounds 的家具預設皆阻擋。
- [ ] functional station 的角色目的地必須是相鄰 interaction point；不得為了抵達工作站而開放整個家具 footprint。
- [ ] 將角色腳部 footprint／安全 margin 納入路徑可走區，避免中心點合法但 sprite 像素切過家具。
- [ ] 家具新增、移動、旋轉、縮放、跨房間貼上、undo／redo、save reload 後，立即重建 blocker grid 並重新規劃仍在房內的角色路徑。
- [ ] 無路可走時停留在最後合法點並顯示可診斷狀態，不可直線穿越或 teleport 到目標。
- [ ] 明確決定 bed 是否為 offline 狀態的例外；在確認前依使用者本次規則視為 blocker。

### P1：Roster 詳情與可調整版面

- [ ] Roster card click、Enter、Space 與村莊人物 click 使用同一個 detail action；同步 selected state、村莊 focus 與詳情內容。
- [ ] 點擊 Roster 後自動打開可見詳情 drawer／dialog，不只更新隱藏 Inspector。
- [ ] 詳情至少顯示：名稱、角色類型、live state、ECG 語意、目前任務、tool／hook、所在房屋、最近事件、last seen、process/session identity；外部原始 payload 必須標記，產品文案維持 en／zh／ja／ko 單一語言。
- [ ] 詳情可用 Escape、close button、backdrop 關閉；鍵盤焦點可恢復到原 card。
- [ ] 將 top status、Roster、village、detail panel 尺寸改為 CSS variables／layout state，不再硬編碼只有 `44px` 與 `112px`。
- [ ] 桌面版提供可拖曳 splitter 與合理 min/max；至少支援 top↔roster、roster↔village、detail panel 寬度／高度。
- [ ] 尺寸偏好持久化；雙擊 splitter 或 Reset layout 可回預設值。
- [ ] 窄螢幕不強塞所有 splitter，改用可捲動／可收合區塊，且重要文字不得被相鄰 panel 蓋住。
- [ ] 任務文字允許合理的 2 行 clamp 或 tooltip，不得只剩無法理解的 ellipsis。

## 驗收測試

### Onboarding

- [ ] 使用臨時目錄模擬 `/home/other-user/projects/CLI_Pixelverse` clone，依 README 命令即可啟動並在另一 repo 安裝 hook。
- [ ] 靜態掃描 README／公開腳本，不得出現 `/home/a0665x`。
- [ ] 既有 hooks 測試：installer 不遺失任何使用者 hook。

### Roster／Responsive UI

- [ ] Browser smoke 覆蓋 1440×900、1024×768、800×450，以及手機寬度。
- [ ] 每個 viewport 驗證 top status、Roster、village、detail 無重疊、無不可達文字、無水平頁面溢出。
- [ ] 點 card 與村莊人物都會打開相同 Agent 詳情；鍵盤路徑同等可用。
- [ ] splitter 拖曳後 reload 保留，Reset layout 恢復預設。
- [ ] 四語言逐一驗證 layout 與完整文案，避免較長日／韓文被截斷。

### Navigation／Pixel Collision

- [ ] Unit test：相同幾何距離在不同房間、不同 route 長度下耗時一致。
- [ ] Unit test：對所有 motion sample，角色腳部 footprint 不與 blocker opaque bounds 相交。
- [ ] Unit test：角色可在 chair／office-chair／sofa 的指定座位重疊，但不能穿越它們作為捷徑。
- [ ] Integration test：新增 divider、desk、plant 後，路徑立即繞行；旋轉／縮放後 blocker 跟著更新。
- [ ] Persistence test：save reload 與 prefab paste 後仍使用相同 blocker geometry。
- [ ] Browser visual smoke：開啟每種房型，連續觀察 ingress 與來回巡邏，保存 route overlay 與 screenshot；任何人物像素穿入非座位家具即失敗。

## 下次開始前需要確認的三個產品決策

1. 詳情採右側 drawer、浮動 dialog，或 desktop drawer／mobile dialog 的 responsive 組合。建議 responsive 組合。
2. 「所有邊界可調整」是否包含 top status 高度、Roster 高度與詳情寬度三者。TODO 暫按三者都包含處理。
3. Offline Agent 是否允許與 bed 重疊。本次文字只允許椅子／沙發，因此暫按不允許處理。

## 非本次關機前工作

- 不在本次紀錄階段修改 UI、速度、碰撞或 README 行為。
- 不把症狀只用提高 `z-index`、放慢單一房間或擴大固定 obstacle rect 暫時遮掩。
- 正式實作前須為上述三個子題分別完成設計確認與 TDD 計畫。

