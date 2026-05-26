import test from 'node:test';
import assert from 'node:assert/strict';

import {
  centeredCamera,
  clampCameraOffset,
  clampZoom,
  nextDraggedOffset,
  nextZoomState,
} from '../public/ui_state.mjs';

test('clampCameraOffset keeps camera within stage bounds', () => {
  const clamped = clampCameraOffset({ x: -900, y: -500 }, { width: 800, height: 600 }, { width: 1200, height: 900 });
  assert.deepEqual(clamped, { x: -400, y: -300 });
});

test('centeredCamera recenters oversized world inside viewport', () => {
  const centered = centeredCamera({ width: 800, height: 600 }, { width: 1200, height: 900 });
  assert.deepEqual(centered, { x: -200, y: -150 });
});

test('nextDraggedOffset applies pointer delta and optional bounds', () => {
  assert.deepEqual(nextDraggedOffset({ x: 10, y: 20 }, { x: -5, y: 8 }), { x: 5, y: 28 });
  assert.deepEqual(nextDraggedOffset({ x: 10, y: 20 }, { x: -50, y: 100 }, { minX: -20, maxX: 40, minY: -10, maxY: 30 }), { x: -20, y: 30 });
});

test('clampZoom keeps camera zoom inside supported range', () => {
  assert.equal(clampZoom(0.2), 0.65);
  assert.equal(clampZoom(1.4), 1.4);
  assert.equal(clampZoom(4), 2.25);
});

test('nextZoomState keeps pointer focus stable while zooming', () => {
  const next = nextZoomState({
    offset: { x: -200, y: -150 },
    scale: 1,
    viewport: { width: 1000, height: 700 },
    stage: { width: 1600, height: 1040 },
    pointer: { x: 400, y: 240 },
    deltaY: -120,
  });
  assert.ok(next.scale > 1);
  const worldBefore = { x: (400 - (-200)) / 1, y: (240 - (-150)) / 1 };
  const worldAfter = { x: (400 - next.offset.x) / next.scale, y: (240 - next.offset.y) / next.scale };
  assert.ok(Math.abs(worldBefore.x - worldAfter.x) < 0.6);
  assert.ok(Math.abs(worldBefore.y - worldAfter.y) < 0.6);
});
