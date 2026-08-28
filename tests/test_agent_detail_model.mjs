import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentDetail } from '../public/agent_detail_model.mjs';
import { buildCommandDeckModel } from '../public/command_deck_model.mjs';

test('detail projects identity state location tooling and only this Agent recent events', () => {
  const model = buildCommandDeckModel({
    server_time_ms: 10_000,
    agents: [{
      agent: 'codex-cli:42', name: 'RAW_NAME', role: 'main_agent', state: 'working',
      pixel_state: 'editing_files', task: 'RAW_TASK', room_key: 'code_workbench',
      tool_name: 'apply_patch', hook: 'PostToolUse', process_id: 42,
      instance_name: 'terminal-a', last_seen_ms: 9_950,
    }],
    events: [
      { id: 'own', agent: 'codex-cli:42', event: 'tool.started', preview: 'RAW_EVENT' },
      { id: 'other', agent: 'other', event: 'status', preview: 'IGNORE' },
    ],
  });

  const detail = buildAgentDetail(model, 'codex-cli:42', { nowMs: 10_000 });

  assert.equal(detail.id, 'codex-cli:42');
  assert.equal(detail.signal.kind, 'busy');
  assert.equal(detail.room.key, 'code_workbench');
  assert.equal(detail.tool, 'apply_patch');
  assert.equal(detail.processIdentity, 42);
  assert.equal(detail.sessionIdentity, 'terminal-a');
  assert.deepEqual(detail.recentEvents.map(({ id }) => id), ['own']);
  assert.deepEqual(detail.externalFields, [
    'name', 'task', 'tool', 'hook', 'processIdentity', 'sessionIdentity', 'recentEvents',
  ]);
});

test('detail returns null for an identity absent from the canonical model', () => {
  assert.equal(buildAgentDetail(buildCommandDeckModel({ agents: [] }), 'missing'), null);
});
