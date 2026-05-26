# System Overview

## 1. 系統意圖
這個系統不是傳統 dashboard，而是把 Hermes runtime 轉成可讀的世界敘事：
- 主代理 = 主角
- subagents = 分身工位
- branch sessions = 工作階段檔案庫
- tools / states / events = 房間移動、氣泡、事件流

## 2. 三層架構
### Layer A — Data Producers
- `bridge.py`
- Hermes web / gateway / session 狀態來源
- hook relay 事件

### Layer B — World Runtime
- `pixelverse_server.py`
- WorldState / AgentState
- humanization、room classification、snapshot shaping、SSE stream

### Layer C — World Renderer
- `public/index.html`
- `public/app.mjs`
- 專責 `.mjs` helper 模組

## 3. 使用者在畫面上應先看到什麼
1. 主代理目前在哪個房間
2. 主代理現在是規劃、思考、執行還是離線
3. 是否有 subagents / sessions 正在工作
4. 最近事件是否顯示異常或完成
5. 之後才是房間裝飾、氛圍與細節動畫

## 4. 目前主要設計特性
- World-first 首屏
- 房間與任務語意映射
- 單頁渲染，透過 polling / event stream 更新
- 中英文 UI 文案切換
- 以可替換開放資產為主，現階段大量使用 Kenney CC0

## 5. 當前技術債
- `pixelverse_server.py` 仍是 MVP 式 monolith
- `public/index.html` 內嵌 CSS 很大
- `public/app.mjs` 承擔過多 orchestration
- 視覺層級已有進步，但仍可再強化「一眼判讀」

## 6. 重構方向
- 後端拆成 routing / domain / integrations / presenters
- 前端拆成 shell / scene / panels / state adapters
- 先保留資料契約，再逐步重構視覺與互動
