import { fetchGlobalMapManifest } from './global_map_loader.mjs';

export const GLOBAL_MAP = {
  key: 'fallback-office',
  name: 'CLI Pixelverse fallback office',
  image: '',
  description: 'Built-in fallback map used only when /global_map/VLM_Generated.yaml cannot be loaded.',
  bounds: { left: 2, top: 2, width: 96, height: 96 },
  loadedFrom: 'fallback',
};

export const CORRIDOR_BAND = { left: 12, right: 92, top: 28, bottom: 74 };

export const CORRIDOR_RECTS = [
  { key: 'north-gallery', left: 12, right: 80, top: 34, bottom: 40 },
  { key: 'blueprint-door-neck', left: 42, right: 46, top: 30, bottom: 36 },
  { key: 'east-spine', left: 72, right: 78, top: 28, bottom: 72 },
  { key: 'south-gallery', left: 12, right: 92, top: 66, bottom: 74 },
  { key: 'west-drop', left: 12, right: 18, top: 34, bottom: 74 },
  { key: 'offline-stub', left: 8, right: 18, top: 70, bottom: 88 },
];

export const FREE_SPACE_RECTS = [];
export const BLOCKED_RECTS = [];

export const ROOM_LAYOUTS = {
  think_lab: {
    left: 4, top: 6, width: 24, height: 28,
    center: { x: 16, y: 20 },
    portal: { x: 16, y: 34 },
    aisle: { x: 16, y: 28 },
    hub: { x: 16, y: 37 },
    patrol: [{ x: 11, y: 15 }, { x: 22, y: 17 }, { x: 16, y: 25 }],
  },
  blueprint_lab: {
    left: 30, top: 4, width: 28, height: 26,
    center: { x: 44, y: 18 },
    portal: { x: 44, y: 30 },
    aisle: { x: 44, y: 24 },
    hub: { x: 44, y: 34 },
    patrol: [{ x: 37, y: 13 }, { x: 52, y: 15 }, { x: 45, y: 23 }],
  },
  file_library: {
    left: 4, top: 42, width: 26, height: 24,
    center: { x: 17, y: 54 },
    portal: { x: 17, y: 42 },
    aisle: { x: 17, y: 48 },
    hub: { x: 17, y: 38 },
    patrol: [{ x: 11, y: 49 }, { x: 24, y: 51 }, { x: 17, y: 60 }],
  },
  clone_bay: {
    left: 62, top: 6, width: 32, height: 26,
    center: { x: 78, y: 19 },
    portal: { x: 76, y: 32 },
    aisle: { x: 76, y: 26 },
    hub: { x: 76, y: 36 },
    patrol: [{ x: 70, y: 14 }, { x: 88, y: 16 }, { x: 79, y: 24 }],
  },
  standby_dock: {
    left: 4, top: 74, width: 22, height: 20,
    center: { x: 15, y: 84 },
    portal: { x: 16, y: 74 },
    aisle: { x: 16, y: 80 },
    hub: { x: 16, y: 70 },
    patrol: [{ x: 10, y: 84 }, { x: 16, y: 80 }, { x: 22, y: 86 }],
  },
  response_studio: {
    left: 29, top: 70, width: 24, height: 24,
    center: { x: 41, y: 82 },
    portal: { x: 41, y: 70 },
    aisle: { x: 41, y: 76 },
    hub: { x: 41, y: 68 },
    patrol: [{ x: 34, y: 84 }, { x: 41, y: 77 }, { x: 47, y: 85 }],
  },
  code_workbench: {
    left: 33, top: 40, width: 27, height: 26,
    center: { x: 46.5, y: 53 },
    portal: { x: 46, y: 40 },
    aisle: { x: 46, y: 46 },
    hub: { x: 46, y: 38 },
    patrol: [{ x: 40, y: 47 }, { x: 55, y: 49 }, { x: 47, y: 58 }],
  },
  terminal_bay: {
    left: 64, top: 42, width: 30, height: 24,
    center: { x: 79, y: 54 },
    portal: { x: 76, y: 42 },
    aisle: { x: 76, y: 48 },
    hub: { x: 76, y: 38 },
    patrol: [{ x: 70, y: 48 }, { x: 88, y: 50 }, { x: 80, y: 59 }],
  },
  tool_forge: {
    left: 55, top: 72, width: 24, height: 22,
    center: { x: 67, y: 83 },
    portal: { x: 67, y: 72 },
    aisle: { x: 67, y: 78 },
    hub: { x: 67, y: 68 },
    patrol: [{ x: 59, y: 85 }, { x: 67, y: 78 }, { x: 73, y: 86 }],
  },
  session_archive: {
    left: 80, top: 70, width: 16, height: 24,
    center: { x: 88, y: 82 },
    portal: { x: 88, y: 70 },
    aisle: { x: 88, y: 76 },
    hub: { x: 88, y: 68 },
    patrol: [{ x: 83, y: 84 }, { x: 88, y: 77 }, { x: 92, y: 85 }],
  },
  offline_corner: {
    left: 4, top: 88, width: 10, height: 6,
    center: { x: 9, y: 91 },
    portal: { x: 9, y: 88 },
    aisle: { x: 9, y: 90 },
    hub: { x: 9, y: 84 },
    patrol: [{ x: 9, y: 91 }],
  },
};

