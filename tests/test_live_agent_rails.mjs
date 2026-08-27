import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLiveAgentRail,
  hookRailForAgents,
  hookGuideForLocale,
  hookChannelsForAgents,
  liveAgentPage,
  normalizeAgentForWorld,
  normalizeVisibleAgents,
  resolvedAgentActivity,
} from '../public/live_agent_rails.mjs';
import { buildCommandDeckModel } from '../public/command_deck_model.mjs';

const agents = [
  { agent: 'sub-b', role: 'subagent', state: 'offline', pixel_state: 'sleeping', room_key: 'rest-cabin', task: '' },
  { agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'tool_call', room_key: 'maker-workshop', task: 'Editing code' },
  { agent: 'sub-a', role: 'subagent', state: 'idle', pixel_state: 'idle', room_key: 'research-library', task: 'Waiting' },
];

test('live agent rail retains working, idle, and offline agents in stable identity order', () => {
  const rows = buildLiveAgentRail({ agents }, { states: {}, rooms: {} }, 100);
  assert.deepEqual(rows.map(({ id }) => id), ['main', 'sub-a', 'sub-b']);
  assert.equal(rows.length, agents.length);
  assert.match(rows[0].path, /^M /);
  assert.equal(rows[2].tone, 'offline');
  assert.match(rows[2].path, /L 176,16$/);
});

test('live agent rail consumes authoritative model agents without re-inferring activity', () => {
  const model = buildCommandDeckModel({ agents: [{
    agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'idle',
    room_key: 'standby_dock', task: 'CLI session running',
  }] });
  const [row] = buildLiveAgentRail(model.agents, { states: {}, rooms: {} }, 100);
  assert.equal(row.id, 'main');
  assert.equal(row.hook, model.agents[0].hookSemantic);
  assert.equal(row.tone, model.agents[0].tone);
  assert.equal(row.room, model.agents[0].targetRoom);
});

test('agent rail pagination is deterministic and clamps when agents disappear', () => {
  assert.deepEqual(liveAgentPage(agents, 1, 2), { items: [agents[0]], page: 1, pageCount: 2, canPrevious: true, canNext: false });
  assert.equal(liveAgentPage(agents.slice(0, 1), 8, 2).page, 0);
});

test('hook rail follows the main active agent and maps its semantic to a building', () => {
  assert.deepEqual(hookRailForAgents(agents), {
    agentId: 'main', semantic: 'work', building: 'Maker Workshop', activity: 'Editing code', roomKey: 'maker-workshop',
  });
});

test('authoritative working state overrides a stale idle animation hint', () => {
  const working = [{
    agent: 'codex-cli:1', role: 'main_agent', state: 'working', pixel_state: 'idle',
    room_key: 'response_studio', task: 'CLI session running',
  }];
  const [row] = buildLiveAgentRail({ agents: working }, { states: {}, rooms: {} }, 100);
  assert.equal(row.tone, 'work');
  assert.notEqual(row.path, 'M 0,16 L 176,16');
  assert.equal(hookRailForAgents(working).semantic, 'work');
});

test('agent rail state and label both use the normalized heartbeat state', () => {
  const [row] = buildLiveAgentRail({ agents: [{
    agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'planning', room_key: 'think_lab',
  }] }, { states: { working: 'Working label', thinking: 'Thinking label' }, rooms: {} }, 100);
  assert.equal(row.state, 'thinking');
  assert.equal(row.stateLabel, 'Thinking label');
});

test('Hook rail prefers the freshest active agent over an offline main identity', () => {
  const rows = [
    { agent: 'main', role: 'main_agent', state: 'offline', is_stale: true, last_seen_ms: 500 },
    { agent: 'sub', role: 'subagent', state: 'thinking', pixel_state: 'planning', last_seen_ms: 900, task: 'Researching' },
  ];
  assert.equal(hookRailForAgents(rows).agentId, 'sub');
  assert.equal(hookRailForAgents(rows).semantic, 'search');
});

test('Hook guide is complete and localized in all four UI locales', () => {
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const guide = hookGuideForLocale(locale);
    assert.equal(guide.length, 4);
    assert.ok(guide.every(({ title, detail }) => title && detail));
  }
  assert.match(hookGuideForLocale('ja-JP')[0].title, /休憩/);
  assert.match(hookGuideForLocale('ko-KR')[0].title, /휴식/);
});

