# Task Understanding — Pixelverse Spec Reframe

## 任務
重新梳理 `hermes-pixelverse`，把 spec 做成更清楚的漸進式披露入口，並將 Star Office 參考轉成 Hermes 自己的可視化標準。

## 這次完成的事
- 重新整理 `spec/PROJECT_MAP.md` 與快速入口文件
- 重寫 architecture / modules / conventions / references 層級文件
- 新增 `conventions/api-and-schema-standards.md`
- 明確定義「更直觀」的判準：主代理優先、房間語意優先、事件摘要優先

## 關鍵結論
- 這個專案的價值不是像素風本身，而是把 Hermes runtime 變成可被快速判讀的世界
- Star Office 應作為敘事參考，而不是美術模板
- 下一輪真正值得做的實作，是持續把 `index.html` / `app.mjs` 拆薄，並讓 mobile 規則更清楚
