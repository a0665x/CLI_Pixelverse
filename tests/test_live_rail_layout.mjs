import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RAIL_WIDTHS,
  clampRailWidth,
  createLiveRailLayoutController,
  nextRailWidth,
  railDensity,
  readRailWidths,
} from '../public/live_rail_layout.mjs';

test('saved rail widths are validated and preserve the minimum map width', () => {
  const storage = { getItem: (key) => ({
    'pixelverse:live-left-width': '400',
    'pixelverse:live-right-width': '350',
  })[key] };
  assert.deepEqual(readRailWidths(storage, 1_440), { left: 400, right: 350 });
  const constrained = readRailWidths(storage, 1_000);
  assert.equal(constrained.left + constrained.right + 16 + 520, 1_000);
  assert.deepEqual(readRailWidths({ getItem: () => 'broken' }, 1_440), DEFAULT_RAIL_WIDTHS);
  assert.deepEqual(readRailWidths({ getItem: () => null }, 1_440), DEFAULT_RAIL_WIDTHS);
});

test('each splitter clamps only its rail while preserving the opposite rail and map', () => {
  assert.equal(clampRailWidth('left', 999, { viewportWidth: 1_200, left: 280, right: 260 }), 404);
  assert.equal(clampRailWidth('right', 999, { viewportWidth: 1_200, left: 280, right: 260 }), 360);
  assert.equal(clampRailWidth('left', 20, { viewportWidth: 1_200, left: 280, right: 260 }), 180);
});

test('pointer and keyboard deltas follow the visual edge direction', () => {
  const widths = { left: 280, right: 260 };
  assert.equal(nextRailWidth({ side: 'left', startWidth: 280, deltaX: 50, viewportWidth: 1_440, widths }), 330);
  assert.equal(nextRailWidth({ side: 'right', startWidth: 260, deltaX: 50, viewportWidth: 1_440, widths }), 210);
  assert.equal(nextRailWidth({ side: 'right', startWidth: 260, deltaX: -50, viewportWidth: 1_440, widths }), 310);
});

test('rail density adapts to the actual left rail width', () => {
  assert.equal(railDensity(200), 'compact');
  assert.equal(railDensity(280), 'standard');
  assert.equal(railDensity(380), 'wide');
});

test('controller applies persisted widths on the workspace that owns the CSS variables', () => {
  const values = new Map();
  const workspace = {
    dataset: {}, classList: { add() {}, remove() {} },
    style: { setProperty: (key, value) => values.set(key, value) },
  };
  const handle = { addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const rootValues = new Map();
  const controller = createLiveRailLayoutController({
    workspace,
    root: { style: { setProperty: (key, value) => rootValues.set(key, value) } },
    leftHandle: handle,
    rightHandle: handle,
    storage: { getItem: (key) => key.endsWith('left-width') ? '296' : '276' },
    resizeTarget: handle,
    viewportWidth: () => 1_440,
  });
  controller.start();
  assert.equal(values.get('--live-left-width'), '296px');
  assert.equal(values.get('--live-right-width'), '276px');
  assert.equal(rootValues.size, 0);
});