export const ROOM_METADATA = Object.fromEntries(
  Object.keys(ROOM_LAYOUTS).map((roomKey) => [roomKey, {
    name: roomKey,
    icon: '',
    description: '',
    event_hints: [],
    furniture: [],
  }]),
);

export const ROOM_STATE_GROUPS = {
  think_lab: ['thinking', 'awaiting_input'],
  blueprint_lab: ['planning'],
  file_library: ['reading_files'],
  code_workbench: ['editing_files', 'self_healing'],
  terminal_bay: ['shell_command', 'executing'],
  tool_forge: ['invoking_skill', 'tool_call', 'browsing', 'external_tool'],
  response_studio: ['responding'],
  standby_dock: ['idle', 'sleeping'],
  clone_bay: ['initializing', 'collaborating'],
  session_archive: ['branch_session'],
  offline_corner: ['offline', 'blocked'],
};

export const DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP = {};

export function roomRect(roomKey) {
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return { left: room.left, top: room.top, width: room.width, height: room.height };
}

const DOOR_SIZE = { width: 5.4, height: 1.1 };

export const HOUSE_DOORS = Object.entries(ROOM_LAYOUTS)
  .filter(([roomKey]) => !!roomKey)
  .map(([roomKey, room]) => ({
    room: roomKey,
    left: Number((room.portal.x - DOOR_SIZE.width / 2).toFixed(2)),
    top: Number((room.portal.y - DOOR_SIZE.height / 2).toFixed(2)),
    width: DOOR_SIZE.width,
    height: DOOR_SIZE.height,
    side: room.portal.y <= room.top ? 'top' : 'bottom',
  }));

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePoint(value = {}, fallback = { x: 0, y: 0 }) {
  return {
    x: numberOr(value.x, fallback.x),
    y: numberOr(value.y, fallback.y),
  };
}

function normalizeFreeSpaceEntry(value = {}) {
  if (Array.isArray(value)) return value.map((item) => normalizePoint(item));
  if (value && hasNumber(value.left) && hasNumber(value.top) && hasNumber(value.width) && hasNumber(value.height)) {
    const left = Number(value.left);
    const top = Number(value.top);
    const right = left + Number(value.width);
    const bottom = top + Number(value.height);
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }
  return [];
}

function normalizeRoom(roomKey, source = {}, fallback = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock) {
  const rect = source.rect || source;
  const left = numberOr(rect.left, fallback.left);
  const top = numberOr(rect.top, fallback.top);
  const width = numberOr(rect.width, fallback.width);
  const height = numberOr(rect.height, fallback.height);
  return {
    left,
    top,
    width,
    height,
    polygon: Array.isArray(source.polygon) ? source.polygon.map((item) => normalizePoint(item)) : [],
    walkable_polygon: Array.isArray(source.walkable_polygon) ? source.walkable_polygon.map((item) => normalizePoint(item)) : [],
    free_space: Array.isArray(source.free_space) ? source.free_space.map((entry) => normalizeFreeSpaceEntry(entry)).filter((entry) => entry.length >= 3) : [],
    center: normalizePoint(source.center, fallback.center || { x: left + width / 2, y: top + height / 2 }),
    portal: normalizePoint(source.portal, fallback.portal || { x: left + width / 2, y: top + height }),
    aisle: normalizePoint(source.aisle, fallback.aisle || source.center || { x: left + width / 2, y: top + height / 2 }),
    hub: normalizePoint(source.hub, fallback.hub || source.portal || { x: left + width / 2, y: top + height }),
    patrol: Array.isArray(source.patrol) && source.patrol.length
      ? source.patrol.map((item) => normalizePoint(item))
      : (fallback.patrol || [fallback.center || { x: left + width / 2, y: top + height / 2 }]),
  };
}

