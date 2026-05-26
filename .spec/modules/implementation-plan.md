# Implementation Strategy

## Why This Is Feasible
- `hermes-miniverse` 提供 Hermes ↔ miniverse 連接概念
- `miniverse` 提供 agent/world/event 模型
- 現有 Hermes web server 已有 status 與 subagent API
- Node / npm 已安裝，可支援前端世界渲染

## Best Path
1. 保留新專案獨立性
2. 先建立前後端骨架
3. 先做模擬 + Hermes polling adapter
4. 接著接真實 subagent 狀態
5. 最後再決定是否 patch Hermes 取得更細工具事件

## Immediate Approval Check
- 建立新專案、clone 參考 repo：已可直接進行
- 若要修改 Hermes 主 repo 以新增更細事件輸出：建議先明確批准
