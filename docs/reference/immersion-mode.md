# 身歷其境：玩家與 Agent 互動

按村莊左上角「身歷其境」開始。玩家從天空降落，帶有隕石外殼、拖尾、
落地震波、裂紋與碎石散開；啟用作業系統「減少動態效果」時直接落地。
WASD 移動，向上走進門口，室內從門口向下走回村莊。再次按按鈕退出。
玩家獨立於 AgentRegistry，不占工作站、不送 heartbeat、不改變 Agent 的任務。

靠近同一空間、沒有牆遮擋的 Agent，自動開啟三選項。滑鼠或左右鍵選取，
Enter 確認；WASD 仍可離開對象，Esc 收起選單，離開接近範圍後才重新觸發。
輸入框開啟時禁止角色移動；Esc 返回選項。視窗失焦會清空移動按鍵。

- 查看工作：文字雲顯示目前 task 與最近四筆公開事件，每半秒更新。
- 插入指令：對執行中任務使用 `turn/steer`，不另開對話。
- 打斷並改派：填妥新指令並送出後才呼叫 `turn/interrupt`；收到對應
  `turn/completed` / `interrupted` 確認，再在同一 thread 呼叫 `turn/start`。
  中斷不撤回已完成的檔案或外部操作。

## 控制通道的實際範圍

現有 Hook/CLI adapter 是狀態回報，不能直接接管任意終端或 Codex 桌面任務。
未綁定的 Agent 仍顯示三選項、可開啟輸入框，但送出停用並說明原因。
這不是模擬成功或以 inbox 冒充送達。

第一版控制服務只接受本機、同來源瀏覽器 POST，且只連接管理者明確綁定的
本機 Codex App Server WebSocket。原本擁有該任務的 Codex 客戶端仍負責審批；
本控制通道不自動核准工具要求。沒有自動啟動模型、建立新對話或接管桌面的功能。

啟動 FastAPI 前設定 `PIXELVERSE_CODEX_CONTROL_BINDINGS` 為本機 JSON 檔路徑：

```json
{
  "村莊中實際的-agent-id": {
    "url": "ws://127.0.0.1:4501",
    "thread_id": "該-App-Server-已載入的實際-thread-id"
  }
}
```

上列值是格式示例，不能直接使用。App Server 必須已由使用者的執行環境啟動，
且該連線能讀取及控制指定執行中的 thread；不能把 Hook 的 session 名稱猜成
控制連線或 thread ID。未配置此檔時，所有 Agent 都是查看模式。

`GET /api/agent-control/{agent}` 會確認連線與 active turn，回傳 available、
turnId、reason。`POST` 只接受 action、text、expected_turn_id、request_id。
前端不得自行指定 executable、WebSocket URL 或 thread ID。
任務變更則拒絕送出；未確認中斷則不開新工作；逾時明示「未確認」，不自動重試。
同一程序中，相同 request_id 的請求只執行一次，最多保留 256 筆；達上限需
管理者重啟服务。此去重記錄不跨程序重啟保存，不能用作持久任務佇列。

## 程式與驗證

- `pixelworld_mvp/src/player/ImmersionController.ts`：玩家、登場、互動與輸入介面。
- `pixelworld_mvp/src/player/playerMotion.ts`：分段碰撞、斜向等速與視線檢查。
- `InteriorCutawaySystem.visitorSurface()`：使用目前已保存的家具配置及室內位置。
- `agent_bridges/codex_control.py`、`pixelverse_fastapi.py`：明確綁定與 Codex 協定。
- `tests/test_codex_control.py`：精確 turn、去重、取消確認、逾時與本機 WebSocket 協定。
- `tests/test_agent_control_api.py`：來源限制與未綁定 Agent 的行為。
- `pixelworld_mvp/tests/playerMotion.test.ts`：穿牆、斜向移動、視線與選项循環。

正式 Codex 控制尚須使用真實的綁定實例驗收；開發驗證使用本機模擬協定伺服器，
不向使用者正在執行的 Agent 發送測試指令。

本次驗證：前端建置成功，778 項前端測試通過；8 項新增後端測試通過。
Chromium 實測空降、自動選單、鍵盤選取、輸入不移動、Hook-only 停用送出、
室內行走與離開、手機尺寸及減少動態模式，無 page/console errors。
本機驗證紀錄位於 `tmp/immersion-evidence.json`；示範角色只透過瀏覽器
測試快照建立，不對真實 Agent 發出控制指令。
原有 FastAPI、Agent bridge 與 Hook bridge 的 24 項回歸測試亦通過。
