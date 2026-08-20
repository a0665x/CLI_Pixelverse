import { DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP, ROOM_LAYOUTS } from './house_layout.mjs';

export const DEFAULT_ROOM_PROP_POSITIONS = {
  think_lab: [
    { x: 20, y: 16, scale: 1.12 },
    { x: 16, y: 42, scale: 1 },
    { x: 32, y: 62, scale: 0.95 },
    { x: 34, y: 78, scale: 1 },
    { x: 78, y: 58, scale: 0.95 },
    { x: 70, y: 20, scale: 1 },
    { x: 84, y: 78, scale: 0.85 },
  ],
  blueprint_lab: [
    { x: 18, y: 18, scale: 1.08 },
    { x: 50, y: 36, scale: 1 },
    { x: 72, y: 62, scale: 0.95 },
    { x: 18, y: 68, scale: 0.9 },
    { x: 82, y: 30, scale: 0.9 },
    { x: 52, y: 16, scale: 0.92 },
    { x: 22, y: 32, scale: 0.9 },
    { x: 54, y: 78, scale: 0.85 },
  ],
  file_library: [
    { x: 28, y: 18, scale: 1 },
    { x: 76, y: 22, scale: 1 },
    { x: 24, y: 76, scale: 0.9 },
    { x: 54, y: 42, scale: 0.95 },
    { x: 78, y: 72, scale: 0.92 },
  ],
  code_workbench: [
    { x: 20, y: 25, scale: 1 },
    { x: 74, y: 24, scale: 1 },
    { x: 26, y: 74, scale: 0.9 },
    { x: 52, y: 50, scale: 0.95 },
    { x: 82, y: 70, scale: 0.9 },
  ],
  terminal_bay: [
    { x: 18, y: 26, scale: 1 },
    { x: 70, y: 24, scale: 1 },
    { x: 24, y: 74, scale: 0.9 },
    { x: 78, y: 72, scale: 0.95 },
    { x: 50, y: 48, scale: 0.95 },
  ],
  tool_forge: [
    { x: 22, y: 24, scale: 1 },
    { x: 42, y: 76, scale: 0.9 },
    { x: 76, y: 30, scale: 0.95 },
    { x: 20, y: 76, scale: 0.85 },
    { x: 82, y: 68, scale: 0.86 },
    { x: 82, y: 50, scale: 0.92 },
    { x: 48, y: 38, scale: 0.9 },
  ],
  response_studio: [
    { x: 20, y: 20, scale: 0.95 },
    { x: 14, y: 34, scale: 0.85 },
    { x: 16, y: 78, scale: 0.9 },
    { x: 88, y: 34, scale: 0.9 },
    { x: 52, y: 78, scale: 0.92 },
    { x: 86, y: 72, scale: 0.9 },
    { x: 82, y: 22, scale: 0.82 },
  ],
  standby_dock: [
    { x: 22, y: 54, scale: 0.95 },
    { x: 62, y: 46, scale: 0.82 },
    { x: 76, y: 66, scale: 1 },
    { x: 84, y: 26, scale: 0.9 },
    { x: 72, y: 84, scale: 0.85 },
    { x: 26, y: 30, scale: 0.85 },
    { x: 16, y: 26, scale: 0.86 },
  ],
  clone_bay: [
    { x: 20, y: 30, scale: 1 },
    { x: 32, y: 72, scale: 0.95 },
    { x: 52, y: 28, scale: 0.95 },
    { x: 18, y: 72, scale: 0.9 },
    { x: 78, y: 64, scale: 0.95 },
    { x: 78, y: 24, scale: 0.95 },
  ],
  session_archive: [
    { x: 20, y: 42, scale: 0.9 },
    { x: 78, y: 70, scale: 0.82 },
    { x: 80, y: 34, scale: 0.85 },
    { x: 50, y: 60, scale: 0.82 },
    { x: 50, y: 25, scale: 0.85 },
    { x: 50, y: 80, scale: 0.75 },
  ],
};

export const ROOM_PROP_POSITIONS = DEFAULT_ROOM_PROP_POSITIONS;
export const FURNITURE_SIZE_MULTIPLIER = 0.7;

