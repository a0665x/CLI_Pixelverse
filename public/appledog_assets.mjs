const BASE = '/assets/appledog-modern-interior/32x32';

export const APPLEDOG_PACK = {
  name: 'Modern Interior Tileset by AppleDog',
  author: 'Apple Dog',
  sourceUrl: 'https://apple-dog.itch.io/modern-tileset-by-appledog',
  credit: 'Apple Dog',
  tileSize: 32,
  terms: 'Free to use in commercial/non-commercial projects with Apple Dog credited, per itch.io author comment.',
};

const PROP_SPRITES = {
  bed: { src: `${BASE}/bed.png`, scale: 1.15, widthTiles: 3, heightTiles: 4 },
  sofa: { src: `${BASE}/sofa.png`, scale: 1.05, widthTiles: 3, heightTiles: 3 },
  chair: { src: `${BASE}/armchair.png`, scale: 1, widthTiles: 3, heightTiles: 3 },
  desk: { src: `${BASE}/desk.png`, scale: 1, widthTiles: 3, heightTiles: 2 },
  table: { src: `${BASE}/office-table.png`, scale: 1, widthTiles: 3, heightTiles: 3 },
  cabinet: { src: `${BASE}/file-cabinet.png`, scale: 1.05, widthTiles: 2, heightTiles: 3 },
  locker: { src: `${BASE}/file-cabinet.png`, scale: 1.05, widthTiles: 2, heightTiles: 3 },
  terminal: { src: `${BASE}/terminal.png`, scale: 1.1, widthTiles: 2, heightTiles: 2 },
  coffee: { src: `${BASE}/coffee-table.png`, scale: 0.95, widthTiles: 1, heightTiles: 1 },
  lamp: { src: `${BASE}/lamp.png`, scale: 1, widthTiles: 1, heightTiles: 3 },
};

const ROOM_THEMES = {
  think_lab: { floorColor: '#c7b18a', wallTile: `${BASE}/wall-cream.png`, rugColor: 'rgba(102,75,48,0.18)' },
  blueprint_lab: { floorColor: '#d8d0a8', wallTile: `${BASE}/wall-aqua.png`, rugColor: 'rgba(74,144,154,0.18)' },
  file_library: { floorColor: '#c3c0a4', wallTile: `${BASE}/wall-wood.png`, rugColor: 'rgba(73,92,110,0.16)' },
  code_workbench: { floorColor: '#b9c08e', wallTile: `${BASE}/wall-green.png`, rugColor: 'rgba(55,99,71,0.16)' },
  terminal_bay: { floorColor: '#c4b083', wallTile: `${BASE}/wall-aqua.png`, rugColor: 'rgba(91,82,46,0.16)' },
  tool_forge: { floorColor: '#b99772', wallTile: `${BASE}/wall-wood.png`, rugColor: 'rgba(77,60,45,0.18)' },
  response_studio: { floorColor: '#b8c792', wallTile: `${BASE}/wall-green.png`, rugColor: 'rgba(69,108,74,0.16)' },
  standby_dock: { floorColor: '#cdb892', wallTile: `${BASE}/wall-cream.png`, rugColor: 'rgba(126,89,61,0.18)' },
  clone_bay: { floorColor: '#c9d1c7', wallTile: `${BASE}/wall-aqua.png`, rugColor: 'rgba(75,111,121,0.16)' },
  session_archive: { floorColor: '#d5c89b', wallTile: `${BASE}/wall-wood.png`, rugColor: 'rgba(92,73,49,0.16)' },
};

export function getAppleDogPropSprite(type = '') {
  return PROP_SPRITES[type] || null;
}

export function getAppleDogRoomTheme(roomKey = 'think_lab') {
  return {
    ...(ROOM_THEMES[roomKey] || ROOM_THEMES.think_lab),
    wallSize: '64px 64px',
  };
}

export function getAppleDogDoorSprite() {
  return `${BASE}/door-wood.png`;
}
