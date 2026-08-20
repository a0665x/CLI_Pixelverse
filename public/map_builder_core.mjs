const DEFAULT_BOUNDS = Object.freeze({ left: 2, top: 2, width: 96, height: 96 });
const MAX_FURNITURE_OCCUPANCY = 0.4;
const DOOR_OFFSET = 3;
const ROOM_TEMPLATES = Object.freeze([
  { key: 'think_lab', name: 'Thinking Room', icon: 'lightbulb' },
  { key: 'blueprint_lab', name: 'Blueprint Lab', icon: 'map' },
  { key: 'clone_bay', name: 'Clone Bay', icon: 'dna' },
  { key: 'file_library', name: 'File Library', icon: 'books' },
  { key: 'code_workbench', name: 'Code Workbench', icon: 'memo' },
  { key: 'terminal_bay', name: 'Terminal Bay', icon: 'laptop' },
  { key: 'tool_forge', name: 'Tool Forge', icon: 'tools' },
  { key: 'response_studio', name: 'Response Studio', icon: 'envelope' },
  { key: 'standby_dock', name: 'Standby Dock', icon: 'bed' },
  { key: 'session_archive', name: 'Session Archive', icon: 'card_index_dividers' },
  { key: 'offline_corner', name: 'Offline Corner', icon: 'warning' },
]);
const FURNITURE_TEMPLATES = Object.freeze([
  { type: 'desk', name: 'Desk', icon: 'desk', w: 6.4, h: 4.6 },
  { type: 'chair', name: 'Chair', icon: 'chair', w: 3.4, h: 3.2 },
  { type: 'table', name: 'Table', icon: 'table', w: 6.8, h: 4.8 },
  { type: 'sofa', name: 'Sofa', icon: 'sofa', w: 7.2, h: 4.8 },
  { type: 'bed', name: 'Bed', icon: 'bed', w: 7.4, h: 5.8 },
  { type: 'board', name: 'Board', icon: 'board', w: 5.8, h: 2.6 },
  { type: 'bookshelf', name: 'Bookshelf', icon: 'shelf', w: 5.8, h: 4.8 },
  { type: 'cabinet', name: 'Cabinet', icon: 'cabinet', w: 4.8, h: 4.8 },
  { type: 'server', name: 'Server', icon: 'server', w: 5.6, h: 4.8 },
  { type: 'terminal', name: 'Terminal', icon: 'terminal', w: 5.2, h: 4.2 },
  { type: 'workbench', name: 'Workbench', icon: 'bench', w: 6.8, h: 4.8 },
  { type: 'portal', name: 'Portal', icon: 'portal', w: 5.2, h: 5.2 },
]);

const BUILDER_STRINGS = Object.freeze({
  'zh-TW': {
    loadPng: '載入 PNG',
    layers: '圖層',
    assignRoomInfo: '指定房間資訊',
    dragHint: '拖拉建立或校正區域，Shift+拖拉平移，滾輪縮放。',
    toolHelp: {
      room: '拖拉框選 PNG 裡的房間邊界。選取後可拖移，八個控制點可調整大小。',
      corridor: '拖拉框選走廊可走區域。走廊必須連成一張圖，門的 hub 要落在走廊內。',
      door: '點房間牆線放門。系統會吸附附近深色牆線，之後可拖 portal / aisle / hub 微調。',
      furniture: '點房間內或從家具清單拖入。家具座標會寫入 YAML，避免擋住主要動線。',
      select: '點任一圖層選取；拖移房間、走廊、家具或門 anchor。Shift+拖曳可平移畫布。',
    },
  },
  'en-US': {
    loadPng: 'Load PNG',
    layers: 'Layers',
    assignRoomInfo: 'Assign room info',
    dragHint: 'Drag to create or align regions. Shift+drag pans. Wheel zooms.',
    toolHelp: {
      room: 'Drag over the PNG room boundary. After selecting it, drag to move or use the eight handles to resize.',
      corridor: 'Drag walkable hallway rectangles. Corridors must stay connected and each door hub must land inside one.',
      door: 'Click near a room wall. The point snaps to a dark wall pixel; then drag portal / aisle / hub to fine tune.',
      furniture: 'Click inside a room or drag from the palette. Furniture is written into YAML and should not block routes.',
      select: 'Select any layer, then drag rooms, corridors, furniture, or door anchors. Shift+drag pans the canvas.',
    },
  },
  'ja-JP': {
    loadPng: 'PNGを読み込む',
    layers: 'レイヤー',
    assignRoomInfo: '部屋情報を割り当て',
    dragHint: 'ドラッグで領域を作成・調整。Shift+ドラッグでパン、ホイールでズーム。',
    toolHelp: {
      room: 'PNG上の部屋境界をドラッグで囲みます。選択後は移動、8つのハンドルでサイズ調整できます。',
      corridor: '通行可能な廊下矩形をドラッグします。廊下は接続され、各ドアのhubが廊下内に必要です。',
      door: '部屋の壁付近をクリックします。暗い壁ピクセルへ吸着し、portal / aisle / hub を後から微調整できます。',
      furniture: '部屋内をクリック、またはパレットからドラッグします。家具はYAMLへ保存され、動線を塞がない配置にします。',
      select: 'レイヤーを選択して、部屋・廊下・家具・ドアanchorをドラッグします。Shift+ドラッグでパンします。',
    },
  },
  'ko-KR': {
    loadPng: 'PNG 불러오기',
    layers: '레이어',
    assignRoomInfo: '방 정보 지정',
    dragHint: '드래그로 영역을 만들거나 보정합니다. Shift+드래그는 이동, 휠은 확대/축소입니다.',
    toolHelp: {
      room: 'PNG의 방 경계를 드래그로 지정합니다. 선택 후 이동하거나 8개 핸들로 크기를 조정합니다.',
      corridor: '이동 가능한 복도 사각형을 드래그합니다. 복도는 연결되어야 하며 각 문 hub가 복도 안에 있어야 합니다.',
      door: '방 벽 근처를 클릭합니다. 어두운 벽 픽셀에 스냅되고 portal / aisle / hub를 다시 드래그해 조정합니다.',
      furniture: '방 안을 클릭하거나 팔레트에서 드래그합니다. 가구는 YAML에 저장되며 주요 동선을 막지 않아야 합니다.',
      select: '레이어를 선택한 뒤 방, 복도, 가구, 문 anchor를 드래그합니다. Shift+드래그는 캔버스 이동입니다.',
    },
  },
});

