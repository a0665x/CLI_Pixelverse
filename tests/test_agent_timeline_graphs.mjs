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

test('timeline panel carries localized live state, room, task, connection, and age', () => {
  const panels = buildAgentTimelinePanels({ agents: [{
    agent: 'codex-main', name: 'Codex', role: 'main_agent', state: 'working',
    room_key: 'tool_forge', room_label: '工具工坊', task: 'terminal', age_seconds: 3,
    connection_status: 'connected', recent_actions: [{ time: Date.now(), type: 'tool', message: 'terminal' }],
  }], events: [] }, getLocaleStrings('en-US'));
  assert.equal(panels[0].stateLabel, 'Working');
  assert.match(panels[0].roomLabel, /Tool|External/i);
  assert.equal(panels[0].taskLabel, 'terminal');
  assert.equal(panels[0].connectionLabel, 'Live');
  assert.equal(panels[0].ageSeconds, 3);
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

test('heartbeat path is subtle while idle and uses dense high-amplitude ECG spikes while active', () => {
  const idle = buildHeartbeatPath({
    state: 'idle', signalKind: 'idle', heartbeatRate: .18, heartbeatAmplitude: .18,
  }, 0, 1000, 100);
  assert.notEqual(idle, 'M 0,16 L 100,16');

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
  assert.equal(heartbeatBeatWidthPx(active), 12);
  assert.match(buildHeartbeatPath(active, 1_700_000_000_000, 1000, 12), /L 12,/);
});

test('semantic ECG produces distinct idle, busy, blocked, and offline signals', () => {
  const idle = buildHeartbeatPath({
    signalKind: 'idle', heartbeatRate: .18, heartbeatAmplitude: .18,
  }, 1_000, 160, 176);
  const busy = buildHeartbeatPath({
    signalKind: 'busy', heartbeatRate: 1, heartbeatAmplitude: 1,
  }, 1_000, 160, 176);
  const blocked = buildHeartbeatPath({
    signalKind: 'blocked', heartbeatRate: .68, heartbeatAmplitude: .72,
  }, 1_000, 160, 176);
  const offline = buildHeartbeatPath({
    signalKind: 'offline', heartbeatRate: 0, heartbeatAmplitude: 0,
  }, 1_000, 160, 176);

  assert.equal(offline, 'M 0,16 L 176,16');
  assert.notEqual(idle, offline);
  assert.notEqual(busy, idle);
  assert.notEqual(blocked, busy);
  assert.ok(heartbeatBeatWidthPx({ heartbeatRate: 1 })
    < heartbeatBeatWidthPx({ heartbeatRate: .62 }));
});

test('timeline points preserve semantic event identity and drill-down targets', () => {
  const now = 1_700_000_000_000;
  const panels = buildAgentTimelinePanels({
    server_time_ms: now,
    agents: [{ agent: 'main', role: 'main_agent', state: 'working', room_key: 'tool_forge' }],
    events: [{ id: 'event-1', agent: 'main', room_key: 'tool_forge', time: now - 100, kind: 'tool.started' }],
  }, getLocaleStrings('en-US'), { nowMs: now });

  assert.equal(panels[0].points[0].id, 'event-1');
  assert.equal(panels[0].points[0].agentId, 'main');
  assert.equal(panels[0].points[0].buildingId, 'tool_forge');
});
