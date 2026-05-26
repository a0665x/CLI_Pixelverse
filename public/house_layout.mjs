export const CORRIDOR_BAND = { left: 6, right: 94, top: 44, bottom: 56 };

export const CORRIDOR_RECTS = [
  { key: 'main-lobby', left: 6, right: 94, top: 44, bottom: 56 },
];

export const ROOM_LAYOUTS = {
  think_lab: {
    left: 6, top: 10, width: 24, height: 34,
    center: { x: 18, y: 27 },
    portal: { x: 18, y: 44 },
    aisle: { x: 18, y: 36 },
    hub: { x: 18, y: 50 },
    patrol: [{ x: 13, y: 20 }, { x: 24, y: 22 }, { x: 18, y: 36 }],
  },
  blueprint_lab: {
    left: 30, top: 10, width: 28, height: 34,
    center: { x: 44, y: 27 },
    portal: { x: 44, y: 44 },
    aisle: { x: 44, y: 36 },
    hub: { x: 44, y: 50 },
    patrol: [{ x: 36, y: 20 }, { x: 52, y: 20 }, { x: 44, y: 36 }],
  },
  clone_bay: {
    left: 58, top: 10, width: 36, height: 34,
    center: { x: 76, y: 27 },
    portal: { x: 76, y: 44 },
    aisle: { x: 76, y: 36 },
    hub: { x: 76, y: 50 },
    patrol: [{ x: 66, y: 22 }, { x: 86, y: 22 }, { x: 76, y: 36 }],
  },
  standby_dock: {
    left: 6, top: 56, width: 24, height: 32,
    center: { x: 18, y: 72 },
    portal: { x: 18, y: 56 },
    aisle: { x: 18, y: 64 },
    hub: { x: 18, y: 50 },
    patrol: [{ x: 13, y: 76 }, { x: 18, y: 64 }, { x: 25, y: 76 }],
  },
  response_studio: {
    left: 30, top: 56, width: 24, height: 32,
    center: { x: 42, y: 72 },
    portal: { x: 42, y: 56 },
    aisle: { x: 42, y: 64 },
    hub: { x: 42, y: 50 },
    patrol: [{ x: 36, y: 76 }, { x: 42, y: 64 }, { x: 49, y: 76 }],
  },
  tool_forge: {
    left: 54, top: 56, width: 20, height: 32,
    center: { x: 64, y: 72 },
    portal: { x: 64, y: 56 },
    aisle: { x: 64, y: 64 },
    hub: { x: 64, y: 50 },
    patrol: [{ x: 59, y: 76 }, { x: 64, y: 64 }, { x: 70, y: 76 }],
  },
  session_archive: {
    left: 74, top: 56, width: 20, height: 32,
    center: { x: 84, y: 72 },
    portal: { x: 84, y: 56 },
    aisle: { x: 84, y: 64 },
    hub: { x: 84, y: 50 },
    patrol: [{ x: 79, y: 76 }, { x: 84, y: 64 }, { x: 90, y: 76 }],
  },
  offline_corner: {
    left: 4, top: 86, width: 10, height: 8,
    center: { x: 9, y: 90 },
    portal: { x: 9, y: 86 },
    aisle: { x: 9, y: 88 },
    hub: { x: 9, y: 83 },
    patrol: [{ x: 9, y: 90 }],
  },
};

export function roomRect(roomKey) {
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return { left: room.left, top: room.top, width: room.width, height: room.height };
}

const DOOR_SIZE = { width: 5.4, height: 1.1 };

export const HOUSE_DOORS = Object.entries(ROOM_LAYOUTS)
  .filter(([roomKey]) => roomKey !== 'offline_corner')
  .map(([roomKey, room]) => ({
    room: roomKey,
    left: Number((room.portal.x - DOOR_SIZE.width / 2).toFixed(2)),
    top: Number((room.portal.y - DOOR_SIZE.height / 2).toFixed(2)),
    width: DOOR_SIZE.width,
    height: DOOR_SIZE.height,
    side: room.portal.y <= room.top ? 'top' : 'bottom',
  }));