function normalizeCorridor(source = {}) {
  return normalizeMapRect(source, `corridor-${source.left || 0}-${source.top || 0}`);
}

function normalizeMapRect(source = {}, fallbackKey = 'rect') {
  const left = numberOr(source.left, 0);
  const top = numberOr(source.top, 0);
  const width = numberOr(source.width, numberOr(source.right, left) - left);
  const height = numberOr(source.height, numberOr(source.bottom, top) - top);
  return {
    key: source.key || fallbackKey,
    left,
    top,
    width,
    height,
    right: numberOr(source.right, left + width),
    bottom: numberOr(source.bottom, top + height),
  };
}

function hasNumber(value) {
  return Number.isFinite(Number(value));
}

function requirePoint(source = {}, key, roomKey) {
  if (!source || !hasNumber(source.x) || !hasNumber(source.y)) {
    throw new Error(`Global map room ${roomKey} must define ${key}.x and ${key}.y.`);
  }
}

function requireRect(source = {}, roomKey) {
  if (!source || !hasNumber(source.left) || !hasNumber(source.top) || !hasNumber(source.width) || !hasNumber(source.height)) {
    throw new Error(`Global map room ${roomKey} must define rect left/top/width/height.`);
  }
  if (Number(source.width) <= 0 || Number(source.height) <= 0) {
    throw new Error(`Global map room ${roomKey} rect width/height must be positive.`);
  }
}

function rectContainsPoint(rect, candidate, padding = 0) {
  return candidate.x >= rect.left - padding
    && candidate.x <= rect.left + rect.width + padding
    && candidate.y >= rect.top - padding
    && candidate.y <= rect.top + rect.height + padding;
}

function corridorContainsPoint(corridor, candidate, padding = 0) {
  return candidate.x >= corridor.left - padding
    && candidate.x <= corridor.left + corridor.width + padding
    && candidate.y >= corridor.top - padding
    && candidate.y <= corridor.top + corridor.height + padding;
}

