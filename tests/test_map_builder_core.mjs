import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDoorToRoom,
  assignRoomFromPalette,
  buildLayerList,
  builderToolHelpItems,
  cancelPendingRect,
  canEditSelection,
  confirmPendingRect,
  createPendingRect,
  detectRoomOverlaps,
  doorAnchorPoints,
  eraseOverlappingWalkable,
  exportBuilderYaml,
  findNearestDarkWall,
  furniturePaletteItems,
  mapBuilderPromptChecklist,
  getBuilderStrings,
  imagePointToWorld,
  planRoomConnectivityRoutes,
  summarizeDarkWallMask,
  pendingRectLabel,
  resizeHandlesForSelection,
  roomPaletteItems,
  setLayerLocked,
  toggleLayerVisibility,
  nextViewport,
  resizeSelection,
  translateSelection,
  updatePendingRect,
  validateBuilderModel,
  worldRectFromDrag,
} from '../public/map_builder_core.mjs';
import { parseGlobalMapYaml } from '../public/global_map_loader.mjs';
import { validateGlobalMapManifest } from '../public/house_layout.mjs';

function darkLineImage(width = 100, height = 100) {
  return {
    width,
    height,
    data: Array.from({ length: width * height * 4 }, (_, index) => {
      const pixel = Math.floor(index / 4);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const dark = x === 50 && y >= 20 && y <= 80;
      if (index % 4 === 3) return 255;
      return dark ? 10 : 235;
    }),
  };
}

test('builder converts PNG drag rectangles into normalized world coordinates', () => {
  assert.deepEqual(imagePointToWorld({ x: 250, y: 500 }, { width: 1000, height: 1000 }), { x: 25, y: 50 });
  assert.deepEqual(
    worldRectFromDrag({ x: 800, y: 100 }, { x: 200, y: 700 }, { width: 1000, height: 1000 }),
    { left: 20, top: 10, width: 60, height: 60 },
  );
});

test('builder snaps doors to nearby dark wall pixels and creates route anchors', () => {
  const wall = findNearestDarkWall(darkLineImage(), { x: 48, y: 52 }, { radius: 5, darkThreshold: 80 });
  assert.deepEqual(wall, { x: 50, y: 52, distance: 2 });

  const model = {
    key: 'builder-test',
    image: '/global_map/default.png',
    corridors: [{ key: 'hall', left: 50, top: 20, width: 8, height: 60 }],
    rooms: {
      think_lab: {
        name: 'Thinking Room',
        rect: { left: 20, top: 20, width: 30, height: 30 },
        states: ['thinking'],
        event_hints: ['UserPromptSubmit'],
        furniture: [],
      },
    },
  };

  addDoorToRoom(model, 'think_lab', { x: 50, y: 35 }, { side: 'right' });

  assert.deepEqual(model.rooms.think_lab.portal, { x: 50, y: 35 });
  assert.deepEqual(model.rooms.think_lab.aisle, { x: 47, y: 35 });
  assert.deepEqual(model.rooms.think_lab.hub, { x: 53, y: 35 });
});

test('builder summarizes extreme dark PNG pixels as wall mask guidance', () => {
  const image = darkLineImage(100, 100);
  const summary = summarizeDarkWallMask(image, { darkThreshold: 80 });

  assert.equal(summary.darkPixels, 61);
  assert.equal(summary.totalPixels, 10000);
  assert.equal(summary.darkRatio, 0.01);
  assert.equal(summary.freeRatio, 0.99);
  assert.equal(summary.freeSpaceRule, 'non-dark pixels inside room/corridor boxes are treated as candidate free space');
});

test('builder exports YAML accepted by the existing global_map parser and validator', () => {
  const model = {
    key: 'builder-test',
    name: 'Builder Test',
    image: '/global_map/default.png',
    corridors: [{ key: 'hall', left: 50, top: 20, width: 8, height: 60 }],
    rooms: {
      think_lab: {
        name: 'Thinking Room',
        icon: 'lightbulb',
        rect: { left: 20, top: 20, width: 30, height: 30 },
        center: { x: 35, y: 35 },
        portal: { x: 50, y: 35 },
        aisle: { x: 47, y: 35 },
        hub: { x: 53, y: 35 },
        states: ['thinking'],
        event_hints: ['UserPromptSubmit'],
        furniture: [{ type: 'desk', x: 40, y: 45, w: 6.4, h: 4.6, scale: 1 }],
      },
    },
  };

  const validation = validateBuilderModel(model);
  assert.deepEqual(validation.errors, []);

  const yaml = exportBuilderYaml(model);
  const manifest = parseGlobalMapYaml(yaml);
  assert.equal(manifest.key, 'builder-test');
  assert.equal(manifest.rooms.think_lab.furniture[0].type, 'desk');
  assert.equal(validateGlobalMapManifest(manifest), true);
});