const RESIZE_HANDLES = Object.freeze(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
const DOOR_ANCHORS = Object.freeze(['portal', 'aisle', 'hub']);

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function hasNumber(value) {
  return Number.isFinite(Number(value));
}

function clamp(value, min, max) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : min;
  return Math.max(min, Math.min(max, numeric));
}

function rectContainsPoint(rect = {}, point = {}, padding = 0) {
  return Number(point.x) >= Number(rect.left) - padding
    && Number(point.x) <= Number(rect.left) + Number(rect.width) + padding
    && Number(point.y) >= Number(rect.top) - padding
    && Number(point.y) <= Number(rect.top) + Number(rect.height) + padding;
}

function rectsTouchOrOverlap(left = {}, right = {}, padding = 0) {
  return Number(left.left) <= Number(right.left) + Number(right.width) + padding
    && Number(left.left) + Number(left.width) >= Number(right.left) - padding
    && Number(left.top) <= Number(right.top) + Number(right.height) + padding
    && Number(left.top) + Number(left.height) >= Number(right.top) - padding;
}

function rectsOverlap(left = {}, right = {}) {
  return Number(left.left) < Number(right.left) + Number(right.width)
    && Number(left.left) + Number(left.width) > Number(right.left)
    && Number(left.top) < Number(right.top) + Number(right.height)
    && Number(left.top) + Number(left.height) > Number(right.top);
}

function rectCenter(rect = {}) {
  return {
    x: round2(Number(rect.left || 0) + Number(rect.width || 0) / 2),
    y: round2(Number(rect.top || 0) + Number(rect.height || 0) / 2),
  };
}

export function eraseOverlappingWalkable(model = {}, eraserRect = {}, options = {}) {
  const rect = normalizeRect(eraserRect);
  const types = new Set(options.types || ['room', 'corridor', 'free_space']);
  const removed = { rooms: 0, corridors: 0, free_space: 0, total: 0 };
  const shouldErase = (target) => rectContainsPoint(rect, rectCenter(target));

  if (types.has('room')) {
    Object.entries(model.rooms || {}).forEach(([roomKey, room]) => {
      if (shouldErase(room.rect || {})) {
        delete model.rooms[roomKey];
        removed.rooms += 1;
      }
    });
  }

  if (types.has('corridor') && Array.isArray(model.corridors)) {
    for (let index = model.corridors.length - 1; index >= 0; index -= 1) {
      if (shouldErase(model.corridors[index])) {
        model.corridors.splice(index, 1);
        removed.corridors += 1;
      }
    }
  }

  if (types.has('free_space') && Array.isArray(model.free_space)) {
    for (let index = model.free_space.length - 1; index >= 0; index -= 1) {
      if (shouldErase(model.free_space[index])) {
        model.free_space.splice(index, 1);
        removed.free_space += 1;
      }
    }
  }

  removed.total = removed.rooms + removed.corridors + removed.free_space;
  return removed;
}

function normalizeRect(rect = {}) {
  return {
    left: round2(clamp(rect.left, 0, 100)),
    top: round2(clamp(rect.top, 0, 100)),
    width: round2(clamp(rect.width, 1, 100)),
    height: round2(clamp(rect.height, 1, 100)),
  };
}

function shiftPoint(point, delta = {}) {
  if (!point || !hasNumber(point.x) || !hasNumber(point.y)) return point;
  return {
    x: round2(clamp(Number(point.x) + Number(delta.dx || 0), 0, 100)),
    y: round2(clamp(Number(point.y) + Number(delta.dy || 0), 0, 100)),
  };
}

