# Task Understanding — Pixelverse Kickoff

## User Intent
使用者想在 `AI_AGX_WS` 中建立一個新專案，做出類似 hermes-miniverse / miniverse 的像素可視化介面，重點是看見 Hermes 現在在做什麼、用了哪些工具、以及是否有多個分身同時工作。

## Important Product Requirements
- 可視化目前 Hermes 狀態
- 可視化目前/最近工具操作
- 點擊主角能查看狀態細節
- 若有 new branch session / subagent，世界中會出現更多像素角色
- 要比原專案更可製化

## Implementation Insight
最務實的路徑是先做獨立 Pixelverse 專案，讀取 Hermes 既有 API 與 subagent tracker；若要更精準呈現主 agent 的工具流，再視情況修改 Hermes 主 repo。
