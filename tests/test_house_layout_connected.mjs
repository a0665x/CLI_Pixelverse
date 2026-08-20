import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseGlobalMapYaml } from '../public/global_map_loader.mjs';
import {
  applyGlobalMapManifest,
  CORRIDOR_RECTS,
  DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP,
  FREE_SPACE_RECTS,
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

function intersectionArea(left, right) {
  const x = Math.max(0, Math.min(left.left + left.width, right.left + right.width) - Math.max(left.left, right.left));
  const y = Math.max(0, Math.min(left.top + left.height, right.top + right.height) - Math.max(left.top, right.top));
  return x * y;
}

test('rooms use one coherent asymmetric multi-room floorplan', () => {
  assert.ok(roomRect('think_lab').left < roomRect('blueprint_lab').left);
  assert.ok(roomRect('blueprint_lab').top < roomRect('clone_bay').top);
  assert.ok(roomRect('file_library').top > roomRect('code_workbench').top);
  assert.ok(roomRect('tool_forge').top > roomRect('response_studio').top);
  assert.ok(roomRect('session_archive').width < roomRect('tool_forge').width);
  assert.ok(CORRIDOR_RECTS.length >= 5);
  assert.ok(CORRIDOR_RECTS.some((rect) => rect.key === 'offline-stub'), 'offline/signal-loss room must have a corridor branch instead of routing through a wall');
  assert.ok(roomRect('think_lab').width < roomRect('blueprint_lab').width);
  assert.ok(roomRect('file_library').width < roomRect('terminal_bay').width);
  assert.ok(roomRect('standby_dock').width >= 22);
});

test('all active rooms have doors connected to the corridor graph', () => {
  for (const [roomKey, room] of Object.entries(ROOM_LAYOUTS)) {
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
  assert.equal(ROOM_LAYOUTS.clone_bay.left, 62);
  assert.deepEqual(ROOM_STATE_GROUPS.tool_forge, ['invoking_skill', 'tool_call', 'browsing', 'external_tool']);
  assert.equal(ROOM_METADATA.terminal_bay.description.includes('Shell commands'), true);
  assert.deepEqual(DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP.code_workbench[0], { x: 20, y: 25, room: 'code_workbench', scale: 1 });
  assert.ok(HOUSE_DOORS.some((door) => door.room === 'session_archive'));
  assert.ok(CORRIDOR_RECTS.some((rect) => rect.key === 'north-gallery' && rect.right === 80));
});

test('custom global_map yaml can drive the frontend room geometry', () => {
  const yaml = readFileSync(new URL('../global_map/custom.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(yaml);
  const defaultManifest = parseGlobalMapYaml(readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8'));

  assert.equal(manifest.image, '/global_map/custom.png');
  assert.ok(manifest.corridors.length >= 4);
  assert.equal(Object.keys(manifest.rooms).length >= 10, true);

  applyGlobalMapManifest(manifest, { loadedFrom: 'custom-test' });

  assert.equal(GLOBAL_MAP.loadedFrom, 'custom-test');
  assert.equal(ROOM_LAYOUTS.think_lab.left, 3);
  assert.equal(ROOM_LAYOUTS.terminal_bay.width, 21);
  assert.ok(CORRIDOR_RECTS.some((rect) => rect.key === 'central-spine'));
  assert.ok(HOUSE_DOORS.some((door) => door.room === 'terminal_bay'));

  applyGlobalMapManifest(defaultManifest, { loadedFrom: 'test-restore' });
});

test('custom global_map has furniture and corridors do not invade room interiors', () => {
  const yaml = readFileSync(new URL('../global_map/custom.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(yaml);
  const activeRooms = Object.entries(manifest.rooms).filter(([roomKey]) => roomKey !== 'offline_corner');

  for (const [roomKey, room] of activeRooms) {
    assert.ok(room.furniture.length >= 2, `${roomKey} should define visible furniture`);
    const roomArea = room.rect.width * room.rect.height;
    for (const corridor of manifest.corridors) {
      const overlapRatio = intersectionArea(room.rect, corridor) / roomArea;
      assert.ok(overlapRatio < 0.08, `${roomKey} overlaps ${corridor.key} by ${overlapRatio}`);
    }
  }
});

test('custom global_map schema requires corridors, doors, and furniture footprints', () => {
  assert.throws(() => applyGlobalMapManifest({
    key: 'invalid-no-corridors',
    rooms: {
      think_lab: {
        rect: { left: 4, top: 4, width: 20, height: 20 },
        center: { x: 14, y: 14 },
        portal: { x: 14, y: 24 },
        aisle: { x: 14, y: 20 },
        hub: { x: 14, y: 28 },
        furniture: [{ type: 'desk', x: 50, y: 50, w: 6, h: 4, scale: 1 }],
      },
    },
  }), /corridors/i);

  assert.throws(() => applyGlobalMapManifest({
    key: 'invalid-furniture-footprint',
    corridors: [{ key: 'hall', left: 10, top: 24, width: 20, height: 6 }],
    rooms: {
      think_lab: {
        rect: { left: 4, top: 4, width: 20, height: 20 },
        center: { x: 14, y: 14 },
        portal: { x: 14, y: 24 },
        aisle: { x: 14, y: 20 },
        hub: { x: 14, y: 27 },
        furniture: [{ type: 'desk', x: 50, y: 50 }],
      },
    },
  }), /furniture.*w.*h/i);
});

test('global_map validator rejects isolated rooms and exposes free-space masks', () => {
  const manifest = parseGlobalMapYaml(readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8'));
  assert.throws(() => applyGlobalMapManifest({
    ...manifest,
    corridors: [
      ...manifest.corridors,
      { key: 'isolated-png-room-stub', left: 2, top: 96, width: 3, height: 3 },
    ],
  }), /corridor graph|not connected|isolated/i);

  applyGlobalMapManifest({
    ...manifest,
    free_space: [{ key: 'terminal-walkable-only', left: 64, top: 42, width: 30, height: 24 }],
  }, { loadedFrom: 'free-space-test' });
  assert.deepEqual(FREE_SPACE_RECTS[0], {
    key: 'terminal-walkable-only',
    left: 64,
    top: 42,
    width: 30,
    height: 24,
    right: 94,
    bottom: 66,
  });

  applyGlobalMapManifest(manifest, { loadedFrom: 'test-restore' });
});