function yamlScalar(value) {
  if (typeof value === 'number') return String(round2(value));
  if (typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^[A-Za-z0-9_./:-]+$/.test(text) ? text : JSON.stringify(text);
}

function flowObject(source = {}, keys = Object.keys(source)) {
  return `{${keys.map((key) => `${key}: ${yamlScalar(source[key])}`).join(', ')}}`;
}

function flowArray(items = []) {
  return `[${items.map(yamlScalar).join(', ')}]`;
}

function corridorKey(index) {
  return `corridor-${index + 1}`;
}

function layerIdForSelection(selection = {}) {
  if (selection.type === 'room') return `room:${selection.key}`;
  if (selection.type === 'corridor') return `corridor:${selection.index}`;
  if (selection.type === 'free_space') return `free_space:${selection.index}`;
  if (selection.type === 'furniture') return `furniture:${selection.key}:${selection.index}`;
  if (selection.type === 'door_anchor') return `door_anchor:${selection.key}:${selection.anchor}`;
  if (selection.type === 'door') return `door:${selection.key}`;
  return '';
}

function selectionFromLayerId(layerId = '') {
  const [type, key, index] = String(layerId).split(':');
  if (type === 'room') return { type: 'room', key };
  if (type === 'corridor') return { type: 'corridor', index: Number(key) };
  if (type === 'free_space') return { type: 'free_space', index: Number(key) };
  if (type === 'door') return { type: 'door', key };
  if (type === 'furniture') return { type: 'furniture', key, index: Number(index) };
  return null;
}

function layerState(model = {}, layerId = '') {
  model.layerState ||= {};
  model.layerState[layerId] ||= { visible: true, locked: false };
  return model.layerState[layerId];
}

export function getBuilderStrings(locale = 'zh-TW') {
  return BUILDER_STRINGS[locale] || BUILDER_STRINGS['zh-TW'];
}

export function builderToolHelpItems(locale = 'zh-TW') {
  const strings = getBuilderStrings(locale);
  return ['room', 'corridor', 'door', 'furniture', 'select'].map((mode) => ({
    mode,
    help: strings.toolHelp?.[mode] || BUILDER_STRINGS['zh-TW'].toolHelp[mode],
  }));
}

export function roomTemplate(roomKey) {
  return ROOM_TEMPLATES.find((item) => item.key === roomKey) || { key: roomKey, name: roomKey, icon: '' };
}

export function roomPaletteItems(model = {}, locale = 'zh-TW') {
  void locale;
  const used = new Set(Object.keys(model.rooms || {}));
  return ROOM_TEMPLATES.map((item) => ({
    ...item,
    disabled: used.has(item.key),
  }));
}

export function furniturePaletteItems() {
  return FURNITURE_TEMPLATES.map((item) => ({ ...item }));
}

export function imagePointToWorld(point = {}, image = {}) {
  const width = Number(image.width) || 1;
  const height = Number(image.height) || 1;
  return {
    x: round2(clamp(Number(point.x) * 100 / width, 0, 100)),
    y: round2(clamp(Number(point.y) * 100 / height, 0, 100)),
  };
}

export function worldRectFromDrag(start = {}, end = {}, image = {}) {
  const a = imagePointToWorld(start, image);
  const b = imagePointToWorld(end, image);
  return {
    left: round2(Math.min(a.x, b.x)),
    top: round2(Math.min(a.y, b.y)),
    width: round2(Math.abs(a.x - b.x)),
    height: round2(Math.abs(a.y - b.y)),
  };
}

export function createPendingRect(type, start = {}, end = {}, image = {}) {
  return {
    type,
    status: 'pending',
    rect: worldRectFromDrag(start, end, image),
  };
}

export function updatePendingRect(pending = {}, start = {}, end = {}, image = {}) {
  return {
    ...pending,
    status: 'pending',
    rect: worldRectFromDrag(start, end, image),
  };
}

export function pendingRectLabel(pending = {}) {
  const rect = pending.rect || {};
  return `L ${Number(rect.left || 0).toFixed(1)} / T ${Number(rect.top || 0).toFixed(1)} / W ${Number(rect.width || 0).toFixed(1)} / H ${Number(rect.height || 0).toFixed(1)}`;
}

export function cancelPendingRect() {
  return null;
}

export function confirmPendingRect(model = {}, pending = {}, info = {}) {
  if (!pending || pending.status !== 'pending') throw new Error('No pending rectangle to confirm.');
  const rect = normalizeRect(pending.rect);
  if (pending.type === 'room') {
    const key = info.key || `room_${Object.keys(model.rooms || {}).length + 1}`;
    model.rooms ||= {};
    model.rooms[key] = {
      name: info.name || key,
      icon: info.icon || '',
      rect,
      center: { x: round2(rect.left + rect.width / 2), y: round2(rect.top + rect.height / 2) },
      portal: info.portal || null,
      aisle: info.aisle || null,
      hub: info.hub || null,
      states: info.states || [],
      event_hints: info.event_hints || [],
      furniture: info.furniture || [],
    };
    return { model, selection: { type: 'room', key } };
  }
  if (pending.type === 'corridor') {
    model.corridors ||= [];
    const index = model.corridors.length;
    model.corridors.push({ key: info.key || corridorKey(index), ...rect });
    return { model, selection: { type: 'corridor', index } };
  }
  if (pending.type === 'free_space') {
    model.free_space ||= [];
    const index = model.free_space.length;
    model.free_space.push({ key: info.key || `free-space-${index + 1}`, ...rect });
    return { model, selection: { type: 'free_space', index } };
  }
  throw new Error(`Unsupported pending type: ${pending.type}`);
}

export function assignRoomFromPalette(model = {}, pending = {}, roomKey) {
  if (model.rooms?.[roomKey]) throw new Error(`Room ${roomKey} is already assigned.`);
  const template = roomTemplate(roomKey);
  return confirmPendingRect(model, pending, {
    key: template.key,
    name: template.name,
    icon: template.icon,
  });
}

export function summarizeDarkWallMask(imageData = {}, options = {}) {
  const width = Number(imageData.width) || 0;
  const height = Number(imageData.height) || 0;
  const data = imageData.data || [];
  const darkThreshold = Number(options.darkThreshold) || 90;
  const totalPixels = Math.max(0, width * height);
  let darkPixels = 0;
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] === undefined ? 255 : Number(data[offset + 3]);
    if (alpha <= 8) continue;
    const darkness = Number(data[offset]) + Number(data[offset + 1]) + Number(data[offset + 2]);
    if (darkness <= darkThreshold * 3) darkPixels += 1;
  }
  const darkRatio = totalPixels ? round2(darkPixels / totalPixels) : 0;
  return {
    width,
    height,
    totalPixels,
    darkPixels,
    freePixels: Math.max(0, totalPixels - darkPixels),
    darkRatio,
    freeRatio: round2(1 - darkRatio),
    darkThreshold,
    freeSpaceRule: 'non-dark pixels inside room/corridor boxes are treated as candidate free space',
  };
}

