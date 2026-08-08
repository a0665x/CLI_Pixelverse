# Agent 動畫、Modern Office 室內與村莊增密設計

日期：2026-08-08

## 目標

修正 Agent 左右方向相反與移動時只有平移、沒有逐幀走路動畫的問題；將所有室內場景與家具統一改用使用者購買的 LimeZu Modern Office Revamped v1.2；在不改變固定全村視角與 48×28 世界尺寸的前提下，把村莊由 8 棟增密為 12 棟功能建築，並建立更接近 RPG 村莊的環狀道路與巷道。

## 現況與根因

主 Agent 使用 LimeZu Adam 16×32 圖集。現有 `facingFrames` 左右映射相反：作者的第 0 幀朝右、第 2 幀朝左。更重要的是，`agentFrameIndex` 一旦看到 `facingFrames` 就直接回傳靜止幀，完全忽略外部傳入的 walk row，因此 `AgentController` 雖然每 100ms 更新動畫計時，畫面仍永遠停在同一張圖片。

現有室內同時混用 Modern Interiors Free 的裁切家具、程序繪製圖形與少量其他占位素材，視覺細節與比例不一致。使用者購買的壓縮包實際位於 `/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip`，包含 16×16 房間建構圖集、完整辦公室圖集與獨立家具 PNG。其授權允許商用與修改，但禁止重新散布原始或修改後素材。

目前村莊只有 8 棟房屋，主要道路是一條東西主幹加多條垂直門前支線，導致大片綠地沒有目的，也缺少可循環遊走的街區感。

## 角色動畫設計

建立資料驅動的 `AgentAnimationProfile`，明確區分靜止幀與各方向走路幀：

- 靜止：右 0、上 1、左 2、下 3。
- 右走：24、25、26、27、28、29。
- 上走：30、31、32、33、34、35。
- 左走：36、37、38、39、40、41。
- 下走：42、43、44、45、46、47。

新增純函式依 `facing`、`moving` 與經過時間選擇幀。外景 `AgentController` 與室內剖面共用同一套選幀規則，不使用水平鏡像代替作者提供的方向動畫。外景維持約 100ms 一幀；室內 A* 處於 ingress 或家具間 transition 時播放走路幀，到達互動點後切回方向靜止幀，再由既有 bob 提供呼吸感。

方向來源仍由正交路徑相鄰點計算。測試必須覆蓋左右不反轉、六幀會隨時間輪播、停止後回到正確方向靜止幀，以及室內外使用相同動畫 profile。

## Modern Office 私有素材設計

新增安裝腳本，從 `/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip` 解出執行時需要的檔案至：

`pixelworld_mvp/public/assets/private/modern-office-v1.2/`

該目錄加入 `.gitignore`，不得將購買素材納入 Git。專案只提交：

- 安裝腳本。
- 預期檔案清單與來源座標／singles 編號。
- 授權摘要與原始 itch.io 購買頁連結。
- 缺少私有素材時的清楚診斷訊息。

室內背景改用 `Room_Builder_Office_16x16.png`；所有可見家具與底部拖放素材庫只可引用 Modern Office v1.2 的完整圖集或 16×16 singles。舊 Modern Interiors Free 家具、舊裁切 PC 與程序繪製家具不得再出現在正式室內 render path。Adam 角色仍可保留，因為 Modern Office 包不含角色，且角色不屬於本次「家具統一」限制。

家具種類至少包含沙發、單椅、辦公椅、電視／顯示器、PC 工作站、一般書桌、會議桌、書櫃、文件櫃、白板、收納櫃、盆栽與茶水設備。每類家具保留 footprint，拖放時繼續檢查邊界、門口保留格與家具碰撞。保存格式仍使用 building-specific localStorage，但素材鍵會遷移到 Modern Office 專用識別碼；無法辨識的舊自訂家具回退為相同語意的 Modern Office 款式。

## 村莊增密設計

世界保持 48×28，不移動鏡頭、不加入跟隨相機。建築由 8 棟增加到 12 棟，新增四個目前共用既有房屋的 Hook 目的地：

1. `awaiting-post`：Awaiting Input 與排隊狀態。
2. `recovery-clinic`：Blocked 與 Self-healing。
3. `heartbeat-tower`：Heartbeat 與連線監控。
4. `offline-dormitory`：Offline 與休眠。

新增建築沿用現有外景 Serene Village 房屋家族，但使用不同屋頂色、周邊擺設與標籤區分。每棟都能點擊開啟對應的 Modern Office 室內主題，並具有獨立 station、interaction slot、queue anchor、入口 threshold 與 outside 格。

道路重整為兩個相連的環路：西側環路連結啟程、思考、工具、等待與復原功能；東側環路連結檔案、網路、編輯、心跳、休息與離線功能。中央廣場與河流雙橋維持主要交會點。主路使用兩格寬的區段，門前巷道維持一格寬，加入彎道、T 字路口、短巷與至少兩條南北替代路線。

所有房門必須連到同一個可達道路圖，Agent 到任何 Hook 都必須經過 outside 與 threshold，不允許直線穿牆或跨越河流。保留農田、牧場、果園、河流與公共廣場，但縮小沒有用途的連續綠地。任何大型綠地都要有造景或功能用途，而不是純空白。

## 資料流與元件邊界

- `assetManifest` 只描述素材來源與動畫 profile，不負責狀態切換。
- 新的角色選幀純函式只接收 profile、方向、移動狀態與時間，方便室內外共用與測試。
- `AgentController` 繼續負責外景 A* 路徑跟隨，只把 movement snapshot 轉成交替幀。
- `interiorMotion` 繼續負責室內 A* 與家具避障，額外輸出是否正在走路。
- `InteriorCutawaySystem` 只根據 motion state 選幀與呈現，不自行推導路徑。
- `worldDefinition` 描述新增建築、道路與 stations；`behaviorRouter` 將對應事件導向新目的地。
- 私有素材安裝器只處理 ZIP 驗證與解壓，不修改程式碼或下載外部內容。

## 錯誤處理

- ZIP 不存在或檔案結構不符時，安裝腳本停止並列出實際檢查路徑。
- 私有素材未安裝時，開發模式顯示一次明確錯誤，不靜默混回舊家具。
- 不合法的家具拖放仍回到原位置並顯示重疊／越界訊息。
- 新道路或建築導致無法到達時，世界驗證與接受測試必須失敗，不能在執行時偷偷改走直線。

## 驗證策略

採 TDD 分批實作：

1. 動畫幀映射與時間輪播單元測試先紅後綠。
2. Modern Office manifest、私有素材安裝與「室內不得引用舊家具」契約測試。
3. 家具 palette、碰撞、保存與遷移測試。
4. 12 棟建築、事件到目的地映射、全入口連通與道路環路測試。
5. 室內外角色正交移動、方向與逐幀動畫整合測試。
6. 完整 Vitest、TypeScript build、Python pytest、瀏覽器 console 與實際拖放／Hook 路線 QA。

完成後同步 CodeGraph，並保留本機開發 URL `http://127.0.0.1:5173/` 供視覺審查。
