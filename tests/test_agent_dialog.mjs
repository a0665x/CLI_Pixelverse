import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentDialog, buildAgentSpeech } from '../public/agent_dialog.mjs';

test('buildAgentSpeech favors active task summaries over idle fallback', () => {
  const speech = buildAgentSpeech({
    role: 'main_agent',
    state: 'working',
    task: 'read_file, patch',
    tool_label: '讀取檔案、修改檔案',
    recent_actions: [{ event_name: 'main.tool.started', tool_name: 'patch', preview: '調整牆與房門' }],
  }, 'zh-TW');
  assert.match(speech.summary, /執行|修改檔案/);
  assert.equal(speech.clickable, true);
});

test('buildAgentDialog returns rich detail rows for main agent event bubbles', () => {
  const detail = buildAgentDialog({
    name: 'Henry',
    role: 'main_agent',
    state: 'planning',
    task: 'search_files, read_file',
    activity_hint: '正在藍圖室拆解需求',
    room_label: '藍圖規劃研究室',
    recent_actions: [{
      event_name: 'main.reasoning',
      preview: '整理房間共牆與走道配置',
      message: '規劃中',
      time: 1700000000000,
    }],
  }, 'zh-TW');
  assert.match(detail.title, /Henry/);
  assert.match(detail.body, /整理房間共牆與走道配置/);
  assert.equal(detail.rows.length >= 3, true);
});