export function findNearestDarkWall(imageData = {}, point = {}, options = {}) {
  const width = Number(imageData.width) || 0;
  const height = Number(imageData.height) || 0;
  const data = imageData.data || [];
  const radius = Number(options.radius) || 8;
  const darkThreshold = Number(options.darkThreshold) || 90;
  let best = null;

  for (let y = Math.max(0, Math.floor(point.y - radius)); y <= Math.min(height - 1, Math.ceil(point.y + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(point.x - radius)); x <= Math.min(width - 1, Math.ceil(point.x + radius)); x += 1) {
      const offset = (y * width + x) * 4;
      const darkness = Number(data[offset]) + Number(data[offset + 1]) + Number(data[offset + 2]);
      if (darkness > darkThreshold * 3) continue;
      const distance = Math.hypot(x - Number(point.x), y - Number(point.y));
      if (distance > radius) continue;
      if (!best || distance < best.distance) {
        best = { x, y, distance: round2(distance) };
      }
    }
  }
  return best;
}

export function inferDoorSide(room = {}, portal = {}) {
  const rect = room.rect || room;
  const distances = [
    ['left', Math.abs(Number(portal.x) - Number(rect.left))],
    ['right', Math.abs(Number(portal.x) - (Number(rect.left) + Number(rect.width)))],
    ['top', Math.abs(Number(portal.y) - Number(rect.top))],
    ['bottom', Math.abs(Number(portal.y) - (Number(rect.top) + Number(rect.height)))],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

export function routeAnchorsForDoor(room = {}, portal = {}, side = inferDoorSide(room, portal)) {
  const offsets = {
    left: { aisle: { x: DOOR_OFFSET, y: 0 }, hub: { x: -DOOR_OFFSET, y: 0 } },
    right: { aisle: { x: -DOOR_OFFSET, y: 0 }, hub: { x: DOOR_OFFSET, y: 0 } },
    top: { aisle: { x: 0, y: DOOR_OFFSET }, hub: { x: 0, y: -DOOR_OFFSET } },
    bottom: { aisle: { x: 0, y: -DOOR_OFFSET }, hub: { x: 0, y: DOOR_OFFSET } },
  }[side] || { aisle: { x: 0, y: -DOOR_OFFSET }, hub: { x: 0, y: DOOR_OFFSET } };
  return {
    portal: { x: round2(portal.x), y: round2(portal.y) },
    aisle: { x: round2(Number(portal.x) + offsets.aisle.x), y: round2(Number(portal.y) + offsets.aisle.y) },
    hub: { x: round2(Number(portal.x) + offsets.hub.x), y: round2(Number(portal.y) + offsets.hub.y) },
  };
}

export function addDoorToRoom(model = {}, roomKey, portal = {}, options = {}) {
  const room = model.rooms?.[roomKey];
  if (!room) throw new Error(`Unknown room: ${roomKey}`);
  const side = options.side || inferDoorSide(room, portal);
  const anchors = routeAnchorsForDoor(room, portal, side);
  room.portal = anchors.portal;
  room.aisle = anchors.aisle;
  room.hub = anchors.hub;
  room.center ||= {
    x: round2(Number(room.rect.left) + Number(room.rect.width) / 2),
    y: round2(Number(room.rect.top) + Number(room.rect.height) / 2),
  };
  return anchors;
}

export function doorAnchorPoints(roomKey, room = {}) {
  return DOOR_ANCHORS
    .filter((anchor) => room?.[anchor] && hasNumber(room[anchor].x) && hasNumber(room[anchor].y))
    .map((anchor) => ({
      roomKey,
      anchor,
      x: round2(room[anchor].x),
      y: round2(room[anchor].y),
      label: anchor,
    }));
}

export function resizeHandlesForSelection(model = {}, selection = {}) {
  if (!canEditSelection(model, selection)) return [];
  if (selection.type === 'room' && model.rooms?.[selection.key]) return [...RESIZE_HANDLES];
  if (selection.type === 'corridor' && model.corridors?.[selection.index]) return [...RESIZE_HANDLES];
  if (selection.type === 'free_space' && model.free_space?.[selection.index]) return [...RESIZE_HANDLES];
  return [];
}

export function furnitureOccupancy(room = {}) {
  const rect = room.rect || {};
  const roomArea = Math.max(0, Number(rect.width) || 0) * Math.max(0, Number(rect.height) || 0);
  const furnitureArea = (room.furniture || []).reduce((total, item) => {
    const scale = clamp(item.scale ?? 1, 0.55, 1.8);
    return total + Math.max(0, Number(item.w) || 0) * Math.max(0, Number(item.h) || 0) * scale * scale;
  }, 0);
  return {
    roomArea: round2(roomArea),
    furnitureArea: round2(furnitureArea),
    ratio: roomArea ? round2(furnitureArea / roomArea) : 0,
  };
}

export function planRoomConnectivityRoutes(model = {}) {
  const rooms = model.rooms || {};
  const corridors = model.corridors || [];
  const roomEntries = Object.entries(rooms);
  const unreachable = [];
  const routes = [];
  const issues = [];

  if (!roomEntries.length || !corridors.length) {
    return {
      ok: false,
      routes,
      unreachable: roomEntries.map(([room]) => ({ room, reason: 'missing corridor graph' })),
      issues: roomEntries.map(([room]) => ({
        type: 'route-unreachable-room',
        severity: 'error',
        message: `room ${room} cannot route because the map has no corridor graph`,
        target: { type: 'room', key: room },
      })),
    };
  }

  const nodes = walkableRects(model);
  const seen = new Set([0]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((candidate, index) => {
      if (seen.has(index)) return;
      if ([...seen].some((seenIndex) => rectsTouchOrOverlap(candidate, nodes[seenIndex], 0.2))) {
        seen.add(index);
        changed = true;
      }
    });
  }
  const mainWalkable = nodes.map((rect, index) => ({ rect, index, key: rect.key || corridorKey(index) })).filter((item) => seen.has(item.index));
  const reachableRooms = new Set();

  roomEntries.forEach(([roomKey, room]) => {
    const hasAnchors = ['center', 'portal', 'aisle', 'hub'].every((pointName) => (
      room[pointName] && hasNumber(room[pointName].x) && hasNumber(room[pointName].y)
    ));
    const aisleInsideRoom = !!room.rect && !!room.aisle && rectContainsPoint(room.rect, room.aisle, 0.1);
    const portalTouchesCorridor = !!room.portal && mainWalkable.some((walkable) => rectContainsPoint(walkable.rect, room.portal, 2.8));
    const hubInsideCorridor = !!room.hub && mainWalkable.some((walkable) => rectContainsPoint(walkable.rect, room.hub, 0.3));
    if (hasAnchors && aisleInsideRoom && portalTouchesCorridor && hubInsideCorridor) {
      reachableRooms.add(roomKey);
      routes.push({ room: roomKey, ok: true, through: ['center', 'aisle', 'portal', 'hub', 'corridor/free-space'] });
      return;
    }
    const reason = !hasAnchors
      ? 'missing center/portal/aisle/hub anchors'
      : !aisleInsideRoom
        ? 'door aisle is not inside room'
        : 'door hub/portal is not connected to the main walkable graph';
    unreachable.push({ room: roomKey, reason });
    issues.push({
      type: 'route-unreachable-room',
      severity: 'error',
      message: `room ${roomKey} cannot route through a real door into the corridor/free-space graph (${reason})`,
      target: { type: 'room', key: roomKey },
    });
  });

  roomEntries.forEach(([fromRoom]) => {
    roomEntries.forEach(([toRoom]) => {
      if (fromRoom === toRoom) return;
      if (reachableRooms.has(fromRoom) && reachableRooms.has(toRoom)) {
        routes.push({ from: fromRoom, to: toRoom, ok: true, through: ['source door', 'corridor/free-space graph', 'target door'] });
      }
    });
  });
  return { ok: unreachable.length === 0 && reachableRooms.size === roomEntries.length, routes, unreachable, issues };
}

export function mapBuilderPromptChecklist(locale = 'zh-TW') {
  void locale;
  return [
    '1. PNG: draw visible floors, walls, and door openings. Do not leave a state room visually sealed with no door.',
    '2. YAML rooms: define every room rect, center, portal, aisle, hub, states, event_hints, and furniture list.',
    '3. YAML corridors: define walkable corridor rectangles that form one connected corridor graph.',
    '4. Doors: each room portal must sit on the room wall/door opening; hub must be inside a corridor; aisle must be inside the room.',
    '5. Furniture: set type/x/y/w/h/scale, keep furniture occupancy below 40%, and do not block center-to-door movement.',
    '6. Validate route planning: every room must route to every other room through source door -> corridor -> target door.',
    '7. Submit only after validation is OK; Submit writes PNG + YAML to tmp/global_map and the main page can reload the active map.',
  ];
}

export function detectRoomOverlaps(model = {}) {
  const entries = Object.entries(model.rooms || {});
  const issues = [];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftKey, leftRoom] = entries[leftIndex];
      const [rightKey, rightRoom] = entries[rightIndex];
      if (rectsOverlap(leftRoom.rect || {}, rightRoom.rect || {})) {
        issues.push({
          type: 'overlap',
          severity: 'warning',
          message: `rooms ${leftKey} and ${rightKey} overlap`,
          target: { type: 'room', key: leftKey },
          relatedTarget: { type: 'room', key: rightKey },
        });
      }
    }
  }
  return issues;
}

