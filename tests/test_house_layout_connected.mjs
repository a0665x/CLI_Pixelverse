import test from 'node:test';
import assert from 'node:assert/strict';

import { CORRIDOR_RECTS, HOUSE_DOORS, ROOM_LAYOUTS, roomRect } from '../public/house_layout.mjs';

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
  assert.equal(roomRect('standby_dock').top, roomRect('response_studio').top);
  assert.equal(roomRect('response_studio').top, roomRect('tool_forge').top);
  assert.equal(roomRect('tool_forge').top, roomRect('session_archive').top);
  assert.equal(CORRIDOR_RECTS.length, 1);
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
