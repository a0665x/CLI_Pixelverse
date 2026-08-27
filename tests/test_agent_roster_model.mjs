import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentRoster, resolveAgentSignal } from '../public/agent_roster_model.mjs';
import { buildCommandDeckModel } from '../public/command_deck_model.mjs';

const model = buildCommandDeckModel({
  server_time_ms: 10_000,
  agents: [
    { agent: 'idle-sub', role: 'subagent', state: 'idle', pixel_state: 'idle', last_seen_ms: 9_900 },
    {
      agent: 'blocked-sub', role: 'subagent', state: 'blocked', pixel_state: 'awaiting_input',
      task: 'RAW_USER_TASK', last_seen_ms: 9_950,
    },
    { agent: 'main', role: 'main_agent', state: 'thinking', pixel_state: 'planning', last_seen_ms: 9_980 },
    { agent: 'busy-sub', role: 'subagent', state: 'working', pixel_state: 'executing', last_seen_ms: 9_970 },
    { agent: 'offline-sub', role: 'subagent', state: 'offline', is_stale: true, last_seen_ms: 1_000 },
  ],
});

test('roster orders main, attention, active, idle, and offline groups', () => {
  const rows = buildAgentRoster(model, { nowMs: 10_000 });

  assert.deepEqual(rows.map(({ id }) => id), [
    'main', 'blocked-sub', 'busy-sub', 'idle-sub', 'offline-sub',
  ]);
  assert.equal(rows[1].needsAttention, true);
  assert.equal(rows[1].externalTask, 'RAW_USER_TASK');
  assert.equal(rows[2].signal.kind, 'busy');
  assert.equal(rows[4].signal.kind, 'offline');
});

test('signal mapping distinguishes liveness, load, and intervention', () => {
  assert.equal(resolveAgentSignal({ state: 'idle', pixel_state: 'idle' }, 10_000).kind, 'idle');
  assert.equal(resolveAgentSignal({ state: 'thinking', pixel_state: 'planning' }, 10_000).kind, 'thinking');
  assert.equal(resolveAgentSignal({ state: 'working', pixel_state: 'responding' }, 10_000).kind, 'working');
  assert.equal(resolveAgentSignal({ state: 'working', pixel_state: 'executing' }, 10_000).kind, 'busy');
  assert.equal(resolveAgentSignal({ state: 'blocked', pixel_state: 'awaiting_input' }, 10_000).kind, 'blocked');
  assert.equal(resolveAgentSignal({ state: 'offline', is_stale: true }, 10_000).kind, 'offline');
});

test('roster ordering remains stable by identity within one urgency group', () => {
  const rows = buildAgentRoster(buildCommandDeckModel({ agents: [
    { agent: 'sub-z', role: 'subagent', state: 'working' },
    { agent: 'sub-a', role: 'subagent', state: 'working' },
  ] }));

  assert.deepEqual(rows.map(({ id }) => id), ['sub-a', 'sub-z']);
});