export function buildLayerList(model = {}) {
  const layers = [];
  Object.entries(model.rooms || {}).forEach(([roomKey, room]) => {
    const roomId = `room:${roomKey}`;
    layers.push({
      id: roomId,
      type: 'room',
      label: room.name || roomKey,
      target: { type: 'room', key: roomKey },
      ...layerState(model, roomId),
    });
  });
  (model.corridors || []).forEach((corridor, index) => {
    const id = `corridor:${index}`;
    layers.push({
      id,
      type: 'corridor',
      label: corridor.key || corridorKey(index),
      target: { type: 'corridor', index },
      ...layerState(model, id),
    });
  });
  (model.free_space || []).forEach((space, index) => {
    const id = `free_space:${index}`;
    layers.push({
      id,
      type: 'free_space',
      label: space.key || `free-space-${index + 1}`,
      target: { type: 'free_space', index },
      ...layerState(model, id),
    });
  });
  Object.entries(model.rooms || {}).forEach(([roomKey, room]) => {
    if (room.portal) {
      const id = `door:${roomKey}`;
      layers.push({
        id,
        type: 'door',
        label: `${roomKey} door`,
        target: { type: 'door', key: roomKey },
        ...layerState(model, id),
      });
    }
    (room.furniture || []).forEach((item, index) => {
      const id = `furniture:${roomKey}:${index}`;
      layers.push({
        id,
        type: 'furniture',
        label: `${roomKey} ${item.type || 'furniture'} ${index + 1}`,
        target: { type: 'furniture', key: roomKey, index },
        ...layerState(model, id),
      });
    });
  });
  return layers;
}

