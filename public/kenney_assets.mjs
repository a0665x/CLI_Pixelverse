const TILE_BASE = '/assets/kenney-rpg-urban/Tiles';

function tile(num) {
  return `${TILE_BASE}/tile_${String(num).padStart(4, '0')}.png`;
}

export const KENNEY_PACK = {
  name: 'Kenney RPG Urban Pack',
  sourceUrl: 'https://kenney.nl/assets/rpg-urban-pack',
  downloadUrl: 'https://kenney.nl/media/pages/assets/rpg-urban-pack/0a097d1dc7-1677578575/kenney_rpg-urban-pack.zip',
  license: 'CC0',
  tileSize: 16,
};

const DIRECTION_INDEX = { left: 0, down: 1, up: 2, right: 3 };

const AGENT_SETS = {
  main_agent: {
    idle: [212, 213, 214, 215],
    active: [239, 240, 241, 242],
  },
  subagent: {
    idle: [131, 132, 133, 134],
    active: [158, 159, 160, 161],
  },
  branch_session: {
    idle: [77, 78, 79, 80],
    active: [104, 105, 106, 107],
  },
};

const ROOM_THEMES = {
  think_lab: {
    floorTile: tile(90),
    floorSize: '24px 24px',
    wallTile: tile(146),
    accentColor: 'rgba(251,191,36,0.22)',
    propScale: 1,
  },
  blueprint_lab: {
    floorTile: tile(82),
    floorSize: '24px 24px',
    wallTile: tile(148),
    accentColor: 'rgba(110,231,249,0.2)',
    propScale: 1,
  },
  tool_forge: {
    floorTile: tile(128),
    floorSize: '24px 24px',
    wallTile: tile(150),
    accentColor: 'rgba(74,222,128,0.18)',
    propScale: 1,
  },
  response_studio: {
    floorTile: tile(83),
    floorSize: '24px 24px',
    wallTile: tile(149),
    accentColor: 'rgba(244,114,182,0.2)',
    propScale: 1,
  },
  standby_dock: {
    floorTile: tile(144),
    floorSize: '24px 24px',
    wallTile: tile(143),
    accentColor: 'rgba(96,165,250,0.16)',
    propScale: 1,
  },
  clone_bay: {
    floorTile: tile(91),
    floorSize: '24px 24px',
    wallTile: tile(148),
    accentColor: 'rgba(167,139,250,0.2)',
    propScale: 1,
  },
  session_archive: {
    floorTile: tile(145),
    floorSize: '24px 24px',
    wallTile: tile(150),
    accentColor: 'rgba(96,165,250,0.18)',
    propScale: 1,
  },
};

const PROP_LIBRARY = {
  window: { src: tile(93), scale: 1.05 },
  bookshelf: { src: tile(124), scale: 1.05 },
  desk: { src: tile(152), scale: 1.15 },
  chair: { src: tile(223), scale: 0.95 },
  lamp: { src: tile(190), scale: 0.9 },
  board: { src: tile(149), scale: 1.1 },
  plant: { src: tile(232), scale: 1 },
  table: { src: tile(162), scale: 1.1 },
  cabinet: { src: tile(250), scale: 1 },
  terminal: { src: tile(167), scale: 1 },
  poster: { src: tile(97), scale: 0.95 },
  rug: { src: tile(128), scale: 1.2 },
  server: { src: tile(251), scale: 1 },
  workbench: { src: tile(163), scale: 1.15 },
  crate: { src: tile(254), scale: 0.95 },
  coffee: { src: tile(166), scale: 0.9 },
  sofa: { src: tile(222), scale: 1.2 },
  bed: { src: tile(172), scale: 1.25 },
  locker: { src: tile(124), scale: 1.05 },
  charger: { src: tile(168), scale: 0.95 },
  portal: { src: tile(255), scale: 1.1 },
};

