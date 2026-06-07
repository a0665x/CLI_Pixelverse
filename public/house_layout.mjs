import { fetchGlobalMapManifest } from './global_map_loader.mjs';

export const GLOBAL_MAP = {
  key: 'fallback-office',
  name: 'CLI Pixelverse fallback office',
  image: '',
  description: 'Built-in fallback map used only when /global_map/default.yaml cannot be loaded.',
  bounds: { left: 2, top: 2, width: 96, height: 96 },
  loadedFrom: 'fallback',
};

export const CORRIDOR_BAND = { left: 4, right: 96, top: 31, bottom: 69 };

export const CORRIDOR_RECTS = [
  { key: 'upper-shared-wall', left: 4, right: 96, top: 31, bottom: 37 },
  { key: 'lower-shared-wall', left: 4, right: 96, top: 63, bottom: 69 },
  { key: 'west-shared-wall', left: 31, right: 37, top: 6, bottom: 94 },
  { key: 'east-shared-wall', left: 61, right: 67, top: 6, bottom: 94 },
];

export const ROOM_LAYOUTS = {
  think_lab: {
    left: 4, top: 6, width: 30, height: 31,
    center: { x: 19, y: 20 },
    portal: { x: 19, y: 37 },
    aisle: { x: 19, y: 30 },
    hub: { x: 19, y: 34 },
    patrol: [{ x: 12, y: 15 }, { x: 26, y: 16 }, { x: 19, y: 25 }],
  },
  blueprint_lab: {
    left: 34, top: 6, width: 30, height: 31,
    center: { x: 49, y: 20 },
    portal: { x: 49, y: 37 },
    aisle: { x: 49, y: 30 },
    hub: { x: 49, y: 34 },
    patrol: [{ x: 42, y: 15 }, { x: 58, y: 16 }, { x: 50, y: 25 }],
  },
  file_library: {
    left: 4, top: 37, width: 30, height: 32,
    center: { x: 19, y: 53 },
    portal: { x: 12, y: 37 },
    aisle: { x: 12, y: 45 },
    hub: { x: 12, y: 34 },
    patrol: [{ x: 12, y: 47 }, { x: 26, y: 50 }, { x: 19, y: 58 }],
  },
  clone_bay: {
    left: 64, top: 6, width: 32, height: 31,
    center: { x: 80, y: 20 },
    portal: { x: 80, y: 37 },
    aisle: { x: 80, y: 30 },
    hub: { x: 80, y: 34 },
    patrol: [{ x: 73, y: 15 }, { x: 89, y: 16 }, { x: 81, y: 25 }],
  },
  standby_dock: {
    left: 4, top: 69, width: 24, height: 25,
    center: { x: 16, y: 82 },
    portal: { x: 16, y: 69 },
    aisle: { x: 16, y: 75 },
    hub: { x: 16, y: 66 },
    patrol: [{ x: 10, y: 84 }, { x: 16, y: 77 }, { x: 22, y: 84 }],
  },
  response_studio: {
    left: 28, top: 69, width: 24, height: 25,
    center: { x: 40, y: 82 },
    portal: { x: 40, y: 69 },
    aisle: { x: 40, y: 75 },
    hub: { x: 40, y: 66 },
    patrol: [{ x: 33, y: 84 }, { x: 39, y: 77 }, { x: 45, y: 84 }],
  },
  code_workbench: {
    left: 34, top: 37, width: 30, height: 32,
    center: { x: 49, y: 53 },
    portal: { x: 49, y: 69 },
    aisle: { x: 49, y: 62 },
    hub: { x: 49, y: 66 },
    patrol: [{ x: 42, y: 47 }, { x: 58, y: 49 }, { x: 50, y: 58 }],
  },
  terminal_bay: {
    left: 64, top: 37, width: 32, height: 32,
    center: { x: 80, y: 53 },
    portal: { x: 80, y: 69 },
    aisle: { x: 80, y: 62 },
    hub: { x: 80, y: 66 },
    patrol: [{ x: 73, y: 47 }, { x: 89, y: 49 }, { x: 81, y: 58 }],
  },
  tool_forge: {
    left: 52, top: 69, width: 24, height: 25,
    center: { x: 64, y: 82 },
    portal: { x: 64, y: 69 },
    aisle: { x: 64, y: 75 },
    hub: { x: 64, y: 66 },
    patrol: [{ x: 56, y: 84 }, { x: 62, y: 77 }, { x: 68, y: 84 }],
  },
  session_archive: {
    left: 76, top: 69, width: 20, height: 25,
    center: { x: 86, y: 82 },
    portal: { x: 86, y: 69 },
    aisle: { x: 86, y: 75 },
    hub: { x: 86, y: 66 },
    patrol: [{ x: 79, y: 84 }, { x: 85, y: 77 }, { x: 91, y: 84 }],
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
  .filter(([roomKey]) => roomKey !== 'offline_corner')
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
  const left = numberOr(source.left, 0);
  const top = numberOr(source.top, 0);
  const width = numberOr(source.width, numberOr(source.right, left) - left);
  const height = numberOr(source.height, numberOr(source.bottom, top) - top);
  return {
    key: source.key || `corridor-${left}-${top}`,
    left,
    top,
    width,
    height,
    right: numberOr(source.right, left + width),
    bottom: numberOr(source.bottom, top + height),
  };
}

function rebuildDoors() {
  HOUSE_DOORS.splice(0, HOUSE_DOORS.length, ...Object.entries(ROOM_LAYOUTS)
    .filter(([roomKey]) => roomKey !== 'offline_corner')
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
  if (!manifest || typeof manifest !== 'object' || !manifest.rooms || typeof manifest.rooms !== 'object') {
    throw new Error('Global map manifest must define rooms.');
  }

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
      .map((item) => ({ x: numberOr(item.x, 50), y: numberOr(item.y, 50), room: roomKey }));
  });

  GLOBAL_MAP.key = manifest.key || 'custom-map';
  GLOBAL_MAP.name = manifest.name || GLOBAL_MAP.key;
  GLOBAL_MAP.image = manifest.image || '';
  GLOBAL_MAP.description = manifest.description || '';
  GLOBAL_MAP.bounds = manifest.bounds || GLOBAL_MAP.bounds;
  GLOBAL_MAP.loadedFrom = options.loadedFrom || 'manifest';
  return GLOBAL_MAP;
}

export async function loadGlobalMap(url = '/global_map/default.yaml') {
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
