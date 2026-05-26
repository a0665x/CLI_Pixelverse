# Hermes Pixelverse AI Town 風格改版計畫

> 目標：把目前偏 dashboard 的 CSS 小人介面，改成更接近 `a16z-infra/ai-town` 的 tile-based pixel world 視覺與互動。

## 為什麼現在看起來不夠 pixel
目前版本的 `public/index.html` 是：
- 直接用 HTML/CSS 畫角色肢體方塊
- 以 panel + inspector 為主的 dashboard 佈局
- 背景只是格線與分區框，不是真正的 tile map
- 沒有 camera/world layer/地圖物件/角色移動語意

所以它雖然有「像素感字體與方塊角色」，但不是 AI Town 那種：
- 俯視 2D 世界
- tile-based 地圖
- 角色站在地圖上活動
- 世界本身就是主畫面，資訊 UI 疊在上面

## 目標風格
第一版要靠近的不是 AI Town 的完整模擬系統，而是它的「前台表現」：
- 全螢幕世界為主
- 像素 tile map 背景
- 主代理 / 分身代理 / branch session 以 sprite 站位
- 上方或側邊保留輕量 HUD，不再以 dashboard 為主
- 點角色顯示 inspector drawer / floating card
- 工具使用狀態透過 icon bubble / speech bubble / 狀態光圈顯示

## 建議技術路線

### Route A — 低風險、最快落地（建議）
保留現有 Python server：
- `pixelverse_server.py` 繼續提供 `/api/world`
- 前端改成 Vite + PixiJS 或 Phaser
- 用 JSON/tile config 管理地圖與 sprite 位置

優點：
- 不需重寫後端
- 不需修改 Hermes 主 repo
- 可逐步從現有 `/api/world` 過渡

### Route B — 更像 AI Town，但工程量大
直接引入完整遊戲引擎式前端架構與資產管線：
- tileset
- spritesheet
- scene manager
- pathing / tween / camera

優點：質感最好
缺點：工期明顯增加

## 我建議的分階段改法

### Phase 1：把畫面從 dashboard 改成 world-first
- 新增前端專案骨架（Vite）
- 世界全螢幕顯示
- 保留 `/api/world` 資料來源
- 先用簡單 tileset + sprite placeholders
- 主代理 / 分身 / sessions 全部改成地圖上角色

驗收：
- 一打開就先看到世界，不是兩欄 dashboard
- 角色在 tile world 中可見
- 點角色可看狀態

### Phase 2：補 AI Town 感的像素世界語言
- 地圖分層：地板、牆、裝飾、活動區
- 角色 idle / thinking / working 動畫狀態
- 工具 icon bubble
- activity belt 改成 world overlay

驗收：
- 使用者一眼看出是像素世界，不是 admin dashboard
- thinking / working 有明顯視覺差異

### Phase 3：互動與可觀測性深化
- hover tooltip
- 點角色展開 drawer
- 最近事件與 timeline 人話化
- 可切換顯示主代理 / 分身 / sessions

驗收：
- 能快速看懂當前 agent 在做什麼
- 分身角色與主代理容易區分

## 會改到的主要檔案
- 新增：`frontend/` 或 `web/`（Vite 前端）
- 保留並擴充：`pixelverse_server.py`
- 保留：`bridge.py`
- 逐步淘汰：`public/index.html` 這個單檔 dashboard

## 資產需求
可先用開源臨時資產：
- 16x16 或 32x32 tile set
- 簡單人物 spritesheet
- icon bubble 素材

若不先導入外部素材，也可先做 placeholder tiles，但視覺會弱很多。

## 風險與注意事項
- 若要「真的很像 AI Town」，前端要從單頁 dashboard 升級為遊戲式 renderer。
- 這不是小改 CSS，可視為一次前端重構。
- 但後端資料模型可大致沿用，因此仍屬可控範圍。

## 建議下一步
1. 先做 `Phase 1` world-first refactor
2. 確認使用 PixiJS 或 Phaser（二選一）
3. 先用 placeholder tile world 跑通
4. 再逐步替換成更完整像素材產與動畫
