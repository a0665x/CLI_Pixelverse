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

test('active speech and inspector dialog framing switches across all four locales while payload stays raw', () => {
  const agent = {
    name: 'Henry',
    role: 'main_agent',
    state: 'working',
    task: 'RAW_TASK_4c18',
    activity_hint: 'RAW_ACTIVITY_a227',
    room_key: 'code_workbench',
    recent_actions: [{ type: 'tool', tool_name: 'read_file', preview: 'RAW_PREVIEW_91ef', time: 1700000000000 }],
  };
  const rendered = Object.fromEntries(['en-US', 'zh-TW', 'ja-JP', 'ko-KR'].map((locale) => [locale, {
    speech: buildAgentSpeech(agent, locale),
    dialog: buildAgentDialog(agent, locale),
  }]));
  assert.equal(new Set(Object.values(rendered).map(({ speech }) => speech.summary)).size, 4);
  assert.equal(new Set(Object.values(rendered).map(({ dialog }) => dialog.title)).size, 4);
  for (const { speech, dialog } of Object.values(rendered)) {
    assert.match(speech.summary, /RAW_TASK_4c18/);
    assert.match(dialog.body, /RAW_PREVIEW_91ef/);
    assert.match(dialog.body, /RAW_ACTIVITY_a227/);
  }
  assert.match(rendered['ja-JP'].dialog.rows.map(({ label }) => label).join(' '), /[ぁ-んァ-ン一-龯]/);
  assert.match(rendered['ko-KR'].dialog.rows.map(({ label }) => label).join(' '), /[가-힣]/);
  assert.doesNotMatch(JSON.stringify(rendered['ja-JP']), /(?:規劃|執行|狀態|房間|任務|事件時間|最新事件)|\b(?:Plan|Doing|State|Room|Task|Latest event)\b/);
  assert.doesNotMatch(JSON.stringify(rendered['ko-KR']), /(?:規劃|執行|狀態|房間|任務|事件時間|最新事件)|\b(?:Plan|Doing|State|Room|Task|Latest event)\b/);
});
