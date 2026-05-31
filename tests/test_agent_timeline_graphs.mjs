import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentTimelinePanels } from '../public/agent_timeline_graphs.mjs';
import { getLocaleStrings } from '../public/ui_strings.mjs';

test('agent timeline panels map recent activity onto time and event lanes', () => {
  const now = 1_700_000_000_000;
  const panels = buildAgentTimelinePanels({
    server_time_ms: now,
    agents: [{
      agent: 'codex-main',
      name: 'Codex',
      role: 'main_agent',
      state: 'working',
      age_seconds: 2,
      recent_actions: [{
        time: now - 1_000,
        type: 'tool',
        event_name: 'agent.tool.started',
        message: 'patch',
      }],
    }],
    events: [],
  }, getLocaleStrings('en-US'));

  assert.equal(panels.length, 1);
  assert.equal(panels[0].agentId, 'codex-main');
  assert.equal(panels[0].points[0].category, 'tool');
  assert.ok(panels[0].points[0].xPct > 99);
  assert.equal(panels[0].rows.length, 7);
});

test('agent timeline panels respect explicit live refresh timing', () => {
  const now = 1_700_000_000_000;
  const panels = buildAgentTimelinePanels({
    server_time_ms: now,
    agents: [{
      agent: 'codex-main',
      name: 'Codex',
      role: 'main_agent',
      state: 'working',
      age_seconds: 2,
      recent_actions: [
        {
          time: now - 7_000,
          type: 'tool',
          event_name: 'agent.tool.started',
          message: 'patch',
        },
        {
          time: now - 1_000,
          type: 'status',
          event_name: 'agent.status',
          message: 'updated',
        },
      ],
    }],
    events: [],
  }, getLocaleStrings('en-US'), { nowMs: now, windowMs: 5_000 });

  assert.equal(panels[0].points.length, 1);
  assert.equal(panels[0].points[0].category, 'status');
  assert.ok(panels[0].points[0].xPct > 75);
});
