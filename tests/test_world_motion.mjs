import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM_ANCHORS, buildRoute, movementDurationMs, patrolPoint, pointsToSvg, routeStaysWalkable, shouldPatrol, routeUsesDoorThresholds } from '../public/world_motion.mjs';

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

test('buildRoute keeps same-room routes compact', () => {
  const route = buildRoute({ x: 20, y: 20 }, { x: 24, y: 26 }, 'think_lab', 'think_lab');
  assert.deepEqual(route, [{ x: 20, y: 20 }, { x: 24, y: 26 }]);
});

test('buildRoute uses an aisle lane and orthogonal segments for longer same-room travel', () => {
  const route = buildRoute({ x: 35, y: 18 }, { x: 50, y: 38 }, 'blueprint_lab', 'blueprint_lab');
  assert.ok(route.length >= 3);
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.blueprint_lab.aisle.x && point.y === ROOM_ANCHORS.blueprint_lab.aisle.y));
  assert.equal(routeStaysWalkable(route), true);
  for (let i = 1; i < route.length; i += 1) {
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  }
});

test('buildRoute adds corridor waypoints across rooms', () => {
  const route = buildRoute({ x: 18, y: 68 }, { x: 44, y: 22 }, 'standby_dock', 'blueprint_lab');
  assert.ok(route.length >= 6);
  assert.ok(Math.abs(route[0].x - 18) <= 1);
  assert.ok(Math.abs(route.at(-1).y - 22) <= 4);
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.standby_dock.hub.x && point.y === ROOM_ANCHORS.standby_dock.hub.y));
  assert.ok(route.some((point) => point.x === ROOM_ANCHORS.blueprint_lab.hub.x && point.y === ROOM_ANCHORS.blueprint_lab.hub.y));
  assert.equal(routeUsesDoorThresholds(route, 'standby_dock', 'blueprint_lab'), true);
  assert.equal(routeStaysWalkable(route), true);
});

test('buildRoute can connect clone bay to archive through the shared house corridor', () => {
  const route = buildRoute({ x: 81, y: 23 }, { x: 84, y: 68 }, 'clone_bay', 'session_archive');
  assert.ok(route.length >= 8);
  assert.equal(routeUsesDoorThresholds(route, 'clone_bay', 'session_archive'), true);
  assert.equal(routeStaysWalkable(route), true);
  for (let i = 1; i < route.length; i += 1) {
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  }
});

test('cross-room routes enter and leave rooms through their door thresholds', () => {
  const route = buildRoute({ x: 13, y: 18 }, { x: 67, y: 72 }, 'think_lab', 'tool_forge');
  assert.equal(routeUsesDoorThresholds(route, 'think_lab', 'tool_forge'), true);
  assert.equal(routeStaysWalkable(route), true);
  assert.ok(pointIndex(route, ROOM_ANCHORS.think_lab.portal) < pointIndex(route, ROOM_ANCHORS.tool_forge.portal));
});

test('test-hook routes approach every door from the front on outbound and return legs', () => {
  const startRoom = 'think_lab';
  const returnRoom = 'standby_dock';
  const rooms = ['blueprint_lab', 'tool_forge', 'response_studio', 'clone_bay', 'session_archive'];
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
