import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyGlobalMapManifest } from '../public/house_layout.mjs';
import { parseGlobalMapYaml } from '../public/global_map_loader.mjs';
import { ROOM_ANCHORS, buildRoute, isWalkable, movementDurationMs, patrolPoint, pointsToSvg, refreshRoomAnchors, routeStaysWalkable, segmentStaysWalkable, shouldPatrol, routeUsesDoorThresholds } from '../public/world_motion.mjs';

function pointIndex(route, target) {
  return route.findIndex((item) => item.x === target.x && item.y === target.y);
}

function assertDoorApproach(route, roomKey, direction) {
  const anchor = ROOM_ANCHORS[roomKey];
  const aisle = pointIndex(route, anchor.aisle);
  const portal = pointIndex(route, anchor.portal);
  const hub = pointIndex(route, anchor.hub);
  assert.ok(aisle >= 0, `${roomKey} route should include room-side door front`);
  assert.ok(portal >= 0, `${roomKey} route should include door portal`);
  assert.ok(hub >= 0, `${roomKey} route should include corridor-side door front`);
  if (direction === 'exit') assert.ok(aisle < portal && portal < hub, `${roomKey} exit should be aisle -> portal -> hub`);
  if (direction === 'enter') assert.ok(hub < portal && portal < aisle, `${roomKey} entry should be hub -> portal -> aisle`);
}

test('buildRoute keeps an unobstructed short same-room route compact', () => {
  const route = buildRoute({ x: 18, y: 18 }, { x: 20, y: 20 }, 'think_lab', 'think_lab');
  assert.deepEqual(route, [{ x: 18, y: 18 }, { x: 20, y: 20 }]);
});

test('buildRoute uses an aisle lane and orthogonal segments for longer same-room travel', () => {
  const route = buildRoute({ x: 36, y: 12 }, { x: 52, y: 24 }, 'blueprint_lab', 'blueprint_lab');
  assert.ok(route.length >= 3);
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.blueprint_lab.aisle.x && point.y === ROOM_ANCHORS.blueprint_lab.aisle.y));
  assert.equal(routeStaysWalkable(route), true);
  for (let i = 1; i < route.length; i += 1) {
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  }
});

test('buildRoute adds corridor waypoints across rooms', () => {
  const route = buildRoute({ x: 16, y: 86 }, { x: 44, y: 22 }, 'standby_dock', 'blueprint_lab');
  assert.ok(route.length >= 6);
  assert.ok(Math.abs(route[0].x - 16) <= 1);
  assert.ok(Math.abs(route.at(-1).y - 22) <= 4);
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.standby_dock.hub.x && point.y === ROOM_ANCHORS.standby_dock.hub.y));
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.blueprint_lab.hub.x && point.y === ROOM_ANCHORS.blueprint_lab.hub.y));
  assert.equal(routeUsesDoorThresholds(route, 'standby_dock', 'blueprint_lab'), true);
  assert.equal(routeStaysWalkable(route), true);
});

test('buildRoute can connect clone bay to archive through the shared house corridor', () => {
  const route = buildRoute({ x: 81, y: 23 }, { x: 88, y: 82 }, 'clone_bay', 'session_archive');
  assert.ok(route.length >= 8);
  assert.equal(routeUsesDoorThresholds(route, 'clone_bay', 'session_archive'), true);
  assert.equal(routeStaysWalkable(route), true);
  for (let i = 1; i < route.length; i += 1) {
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  }
});

test('cross-room routes enter and leave rooms through their door thresholds', () => {
  const route = buildRoute({ x: 13, y: 18 }, { x: 67, y: 83 }, 'think_lab', 'tool_forge');
  assert.equal(routeUsesDoorThresholds(route, 'think_lab', 'tool_forge'), true);
  assert.equal(routeStaysWalkable(route), true);
  assert.ok(pointIndex(route, ROOM_ANCHORS.think_lab.portal) < pointIndex(route, ROOM_ANCHORS.tool_forge.portal));
});

test('wall validator rejects direct cross-room wall cuts outside doors', () => {
  assert.equal(segmentStaysWalkable({ x: 24, y: 20 }, { x: 24, y: 48 }), false);
  assert.equal(routeStaysWalkable([
    { x: 24, y: 20 },
    { x: 24, y: 34 },
    { x: 24, y: 48 },
  ]), false);
  assert.equal(segmentStaysWalkable(ROOM_ANCHORS.think_lab.portal, ROOM_ANCHORS.think_lab.hub), true);
});

test('door layer switching is limited to the visual door opening', () => {
  assert.equal(segmentStaysWalkable(
    { x: ROOM_ANCHORS.think_lab.portal.x + 2, y: ROOM_ANCHORS.think_lab.portal.y - 2 },
    ROOM_ANCHORS.think_lab.hub,
  ), false);
  assert.equal(segmentStaysWalkable(
    { x: ROOM_ANCHORS.file_library.portal.x + 2, y: ROOM_ANCHORS.file_library.portal.y + 2 },
    ROOM_ANCHORS.file_library.hub,
  ), false);
  assert.equal(segmentStaysWalkable(ROOM_ANCHORS.think_lab.portal, ROOM_ANCHORS.think_lab.hub), true);
  assert.equal(segmentStaysWalkable(ROOM_ANCHORS.file_library.portal, ROOM_ANCHORS.file_library.hub), true);
});