export function toggleLayerVisibility(model = {}, layerId = '') {
  const state = layerState(model, layerId);
  state.visible = !state.visible;
  return state.visible;
}

export function setLayerLocked(model = {}, layerId = '', locked = true) {
  const state = layerState(model, layerId);
  state.locked = !!locked;
  return state.locked;
}

export function isLayerVisible(model = {}, selection = {}) {
  const id = layerIdForSelection(selection);
  return !id || layerState(model, id).visible !== false;
}

export function canEditSelection(model = {}, selection = {}) {
  const id = layerIdForSelection(selection);
  return !!id && layerState(model, id).locked !== true;
}

export function translateSelection(model = {}, selection = {}, delta = {}) {
  const dx = Number(delta.dx || 0);
  const dy = Number(delta.dy || 0);
  if (selection.type === 'room') {
    const room = model.rooms?.[selection.key];
    if (!room) return model;
    room.rect = normalizeRect({
      ...room.rect,
      left: Number(room.rect.left) + dx,
      top: Number(room.rect.top) + dy,
    });
    room.center = shiftPoint(room.center, { dx, dy });
    room.portal = shiftPoint(room.portal, { dx, dy });
    room.aisle = shiftPoint(room.aisle, { dx, dy });
    room.hub = shiftPoint(room.hub, { dx, dy });
    return model;
  }
  if (selection.type === 'corridor') {
    const corridor = model.corridors?.[selection.index];
    if (!corridor) return model;
    corridor.left = round2(clamp(Number(corridor.left) + dx, 0, 100));
    corridor.top = round2(clamp(Number(corridor.top) + dy, 0, 100));
    return model;
  }
  if (selection.type === 'free_space') {
    const space = model.free_space?.[selection.index];
    if (!space) return model;
    space.left = round2(clamp(Number(space.left) + dx, 0, 100));
    space.top = round2(clamp(Number(space.top) + dy, 0, 100));
    return model;
  }
  if (selection.type === 'door_anchor') {
    const room = model.rooms?.[selection.key];
    const anchor = selection.anchor;
    if (!room || !DOOR_ANCHORS.includes(anchor) || !room[anchor]) return model;
    room[anchor] = shiftPoint(room[anchor], { dx, dy });
    return model;
  }
  if (selection.type === 'furniture') {
    const room = model.rooms?.[selection.key];
    const item = room?.furniture?.[selection.index];
    if (!room || !item) return model;
    const localDx = Number(room.rect?.width) ? dx * 100 / Number(room.rect.width) : dx;
    const localDy = Number(room.rect?.height) ? dy * 100 / Number(room.rect.height) : dy;
    item.x = round2(clamp(Number(item.x) + localDx, 0, 100));
    item.y = round2(clamp(Number(item.y) + localDy, 0, 100));
    return model;
  }
  return model;
}

