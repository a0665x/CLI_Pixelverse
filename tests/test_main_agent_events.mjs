import test from 'node:test';
import assert from 'node:assert/strict';

import { agentEventChipPresentation, deriveAgentEventVisual } from '../public/main_agent_events.mjs';

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

test('every pixel-state, main event, and ambient branch has Japanese and Korean product copy', () => {
  const pixelStates = ['reading_files', 'editing_files', 'shell_command', 'browsing', 'external_tool', 'blocked', 'self_healing', 'awaiting_input', 'initializing', 'sleeping', 'collaborating', 'invoking_skill', 'tool_call', 'executing', 'responding'];
  const eventNames = ['main.task.started', 'main.reasoning', 'main.tool.started', 'main.tool.completed', 'main.tool.batch', 'main.task.completed'];
  const ambientStates = ['working', 'planning', 'thinking', 'offline', 'idle'];
  const agents = [
    ...pixelStates.map((pixel_state) => ({ role: 'main_agent', pixel_state, state: 'working' })),
    ...eventNames.map((event_name) => ({ role: 'main_agent', state: 'working', recent_actions: [{ event_name }] })),
    ...ambientStates.map((state) => ({ role: 'subagent', state })),
  ];
  for (const agent of agents) {
    const labels = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR'].map((locale) => deriveAgentEventVisual(agent, locale).label);
    labels.forEach((label) => assert.doesNotMatch(label, /commandDeck\.eventChip/));
    const ja = deriveAgentEventVisual(agent, 'ja-JP');
    const ko = deriveAgentEventVisual(agent, 'ko-KR');
    assert.match(`${ja.label}${ja.detail}`, /[ぁ-んァ-ン一-龯]/, JSON.stringify({ agent, ja }));
    assert.match(`${ko.label}${ko.detail}`, /[가-힣]/, JSON.stringify({ agent, ko }));
    assert.doesNotMatch(ja.label, /(?:Blocked|Working|Reasoning|Tool|Standby|受阻|執行|規劃|工具|待命)/);
    assert.doesNotMatch(ko.label, /(?:Blocked|Working|Reasoning|Tool|Standby|受阻|執行|規劃|工具|待命)/);
  }
});

test('event visuals preserve raw preview/message tokens and localize only explicit tool fields', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const previewOnly = deriveAgentEventVisual({
      role: 'main_agent', state: 'working',
      recent_actions: [{ event_name: 'main.tool.started', preview: 'read_file' }],
    }, locale);
    assert.match(previewOnly.detail, /read_file/);

    const explicitTool = deriveAgentEventVisual({
      role: 'main_agent', state: 'working',
      recent_actions: [{ event_name: 'main.tool.started', tool_name: 'read_file', preview: 'read_file' }],
    }, locale);
    assert.match(explicitTool.detail, /read_file/);
    assert.equal(explicitTool.label.includes('read_file'), false, `${locale} tool_name was not localized`);
    for (const event_name of ['main.task.started', 'main.reasoning', 'main.tool.completed', 'main.tool.batch', 'main.task.completed']) {
      const visual = deriveAgentEventVisual({
        role: 'main_agent', state: 'working', pixel_state: 'reading_files',
        recent_actions: [{ event_name, tool_name: 'read_file', message: 'read_file' }],
      }, locale);
      assert.match(visual.detail, /read_file/, `${locale} ${event_name} changed or hid raw message`);
    }
    const chip = agentEventChipPresentation({ role: 'main_agent', state: 'working', recent_actions: [{ event_name: 'main.reasoning', message: 'read_file' }] }, locale);
    assert.match(chip.title, /read_file/);
    const combined = agentEventChipPresentation({
      role: 'main_agent', state: 'working', pixel_state: 'reading_files',
      recent_actions: [{ event_name: 'main.tool.started', tool_name: 'read_file', preview: 'read_file' }],
    }, locale);
    assert.match(combined.title, /read_file/);
    assert.equal(combined.visual.icon, '▶');
  }
});