const ROOM_LAYOUTS = {
  think_lab: {
    semanticZones: [
      { key: 'focus-desk', labelKey: 'focusDesk', kind: 'focus', tile: tile(162), left: 16, top: 20, width: 28, height: 18, opacity: 0.74 },
      { key: 'idea-wall', labelKey: 'thoughtBoard', kind: 'plan', tile: tile(149), left: 58, top: 12, width: 24, height: 16, opacity: 0.82 },
      { key: 'reading-nook', labelKey: 'bookshelf', kind: 'archive', tile: tile(124), left: 8, top: 48, width: 18, height: 28, opacity: 0.72 },
      { key: 'lamp-corner', labelKey: 'ideaLamp', kind: 'ambient', tile: tile(190), left: 70, top: 46, width: 14, height: 20, opacity: 0.72 },
    ],
    wallSegments: [
      { key: 'north-shelf', tile: tile(124), left: 8, top: 6, width: 24, height: 12, opacity: 0.78 },
      { key: 'east-board', tile: tile(149), left: 78, top: 22, width: 12, height: 26, opacity: 0.82 },
      { key: 'south-console', tile: tile(152), left: 42, top: 70, width: 22, height: 12, opacity: 0.7 },
    ],
    floorAccents: [
      { key: 'focus-rug', tile: tile(90), left: 24, top: 42, width: 38, height: 24, opacity: 0.46 },
      { key: 'window-strip', tile: tile(93), left: 8, top: 12, width: 74, height: 8, opacity: 0.55 },
    ],
  },
  blueprint_lab: {
    semanticZones: [
      { key: 'briefing-strip', labelKey: 'routePoster', kind: 'briefing', tile: tile(97), left: 10, top: 10, width: 76, height: 10, opacity: 0.64 },
      { key: 'blueprint-table', labelKey: 'blueprintTable', kind: 'plan', tile: tile(162), left: 28, top: 34, width: 38, height: 20, opacity: 0.82 },
      { key: 'scanner-nook', labelKey: 'scannerConsole', kind: 'scan', tile: tile(167), left: 72, top: 18, width: 16, height: 24, opacity: 0.78 },
      { key: 'archive-wall', labelKey: 'archiveCabinet', kind: 'archive', tile: tile(250), left: 8, top: 52, width: 22, height: 22, opacity: 0.72 },
    ],
    wallSegments: [
      { key: 'map-wall', tile: tile(149), left: 36, top: 6, width: 28, height: 12, opacity: 0.84 },
      { key: 'north-window', tile: tile(93), left: 10, top: 6, width: 18, height: 10, opacity: 0.66 },
      { key: 'east-cabinet', tile: tile(250), left: 82, top: 44, width: 10, height: 28, opacity: 0.74 },
    ],
    floorAccents: [
      { key: 'route-rug', tile: tile(128), left: 20, top: 58, width: 58, height: 16, opacity: 0.5 },
      { key: 'scan-lane', tile: tile(82), left: 60, top: 16, width: 18, height: 42, opacity: 0.42 },
    ],
  },
  tool_forge: {
    semanticZones: [
      { key: 'build-server', labelKey: 'buildServer', kind: 'work', tile: tile(251), left: 8, top: 10, width: 20, height: 24, opacity: 0.82 },
      { key: 'forge-bench', labelKey: 'workbench', kind: 'craft', tile: tile(163), left: 28, top: 44, width: 26, height: 18, opacity: 0.82 },
      { key: 'terminal-rig', labelKey: 'terminalRig', kind: 'terminal', tile: tile(167), left: 62, top: 18, width: 18, height: 20, opacity: 0.8 },
      { key: 'parts-locker', labelKey: 'partsLocker', kind: 'storage', tile: tile(250), left: 70, top: 52, width: 16, height: 18, opacity: 0.76 },
    ],
    wallSegments: [
      { key: 'north-racks', tile: tile(251), left: 8, top: 6, width: 30, height: 12, opacity: 0.78 },
      { key: 'west-crates', tile: tile(254), left: 6, top: 42, width: 12, height: 24, opacity: 0.72 },
      { key: 'east-rack', tile: tile(250), left: 84, top: 18, width: 8, height: 42, opacity: 0.72 },
    ],
    floorAccents: [
      { key: 'forge-rug', tile: tile(128), left: 18, top: 60, width: 54, height: 14, opacity: 0.5 },
      { key: 'power-lane', tile: tile(145), left: 44, top: 14, width: 16, height: 44, opacity: 0.46 },
    ],
  },
  response_studio: {
    semanticZones: [
      { key: 'writing-desk', labelKey: 'writingDesk', kind: 'draft', tile: tile(152), left: 12, top: 16, width: 24, height: 18, opacity: 0.78 },
      { key: 'reply-console', labelKey: 'replyConsole', kind: 'terminal', tile: tile(167), left: 18, top: 50, width: 22, height: 18, opacity: 0.8 },
      { key: 'briefing-chair', labelKey: 'briefingChair', kind: 'review', tile: tile(223), left: 60, top: 48, width: 14, height: 16, opacity: 0.72 },
      { key: 'reference-shelf', labelKey: 'replyShelf', kind: 'reference', tile: tile(124), left: 70, top: 14, width: 18, height: 24, opacity: 0.76 },
    ],
    wallSegments: [
      { key: 'north-window', tile: tile(93), left: 8, top: 6, width: 18, height: 10, opacity: 0.64 },
      { key: 'east-poster', tile: tile(97), left: 82, top: 18, width: 10, height: 18, opacity: 0.72 },
      { key: 'south-shelf', tile: tile(124), left: 38, top: 68, width: 24, height: 10, opacity: 0.72 },
    ],
    floorAccents: [
      { key: 'studio-rug', tile: tile(83), left: 22, top: 30, width: 46, height: 26, opacity: 0.45 },
      { key: 'reply-lane', tile: tile(128), left: 44, top: 54, width: 24, height: 12, opacity: 0.42 },
    ],
  },
  standby_dock: {
    semanticZones: [
      { key: 'rest-lane', labelKey: 'breakSofa', kind: 'rest', tile: tile(222), left: 8, top: 26, width: 24, height: 24, opacity: 0.82 },
      { key: 'bed-alcove', labelKey: 'restBed', kind: 'rest', tile: tile(172), left: 34, top: 18, width: 26, height: 28, opacity: 0.84 },
      { key: 'coffee-corner', labelKey: 'teaCorner', kind: 'break', tile: tile(166), left: 66, top: 18, width: 14, height: 18, opacity: 0.78 },
      { key: 'ready-lockers', labelKey: 'readyLocker', kind: 'storage', tile: tile(124), left: 78, top: 14, width: 12, height: 30, opacity: 0.74 },
    ],
    wallSegments: [
      { key: 'north-lockers', tile: tile(124), left: 64, top: 6, width: 26, height: 10, opacity: 0.74 },
      { key: 'east-charge', tile: tile(168), left: 88, top: 40, width: 8, height: 22, opacity: 0.76 },
      { key: 'south-benches', tile: tile(222), left: 10, top: 72, width: 28, height: 10, opacity: 0.72 },
    ],
    floorAccents: [
      { key: 'sleep-rug', tile: tile(144), left: 20, top: 54, width: 42, height: 18, opacity: 0.46 },
      { key: 'service-lane', tile: tile(145), left: 64, top: 42, width: 24, height: 12, opacity: 0.38 },
    ],
  },
  clone_bay: {
    semanticZones: [
      { key: 'portal-stage', labelKey: 'cloneGate', kind: 'portal', tile: tile(255), left: 12, top: 18, width: 20, height: 24, opacity: 0.84 },
      { key: 'dispatch-row', labelKey: 'dispatchBoard', kind: 'dispatch', tile: tile(167), left: 34, top: 18, width: 18, height: 20, opacity: 0.8 },
      { key: 'subagent-pod', labelKey: 'subagentDesk', kind: 'desk', tile: tile(152), left: 20, top: 52, width: 28, height: 18, opacity: 0.8 },
      { key: 'clone-nodes', labelKey: 'cloneServer', kind: 'server', tile: tile(251), left: 66, top: 44, width: 20, height: 24, opacity: 0.78 },
    ],
    wallSegments: [
      { key: 'north-portals', tile: tile(255), left: 8, top: 6, width: 30, height: 12, opacity: 0.76 },
      { key: 'east-racks', tile: tile(251), left: 84, top: 20, width: 8, height: 34, opacity: 0.74 },
      { key: 'south-crates', tile: tile(254), left: 46, top: 72, width: 22, height: 10, opacity: 0.7 },
    ],
    floorAccents: [
      { key: 'summon-rug', tile: tile(91), left: 22, top: 56, width: 44, height: 18, opacity: 0.5 },
      { key: 'dispatch-lane', tile: tile(82), left: 46, top: 18, width: 16, height: 44, opacity: 0.42 },
    ],
  },
  session_archive: {
    semanticZones: [
      { key: 'history-cabinets', labelKey: 'sessionCabinet', kind: 'archive', tile: tile(250), left: 8, top: 14, width: 18, height: 48, opacity: 0.78 },
      { key: 'timeline-table', labelKey: 'timelineTable', kind: 'review', tile: tile(162), left: 34, top: 32, width: 34, height: 18, opacity: 0.82 },
      { key: 'record-shelf', labelKey: 'recordShelf', kind: 'archive', tile: tile(124), left: 72, top: 16, width: 16, height: 26, opacity: 0.76 },
      { key: 'viewer-console', labelKey: 'sessionViewer', kind: 'terminal', tile: tile(167), left: 68, top: 54, width: 18, height: 18, opacity: 0.78 },
    ],
    wallSegments: [
      { key: 'north-ledger', tile: tile(124), left: 20, top: 6, width: 24, height: 10, opacity: 0.72 },
      { key: 'east-poster', tile: tile(97), left: 84, top: 20, width: 8, height: 18, opacity: 0.68 },
      { key: 'south-cabinets', tile: tile(250), left: 40, top: 74, width: 28, height: 8, opacity: 0.74 },
    ],
    floorAccents: [
      { key: 'archive-rug', tile: tile(145), left: 24, top: 54, width: 50, height: 18, opacity: 0.5 },
      { key: 'ledger-lane', tile: tile(83), left: 52, top: 16, width: 14, height: 42, opacity: 0.42 },
    ],
  },
};