test('builder exports empty furniture as an explicit YAML list', () => {
  const yaml = exportBuilderYaml({
    key: 'empty-furniture-map',
    name: 'Empty Furniture Map',
    image: '/global_map/default.png',
    corridors: [{ key: 'hall', left: 10, top: 10, width: 80, height: 8 }],
    rooms: {
      offline_corner: {
        name: 'Offline Corner',
        rect: { left: 10, top: 20, width: 12, height: 10 },
        center: { x: 16, y: 25 },
        portal: { x: 16, y: 20 },
        aisle: { x: 16, y: 23 },
        hub: { x: 16, y: 14 },
        states: ['offline'],
        event_hints: ['blocked'],
        furniture: [],
      },
    },
  });
  assert.match(yaml, /furniture: \[\]/);
  const manifest = parseGlobalMapYaml(yaml);
  assert.deepEqual(manifest.rooms.offline_corner.furniture, []);
});

test('builder validation rejects disconnected doors and crowded furniture', () => {
  const model = {
    key: 'invalid-builder-map',
    image: '/global_map/default.png',
    corridors: [{ key: 'hall', left: 80, top: 80, width: 5, height: 5 }],
    rooms: {
      tiny_room: {
        name: 'Tiny Room',
        rect: { left: 10, top: 10, width: 10, height: 10 },
        center: { x: 15, y: 15 },
        portal: { x: 20, y: 15 },
        aisle: { x: 17, y: 15 },
        hub: { x: 23, y: 15 },
        states: [],
        event_hints: [],
        furniture: [
          { type: 'bed', x: 50, y: 50, w: 7.4, h: 5.8, scale: 1.8 },
          { type: 'table', x: 50, y: 50, w: 6.8, h: 4.8, scale: 1.8 },
        ],
      },
    },
  };

  const validation = validateBuilderModel(model);
  assert.ok(validation.errors.some((error) => error.includes('portal must touch a corridor')));
  assert.ok(validation.errors.some((error) => error.includes('furniture occupancy')));
});

test('builder supports pending room assignment confirm and cancel flow', () => {
  const pending = createPendingRect('room', { x: 100, y: 120 }, { x: 400, y: 520 }, { width: 1000, height: 1000 });
  assert.deepEqual(pending.rect, { left: 10, top: 12, width: 30, height: 40 });
  assert.equal(pending.status, 'pending');

  const model = { key: 'ux-flow', corridors: [], rooms: {} };
  const confirmed = confirmPendingRect(model, pending, {
    key: 'file_library',
    name: 'File Library',
    icon: 'books',
  });

  assert.equal(confirmed.selection.type, 'room');
  assert.equal(confirmed.selection.key, 'file_library');
  assert.deepEqual(model.rooms.file_library.center, { x: 25, y: 32 });
  assert.equal(model.rooms.file_library.name, 'File Library');
  assert.equal(cancelPendingRect(pending), null);
});

test('builder translates and resizes selected rooms and corridors for fine tuning', () => {
  const model = {
    corridors: [{ key: 'hall', left: 45, top: 20, width: 8, height: 60 }],
    rooms: {
      think_lab: {
        rect: { left: 10, top: 10, width: 20, height: 20 },
        center: { x: 20, y: 20 },
        portal: { x: 30, y: 20 },
        aisle: { x: 27, y: 20 },
        hub: { x: 33, y: 20 },
        furniture: [{ type: 'desk', x: 50, y: 50, w: 6, h: 4, scale: 1 }],
      },
    },
  };

  translateSelection(model, { type: 'room', key: 'think_lab' }, { dx: 5, dy: -3 });
  assert.deepEqual(model.rooms.think_lab.rect, { left: 15, top: 7, width: 20, height: 20 });
  assert.deepEqual(model.rooms.think_lab.center, { x: 25, y: 17 });
  assert.deepEqual(model.rooms.think_lab.portal, { x: 35, y: 17 });

  resizeSelection(model, { type: 'room', key: 'think_lab' }, 'se', { dx: 4, dy: 6 });
  assert.deepEqual(model.rooms.think_lab.rect, { left: 15, top: 7, width: 24, height: 26 });

  translateSelection(model, { type: 'corridor', index: 0 }, { dx: -5, dy: 2 });
  assert.deepEqual(model.corridors[0], { key: 'hall', left: 40, top: 22, width: 8, height: 60 });
});

