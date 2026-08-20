import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMissionTrace, createMissionTraceController } from '../public/mission_trace.mjs';

const model = (events = []) => {
  const agents = [
    { id: 'main', agent: 'main', name: 'Main', role: 'main_agent', buildingId: 'maker', hookSemantic: 'work' },
    { id: 'sub', agent: 'sub', name: 'Sub', role: 'subagent', buildingId: 'lab', hookSemantic: 'search' },
  ];
  const agent = Object.fromEntries(agents.map((item) => [item.id, item]));
  const normalizedEvents = events.map((event) => ({
    category: event.category,
    summary: event.summary || event.kind,
    agent: agent[event.agentId] || null,
    buildingId: event.buildingId || agent[event.agentId]?.buildingId || '',
    hookSemantic: agent[event.agentId]?.hookSemantic || 'work',
    ...event,
  }));
  return {
    agents,
    events: normalizedEvents,
    selectionIndex: {
      agent,
      building: {
        maker: { id: 'maker' },
        lab: { id: 'lab' },
      },
      event: Object.fromEntries(normalizedEvents.map((item) => [item.id, item])),
    },
  };
};

test('mission trace creates stable per-agent lanes and classifies canonical events', () => {
  const source = model([
    { id: 'evt-tool', agentId: 'main', time: 900, kind: 'tool.started' },
    { id: 'evt-think', agentId: 'sub', time: 950, kind: 'reasoning.available' },
  ]);
  const first = buildMissionTrace(source, { nowMs: 1_000, windowMs: 1_000 });
  const second = buildMissionTrace({ ...source, agents: [...source.agents].reverse() }, { nowMs: 1_000, windowMs: 1_000 });

  assert.deepEqual(first.lanes.map(({ agentId }) => agentId), ['main', 'sub']);
  assert.deepEqual(second.lanes.map(({ agentId }) => agentId), ['main', 'sub']);
  assert.equal(first.lanes[0].events[0].category, 'tool');
  assert.equal(first.lanes[1].events[0].category, 'reasoning');
});

test('mission trace retains only the newest bounded events and advances without a new snapshot', () => {
  const source = model([
    { id: 'old', agentId: 'main', time: 700, kind: 'status' },
    { id: 'middle', agentId: 'main', time: 800, kind: 'tool' },
    { id: 'new', agentId: 'main', time: 900, kind: 'completed' },
  ]);
  const first = buildMissionTrace(source, { nowMs: 1_000, windowMs: 1_000, maxEvents: 2 });
  const second = buildMissionTrace(source, { nowMs: 1_100, windowMs: 1_000, maxEvents: 2 });

  assert.deepEqual(first.lanes[0].events.map(({ id }) => id), ['middle', 'new']);
  assert.ok(second.lanes[0].events[1].xPct < first.lanes[0].events[1].xPct);
  assert.equal(second.windowEndMs, 1_100);
});

test('mission events resolve their agent and building for unified drill-down', () => {
  const trace = buildMissionTrace(model([
    { id: 'evt', agentId: 'sub', time: 900, kind: 'message' },
  ]), { nowMs: 1_000 });
  const event = trace.lanes[1].events[0];

  assert.equal(event.agent.id, 'sub');
  assert.equal(event.agentId, 'sub');
  assert.equal(event.building.id, 'lab');
  assert.equal(event.buildingId, 'lab');
});

test('mission trace controller pauses on selection and resumes Live mode without snapshot churn', () => {
  let nowMs = 1_000;
  const frames = [];
  const rendered = [];
  const controller = createMissionTraceController({
    now: () => nowMs,
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => {},
    onRender: (trace, change) => rendered.push({ trace, change }),
    windowMs: 1_000,
    frameIntervalMs: 0,
  });
  controller.setModel(model([{ id: 'evt', agentId: 'main', time: 900, kind: 'tool' }]));
  controller.start();
  nowMs = 1_100;
  frames.shift()(nowMs);
  const movingX = rendered.at(-1).trace.lanes[0].events[0].xPct;

  controller.select('evt');
  assert.equal(rendered.at(-1).trace.live, false);
  assert.equal(rendered.at(-1).trace.selectedEventId, 'evt');
  nowMs = 1_200;
  frames.shift()(nowMs);
  assert.equal(rendered.at(-1).trace.lanes[0].events[0].xPct, movingX);

  controller.resume();
  assert.equal(rendered.at(-1).trace.live, true);
  assert.equal(rendered.at(-1).trace.selectedEventId, null);
  controller.stop();
});

test('reduced motion uses low-frequency static refresh instead of animation frames', () => {
  let frameRequests = 0;
  let staticTick;
  const rendered = [];
  const controller = createMissionTraceController({
    reducedMotion: true,
    requestAnimationFrame: () => { frameRequests += 1; },
    setInterval: (callback, delay) => { staticTick = callback; assert.ok(delay >= 1_000); return 7; },
    clearInterval: () => {},
    onRender: (trace, change) => rendered.push({ trace, change }),
  });

  controller.setModel(model([{ id: 'evt', agentId: 'main', time: 900, kind: 'tool' }]));
  controller.start();
  assert.equal(frameRequests, 0);
  staticTick();
  assert.equal(rendered.at(-1).change.structureChanged, false);
  controller.stop();
});
