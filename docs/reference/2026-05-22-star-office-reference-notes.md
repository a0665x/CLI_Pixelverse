# Star Office UI 參考筆記

日期：2026-05-22

## 我實際檢查了什麼
- `~/Desktop/AI_AGX_WS/Star-Office-UI/README.en.md`
- `~/Desktop/AI_AGX_WS/Star-Office-UI/frontend/game.js`
- `~/Desktop/AI_AGX_WS/Star-Office-UI/frontend/layout.js`
- `~/Desktop/AI_AGX_WS/Star-Office-UI/backend/app.py`
- `~/Desktop/AI_AGX_WS/Star-Office-UI/LICENSE`

## 可借鏡的設計
1. **世界優先（world-first）**
   - 主畫面是辦公室，不是傳統 dashboard。
2. **狀態 → 區域映射**
   - agent 依狀態移動到不同工位。
3. **前端路由 / 移動語意**
   - 角色不該瞬移，而應該沿著明確走道移動。
4. **家具密度與空間語意**
   - 每個房間不只是色塊，要有桌子、櫃子、海報、咖啡機、床、伺服器等元素。
5. **角色氣泡 + 名牌 + 狀態色**
   - 使用者要能一眼看懂誰在做什麼。

## 我沒有直接照抄的部分
- Star Office 的整體場景美術
- 角色 sprite
- 背景圖
- 按鈕 skin 與裝飾圖

原因：該 repo 的 `LICENSE` 明確寫到：
- **程式碼 / 邏輯是 MIT**
- **美術資產是 non-commercial only**
- 若要商用，必須替換成自己的資產

因此我採取的策略是：
- **參考其互動結構與前後端分層方式**
- **自行建立 Hermes Pixelverse 的房間 / SVG sprite / 路徑視覺 / UI**

## Star Office 後端 API / 路由架構參考
重點端點：
- `GET /status`
- `POST /set_state`
- `GET /agents`
- `POST /join-agent`
- `POST /agent-push`
- `POST /leave-agent`
- `GET /health`

對 Hermes Pixelverse 的啟發：
- 保持簡單、輪詢友善的狀態 API
- 將主 agent 與 guest/subagent 分開建模
- 用前端自己決定場景與動畫，不把畫面邏輯硬塞進後端

## 已套用到 Hermes Pixelverse 的改動
1. **更像辦公室的世界結構**
   - 走廊、房門、窗帶、左右 wing 標記
2. **更高密度房間家具**
   - 沙發、休息床、咖啡機、伺服器櫃、海報、地毯、書櫃、工作桌
3. **更明確的 room activity target**
   - 同一房間內依任務語意切換到不同家具位置
4. **角色移動與走路 pose**
   - 依方向切換 facing
   - 依移動切換 frame
5. **更明顯的 speech bubble**
   - 就算沒有顯式 `speak`，也會依 state / task 給出環境氣泡

## 推薦的開源資產方向
因為 Star Office 美術不能直接拿來替換，我建議下一步選用：
1. **Kenney（CC0）**
   - 適合地圖 tiles、家具、一般 pixel props
2. **OpenGameArt 上的 CC0 / CC-BY 像素素材**
   - 可找室內家具、桌椅、書櫃、電腦設備
3. **LimeZu free pack（需保留授權與 attribution）**
   - 適合角色動畫參考，但要先確認授權情境
4. **0x72 系列 pixel tileset**
   - 常見於 top-down / office / room 類視覺原型

## 下一步建議
- 將目前 SVG sprite 原型，逐步替換成一套授權清楚的 tileset / spritesheet
- 保持目前的 Hermes world/state API，不必為了換美術而重做資料層