test('builder exposes fast edit handles and draggable door anchors', () => {
  const model = {
    corridors: [{ key: 'hall', left: 45, top: 20, width: 8, height: 60 }],
    rooms: {
      think_lab: {
        rect: { left: 10, top: 10, width: 20, height: 20 },
        center: { x: 20, y: 20 },
        portal: { x: 30, y: 20 },
        aisle: { x: 27, y: 20 },
        hub: { x: 33, y: 20 },
        furniture: [{ type: 'desk', x: 50, y: 50, w: 6, h: 4, scale: 1 }],
      },
    },
  };

  assert.deepEqual(resizeHandlesForSelection(model, { type: 'room', key: 'think_lab' }), ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
  assert.deepEqual(doorAnchorPoints('think_lab', model.rooms.think_lab).map((item) => item.anchor), ['portal', 'aisle', 'hub']);

  translateSelection(model, { type: 'door_anchor', key: 'think_lab', anchor: 'hub' }, { dx: 2, dy: -1 });
  assert.deepEqual(model.rooms.think_lab.hub, { x: 35, y: 19 });

  translateSelection(model, { type: 'furniture', key: 'think_lab', index: 0 }, { dx: 5, dy: -7 });
  assert.deepEqual(model.rooms.think_lab.furniture[0], { type: 'desk', x: 75, y: 15, w: 6, h: 4, scale: 1 });
});

test('builder treats overlapping walkable boxes as warnings, not submit blockers', () => {
  const model = {
    key: 'overlap-walkable-map',
    image: '/global_map/default.png',
    corridors: [{ key: 'hall', left: 18, top: 20, width: 42, height: 8 }],
    rooms: {
      a: {
        rect: { left: 10, top: 10, width: 20, height: 20 },
        center: { x: 20, y: 20 },
        portal: { x: 20, y: 20 },
        aisle: { x: 20, y: 18 },
        hub: { x: 20, y: 22 },
        furniture: [],
      },
      b: {
        rect: { left: 24, top: 10, width: 20, height: 20 },
        center: { x: 34, y: 20 },
        portal: { x: 34, y: 20 },
        aisle: { x: 34, y: 18 },
        hub: { x: 34, y: 22 },
        furniture: [],
      },
    },
  };

  const overlaps = detectRoomOverlaps(model);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].severity, 'warning');

  const validation = validateBuilderModel(model);
  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some((warning) => warning.message === 'rooms a and b overlap'));
  assert.equal(validation.errors.some((error) => error.includes('overlap')), false);
});

test('builder route planning lets supplemental free-space bridge corridor gaps', () => {
  const model = {
    key: 'free-space-bridge-map',
    image: '/global_map/default.png',
    corridors: [
      { key: 'main-hall', left: 10, top: 40, width: 20, height: 8 },
      { key: 'offline-stub', left: 40, top: 40, width: 20, height: 8 },
    ],
    free_space: [{ key: 'manual-gap-bridge', left: 28, top: 40, width: 14, height: 8 }],
    rooms: {
      think_lab: {
        rect: { left: 10, top: 10, width: 20, height: 30 },
        center: { x: 20, y: 24 },
        portal: { x: 20, y: 40 },
        aisle: { x: 20, y: 35 },
        hub: { x: 20, y: 42 },
        states: ['thinking'],
        furniture: [],
      },
      offline_corner: {
        rect: { left: 44, top: 48, width: 12, height: 10 },
        center: { x: 50, y: 53 },
        portal: { x: 50, y: 48 },
        aisle: { x: 50, y: 51 },
        hub: { x: 50, y: 44 },
        states: ['offline'],
        furniture: [],
      },
    },
  };

  const routePlan = planRoomConnectivityRoutes(model);
  assert.equal(routePlan.ok, true);
  const validation = validateBuilderModel(model);
  assert.equal(validation.ok, true);
  assert.equal(validation.errors.some((error) => error.includes('offline-stub')), false);
});

