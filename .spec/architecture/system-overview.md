# System Overview

## Goal
把 Hermes 的執行狀態轉成一個可觀測、可點擊、可客製化的像素世界。

## Proposed Architecture
1. **Pixelverse Frontend**
   - React + TypeScript
   - 像素世界場景、角色、工具圖示、資訊面板
   - 點擊主角或分身可查看當前狀態、任務、工具、最近事件

2. **Pixelverse Backend / Adapter**
   - 聚合 Hermes 狀態來源
   - 提供 world-state API / WebSocket
   - 將 Hermes 的 session / subagent / runtime 狀態轉成世界中的 agent entities

3. **Hermes Integration Layer**
   - Phase 1: 輪詢 `status`、`subagents`、session 資料
   - Phase 2: 補充工具事件流（hook / SSE / tracker / patch）

## Main World Objects
- `main-agent`: 代表目前這個 Hermes 實例
- `subagent`: 代表 delegate_task 產生的分身
- `tool-icon`: 正在使用的工具或最近使用工具
- `status-panel`: 可點擊後看到詳細執行狀態
- `event-log`: 世界底部或側邊最近事件
