# `run.sh restart` 設定沿用設計

日期：2026-08-27

## 目標

讓日常使用的 `./run.sh restart` 與 `./run.sh down_up` 不再重複詢問 Agent source 與 visual floorplan。重啟應沿用最近一次成功寫入的服務設定與目前 runtime 地圖，同時保留環境變數的明確覆寫能力。

## 範圍

- `restart` 與 `down_up` 使用免互動的設定沿用流程。
- `start` 保留既有互動流程，方便首次啟動或重新選擇設定。
- `prepare-floorplan`、`floorplans` 與 adapter 相關命令維持既有行為。
- 不移除任何 Agent kind、floorplan 或 exposure mode 功能。

## 行為設計

### Agent 與曝光模式

重啟時依下列優先序解析設定：

1. 當次 shell 明確提供的 `PIXELVERSE_AGENT_KIND` 或 `PIXELVERSE_EXPOSURE_MODE`。
2. `.pixelverse-service/compose.env` 中最近一次寫入的值。
3. 若尚無可沿用的 Agent 設定，安全回退到既有互動式 `start` 流程，不猜測使用者想用哪一種 Agent。

解析後仍使用現有正規化與驗證邏輯，無效的明確覆寫必須回報錯誤，不得靜默改成其他 Agent。

### Floorplan

重啟時依下列優先序處理地圖：

1. 明確提供 `PIXELVERSE_FLOORPLAN` 時，驗證並複製指定的 YAML/PNG 配對。
2. 未提供時，若 runtime 目錄已有 `default.yaml` 與 `default.png`，直接沿用，不顯示選單也不覆寫。
3. runtime 地圖不存在時，沿用既有非互動 fallback：優先選擇內建 `default`，否則使用第一個完整配對。

因此自訂或 builder 匯出的 runtime 地圖不會在重啟時被舊的 floorplan 選單覆蓋。

## 實作邊界

`start_service` 接受一個明確的啟動模式，而不是依終端是否為 TTY 猜測意圖：

- interactive：供 `start` 使用，維持現有選單。
- reuse：供 `restart/down_up` 使用，先讀取已儲存設定並禁止不必要的選單。

floorplan preparation 同樣接收 reuse 意圖，使「已存在 runtime 地圖就保留」在互動終端與自動化環境中具有一致結果。Docker build、adapter 安裝、health wait 與服務輸出不改變。

## 錯誤處理

- 儲存的 Agent kind 無效時顯示具體錯誤，避免用錯誤設定啟動。
- 明確指定但不存在的 floorplan 仍以非零狀態退出。
- compose env 不存在或缺少 Agent kind 時才回退互動流程。
- runtime 地圖只有 YAML 或只有 PNG 時視為不完整，不得假裝成功沿用；改用既有完整配對選擇規則。

## 測試與驗收

測試採 test-first，至少證明：

- 有已儲存設定時，`restart/down_up` 不呼叫 Agent 選單並沿用 Agent 與 exposure mode。
- 有 runtime YAML/PNG 時，重啟不呼叫 floorplan 選單且檔案內容不變。
- `PIXELVERSE_AGENT_KIND`、`PIXELVERSE_EXPOSURE_MODE`、`PIXELVERSE_FLOORPLAN` 可覆寫沿用值。
- 首次無儲存 Agent 設定時仍可走既有互動式安全回退。
- `start` 的互動式選擇行為沒有被移除。
- `./run.sh restart` 的實際服務重啟 smoke 通過，且啟動輸出不再出現兩個舊選單。