test('attached CLI suppresses only its redundant stale source placeholder', () => {
  const visible = normalizeVisibleAgents({ agents: [
    {
      agent: 'codex-cli:2237262', role: 'main_agent', source: 'bridge', source_placeholder: false,
      connection_status: 'attached', state: 'working', pixel_state: 'idle', room_key: 'response_studio',
    },
    {
      agent: 'codex-main', role: 'main_agent', source: 'bridge', source_placeholder: true,
      connection_status: 'awaiting_attach', state: 'idle', pixel_state: 'idle', room_key: 'standby_dock', is_stale: true,
    },
    {
      agent: 'offline-sub', role: 'subagent', source: 'bridge', source_placeholder: false,
      state: 'offline', room_key: 'offline_corner', is_stale: true,
    },
  ] });
  assert.deepEqual(visible.map(({ agent }) => agent), ['codex-cli:2237262', 'offline-sub']);
});

test('placeholder remains visible until a real attached agent from the same source exists', () => {
  const placeholder = {
    agent: 'codex-main', role: 'main_agent', source: 'bridge', source_placeholder: true,
    connection_status: 'awaiting_attach', state: 'idle', room_key: 'standby_dock',
  };
  assert.deepEqual(normalizeVisibleAgents({ agents: [placeholder] }), [placeholder]);
});

test('resolved activity keeps the village state and room consistent with the live rail', () => {
  assert.deepEqual(resolvedAgentActivity({
    agent: 'codex-cli:1', state: 'working', pixel_state: 'idle', room_key: 'standby_dock', task: 'CLI session running',
  }), {
    state: 'working', tone: 'work', load: .94, semantic: 'work', roomKey: 'response_studio',
  });
  assert.equal(resolvedAgentActivity({ state: 'offline', pixel_state: 'working', is_stale: true }).state, 'offline');
  assert.equal(resolvedAgentActivity({ state: 'working', pixel_state: 'thinking' }).semantic, 'search');
  assert.equal(resolvedAgentActivity({ state: 'thinking', pixel_state: 'idle' }).semantic, 'search');
});

test('world projection replaces stale pixel hints with the resolved live activity', () => {
  assert.deepEqual(normalizeAgentForWorld({
    agent: 'codex-cli:1', state: 'working', pixel_state: 'idle', room_key: 'standby_dock', task: 'CLI session running',
  }), {
    agent: 'codex-cli:1', state: 'working', pixel_state: 'responding', room_key: 'response_studio', task: 'CLI session running',
  });
  assert.equal(normalizeAgentForWorld({ state: 'thinking', pixel_state: 'idle' }).pixel_state, 'thinking');
  assert.equal(normalizeAgentForWorld({ state: 'working', pixel_state: 'tool_call' }).pixel_state, 'tool_call');
  assert.deepEqual(normalizeAgentForWorld({
    state: 'working', pixel_state: 'reading_files', room_key: 'file_library', task: 'Reading code',
  }), {
    state: 'thinking', pixel_state: 'reading_files', room_key: 'file_library', task: 'Reading code',
  });
  assert.equal(normalizeAgentForWorld({ state: 'offline', pixel_state: 'tool_call', is_stale: true }).pixel_state, 'offline');
});

test('Hook console always exposes dense Work Search and Rest channels', () => {
  const channels = hookChannelsForAgents([
    { agent: 'worker', state: 'working', pixel_state: 'idle', task: 'Editing code', last_seen_ms: 300 },
    { agent: 'reader', state: 'thinking', task: 'Searching docs', last_seen_ms: 200 },
    { agent: 'idle', state: 'idle', task: '', last_seen_ms: 100 },
  ], 'zh-TW', 'worker');
  assert.deepEqual(channels.map(({ semantic }) => semantic), ['work', 'search', 'rest']);
  assert.deepEqual(channels.map(({ count }) => count), [1, 1, 1]);
  assert.deepEqual(channels.map(({ label }) => label), ['工作', '搜尋', '休息']);
  assert.ok(channels.every(({ path }) => /^M /.test(path)));
  assert.notEqual(channels[0].path, 'M 0,16 L 176,16');
  assert.equal(channels[0].active, true);
  assert.equal(channels[0].activity, 'Editing code');
});

test('legacy live rail exposes the canonical signal object for roster migration', () => {
  const [row] = buildLiveAgentRail({
    agents: [{ agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'executing' }],
  }, { states: {}, rooms: {} }, 100);

  assert.equal(row.signal.kind, 'busy');
  assert.equal(row.signal.rate, 1);
  assert.equal(row.portraitInput.role, 'main_agent');
});
