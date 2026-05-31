import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGridLines,
  clampPercent,
  COARSE_SNAP_STEP,
  DEFAULT_SNAP_STEP,
  formatPercent,
  normalizePercent,
  resolveSnapStep,
  snapPercent,
} from '../public/furniture_editing.mjs';
import {
  getRoomPropPositions,
  positionOverlapsFurniture,
} from '../public/room_furniture.mjs';
import { getRoomDecor } from '../public/ui_strings.mjs';

test('clampPercent keeps furniture coordinates inside editable room bounds', () => {
  assert.equal(clampPercent(-10), 6);
  assert.equal(clampPercent(50), 50);
  assert.equal(clampPercent(120), 94);
});

test('snapPercent and resolveSnapStep support fine and coarse snapping', () => {
  assert.equal(resolveSnapStep(false), DEFAULT_SNAP_STEP);
  assert.equal(resolveSnapStep(true), COARSE_SNAP_STEP);
  assert.equal(snapPercent(42.24, DEFAULT_SNAP_STEP), 42);
  assert.equal(snapPercent(42.26, DEFAULT_SNAP_STEP), 42.5);
  assert.equal(snapPercent(42.6, COARSE_SNAP_STEP), 43);
});

test('normalizePercent applies clamp before snap', () => {
  assert.equal(normalizePercent(4.9), 6);
  assert.equal(normalizePercent(95.4), 94);
  assert.equal(normalizePercent(42.26), 42.5);
});

test('buildGridLines produces reusable room grid lanes inside bounds', () => {
  assert.deepEqual(buildGridLines(), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
});

test('formatPercent renders one decimal place for coordinate HUD', () => {
  assert.equal(formatPercent(42), '42.0');
  assert.equal(formatPercent(42.56), '42.6');
});

test('positionOverlapsFurniture rejects occupied prop locations', () => {
  const roomKey = 'tool_forge';
  const positions = getRoomPropPositions(roomKey);
  const decor = getRoomDecor(roomKey, 'en-US');

  assert.equal(positionOverlapsFurniture(roomKey, decor, 1, positions[0], positions), true);
  assert.equal(positionOverlapsFurniture(roomKey, decor, 1, { x: 42, y: 74 }, positions), false);
});
