import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommandDeckModel,
  commandDeckFindings,
  compareCommandDeckAgents,
  resolveCommandSelection,
} from '../public/command_deck_model.mjs';

const snapshotWithMainAndSubagent = {
  server_time_ms: 2_000,
  agents: [
    {
      agent: 'synthetic-subagent-1', role: 'subagent', state: 'working', pixel_state: 'tool_call',
      room_key: 'tool_forge', task: 'Run the external task exactly', last_seen_ms: 1_900,
    },
    {
      agent: 'main', role: 'main_agent', state: 'thinking', pixel_state: 'planning',
      room_key: 'think_lab', task: 'Coordinate the work', last_seen_ms: 1_950,
    },
  ],
  events: [
    {
      id: 'evt-sub-tool', agent: 'synthetic-subagent-1', type: 'tool.started',
      target_room: 'tool_forge', time: 1_900, message: 'Calling tool',
    },
    {
      id: 'evt-main-plan', agent: 'main', type: 'planning',
      target_room: 'think_lab', time: 1_850, message: 'Planning',
    },
  ],
};

test('main agent sorts first and real subagents remain visible', () => {
  const model = buildCommandDeckModel(snapshotWithMainAndSubagent);
  assert.deepEqual(model.agents.map(({ id }) => id), ['main', 'synthetic-subagent-1']);
  assert.equal(model.agents[1].task, 'Run the external task exactly');
  assert.equal(model.agents[1].labelKey, 'commandDeck.agent');
});

test('stale placeholders are suppressed only after a real source replacement attaches', () => {
  const placeholder = {
    agent: 'codex-main', role: 'main_agent', source: 'bridge', source_placeholder: true,
    connection_status: 'awaiting_attach', state: 'idle', room_key: 'standby_dock', is_stale: true,
  };
  const replacement = {
    agent: 'codex-cli:7', role: 'main_agent', source: 'bridge', source_placeholder: false,
    connection_status: 'attached', state: 'working', room_key: 'response_studio',
  };
  assert.deepEqual(buildCommandDeckModel({ agents: [placeholder] }).agents.map(({ id }) => id), ['codex-main']);
  assert.deepEqual(buildCommandDeckModel({ agents: [placeholder, replacement] }).agents.map(({ id }) => id), ['codex-cli:7']);
});

test('generated event IDs are stable across snapshot ordering', () => {
  const events = [
    { agent: 'main', type: 'reasoning', time: 100, message: 'Think' },
    { agent: 'main', type: 'tool.started', time: 200, message: 'Patch' },
  ];
  const first = buildCommandDeckModel({ agents: snapshotWithMainAndSubagent.agents, events });
  const second = buildCommandDeckModel({ agents: snapshotWithMainAndSubagent.agents, events: [...events].reverse() });
  assert.deepEqual(new Set(first.events.map(({ id }) => id)), new Set(second.events.map(({ id }) => id)));
  assert.ok(first.events.every(({ id }) => id.startsWith('event-')));
});

test('one authoritative model drives agent, event, building, and Hook selection', () => {
  const model = buildCommandDeckModel(snapshotWithMainAndSubagent);
  const selectedEvent = resolveCommandSelection(model, { kind: 'event', id: 'evt-sub-tool' });
  assert.equal(selectedEvent.agent.id, 'synthetic-subagent-1');
  assert.equal(selectedEvent.buildingId, 'tool_forge');
  assert.strictEqual(selectedEvent.agent, model.agents[1]);
  assert.strictEqual(selectedEvent.event, model.events.find(({ id }) => id === 'evt-sub-tool'));
  assert.strictEqual(selectedEvent.building, model.selectionIndex.building.tool_forge);

  const selectedAgent = resolveCommandSelection(model, { kind: 'agent', id: 'synthetic-subagent-1' });
  const selectedBuilding = resolveCommandSelection(model, { kind: 'building', id: 'tool_forge' });
  const selectedHook = resolveCommandSelection(model, { kind: 'hook', id: 'work' });
  assert.strictEqual(selectedAgent.agent, selectedEvent.agent);
  assert.strictEqual(selectedBuilding.building, selectedEvent.building);
  assert.ok(selectedBuilding.events.includes(selectedEvent.event));
  assert.strictEqual(selectedHook.hook, model.selectionIndex.hook.work);
  assert.equal(resolveCommandSelection(model, { kind: 'event', id: 'missing' }), null);
});

test('room mismatches and missing rendered village entities produce structured findings', () => {
  const model = buildCommandDeckModel({
    agents: [{
      agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'idle',
      room_key: 'standby_dock', task: 'CLI session running',
    }],
    events: [],
  });
  assert.ok(model.findings.some(({ id, messageKey }) => (
    id === 'agent-room-mismatch:main' && messageKey === 'commandDeck.findings.roomMismatch'
  )));

  const findings = commandDeckFindings(model, { agents: [], buildings: [] });
  assert.ok(findings.some(({ agentId, messageKey }) => (
    agentId === 'main' && messageKey === 'commandDeck.findings.missingVillageAgent'
  )));
  assert.ok(findings.some(({ buildingId, messageKey }) => (
    buildingId === 'response_studio' && messageKey === 'commandDeck.findings.missingVillageBuilding'
  )));
  assert.ok(findings.every(({ severity, params }) => (
    ['info', 'warning', 'critical'].includes(severity) && params && typeof params === 'object'
  )));
});

test('building and event records expose product label keys while preserving external text', () => {
  const model = buildCommandDeckModel(snapshotWithMainAndSubagent);
  const event = model.events.find(({ id }) => id === 'evt-sub-tool');
  assert.equal(event.summary, 'Calling tool');
  assert.equal(event.category, 'tool');
  assert.equal(event.categoryLabelKey, 'eventCategories.tool');
  assert.equal(model.selectionIndex.building.tool_forge.labelKey, 'rooms.tool_forge.name');
  assert.equal(model.situation.agentCount, 2);
});

test('API action payload supplies the authoritative event category and text', () => {
  const model = buildCommandDeckModel({
    agents: [{ agent: 'main', role: 'main_agent', state: 'working' }],
    events: [{
      id: 'evt-payload-tool', kind: 'action', agent: 'main',
      payload: { action: { type: 'tool', message: 'Running payload tool' } },
    }],
  });
  assert.equal(model.events[0].category, 'tool');
  assert.equal(model.events[0].summary, 'Running payload tool');

  const withEmptyPreview = buildCommandDeckModel({
    agents: [{ agent: 'main', role: 'main_agent', state: 'working' }],
    events: [{
      id: 'evt-payload-empty-preview', kind: 'action', agent: 'main',
      payload: { action: { type: 'tool', preview: '', message: 'Fallback payload message' } },
    }],
  });
  assert.equal(withEmptyPreview.events[0].summary, 'Fallback payload message');
});

test('command deck exports the one canonical identity ordering helper', () => {
  const unordered = [
    { id: 'sub-b', role: 'subagent' },
    { id: 'main', role: 'main_agent' },
    { id: 'sub-a', role: 'subagent' },
  ];
  assert.deepEqual([...unordered].sort(compareCommandDeckAgents).map(({ id }) => id), ['main', 'sub-a', 'sub-b']);
});
