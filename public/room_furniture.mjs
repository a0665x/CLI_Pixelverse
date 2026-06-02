import { ROOM_LAYOUTS } from './house_layout.mjs';

export const DEFAULT_ROOM_PROP_POSITIONS = {
  think_lab: [
    { x: 18, y: 16 },
    { x: 14, y: 46 },
    { x: 30, y: 62 },
    { x: 30, y: 78 },
    { x: 84, y: 58 },
    { x: 72, y: 18 },
    { x: 84, y: 76 },
  ],
  blueprint_lab: [
    { x: 18, y: 18 },
    { x: 50, y: 36 },
    { x: 72, y: 62 },
    { x: 16, y: 64 },
    { x: 82, y: 28 },
    { x: 50, y: 16 },
    { x: 18, y: 28 },
    { x: 50, y: 78 },
  ],
  tool_forge: [
    { x: 20, y: 24 },
    { x: 42, y: 74 },
    { x: 76, y: 30 },
    { x: 20, y: 74 },
    { x: 82, y: 68 },
    { x: 82, y: 48 },
    { x: 48, y: 36 },
  ],
  response_studio: [
    { x: 18, y: 18 },
    { x: 26, y: 32 },
    { x: 30, y: 72 },
    { x: 78, y: 34 },
    { x: 50, y: 76 },
    { x: 72, y: 72 },
    { x: 84, y: 22 },
  ],
  standby_dock: [
    { x: 22, y: 58 },
    { x: 62, y: 46 },
    { x: 80, y: 64 },
    { x: 86, y: 24 },
    { x: 78, y: 82 },
    { x: 24, y: 30 },
    { x: 16, y: 26 },
  ],
  clone_bay: [
    { x: 20, y: 28 },
    { x: 30, y: 70 },
    { x: 50, y: 28 },
    { x: 16, y: 70 },
    { x: 78, y: 62 },
    { x: 78, y: 24 },
  ],
  session_archive: [
    { x: 18, y: 42 },
    { x: 78, y: 70 },
    { x: 80, y: 34 },
    { x: 50, y: 60 },
    { x: 50, y: 25 },
    { x: 50, y: 78 },
  ],
};

export const ROOM_PROP_POSITIONS = DEFAULT_ROOM_PROP_POSITIONS;

let roomPropOverrides = {};

export const VISIBLE_PROP_TYPES = new Set([
  'bed',
  'board',
  'bookshelf',
  'cabinet',
  'chair',
  'coffee',
  'desk',
  'locker',
  'portal',
  'server',
  'sofa',
  'table',
  'terminal',
  'workbench',
]);