export function resizeSelection(model = {}, selection = {}, handle = 'se', delta = {}) {
  let target = null;
  if (selection.type === 'room') target = model.rooms?.[selection.key]?.rect;
  if (selection.type === 'corridor') target = model.corridors?.[selection.index];
  if (selection.type === 'free_space') target = model.free_space?.[selection.index];
  if (!target) return model;
  const rect = { ...target };
  const dx = Number(delta.dx || 0);
  const dy = Number(delta.dy || 0);
  if (handle.includes('e')) rect.width = Number(rect.width) + dx;
  if (handle.includes('s')) rect.height = Number(rect.height) + dy;
  if (handle.includes('w')) {
    rect.left = Number(rect.left) + dx;
    rect.width = Number(rect.width) - dx;
  }
  if (handle.includes('n')) {
    rect.top = Number(rect.top) + dy;
    rect.height = Number(rect.height) - dy;
  }
  const normalized = normalizeRect(rect);
  Object.assign(target, normalized);
  if (selection.type === 'room') {
    const room = model.rooms?.[selection.key];
    room.center = { x: round2(room.rect.left + room.rect.width / 2), y: round2(room.rect.top + room.rect.height / 2) };
  }
  return model;
}

export function nextViewport(viewport = {}, action = {}) {
  const current = {
    scale: Number(viewport.scale) || 1,
    x: Number(viewport.x) || 0,
    y: Number(viewport.y) || 0,
    preferredZoom: viewport.preferredZoom || null,
  };
  if (action.type === 'zoom') {
    const direction = Number(action.delta) >= 0 ? 1 : -1;
    const scale = round2(clamp(current.scale * (direction > 0 ? 1.12 : 0.88), 0.35, 4));
    return {
      ...current,
      scale,
      preferredZoom: action.anchor ? { x: round2(action.anchor.x), y: round2(action.anchor.y) } : current.preferredZoom,
    };
  }
  if (action.type === 'pan') {
    return {
      ...current,
      x: round2(current.x + Number(action.dx || 0)),
      y: round2(current.y + Number(action.dy || 0)),
    };
  }
  return current;
}

function walkableRects(modelOrCorridors = {}) {
  if (Array.isArray(modelOrCorridors)) return modelOrCorridors;
  return [
    ...(modelOrCorridors.corridors || []),
    ...(modelOrCorridors.free_space || []),
  ];
}

function validateCorridorGraph(modelOrCorridors = {}) {
  const corridors = Array.isArray(modelOrCorridors) ? modelOrCorridors : (modelOrCorridors.corridors || []);
  if (corridors.length < 2) return [];
  const nodes = walkableRects(modelOrCorridors);
  const seen = new Set([0]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((candidate, index) => {
      if (seen.has(index)) return;
      if ([...seen].some((seenIndex) => rectsTouchOrOverlap(candidate, nodes[seenIndex], 0.2))) {
        seen.add(index);
        changed = true;
      }
    });
  }
  return corridors
    .map((corridor, index) => ({ corridor, index }))
    .filter((item) => !seen.has(item.index))
    .map(({ corridor, index }) => ({ key: corridor.key || 'unnamed corridor', index }));
}

