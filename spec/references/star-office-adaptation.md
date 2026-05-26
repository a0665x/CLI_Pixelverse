# Star Office Adaptation

## 1. 參考來源
- `/home/a0665x/Desktop/AI_AGX_WS/Star-Office-UI/`
- `docs/reference/2026-05-22-star-office-reference-notes.md`
- `Star-Office-UI/docs/STAR_OFFICE_UI_OVERVIEW.md`

## 2. 我們真正要吸收的東西
- 使用者一開頁就先看到世界，而不是控制台
- 狀態要落到空間區域，不要只剩 badge
- 角色移動、房間家具、區域命名都要幫助理解
- 可視化必須對手機 / 展示場景友善

## 3. 我們不照抄的東西
- Star Office 的美術資產
- Star Office 的產品人格與敘事口吻
- Star Office 的辦公室內容編排
- 與 Hermes 語意不相容的狀態模型

## 4. 轉譯後的 Hermes 化方向
### Star Office 的「辦公室」
→ Hermes Pixelverse 的「runtime world」

### Star Office 的「單/多訪客狀態」
→ Hermes 的「主代理 / subagents / branch sessions」

### Star Office 的「狀態區域」
→ Hermes 的「思考室 / 藍圖規劃研究室 / 工具鍛造間 / 回覆工坊 / 工作階段檔案庫」

## 5. 更直觀可視化的具體要求
1. 主代理的路徑、房間與狀態必須 3 秒內可讀
2. 分身要看得出來是在幫忙，不是和主代理搶焦點
3. 事件面板要像任務摘要，不要像 raw logs
4. 任何新增裝飾都要回答：它讓使用者更懂了嗎？