test('builder eraser removes walkable boxes overlapped by a dragged rectangle', () => {
  const model = {
    corridors: [
      { key: 'main-hall', left: 10, top: 40, width: 20, height: 8 },
      { key: 'keep-hall', left: 70, top: 40, width: 20, height: 8 },
    ],
    free_space: [
      { key: 'bad-gap', left: 29, top: 40, width: 10, height: 8 },
      { key: 'keep-gap', left: 70, top: 52, width: 10, height: 8 },
    ],
    rooms: {
      bad_room: { rect: { left: 28, top: 48, width: 12, height: 10 }, furniture: [] },
      keep_room: { rect: { left: 70, top: 62, width: 12, height: 10 }, furniture: [] },
    },
  };

  const removed = eraseOverlappingWalkable(model, { left: 9, top: 39, width: 35, height: 22 });

  assert.deepEqual(removed, { rooms: 1, corridors: 1, free_space: 1, total: 3 });
  assert.deepEqual(Object.keys(model.rooms), ['keep_room']);
  assert.deepEqual(model.corridors.map((item) => item.key), ['keep-hall']);
  assert.deepEqual(model.free_space.map((item) => item.key), ['keep-gap']);
});

test('builder viewport supports ROS-like pan and preferred zoom', () => {
  const zoomed = nextViewport(
    { scale: 1, x: 0, y: 0 },
    { type: 'zoom', delta: 1, anchor: { x: 500, y: 400 } },
  );
  assert.equal(zoomed.scale, 1.12);
  assert.deepEqual(zoomed.preferredZoom, { x: 500, y: 400 });

  const panned = nextViewport(zoomed, { type: 'pan', dx: 30, dy: -12 });
  assert.equal(panned.x, 30);
  assert.equal(panned.y, -12);
});

test('builder room palette disables already assigned room keys', () => {
  const model = {
    rooms: {
      think_lab: { rect: { left: 10, top: 10, width: 10, height: 10 } },
    },
  };
  const palette = roomPaletteItems(model, 'zh-TW');

  assert.equal(palette.find((item) => item.key === 'think_lab').disabled, true);
  assert.equal(palette.find((item) => item.key === 'file_library').disabled, false);

  const pending = createPendingRect('room', { x: 200, y: 200 }, { x: 400, y: 400 }, { width: 1000, height: 1000 });
  assert.throws(() => assignRoomFromPalette(model, pending, 'think_lab'), /already assigned/);
  const result = assignRoomFromPalette(model, pending, 'file_library');
  assert.equal(result.selection.key, 'file_library');
  assert.equal(model.rooms.file_library.name, 'File Library');
});

test('builder live drag preview updates pending rect and label while dragging', () => {
  const pending = createPendingRect('room', { x: 100, y: 100 }, { x: 180, y: 180 }, { width: 1000, height: 1000 });
  const updated = updatePendingRect(pending, { x: 100, y: 100 }, { x: 420, y: 360 }, { width: 1000, height: 1000 });

  assert.deepEqual(updated.rect, { left: 10, top: 10, width: 32, height: 26 });
  assert.equal(pendingRectLabel(updated), 'L 10.0 / T 10.0 / W 32.0 / H 26.0');
});

test('builder layer panel exposes visibility, lock, and selectable targets', () => {
  const model = {
    corridors: [{ key: 'hall', left: 40, top: 20, width: 8, height: 60 }],
    rooms: {
      think_lab: {
        name: 'Thinking Room',
        rect: { left: 10, top: 10, width: 20, height: 20 },
        portal: { x: 30, y: 20 },
        furniture: [{ type: 'desk', x: 50, y: 50, w: 6, h: 4, scale: 1 }],
      },
    },
    layerState: {
      'room:think_lab': { visible: true, locked: false },
    },
  };

  const layers = buildLayerList(model);
  assert.deepEqual(layers.map((layer) => layer.id), ['room:think_lab', 'corridor:0', 'door:think_lab', 'furniture:think_lab:0']);
  assert.equal(layers[0].visible, true);
  assert.equal(layers[0].locked, false);

  toggleLayerVisibility(model, 'room:think_lab');
  setLayerLocked(model, 'room:think_lab', true);

  assert.equal(buildLayerList(model)[0].visible, false);
  assert.equal(buildLayerList(model)[0].locked, true);
  assert.equal(canEditSelection(model, { type: 'room', key: 'think_lab' }), false);
});

test('builder i18n provides required labels for supported languages', () => {
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const strings = getBuilderStrings(locale);
    assert.ok(strings.loadPng);
    assert.ok(strings.layers);
    assert.ok(strings.assignRoomInfo);
    assert.ok(strings.dragHint);
  }
});

