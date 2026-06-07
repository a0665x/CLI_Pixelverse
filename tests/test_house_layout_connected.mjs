import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseGlobalMapYaml } from '../public/global_map_loader.mjs';
import {
  applyGlobalMapManifest,
  CORRIDOR_RECTS,
  DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP,
  GLOBAL_MAP,
  HOUSE_DOORS,
  ROOM_LAYOUTS,
  ROOM_METADATA,
  ROOM_STATE_GROUPS,
  roomRect,
} from '../public/house_layout.mjs';

function rectContains(rect, point, padding = 0) {
  return point.x >= rect.left - padding
    && point.x <= rect.right + padding
    && point.y >= rect.top - padding
    && point.y <= rect.bottom + padding;
}

test('rooms use one coherent central-corridor floorplan', () => {
  assert.ok(roomRect('think_lab').left < roomRect('blueprint_lab').left);
  assert.equal(roomRect('think_lab').top, roomRect('blueprint_lab').top);
  assert.equal(roomRect('blueprint_lab').top, roomRect('clone_bay').top);
  assert.equal(roomRect('file_library').top, roomRect('code_workbench').top);
  assert.equal(roomRect('code_workbench').top, roomRect('terminal_bay').top);
  assert.equal(roomRect('standby_dock').top, roomRect('response_studio').top);
  assert.equal(roomRect('response_studio').top, roomRect('tool_forge').top);
  assert.equal(roomRect('tool_forge').top, roomRect('session_archive').top);
  assert.equal(CORRIDOR_RECTS.length, 4);
  assert.ok(roomRect('think_lab').width >= 28);
  assert.ok(roomRect('file_library').width >= 28);
  assert.ok(roomRect('standby_dock').width >= 22);
});

test('all active rooms have doors connected to the corridor graph', () => {
  for (const [roomKey, room] of Object.entries(ROOM_LAYOUTS)) {
    if (roomKey === 'offline_corner') continue;
    const door = HOUSE_DOORS.find((item) => item.room === roomKey);
    assert.ok(door, `missing door for ${roomKey}`);
    assert.ok(door.left >= room.left, `${roomKey} door should stay inside room width`);
    assert.ok(door.left + door.width <= room.left + room.width, `${roomKey} door should stay inside room width`);
    assert.ok(
      CORRIDOR_RECTS.some((rect) => rectContains(rect, room.portal, 2.8)),
      `${roomKey} portal should touch a corridor branch`,
    );
    assert.ok(
      CORRIDOR_RECTS.some((rect) => rectContains(rect, room.hub, 0.2)),
      `${roomKey} hub should be inside the corridor graph`,
    );
  }
});

test('global_map yaml drives room geometry, semantics, and furniture defaults', () => {
  const yaml = readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(yaml);

  assert.equal(manifest.image, '/global_map/default.png');
  assert.equal(Object.keys(manifest.rooms).length >= 10, true);
  assert.deepEqual(manifest.rooms.code_workbench.states, ['editing_files', 'self_healing']);
  assert.equal(manifest.rooms.tool_forge.furniture[0].type, 'workbench');

  applyGlobalMapManifest(manifest, { loadedFrom: 'test' });
  assert.equal(GLOBAL_MAP.loadedFrom, 'test');
  assert.equal(ROOM_LAYOUTS.clone_bay.left, 64);
  assert.deepEqual(ROOM_STATE_GROUPS.tool_forge, ['invoking_skill', 'tool_call', 'browsing', 'external_tool']);
  assert.equal(ROOM_METADATA.terminal_bay.description.includes('Shell commands'), true);
  assert.deepEqual(DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP.code_workbench[0], { x: 20, y: 24, room: 'code_workbench' });
  assert.ok(HOUSE_DOORS.some((door) => door.room === 'session_archive'));
  assert.ok(CORRIDOR_RECTS.some((rect) => rect.key === 'upper-shared-wall' && rect.right === 96));
});