function validateFurniture(roomKey, furniture = []) {
  if (!Array.isArray(furniture)) throw new Error(`Global map room ${roomKey} furniture must be a list.`);
  furniture.forEach((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Global map room ${roomKey} furniture[${index}] must be an object.`);
    if (!item.type) throw new Error(`Global map room ${roomKey} furniture[${index}] must define type.`);
    if (!hasNumber(item.x) || !hasNumber(item.y)) throw new Error(`Global map room ${roomKey} furniture[${index}] must define x and y.`);
    const footprint = item.footprint || {};
    const hasFootprint = hasNumber(footprint.w) || hasNumber(footprint.width) || hasNumber(footprint.h) || hasNumber(footprint.height);
    if (!hasNumber(item.w) && !hasNumber(item.width) && !hasNumber(footprint.w) && !hasNumber(footprint.width)) {
      throw new Error(`Global map room ${roomKey} furniture[${index}] must define w and h or footprint.`);
    }
    if (!hasNumber(item.h) && !hasNumber(item.height) && !hasNumber(footprint.h) && !hasNumber(footprint.height)) {
      throw new Error(`Global map room ${roomKey} furniture[${index}] must define w and h or footprint.`);
    }
    if (Number(item.w ?? item.width ?? footprint.w ?? footprint.width) <= 0 || Number(item.h ?? item.height ?? footprint.h ?? footprint.height) <= 0) throw new Error(`Global map room ${roomKey} furniture[${index}] w and h must be positive.`);
    if (hasFootprint && (Number(footprint.w ?? footprint.width ?? 0) <= 0 || Number(footprint.h ?? footprint.height ?? 0) <= 0)) {
      throw new Error(`Global map room ${roomKey} furniture[${index}] footprint w and h must be positive.`);
    }
    if (item.scale !== undefined && (!hasNumber(item.scale) || Number(item.scale) < 0.55 || Number(item.scale) > 1.8)) {
      throw new Error(`Global map room ${roomKey} furniture[${index}] scale must be between 0.55 and 1.8.`);
    }
  });
}

function validateMapRects(rects = [], label = 'map rect') {
  if (!Array.isArray(rects)) throw new Error(`Global map ${label} must be a list.`);
  return rects.map((rect, index) => {
    if (Array.isArray(rect) && rect.length >= 3) {
      const xs = rect.map((point) => Number(point.x));
      const ys = rect.map((point) => Number(point.y));
      return normalizeMapRect({ left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }, `${label}-${index}`);
    }
    if (!rect || typeof rect !== 'object') throw new Error(`Global map ${label}[${index}] must be an object.`);
    if (!hasNumber(rect.left) || !hasNumber(rect.top) || !hasNumber(rect.width) || !hasNumber(rect.height)) {
      throw new Error(`Global map ${label}[${index}] must define left/top/width/height.`);
    }
    if (Number(rect.width) <= 0 || Number(rect.height) <= 0) throw new Error(`Global map ${label}[${index}] width/height must be positive.`);
    return normalizeMapRect(rect, `${label}-${index}`);
  });
}

function rectsTouchOrOverlap(left, right, padding = 0.05) {
  return left.left <= right.right + padding
    && left.right >= right.left - padding
    && left.top <= right.bottom + padding
    && left.bottom >= right.top - padding;
}

function validateCorridorConnectivity(corridors = [], rooms = {}) {
  const activeRooms = Object.entries(rooms).filter(([roomKey]) => roomKey !== 'offline_corner');
  if (!activeRooms.length || corridors.length <= 1) return;
  const visited = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const index = queue.shift();
    corridors.forEach((candidate, candidateIndex) => {
      if (!visited.has(candidateIndex) && rectsTouchOrOverlap(corridors[index], candidate, 0.2)) {
        visited.add(candidateIndex);
        queue.push(candidateIndex);
      }
    });
  }
  if (visited.size !== corridors.length) {
    throw new Error('Global map corridor graph is not connected; isolated corridor branches would create unreachable rooms.');
  }
  activeRooms.forEach(([roomKey, room]) => {
    const touches = corridors.some((corridor) => corridorContainsPoint(corridor, room.portal, 2.8) && corridorContainsPoint(corridor, room.hub, 0.2));
    if (!touches) throw new Error(`Global map room ${roomKey} is not connected to the corridor graph.`);
  });
}

export function validateGlobalMapManifest(manifest = {}) {
  if (!manifest || typeof manifest !== 'object' || !manifest.rooms || typeof manifest.rooms !== 'object') {
    throw new Error('Global map manifest must define rooms.');
  }
  if (!Array.isArray(manifest.corridors) || !manifest.corridors.length) {
    throw new Error('Global map manifest must define at least one corridors entry.');
  }
  const corridors = validateMapRects(manifest.corridors, 'corridor');
  const freeSpace = validateMapRects(manifest.free_space || [], 'free_space');
  const blocked = validateMapRects(manifest.blocked || [], 'blocked');

  const polygonMode = manifest.geometry?.corridor_mode === 'none';
  const roomEntries = Object.entries(manifest.rooms);
  if (!roomEntries.length) throw new Error('Global map manifest must define at least one room.');
  roomEntries.forEach(([roomKey, room]) => {
    if (!room || typeof room !== 'object') throw new Error(`Global map room ${roomKey} must be an object.`);
    requireRect(room.rect, roomKey);
    requirePoint(room.center, 'center', roomKey);
    requirePoint(room.portal, 'portal', roomKey);
    requirePoint(room.aisle, 'aisle', roomKey);
    requirePoint(room.hub, 'hub', roomKey);
    if (roomKey !== 'offline_corner') {
      if (!rectContainsPoint(room.rect, room.aisle, 0.1)) throw new Error(`Global map room ${roomKey} aisle must be inside its room rect.`);
      if (!rectContainsPoint(room.rect, room.portal, 0.2)) throw new Error(`Global map room ${roomKey} portal must sit on or inside its room rect.`);
      if (!polygonMode && !corridors.some((corridor) => corridorContainsPoint(corridor, room.portal, 2.8))) {
        throw new Error(`Global map room ${roomKey} portal must touch a corridor.`);
      }
      if (!polygonMode && !corridors.some((corridor) => corridorContainsPoint(corridor, room.hub, 0.2))) {
        throw new Error(`Global map room ${roomKey} hub must be inside a corridor.`);
      }
    }
    validateFurniture(roomKey, room.furniture || []);
  });
  if (!polygonMode) validateCorridorConnectivity(corridors, manifest.rooms);
  return true;
}

function rebuildDoors() {
  HOUSE_DOORS.splice(0, HOUSE_DOORS.length, ...Object.entries(ROOM_LAYOUTS)
    .filter(([roomKey]) => !!roomKey)
    .map(([roomKey, room]) => ({
      room: roomKey,
      left: Number((room.portal.x - DOOR_SIZE.width / 2).toFixed(2)),
      top: Number((room.portal.y - DOOR_SIZE.height / 2).toFixed(2)),
      width: DOOR_SIZE.width,
      height: DOOR_SIZE.height,
      side: room.portal.y <= room.top ? 'top' : 'bottom',
    })));
}

function rebuildCorridorBand() {
  if (!CORRIDOR_RECTS.length) return;
  CORRIDOR_BAND.left = Math.min(...CORRIDOR_RECTS.map((rect) => rect.left));
  CORRIDOR_BAND.right = Math.max(...CORRIDOR_RECTS.map((rect) => rect.right));
  CORRIDOR_BAND.top = Math.min(...CORRIDOR_RECTS.map((rect) => rect.top));
  CORRIDOR_BAND.bottom = Math.max(...CORRIDOR_RECTS.map((rect) => rect.bottom));
}

export function applyGlobalMapManifest(manifest = {}, options = {}) {
  validateGlobalMapManifest(manifest);

  const previousLayouts = Object.fromEntries(
    Object.entries(ROOM_LAYOUTS).map(([roomKey, room]) => [roomKey, { ...room }]),
  );
  Object.keys(ROOM_LAYOUTS).forEach((roomKey) => { delete ROOM_LAYOUTS[roomKey]; });
  Object.entries(manifest.rooms).forEach(([roomKey, room]) => {
    ROOM_LAYOUTS[roomKey] = normalizeRoom(roomKey, room, previousLayouts[roomKey] || previousLayouts.standby_dock);
  });
  if (!ROOM_LAYOUTS.standby_dock) {
    const firstRoom = Object.keys(ROOM_LAYOUTS)[0];
    ROOM_LAYOUTS.standby_dock = normalizeRoom('standby_dock', {}, ROOM_LAYOUTS[firstRoom]);
  }

  CORRIDOR_RECTS.splice(0, CORRIDOR_RECTS.length, ...(manifest.corridors || []).map(normalizeCorridor));
  FREE_SPACE_RECTS.splice(0, FREE_SPACE_RECTS.length, ...validateMapRects(manifest.free_space || [], 'free_space'));
  BLOCKED_RECTS.splice(0, BLOCKED_RECTS.length, ...(manifest.blocked || []).map((rect, index) => normalizeMapRect(rect, `blocked-${index}`)));
  rebuildCorridorBand();
  rebuildDoors();

  Object.keys(ROOM_STATE_GROUPS).forEach((roomKey) => { delete ROOM_STATE_GROUPS[roomKey]; });
  Object.keys(ROOM_METADATA).forEach((roomKey) => { delete ROOM_METADATA[roomKey]; });
  Object.keys(DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP).forEach((roomKey) => { delete DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP[roomKey]; });

  Object.entries(manifest.rooms).forEach(([roomKey, room]) => {
    ROOM_STATE_GROUPS[roomKey] = Array.isArray(room.states) ? [...room.states] : [];
    ROOM_METADATA[roomKey] = {
      name: room.name || roomKey,
      icon: room.icon || '',
      description: room.description || '',
      event_hints: Array.isArray(room.event_hints) ? [...room.event_hints] : [],
      furniture: Array.isArray(room.furniture) ? room.furniture.map((item) => ({ ...item })) : [],
    };
    DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP[roomKey] = (ROOM_METADATA[roomKey].furniture || [])
      .map((item) => {
        const usesWorldCoordinates = item.coordinate_space === 'world' || !!room.polygon;
        return {
          x: usesWorldCoordinates ? ((numberOr(item.x, room.rect.left) - room.rect.left) / room.rect.width) * 100 : numberOr(item.x, 50),
          y: usesWorldCoordinates ? ((numberOr(item.y, room.rect.top) - room.rect.top) / room.rect.height) * 100 : numberOr(item.y, 50),
          room: roomKey,
          scale: numberOr(item.scale, 1),
        };
      });
  });

  GLOBAL_MAP.key = manifest.key || 'custom-map';
  GLOBAL_MAP.name = manifest.name || GLOBAL_MAP.key;
  GLOBAL_MAP.image = manifest.image || '';
  GLOBAL_MAP.description = manifest.description || '';
  GLOBAL_MAP.bounds = manifest.bounds || GLOBAL_MAP.bounds;
  GLOBAL_MAP.loadedFrom = options.loadedFrom || 'manifest';
  return GLOBAL_MAP;
}

export async function loadGlobalMap(url = '/global_map/VLM_Generated.yaml') {
  const manifest = await fetchGlobalMapManifest(url);
  return applyGlobalMapManifest(manifest, { loadedFrom: url });
}

export function roomMapCopy(roomKey) {
  return ROOM_METADATA[roomKey] || {
    name: roomKey,
    icon: '',
    description: '',
    event_hints: [],
    furniture: [],
  };
}