test('builder tool help items provide hover guidance for every editing mode', () => {
  const helpItems = builderToolHelpItems('zh-TW');
  assert.deepEqual(helpItems.map((item) => item.mode), ['room', 'corridor', 'door', 'furniture', 'select']);
  assert.ok(helpItems.every((item) => item.help.includes('拖') || item.help.includes('點')));
});

test('builder furniture palette exposes draggable furniture templates with footprints', () => {
  const palette = furniturePaletteItems();
  const desk = palette.find((item) => item.type === 'desk');
  const bed = palette.find((item) => item.type === 'bed');

  assert.ok(desk);
  assert.equal(desk.icon, 'desk');
  assert.equal(desk.w, 6.4);
  assert.ok(bed.h > desk.h);
});

test('builder validation fails closed when a state room has no usable door into the route graph', () => {
  const model = {
    key: 'isolated-signal-room',
    image: '/global_map/default.png',
    corridors: [{ key: 'main-hall', left: 10, top: 40, width: 70, height: 6 }],
    rooms: {
      think_lab: {
        rect: { left: 10, top: 10, width: 20, height: 30 },
        center: { x: 20, y: 24 },
        portal: { x: 20, y: 40 },
        aisle: { x: 20, y: 35 },
        hub: { x: 20, y: 42 },
        states: ['thinking'],
        furniture: [{ type: 'desk', x: 50, y: 50, w: 4, h: 4, scale: 1 }],
      },
      offline_corner: {
        rect: { left: 10, top: 80, width: 16, height: 10 },
        center: { x: 18, y: 85 },
        portal: { x: 18, y: 80 },
        aisle: { x: 18, y: 84 },
        hub: { x: 18, y: 74 },
        states: ['offline', 'blocked'],
        furniture: [],
      },
    },
  };

  const routePlan = planRoomConnectivityRoutes(model);
  assert.equal(routePlan.ok, false);
  assert.ok(routePlan.unreachable.some((item) => item.room === 'offline_corner'));

  const validation = validateBuilderModel(model);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('offline_corner')));
  assert.ok(validation.errors.some((error) => error.includes('cannot route')));
});

test('builder prompt checklist guides PNG/YAML authors through doors, rooms, furniture, and submit gates', () => {
  const checklist = mapBuilderPromptChecklist('zh-TW');
  const text = checklist.join('\n');

  assert.ok(text.includes('PNG'));
  assert.ok(text.includes('YAML'));
  assert.ok(text.includes('door'));
  assert.ok(text.includes('corridor'));
  assert.ok(text.includes('furniture'));
  assert.ok(text.includes('Submit'));
});


test('builder lets corridors and free-space patches be selected, moved, and resized like rooms', () => {
  const model = {
    rooms: {},
    corridors: [{ key: 'hall', left: 20, top: 40, width: 20, height: 8 }],
    free_space: [{ key: 'door-gap', left: 38, top: 42, width: 6, height: 5 }],
  };

  assert.deepEqual(resizeHandlesForSelection(model, { type: 'corridor', index: 0 }), ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
  assert.deepEqual(resizeHandlesForSelection(model, { type: 'free_space', index: 0 }), ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);

  resizeSelection(model, { type: 'corridor', index: 0 }, 'e', { dx: 10, dy: 0 });
  assert.equal(model.corridors[0].width, 30);
  translateSelection(model, { type: 'free_space', index: 0 }, { dx: 4, dy: -2 });
  assert.deepEqual(model.free_space[0], { key: 'door-gap', left: 42, top: 40, width: 6, height: 5 });
  resizeSelection(model, { type: 'free_space', index: 0 }, 's', { dx: 0, dy: 3 });
  assert.equal(model.free_space[0].height, 8);
});

test('builder exports and parses supplemental free-space rectangles', () => {
  const model = {
    key: 'free-space-test',
    name: 'Free Space Test',
    image: '/global_map/default.png',
    bounds: { left: 2, top: 2, width: 96, height: 96 },
    corridors: [{ key: 'hall', left: 20, top: 40, width: 28, height: 8 }],
    free_space: [{ key: 'door-gap', left: 47, top: 42, width: 5, height: 4 }],
    rooms: {},
  };

  const yaml = exportBuilderYaml(model);
  assert.match(yaml, /free_space:/);
  assert.match(yaml, /key: door-gap/);
  const parsed = parseGlobalMapYaml(yaml);
  assert.ok(parsed.free_space.some((item) => item.key === 'door-gap' && item.left === 47 && item.top === 42));
  assert.ok(parsed.free_space.some((item) => item.key === 'hall'));
});
