# 2026-05-23 — Pixelverse spec bootstrap

## 本次做了什麼
- 重新盤點 `hermes-pixelverse` 的目前程式碼結構
- 交叉參考 `Star-Office-UI` 的 world-first 展示思路
- 建立新的 `spec/` 文件體系，作為後續重構入口

## 這次確認的核心結論
1. 專案當前最重要的不是再加更多畫面元素，而是先把 **可判讀性標準** 寫清楚。
2. `pixelverse_server.py`、`public/index.html`、`public/app.mjs` 是後續最需要拆責任的三個檔。
3. 專案應學習 Star Office 的「直觀敘事」，但不能照抄其資產與產品表情。
4. spec 之後應優先成為專案入口，讓後續 agent 不必再次整庫掃描。

## 建議的下一步
- 先依 spec 補 UI hierarchy / snapshot schema
- 再做前端模組拆分與視覺精煉
