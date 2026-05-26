import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveAgentEventVisual } from '../public/main_agent_events.mjs';

test('deriveAgentEventVisual humanizes reasoning and fine-grained tool phases', () => {
  const reasoning = deriveAgentEventVisual({
    role: 'main_agent',
    recent_actions: [{ event_name: 'main.reasoning', preview: '拆解房間配置', message: '規劃中' }],
  }, 'zh-TW');
  assert.equal(reasoning.tone, 'planning');
  assert.match(reasoning.label, /規劃/);
  assert.match(reasoning.detail, /拆解房間配置/);

  const started = deriveAgentEventVisual({
    role: 'main_agent',
    recent_actions: [{ event_name: 'main.tool.started', tool_name: 'read_file', preview: '讀取房間設定' }],
  }, 'zh-TW');
  assert.equal(started.tone, 'working');
  assert.match(started.label, /讀取檔案/);
  assert.match(started.detail, /啟動|開始/);

  const completed = deriveAgentEventVisual({
    role: 'main_agent',
    recent_actions: [{ event_name: 'main.tool.completed', tool_name: 'patch', preview: '寫入牆面與房門調整' }],
  }, 'zh-TW');
  assert.match(completed.label, /修改檔案/);
  assert.match(completed.detail, /完成/);
});


test('deriveAgentEventVisual falls back to ambient state for non-main agents and idle main agent', () => {
  const subagent = deriveAgentEventVisual({ role: 'subagent', state: 'working', task: 'delegate_task' }, 'en-US');
  assert.equal(subagent.tone, 'working');
  assert.match(subagent.label, /Working/);

  const idle = deriveAgentEventVisual({ role: 'main_agent', state: 'idle', task: null, recent_actions: [] }, 'en-US');
  assert.equal(idle.tone, 'idle');
  assert.match(idle.label, /Standby/i);
});
