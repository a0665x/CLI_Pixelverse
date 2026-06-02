import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentTimelinePanels, buildHeartbeatPath, heartbeatBeatWidthPx } from '../public/agent_timeline_graphs.mjs';
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

test('offline agent timelines remain visible and expose manual deletion', () => {
  const panels = buildAgentTimelinePanels({
    agents: [{
      agent: 'codex-cli:42',
      name: 'Codex CLI',
      role: 'main_agent',
      state: 'offline',
      is_stale: true,
      can_delete: true,
      age_seconds: 90,
      recent_actions: [],
    }],
    events: [],
  }, getLocaleStrings('en-US'));

  assert.equal(panels.length, 1);
  assert.equal(panels[0].heartbeatTone, 'stale');
  assert.equal(panels[0].canDelete, true);
  assert.ok(panels[0].heartbeatLoad > 0);
});

test('heartbeat path is flat while idle and uses dense high-amplitude ECG spikes while active', () => {
  assert.equal(buildHeartbeatPath({ state: 'idle', heartbeatLoad: 0 }, 0, 1000, 100), 'M 0,16 L 100,16');

  const active = { state: 'working', heartbeatTone: 'live', heartbeatLoad: 1 };
  const beatWidth = heartbeatBeatWidthPx(active);
  const path = buildHeartbeatPath(active, 1_700_000_000_000, 1000, beatWidth);
  const points = [...path.matchAll(/(?:M|L) ([\d.]+),(-?[\d.]+)/g)].map((match) => Number(match[2]));
  assert.ok(beatWidth <= 18);
  assert.ok(points.length >= 60);
  assert.ok(Math.max(...points) - Math.min(...points) > 18);
});

test('heartbeat density uses a fixed pixel beat width independent of timeline width', () => {
  const active = { state: 'working', heartbeatTone: 'live', heartbeatLoad: 1 };
  assert.equal(heartbeatBeatWidthPx(active), 16);
  assert.match(buildHeartbeatPath(active, 1_700_000_000_000, 1000, 16), /L 16,/);
});
