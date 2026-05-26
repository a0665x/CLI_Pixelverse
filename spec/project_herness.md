# Project Harness

## Purpose
`spec/` 是 Hermes Pixelverse 的正式理解層，不是附屬文書。

## Harness Rules
- 新 agent 預設從 `spec/PROJECT_MAP.md` 啟動
- 高層決策先落在 `architecture/` 與 `modules/product-scope.md`
- 視覺、文件、資料契約標準分開記錄在 `conventions/`
- 若模組責任改變，先更新 spec 再擴散到實作

## Compatibility
- `spec/` 是正式入口
- `.spec/` 只保留舊流程相容，不再承載最新真相