function defaultRoomPropPositions(roomKey) {
  return DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP[roomKey]?.length
    ? DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP[roomKey]
    : (DEFAULT_ROOM_PROP_POSITIONS[roomKey] || []);
}

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
  'lamp',
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
    scale: Number(clamp(Number.isFinite(Number(pos.scale)) ? Number(pos.scale) : Number(fallback.scale || 1), 0.55, 1.8).toFixed(2)),
  };
}

export function setFurnitureLayoutOverrides(overrides = {}) {
  const next = {};
  Object.entries(overrides || {}).forEach(([roomKey, positions]) => {
    if (!ROOM_LAYOUTS[roomKey] || roomKey === 'offline_corner' || !Array.isArray(positions)) return;
    const defaults = defaultRoomPropPositions(roomKey);
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
  const defaults = defaultRoomPropPositions(roomKey);
  const overrides = roomPropOverrides[roomKey] || [];
  return defaults.map((fallback, index) => sanitizePosition(overrides[index], fallback, roomKey));
}

export function exportFurnitureLayout(roomKeys = Object.keys(ROOM_LAYOUTS).filter((roomKey) => roomKey !== 'offline_corner')) {
  return Object.fromEntries(roomKeys.map((roomKey) => [roomKey, getRoomPropPositions(roomKey)]));
}

export function roomLocalToWorld(roomKey, local = { x: 50, y: 50 }) {
  const rect = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return {
    x: Number((rect.left + (rect.width * local.x / 100)).toFixed(2)),
    y: Number((rect.top + (rect.height * local.y / 100)).toFixed(2)),
  };
}

export function propBlockerSize(propType = '', prop = {}, pos = {}) {
  const fallback = PROP_BLOCKER_SIZE[propType] || { width: 4.6, height: 3.8 };
  const footprint = prop.footprint || {};
  const baseWidth = Number.isFinite(Number(footprint.w)) ? Number(footprint.w) : Number.isFinite(Number(footprint.width)) ? Number(footprint.width) : Number.isFinite(Number(prop.w)) ? Number(prop.w) : Number.isFinite(Number(prop.width)) ? Number(prop.width) : fallback.width;
  const baseHeight = Number.isFinite(Number(footprint.h)) ? Number(footprint.h) : Number.isFinite(Number(footprint.height)) ? Number(footprint.height) : Number.isFinite(Number(prop.h)) ? Number(prop.h) : Number.isFinite(Number(prop.height)) ? Number(prop.height) : fallback.height;
  const scale = Number.isFinite(Number(pos.scale)) ? Number(pos.scale) : Number.isFinite(Number(prop.scale)) ? Number(prop.scale) : 1;
  const renderedScale = clamp(scale, 0.55, 1.8) * FURNITURE_SIZE_MULTIPLIER;
  return {
    width: Number((baseWidth * renderedScale).toFixed(2)),
    height: Number((baseHeight * renderedScale).toFixed(2)),
    scale: Number(renderedScale.toFixed(2)),
  };
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
    const size = propBlockerSize(prop.type, prop, pos);
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
  const size = propBlockerSize(prop.type, prop, pos);
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

export function interactionStandPoint(roomKey, propType, propCenter, blockers = [], prop = null) {
  const explicitAnchors = Array.isArray(prop?.anchors) ? prop.anchors : Array.isArray(prop?.approach_points) ? prop.approach_points : [];
  if (explicitAnchors.length) {
    const anchor = explicitAnchors[0];
    return {
      ...roomLocalToWorld(roomKey, anchor),
      facing: anchor.facing || 'down',
      anchorKey: anchor.key || anchor.type || 'approach',
      handles: Array.isArray(anchor.handles) ? [...anchor.handles] : Array.isArray(prop?.handles) ? [...prop.handles] : [],
    };
  }
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  const blocker = blockers.find((item) => item.prop?.type === propType && Math.abs(item.center.x - propCenter.x) < 0.1 && Math.abs(item.center.y - propCenter.y) < 0.1);
  const size = blocker || propBlockerSize(propType);
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
      ...interactionStandPoint(roomKey, prop.type, propCenter, blockers, prop),
      propCenter,
      index,
      propType: prop.type,
    };
  });
}
