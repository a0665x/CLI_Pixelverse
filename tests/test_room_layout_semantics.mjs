import test from 'node:test';
import assert from 'node:assert/strict';

import { getKenneyRoomLayout } from '../public/kenney_assets.mjs';

const REQUIRED_ROOMS = [
  'think_lab',
  'blueprint_lab',
  'file_library',
  'code_workbench',
  'terminal_bay',
  'tool_forge',
  'response_studio',
  'standby_dock',
  'clone_bay',
  'session_archive',
];

test('every room exposes semantic tilemap layout metadata', () => {
  for (const roomKey of REQUIRED_ROOMS) {
    const layout = getKenneyRoomLayout(roomKey);
    assert.equal(layout.roomKey, roomKey);
    assert.equal(Array.isArray(layout.semanticZones), true);
    assert.equal(Array.isArray(layout.wallSegments), true);
    assert.equal(Array.isArray(layout.floorAccents), true);
    assert.ok(layout.semanticZones.length >= 2, `${roomKey} should expose at least two semantic zones`);
    assert.ok(layout.wallSegments.length >= 2, `${roomKey} should expose wall/furniture silhouette segments`);
    assert.ok(layout.floorAccents.length >= 1, `${roomKey} should expose floor accents`);
  }
});

test('planning-heavy and rest-heavy rooms expose distinct semantic anchors', () => {
  const blueprint = getKenneyRoomLayout('blueprint_lab');
  const standby = getKenneyRoomLayout('standby_dock');

  assert.deepEqual(
    blueprint.semanticZones.map((zone) => zone.key),
    ['briefing-strip', 'blueprint-table', 'scanner-nook', 'archive-wall'],
  );

  assert.deepEqual(
    standby.semanticZones.map((zone) => zone.key),
    ['rest-lane', 'bed-alcove', 'coffee-corner', 'ready-lockers'],
  );
});

test('semantic zones provide tile assets and positioning that can render directly', () => {
  const forge = getKenneyRoomLayout('tool_forge');
  const firstZone = forge.semanticZones[0];
  const firstWall = forge.wallSegments[0];
  const firstAccent = forge.floorAccents[0];

  for (const item of [firstZone, firstWall, firstAccent]) {
    assert.equal(typeof item.left, 'number');
    assert.equal(typeof item.top, 'number');
    assert.equal(typeof item.width, 'number');
    assert.equal(typeof item.height, 'number');
    assert.match(String(item.tile), /tile_\d+\.png$/);
  }

  assert.equal(firstZone.labelKey, 'buildServer');
  assert.equal(firstZone.kind, 'work');
});
