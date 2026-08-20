import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentDialog, buildAgentSpeech } from '../public/agent_dialog.mjs';
import { agentTooltipText } from '../public/ui_strings.mjs';

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

test('recognized task tokens stay byte-for-byte raw while actual tool fields localize', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const agent = {
      name: 'Henry', role: 'main_agent', state: 'working', task: 'read_file',
      tool_label: 'write_file', room_key: 'code_workbench', recent_actions: [],
    };
    const speech = buildAgentSpeech(agent, locale);
    const dialog = buildAgentDialog(agent, locale);
    assert.match(speech.summary, /read_file/);
    assert.equal(dialog.rows.find(({ label }) => /Task|任務|タスク|작업/.test(label))?.value, 'read_file');
    assert.match(agentTooltipText(agent, locale), /^read_file(?: · |$)/);
  }
});

test('long task, preview, and message-only payloads are never sliced in speech or dialog DOM copy', () => {
  const task = `read_file::${'LONG_TASK_PAYLOAD_'.repeat(12)}END_TASK`;
  const preview = `LONG_PREVIEW_PAYLOAD_${'preview-segment-'.repeat(10)}END_PREVIEW`;
  const message = `LONG_MESSAGE_ONLY_${'message-segment-'.repeat(10)}END_MESSAGE`;
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const withPreview = { role: 'main_agent', state: 'working', task, room_key: 'code_workbench', recent_actions: [{ tool_name: 'read_file', preview }] };
    assert.ok(buildAgentSpeech(withPreview, locale).summary.includes(task));
    const previewDialog = buildAgentDialog(withPreview, locale);
    assert.ok(previewDialog.body.includes(preview));
    assert.equal(previewDialog.rows.find(({ value }) => value === task)?.value, task);
    const messageDialog = buildAgentDialog({ ...withPreview, recent_actions: [{ tool_name: 'read_file', message }] }, locale);
    assert.ok(messageDialog.body.includes(message));
    assert.doesNotMatch(`${buildAgentSpeech(withPreview, locale).summary}${previewDialog.body}${messageDialog.body}`, /…/);
  }
});