test('test-hook routes approach every door from the front on outbound and return legs', () => {
  const startRoom = 'think_lab';
  const returnRoom = 'standby_dock';
  const rooms = ['blueprint_lab', 'file_library', 'code_workbench', 'terminal_bay', 'tool_forge', 'response_studio', 'clone_bay', 'session_archive'];
  for (const roomKey of rooms) {
    const outbound = buildRoute(ROOM_ANCHORS[startRoom], ROOM_ANCHORS[roomKey], startRoom, roomKey);
    assertDoorApproach(outbound, startRoom, 'exit');
    assertDoorApproach(outbound, roomKey, 'enter');
    assert.equal(routeStaysWalkable(outbound), true);

    const inbound = buildRoute(ROOM_ANCHORS[roomKey], ROOM_ANCHORS[returnRoom], roomKey, returnRoom);
    assertDoorApproach(inbound, roomKey, 'exit');
    assertDoorApproach(inbound, returnRoom, 'enter');
    assert.equal(routeStaysWalkable(inbound), true);
  }
});

test('movementDurationMs is longer for longer routes', () => {
  const short = movementDurationMs([{ x: 10, y: 10 }, { x: 12, y: 12 }], 'thinking');
  const long = movementDurationMs([{ x: 10, y: 10 }, { x: 30, y: 30 }, { x: 50, y: 50 }], 'thinking');
  assert.ok(long > short);
});

test('patrolPoint and shouldPatrol support active room loops', () => {
  const point = patrolPoint('blueprint_lab', 2);
  assert.equal(typeof point.x, 'number');
  assert.equal(shouldPatrol('planning'), true);
  assert.equal(shouldPatrol('idle'), false);
});

test('pointsToSvg converts percentages into svg coordinates', () => {
  const output = pointsToSvg([{ x: 10, y: 20 }, { x: 50, y: 60 }]);
  assert.equal(output, '10,20 50,60');
});

test('buildRoute fails closed instead of drawing a wall-cut fallback when corridors are disconnected', () => {
  const yaml = readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(yaml);
  const disconnected = {
    ...manifest,
    corridors: Object.entries(manifest.rooms)
      .filter(([roomKey]) => roomKey !== 'offline_corner')
      .map(([roomKey, room]) => {
        const minY = Math.min(room.portal.y, room.hub.y);
        return {
          key: `${roomKey}-door-stub`,
          left: room.hub.x - 3,
          top: minY - 1,
          width: 6,
          height: Math.abs(room.portal.y - room.hub.y) + 2,
        };
      }),
  };
  assert.throws(() => applyGlobalMapManifest(disconnected), /corridor graph|not connected|isolated/i);
  applyGlobalMapManifest(manifest, { loadedFrom: 'test-restore' });
});

test('room anchors resync after applying a new global map manifest', () => {
  const yaml = readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(yaml);
  const shifted = {
    ...manifest,
    rooms: {
      ...manifest.rooms,
      think_lab: {
        ...manifest.rooms.think_lab,
        center: { x: 18, y: 19 },
        portal: { x: 18, y: 34 },
        aisle: { x: 18, y: 28 },
        hub: { x: 18, y: 37 },
      },
    },
  };

  applyGlobalMapManifest(shifted, { loadedFrom: 'test-shifted' });
  const route = buildRoute({ x: 18, y: 19 }, { x: 44, y: 22 }, 'think_lab', 'blueprint_lab');
  assert.equal(ROOM_ANCHORS.think_lab.portal.x, 18);
  assert.ok(route.some((point) => point.x === 18 && point.y === 34));
  assert.equal(routeStaysWalkable(route), true);

  applyGlobalMapManifest(manifest, { loadedFrom: 'test-restore' });
});

test('custom floorplan routes through doors instead of crossing walls', () => {
  const customYaml = readFileSync(new URL('../global_map/custom.yaml', import.meta.url), 'utf8');
  const custom = parseGlobalMapYaml(customYaml);
  const defaultYaml = readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8');
  const fallback = parseGlobalMapYaml(defaultYaml);

  applyGlobalMapManifest(custom, { loadedFrom: 'custom-route-test' });
  refreshRoomAnchors();
  const route = buildRoute(
    { x: ROOM_ANCHORS.terminal_bay.x, y: ROOM_ANCHORS.terminal_bay.y },
    { x: ROOM_ANCHORS.response_studio.x, y: ROOM_ANCHORS.response_studio.y },
    'terminal_bay',
    'response_studio',
  );

  assert.ok(route.length > 1);
  assert.equal(routeUsesDoorThresholds(route, 'terminal_bay', 'response_studio'), true);
  assert.equal(routeStaysWalkable(route), true);
  assert.ok(route.some((item) => item.x === ROOM_ANCHORS.terminal_bay.hub.x && item.y === ROOM_ANCHORS.terminal_bay.hub.y));
  assert.ok(route.some((item) => item.x === ROOM_ANCHORS.response_studio.hub.x && item.y === ROOM_ANCHORS.response_studio.hub.y));

  applyGlobalMapManifest(fallback, { loadedFrom: 'test-restore' });
  refreshRoomAnchors();
});

test('explicit global_map blocked masks remove PNG/YAML wall pixels from walkability', () => {
  const defaultYaml = readFileSync(new URL('../global_map/default.yaml', import.meta.url), 'utf8');
  const fallback = parseGlobalMapYaml(defaultYaml);
  const blockedPoint = { x: 79, y: 54 };

  applyGlobalMapManifest({
    ...fallback,
    blocked: [{ key: 'terminal-center-wall-from-png', left: 77, top: 52, width: 5, height: 5 }],
  }, { loadedFrom: 'blocked-mask-test' });
  refreshRoomAnchors();

  assert.equal(isWalkable(blockedPoint), false);
  assert.equal(routeStaysWalkable([ROOM_ANCHORS.terminal_bay.aisle, blockedPoint]), false);

  applyGlobalMapManifest(fallback, { loadedFrom: 'test-restore' });
  refreshRoomAnchors();
});