export function validateBuilderModel(model = {}) {
  const errors = [];
  const issues = [];
  const rooms = model.rooms || {};
  const corridors = model.corridors || [];
  if (!Object.keys(rooms).length) errors.push('model must define at least one room');
  if (!corridors.length) errors.push('model must define at least one corridor');
  corridors.forEach((corridor, index) => {
    ['left', 'top', 'width', 'height'].forEach((field) => {
      if (!hasNumber(corridor[field])) errors.push(`corridor[${index}] missing ${field}`);
    });
  });
  validateCorridorGraph(model).forEach(({ key, index }) => {
    const message = `corridor graph is disconnected at ${key}`;
    errors.push(message);
    issues.push({ type: 'corridor-disconnected', severity: 'error', message, target: { type: 'corridor', index } });
  });
  const warnings = [];
  detectRoomOverlaps(model).forEach((issue) => {
    warnings.push(issue);
    issues.push(issue);
  });
  const routePlan = planRoomConnectivityRoutes(model);
  routePlan.issues.forEach((issue) => {
    errors.push(issue.message);
    issues.push(issue);
  });

  Object.entries(rooms).forEach(([roomKey, room]) => {
    const rect = room.rect || {};
    ['left', 'top', 'width', 'height'].forEach((field) => {
      if (!hasNumber(rect[field])) errors.push(`room ${roomKey} rect missing ${field}`);
    });
    ['center', 'portal', 'aisle', 'hub'].forEach((pointName) => {
      if (!room[pointName] || !hasNumber(room[pointName].x) || !hasNumber(room[pointName].y)) {
        errors.push(`room ${roomKey} missing ${pointName}.x/y`);
      }
    });
    if (room.portal && !walkableRects(model).some((rect) => rectContainsPoint(rect, room.portal, 2.8))) {
      const message = `room ${roomKey} portal must touch a corridor/free-space area`;
      errors.push(message);
      issues.push({ type: 'door-disconnected', severity: 'error', message, target: { type: 'room', key: roomKey } });
    }
    if (room.hub && !walkableRects(model).some((rect) => rectContainsPoint(rect, room.hub, 0.3))) {
      const message = `room ${roomKey} hub must be inside a corridor/free-space area`;
      errors.push(message);
      issues.push({ type: 'hub-outside-corridor', severity: 'error', message, target: { type: 'room', key: roomKey } });
    }
    const occupancy = furnitureOccupancy(room);
    if (occupancy.ratio > MAX_FURNITURE_OCCUPANCY) {
      const message = `room ${roomKey} furniture occupancy ${occupancy.ratio} exceeds ${MAX_FURNITURE_OCCUPANCY}`;
      errors.push(message);
      issues.push({ type: 'furniture-occupancy', severity: 'error', message, target: { type: 'room', key: roomKey } });
    }
    (room.furniture || []).forEach((item, index) => {
      ['type', 'x', 'y', 'w', 'h'].forEach((field) => {
        if (item[field] === undefined || item[field] === '') errors.push(`room ${roomKey} furniture[${index}] missing ${field}`);
      });
    });
  });
  return { ok: errors.length === 0, errors, issues, warnings };
}

export function exportBuilderYaml(model = {}) {
  const lines = [
    'version: 2',
    `key: ${yamlScalar(model.key || 'user-built-office')}`,
    `name: ${yamlScalar(model.name || model.key || 'User Built Office')}`,
    `image: ${yamlScalar(model.image || '/global_map/default.png')}`,
    `bounds: ${flowObject(model.bounds || DEFAULT_BOUNDS, ['left', 'top', 'width', 'height'])}`,
    'corridors:',
  ];

  (model.corridors || []).forEach((corridor, index) => {
    const item = { key: corridor.key || corridorKey(index), left: corridor.left, top: corridor.top, width: corridor.width, height: corridor.height };
    lines.push(`  - ${flowObject(item, ['key', 'left', 'top', 'width', 'height'])}`);
  });

  const freeSpaceRects = [];
  Object.entries(model.rooms || {}).forEach(([roomKey, room]) => {
    if (room?.rect) freeSpaceRects.push({ key: `room-${roomKey}`, ...room.rect });
  });
  (model.corridors || []).forEach((corridor, index) => {
    freeSpaceRects.push({ key: corridor.key || corridorKey(index), left: corridor.left, top: corridor.top, width: corridor.width, height: corridor.height });
  });
  (model.free_space || []).forEach((space, index) => {
    freeSpaceRects.push({ key: space.key || `free-space-${index + 1}`, left: space.left, top: space.top, width: space.width, height: space.height });
  });
  if ((model.free_space || []).length) {
    lines.push('free_space:');
    freeSpaceRects.forEach((item) => {
      lines.push(`  - ${flowObject(item, ['key', 'left', 'top', 'width', 'height'])}`);
    });
  }

  lines.push('rooms:');
  Object.entries(model.rooms || {}).forEach(([roomKey, room]) => {
    const center = room.center || {
      x: round2(Number(room.rect.left) + Number(room.rect.width) / 2),
      y: round2(Number(room.rect.top) + Number(room.rect.height) / 2),
    };
    lines.push(`  ${roomKey}:`);
    lines.push(`    name: ${yamlScalar(room.name || roomKey)}`);
    if (room.icon) lines.push(`    icon: ${yamlScalar(room.icon)}`);
    if (room.description) lines.push(`    description: ${yamlScalar(room.description)}`);
    lines.push(`    rect: ${flowObject(room.rect, ['left', 'top', 'width', 'height'])}`);
    lines.push(`    center: ${flowObject(center, ['x', 'y'])}`);
    lines.push(`    portal: ${flowObject(room.portal, ['x', 'y'])}`);
    lines.push(`    aisle: ${flowObject(room.aisle, ['x', 'y'])}`);
    lines.push(`    hub: ${flowObject(room.hub, ['x', 'y'])}`);
    lines.push(`    states: ${flowArray(room.states || [])}`);
    lines.push(`    event_hints: ${flowArray(room.event_hints || [])}`);
    const furniture = room.furniture || [];
    if (!furniture.length) {
      lines.push('    furniture: []');
    } else {
      lines.push('    furniture:');
      furniture.forEach((item) => {
        const prop = {
          type: item.type,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          scale: item.scale ?? 1,
        };
        lines.push(`      - ${flowObject(prop, ['type', 'x', 'y', 'w', 'h', 'scale'])}`);
      });
    }
  });
  return `${lines.join('\n')}\n`;
}