const PROP_BLOCKER_SIZE = {
  bed: { width: 7.4, height: 5.8 },
  board: { width: 5.8, height: 2.6 },
  bookshelf: { width: 5.8, height: 4.8 },
  cabinet: { width: 4.8, height: 4.8 },
  chair: { width: 3.4, height: 3.2 },
  coffee: { width: 3.8, height: 3.2 },
  desk: { width: 6.4, height: 4.6 },
  locker: { width: 4.8, height: 4.8 },
  portal: { width: 5.2, height: 5.2 },
  server: { width: 5.6, height: 4.8 },
  sofa: { width: 7.2, height: 4.8 },
  table: { width: 6.8, height: 4.8 },
  terminal: { width: 5.2, height: 4.2 },
  workbench: { width: 6.8, height: 4.8 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFurnitureRoom(roomKey) {
  return !!ROOM_LAYOUTS[roomKey] && roomKey !== 'offline_corner';
}

function sanitizePosition(pos = {}, fallback = { x: 50, y: 50 }, originRoomKey = 'standby_dock') {
  return {
    x: Number(clamp(Number.isFinite(Number(pos.x)) ? Number(pos.x) : fallback.x, 6, 94).toFixed(2)),
    y: Number(clamp(Number.isFinite(Number(pos.y)) ? Number(pos.y) : fallback.y, 6, 94).toFixed(2)),
    room: isFurnitureRoom(pos.room) ? pos.room : originRoomKey,
  };
}

export function setFurnitureLayoutOverrides(overrides = {}) {
  const next = {};
  Object.entries(overrides || {}).forEach(([roomKey, positions]) => {
    if (!ROOM_LAYOUTS[roomKey] || roomKey === 'offline_corner' || !Array.isArray(positions)) return;
    const defaults = DEFAULT_ROOM_PROP_POSITIONS[roomKey] || [];
    next[roomKey] = positions.map((pos, index) => sanitizePosition(pos, defaults[index] || { x: 50, y: 50 }, roomKey));
  });
  roomPropOverrides = next;
  return getFurnitureLayoutOverrides();
}

export function resetFurnitureLayoutOverrides() {
  roomPropOverrides = {};
}

export function getFurnitureLayoutOverrides() {
  return JSON.parse(JSON.stringify(roomPropOverrides));
}

export function getRoomPropPositions(roomKey) {
  const defaults = DEFAULT_ROOM_PROP_POSITIONS[roomKey] || [];
  const overrides = roomPropOverrides[roomKey] || [];
  return defaults.map((fallback, index) => sanitizePosition(overrides[index], fallback, roomKey));
}

export function exportFurnitureLayout(roomKeys = Object.keys(DEFAULT_ROOM_PROP_POSITIONS)) {
  return Object.fromEntries(roomKeys.map((roomKey) => [roomKey, getRoomPropPositions(roomKey)]));
}

export function roomLocalToWorld(roomKey, local = { x: 50, y: 50 }) {
  const rect = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return {
    x: Number((rect.left + (rect.width * local.x / 100)).toFixed(2)),
    y: Number((rect.top + (rect.height * local.y / 100)).toFixed(2)),
  };
}

export function propBlockerSize(propType = '') {
  return PROP_BLOCKER_SIZE[propType] || { width: 4.6, height: 3.8 };
}

export function roomDecorLayout(roomKey, decor = [], decorByRoom = null) {
  const sources = decorByRoom
    ? Object.entries(decorByRoom)
    : [[roomKey, decor]];
  return sources
    .flatMap(([originRoomKey, sourceDecor]) => {
      const positions = getRoomPropPositions(originRoomKey);
      return sourceDecor.map((prop, index) => ({
        prop,
        pos: positions[index] || { x: 50, y: 50, room: originRoomKey },
        index,
        originRoomKey,
      }));
    })
    .filter((item) => item.pos.room === roomKey)
    .filter((item) => VISIBLE_PROP_TYPES.has(item.prop.type));
}

export function furnitureBlockers(roomKey, decor = [], decorByRoom = null) {
  return roomDecorLayout(roomKey, decor, decorByRoom).map(({ prop, pos, index, originRoomKey }) => {
    const center = roomLocalToWorld(roomKey, pos);
    const size = propBlockerSize(prop.type);
    return {
      key: `${originRoomKey}:${index}:${prop.type}`,
      roomKey,
      originRoomKey,
      prop,
      index,
      center,
      width: size.width,
      height: size.height,
      left: Number((center.x - size.width / 2).toFixed(2)),
      right: Number((center.x + size.width / 2).toFixed(2)),
      top: Number((center.y - size.height / 2).toFixed(2)),
      bottom: Number((center.y + size.height / 2).toFixed(2)),
    };
  });
}

export function allFurnitureBlockers(decorByRoom = {}) {
  return Object.keys(ROOM_LAYOUTS)
    .filter((roomKey) => roomKey !== 'offline_corner')
    .flatMap((roomKey) => furnitureBlockers(roomKey, decorByRoom[roomKey] || [], decorByRoom));
}

function blockersOverlap(left, right, padding = 0.35) {
  return left.left < right.right + padding
    && left.right > right.left - padding
    && left.top < right.bottom + padding
    && left.bottom > right.top - padding;
}

function blockerForPosition(roomKey, prop, index, pos) {
  const center = roomLocalToWorld(roomKey, pos);
  const size = propBlockerSize(prop.type);
  return {
    key: `${roomKey}:${index}:${prop.type}`,
    roomKey,
    prop,
    index,
    center,
    width: size.width,
    height: size.height,
    left: Number((center.x - size.width / 2).toFixed(2)),
    right: Number((center.x + size.width / 2).toFixed(2)),
    top: Number((center.y - size.height / 2).toFixed(2)),
    bottom: Number((center.y + size.height / 2).toFixed(2)),
  };
}

export function positionOverlapsFurniture(roomKey, decor = [], movingIndex, candidate, positions = getRoomPropPositions(roomKey), options = {}) {
  const originRoomKey = options.originRoomKey || roomKey;
  const decorByRoom = options.decorByRoom || null;
  const sourceDecor = decorByRoom?.[originRoomKey] || decor;
  const prop = sourceDecor[movingIndex];
  if (!prop || !VISIBLE_PROP_TYPES.has(prop.type)) return false;
  const moving = blockerForPosition(roomKey, prop, movingIndex, candidate);
  return roomDecorLayout(roomKey, decor, decorByRoom).some(({ prop: other, pos, index, originRoomKey: otherOriginRoomKey }) => {
    if ((otherOriginRoomKey || roomKey) === originRoomKey && index === movingIndex) return false;
    if (!pos) return false;
    return blockersOverlap(moving, blockerForPosition(roomKey, other, index, pos));
  });
}

export function isInsideFurnitureBlocker(candidate, blockers = [], padding = 0.15) {
  return blockers.some((blocker) => (
    candidate.x >= blocker.left - padding
    && candidate.x <= blocker.right + padding
    && candidate.y >= blocker.top - padding
    && candidate.y <= blocker.bottom + padding
  ));
}

function roomInnerRect(roomKey, inset = 2.2) {
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return {
    left: room.left + inset,
    right: room.left + room.width - inset,
    top: room.top + inset,
    bottom: room.top + room.height - inset,
  };
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function interactionStandPoint(roomKey, propType, propCenter, blockers = []) {
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  const size = propBlockerSize(propType);
  const gap = 2.1;
  const candidates = [
    { x: propCenter.x, y: propCenter.y + size.height / 2 + gap },
    { x: propCenter.x, y: propCenter.y - size.height / 2 - gap },
    { x: propCenter.x - size.width / 2 - gap, y: propCenter.y },
    { x: propCenter.x + size.width / 2 + gap, y: propCenter.y },
  ];
  const inner = roomInnerRect(roomKey);
  const target = candidates
    .map((candidate) => ({
      x: Number(clamp(candidate.x, inner.left, inner.right).toFixed(2)),
      y: Number(clamp(candidate.y, inner.top, inner.bottom).toFixed(2)),
    }))
    .filter((candidate) => pointInRect(candidate, inner))
    .filter((candidate) => !isInsideFurnitureBlocker(candidate, blockers, 0.5))
    .sort((a, b) => {
      const aScore = Math.hypot(a.x - room.aisle.x, a.y - room.aisle.y);
      const bScore = Math.hypot(b.x - room.aisle.x, b.y - room.aisle.y);
      return aScore - bScore;
    })[0];
  return target || {
    x: Number(room.aisle.x.toFixed(2)),
    y: Number(room.aisle.y.toFixed(2)),
  };
}

export function roomInteractionPositions(roomKey, decor = [], decorByRoom = null) {
  const blockers = furnitureBlockers(roomKey, decor, decorByRoom);
  return roomDecorLayout(roomKey, decor, decorByRoom).map(({ prop, pos, index }) => {
    const propCenter = roomLocalToWorld(roomKey, pos);
    return {
      ...interactionStandPoint(roomKey, prop.type, propCenter, blockers),
      propCenter,
      index,
      propType: prop.type,
    };
  });
}