export function getKenneyRoomTheme(roomKey = 'think_lab') {
  return ROOM_THEMES[roomKey] || ROOM_THEMES.think_lab;
}

export function getKenneyRoomLayout(roomKey = 'think_lab') {
  const layout = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.think_lab;
  return {
    roomKey,
    semanticZones: layout.semanticZones.map((item) => ({ ...item })),
    wallSegments: layout.wallSegments.map((item) => ({ ...item })),
    floorAccents: layout.floorAccents.map((item) => ({ ...item })),
  };
}

export function getKenneyDoorSprite() {
  return tile(255);
}

export function getKenneyPropSprite(type = 'desk') {
  return PROP_LIBRARY[type] || null;
}

export function getKenneyAgentSprite({ role = 'main_agent', state = 'idle', frame = 0, facing = 'right' } = {}) {
  const roleSet = AGENT_SETS[role] || AGENT_SETS.main_agent;
  const directionIndex = DIRECTION_INDEX[facing] ?? DIRECTION_INDEX.right;
  const walking = state === 'working' || state === 'planning' || state === 'thinking';
  const useActiveFrame = walking && Math.abs(frame) % 2 === 1;
  const frames = useActiveFrame ? roleSet.active : roleSet.idle;
  const src = tile(frames[directionIndex] ?? frames[DIRECTION_INDEX.right]);
  return {
    src,
    flipX: false,
    pixelClass: `kenney-${role} facing-${facing}`,
  };
}
