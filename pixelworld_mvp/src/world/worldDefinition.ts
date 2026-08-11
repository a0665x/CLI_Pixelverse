import type {
  AgentAction,
  Facing,
  GridPoint,
  StationDefinition,
  TerrainArea,
  TerrainKind,
  WorldBuilding,
  WorldDefinition,
} from './types';

const slot = (id: string, x: number, y: number, facing: Facing, action: AgentAction) => ({
  id, point: { x, y }, facing, action,
});
const station = (
  id: string,
  zoneId: string,
  slots: ReturnType<typeof slot>[],
  queue: GridPoint[] = [],
  buildingId?: string,
): StationDefinition => ({
  id,
  zoneId,
  ...(buildingId ? { buildingId, interiorSceneId: `${buildingId}-interior` } : {}),
  approachAnchors: slots.map((item) => item.point),
  interactionSlots: slots,
  queueAnchors: queue,
});

const pointKey = ({ x, y }: GridPoint): string => `${x},${y}`;
const lineH = (x1: number, x2: number, y: number): GridPoint[] =>
  Array.from({ length: x2 - x1 + 1 }, (_, index) => ({ x: x1 + index, y }));
const lineV = (x: number, y1: number, y2: number): GridPoint[] =>
  Array.from({ length: y2 - y1 + 1 }, (_, index) => ({ x, y: y1 + index }));
const rectPoints = (x: number, y: number, width: number, height: number): GridPoint[] =>
  Array.from({ length: width * height }, (_, index) => ({
    x: x + index % width,
    y: y + Math.floor(index / width),
  }));
const terrainCells = (groups: Array<{ kind: TerrainKind; cost: number; points: GridPoint[] }>): TerrainArea[] => {
  const cells = new Map<string, TerrainArea>();
  groups.forEach(({ kind, cost, points }) => points.forEach((point) => {
    cells.set(pointKey(point), { kind, cost, bounds: { ...point, width: 1, height: 1 } });
  }));
  return [...cells.values()];
};

const building = (
  id: string,
  label: string,
  themeId: WorldBuilding['themeId'],
  x: number,
  y: number,
  doorX: number,
): WorldBuilding => ({
  id,
  label,
  themeId,
  bounds: { x, y, width: 5, height: 4 },
  labelAnchor: { x: x + 2.5, y: y - 0.5 },
  entrance: {
    threshold: { x: doorX, y: y + 3 },
    outside: { x: doorX, y: y + 4 },
    entryFacing: 'up',
    exitFacing: 'down',
  },
});

const buildings: WorldBuilding[] = [
  building('arrival-lodge', 'Arrival Lodge · 啟程小屋', 'collaboration-barn', 1, 2, 3),
  building('thinkers-cottage', 'Thinker’s Cottage · 思考屋', 'research-library', 9, 2, 11),
  building('archive-library', 'Archive Library · 檔案館', 'research-library', 18, 2, 20),
  building('network-lab', 'Web / MCP Lab · 網路屋', 'research-library', 31, 2, 33),
  building('heartbeat-tower', 'Heartbeat Tower · 心跳塔', 'collaboration-barn', 40, 2, 42),
  building('offline-dormitory', 'Offline Dormitory · 離線宿舍', 'rest-cabin', 2, 10, 4),
  building('maker-workshop', 'Maker Workshop · 編輯工坊', 'maker-workshop', 40, 10, 42),
  building('tool-smithy', 'Tool Smithy · 工具鐵舖', 'maker-workshop', 1, 20, 3),
  building('awaiting-post', 'Awaiting Post · 等候站', 'collaboration-barn', 9, 20, 11),
  building('collaboration-barn', 'Agent Guild · 協作公會', 'collaboration-barn', 18, 20, 20),
  building('recovery-clinic', 'Recovery Clinic · 修復所', 'maker-workshop', 31, 20, 33),
  building('rest-cabin', 'Rest Cabin · 休息小屋', 'rest-cabin', 40, 20, 42),
];

const trees = [
  { id: 'tree-nw', trunk: { x: 7, y: 2 } }, { id: 'tree-thinker', trunk: { x: 15, y: 3 } },
  { id: 'tree-archive', trunk: { x: 24, y: 2 } }, { id: 'tree-network', trunk: { x: 37, y: 3 } },
  { id: 'tree-east', trunk: { x: 46, y: 3 } }, { id: 'tree-mid-west', trunk: { x: 9, y: 11 } },
  { id: 'tree-square', trunk: { x: 17, y: 12 } }, { id: 'tree-river', trunk: { x: 26, y: 10 } },
  { id: 'tree-mid-east', trunk: { x: 37, y: 11 } }, { id: 'tree-tool', trunk: { x: 8, y: 21 } },
  { id: 'tree-await', trunk: { x: 15, y: 22 } }, { id: 'tree-guild', trunk: { x: 24, y: 21 } },
  { id: 'tree-recovery', trunk: { x: 37, y: 22 } }, { id: 'tree-rest', trunk: { x: 45, y: 21 } },
  { id: 'orchard-a', trunk: { x: 10, y: 12 } }, { id: 'orchard-b', trunk: { x: 11, y: 12 } },
  { id: 'orchard-c', trunk: { x: 10, y: 13 } }, { id: 'orchard-d', trunk: { x: 12, y: 13 } },
  { id: 'west-park-a', trunk: { x: 2, y: 16 } }, { id: 'west-park-b', trunk: { x: 4, y: 18 } },
  { id: 'west-park-c', trunk: { x: 6, y: 16 } }, { id: 'library-garden-a', trunk: { x: 15, y: 10 } },
  { id: 'library-garden-b', trunk: { x: 15, y: 17 } }, { id: 'plaza-north-a', trunk: { x: 17, y: 8 } },
  { id: 'plaza-north-b', trunk: { x: 26, y: 8 } }, { id: 'plaza-south-a', trunk: { x: 26, y: 18 } },
  { id: 'plaza-south-b', trunk: { x: 26, y: 20 } }, { id: 'east-garden-a', trunk: { x: 39, y: 9 } },
  { id: 'east-garden-b', trunk: { x: 45, y: 9 } }, { id: 'pasture-edge-a', trunk: { x: 39, y: 16 } },
  { id: 'pasture-edge-b', trunk: { x: 45, y: 17 } }, { id: 'south-verge-a', trunk: { x: 6, y: 26 } },
  { id: 'south-verge-b', trunk: { x: 24, y: 26 } }, { id: 'south-verge-c', trunk: { x: 39, y: 26 } },
];

const northBridge = rectPoints(27, 6, 2, 1);
const topBridge = rectPoints(27, 14, 2, 1);
const southBridge = rectPoints(27, 24, 2, 1);
const roadPoints = [
  ...lineH(3, 44, 6),
  ...lineH(2, 25, 7),
  ...lineH(30, 46, 7),
  ...lineH(4, 44, 14),
  ...lineH(7, 9, 13),
  ...lineH(11, 11, 13),
  ...lineH(13, 17, 13),
  ...lineH(29, 39, 13),
  ...lineH(45, 46, 13),
  ...lineH(3, 44, 24),
  ...lineH(2, 25, 25),
  ...lineH(30, 46, 25),
  ...lineH(7, 9, 9),
  ...lineH(13, 16, 9),
  ...lineH(30, 33, 9),
  ...lineH(37, 38, 9),
  ...lineH(38, 46, 18),
  ...lineV(7, 6, 24),
  ...lineV(16, 6, 24),
  ...lineV(25, 6, 24),
  ...lineV(30, 6, 24),
  ...lineV(38, 6, 24),
  ...lineV(46, 6, 24),
  ...northBridge,
  ...topBridge,
  ...southBridge,
];
const plazaPoints = rectPoints(18, 11, 7, 6);

const buildingObstacles = buildings.flatMap(({ bounds, entrance }) => [
  { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height - 1 },
  { x: bounds.x, y: bounds.y + bounds.height - 1, width: entrance.threshold.x - bounds.x, height: 1 },
  {
    x: entrance.threshold.x + 1,
    y: bounds.y + bounds.height - 1,
    width: bounds.x + bounds.width - entrance.threshold.x - 1,
    height: 1,
  },
]);

export const WORLD_DEFINITION: WorldDefinition = {
  width: 48,
  height: 28,
  spawn: { x: 21, y: 14 },
  buildings,
  zones: [
    ...buildings.map(({ id, label, bounds }) => ({ id, label, bounds: { ...bounds, height: 5 } })),
    { id: 'village-square', label: 'Village Square', bounds: { x: 18, y: 11, width: 7, height: 6 } },
  ],
  scenery: {
    trees,
    decorations: [
      { id: 'square-fire', kind: 'campfire', point: { x: 17, y: 15 } },
      { id: 'square-seat-a', kind: 'bench', point: { x: 17, y: 16 } },
      { id: 'square-seat-b', kind: 'bench', point: { x: 26, y: 16 } },
      { id: 'square-board', kind: 'signboard', point: { x: 17, y: 10 } },
      { id: 'farm-crate', kind: 'crate', point: { x: 17, y: 18 } },
      { id: 'archive-crate', kind: 'crate', point: { x: 24, y: 8 } },
      { id: 'west-river-rock', kind: 'rock', point: { x: 24, y: 10 } },
      { id: 'east-river-rock', kind: 'rock', point: { x: 29, y: 8 } },
      { id: 'south-river-rock', kind: 'rock', point: { x: 29, y: 22 } },
      { id: 'west-wildflowers', kind: 'flowers', point: { x: 1, y: 17 } },
      { id: 'east-wildflowers', kind: 'flowers', point: { x: 45, y: 17 } },
      { id: 'guild-wildflowers', kind: 'flowers', point: { x: 17, y: 19 } },
      { id: 'west-park-seat-a', kind: 'bench', point: { x: 2, y: 18 } },
      { id: 'west-park-seat-b', kind: 'bench', point: { x: 5, y: 18 } },
      { id: 'west-crossroad-sign', kind: 'signboard', point: { x: 6, y: 9 } },
      { id: 'west-garden-flowers', kind: 'flowers', point: { x: 2, y: 8 } },
      { id: 'west-park-flowers', kind: 'flowers', point: { x: 5, y: 16 } },
      { id: 'west-park-rock', kind: 'rock', point: { x: 6, y: 17 } },
      { id: 'orchard-supplies', kind: 'crate', point: { x: 14, y: 8 } },
      { id: 'plaza-north-seat-a', kind: 'bench', point: { x: 17, y: 9 } },
      { id: 'plaza-north-seat-b', kind: 'bench', point: { x: 24, y: 9 } },
      { id: 'plaza-south-sign', kind: 'signboard', point: { x: 24, y: 17 } },
      { id: 'plaza-north-flowers', kind: 'flowers', point: { x: 17, y: 8 } },
      { id: 'plaza-south-flowers', kind: 'flowers', point: { x: 24, y: 18 } },
      { id: 'river-walk-rock', kind: 'rock', point: { x: 26, y: 18 } },
      { id: 'farm-lane-crate', kind: 'crate', point: { x: 17, y: 18 } },
      { id: 'pasture-seat-a', kind: 'bench', point: { x: 40, y: 19 } },
      { id: 'pasture-seat-b', kind: 'bench', point: { x: 45, y: 19 } },
      { id: 'east-crossroad-sign-a', kind: 'signboard', point: { x: 39, y: 9 } },
      { id: 'east-crossroad-sign-b', kind: 'signboard', point: { x: 45, y: 8 } },
      { id: 'pasture-flowers-a', kind: 'flowers', point: { x: 45, y: 16 } },
      { id: 'pasture-flowers-b', kind: 'flowers', point: { x: 39, y: 19 } },
      { id: 'pasture-rock', kind: 'rock', point: { x: 44, y: 17 } },
      { id: 'pasture-crate', kind: 'crate', point: { x: 39, y: 17 } },
    ],
    river: [
      { x: 27, y: 1, width: 2, height: 5 },
      { x: 27, y: 7, width: 2, height: 7 },
      { x: 27, y: 15, width: 2, height: 9 },
      { x: 27, y: 25, width: 2, height: 2 },
    ],
    bridges: [{ x: 27, y: 6, width: 2, height: 1 }, { x: 27, y: 14, width: 2, height: 1 }, { x: 27, y: 24, width: 2, height: 1 }],
    pastures: [{ x: 31, y: 15, width: 7, height: 5 }],
    cropFields: [{ x: 8, y: 16, width: 7, height: 4 }],
    flowerBeds: [{ x: 10, y: 8, width: 3, height: 2 }, { x: 34, y: 8, width: 3, height: 2 }],
    animals: [
      { id: 'cow-mochi', species: 'cow', patrolBounds: { x: 31, y: 15, width: 3, height: 3 }, start: { x: 32, y: 16 }, speed: 6 },
      { id: 'cow-cocoa', species: 'cow', patrolBounds: { x: 32, y: 17, width: 3, height: 3 }, start: { x: 33, y: 18 }, speed: 5 },
      { id: 'sheep-cloud', species: 'sheep', patrolBounds: { x: 34, y: 16, width: 4, height: 4 }, start: { x: 35, y: 17 }, speed: 7 },
      { id: 'sheep-wool', species: 'sheep', patrolBounds: { x: 35, y: 16, width: 3, height: 4 }, start: { x: 37, y: 18 }, speed: 6 },
      { id: 'sheep-snow', species: 'sheep', patrolBounds: { x: 33, y: 15, width: 3, height: 3 }, start: { x: 34, y: 16 }, speed: 7 },
      { id: 'chicken-peep', species: 'chicken', patrolBounds: { x: 31, y: 18, width: 3, height: 3 }, start: { x: 32, y: 19 }, speed: 9 },
      { id: 'chicken-pip', species: 'chicken', patrolBounds: { x: 35, y: 17, width: 3, height: 3 }, start: { x: 36, y: 19 }, speed: 9 },
      { id: 'chicken-dot', species: 'chicken', patrolBounds: { x: 32, y: 16, width: 3, height: 3 }, start: { x: 33, y: 17 }, speed: 8 },
      { id: 'pig-bean', species: 'pig', patrolBounds: { x: 35, y: 15, width: 3, height: 3 }, start: { x: 36, y: 16 }, speed: 6 },
      { id: 'pig-truffle', species: 'pig', patrolBounds: { x: 33, y: 17, width: 3, height: 3 }, start: { x: 34, y: 18 }, speed: 6 },
    ],
  },
  terrain: terrainCells([
    { kind: 'road', cost: 1, points: roadPoints },
    { kind: 'plaza', cost: 1, points: plazaPoints },
  ]),
  obstacleRects: [
    { x: 0, y: 0, width: 48, height: 1 }, { x: 0, y: 27, width: 48, height: 1 },
    { x: 0, y: 1, width: 1, height: 26 }, { x: 47, y: 1, width: 1, height: 26 },
    ...buildingObstacles,
    { x: 27, y: 1, width: 2, height: 5 }, { x: 27, y: 7, width: 2, height: 7 },
    { x: 27, y: 15, width: 2, height: 9 },
    { x: 27, y: 25, width: 2, height: 2 },
    { x: 31, y: 15, width: 7, height: 5 }, { x: 8, y: 16, width: 7, height: 4 },
    { x: 10, y: 8, width: 3, height: 2 }, { x: 34, y: 8, width: 3, height: 2 },
    ...trees.map(({ trunk }) => ({ ...trunk, width: 1, height: 1 })),
  ],
  walkableOverrides: [
    ...buildings.flatMap(({ entrance }) => [entrance.threshold, entrance.outside]),
    ...northBridge,
    ...topBridge,
    ...southBridge,
  ],
  stations: [
    station('arrival', 'arrival-lodge', [slot('arrival-1', 3, 6, 'up', 'arrive')], [], 'arrival-lodge'),
    station('think-plan', 'thinkers-cottage', [slot('think-1', 11, 6, 'up', 'ponder'), slot('plan-1', 12, 6, 'up', 'plan')], [{ x: 10, y: 6 }], 'thinkers-cottage'),
    station('archive-read', 'archive-library', [slot('read-1', 20, 6, 'up', 'read'), slot('read-2', 21, 6, 'up', 'read')], [{ x: 19, y: 6 }], 'archive-library'),
    station('network-web', 'network-lab', [slot('web-1', 33, 6, 'up', 'signal'), slot('web-2', 34, 6, 'up', 'signal')], [{ x: 32, y: 6 }], 'network-lab'),
    station('heartbeat-pulse', 'heartbeat-tower', [slot('pulse-1', 42, 6, 'up', 'pulse')], [{ x: 43, y: 6 }], 'heartbeat-tower'),
    station('offline-bed', 'offline-dormitory', [slot('offline-1', 4, 14, 'up', 'offline'), slot('offline-2', 5, 14, 'up', 'offline')], [{ x: 6, y: 14 }], 'offline-dormitory'),
    station('maker-edit', 'maker-workshop', [slot('edit-1', 42, 14, 'up', 'type'), slot('edit-2', 43, 14, 'up', 'type')], [{ x: 41, y: 14 }], 'maker-workshop'),
    station('tool-call', 'tool-smithy', [slot('tool-1', 3, 24, 'up', 'terminal'), slot('tool-2', 4, 24, 'up', 'terminal')], [{ x: 5, y: 24 }], 'tool-smithy'),
    station('awaiting-wait', 'awaiting-post', [slot('wait-1', 11, 24, 'up', 'queue'), slot('wait-2', 12, 24, 'up', 'queue')], [{ x: 10, y: 24 }], 'awaiting-post'),
    station('guild-dispatch', 'collaboration-barn', [slot('dispatch-1', 20, 24, 'up', 'dispatch'), slot('dispatch-2', 21, 24, 'up', 'dispatch')], [{ x: 19, y: 24 }], 'collaboration-barn'),
    station('guild-respond', 'collaboration-barn', [slot('respond-1', 20, 24, 'up', 'respond'), slot('respond-2', 21, 24, 'up', 'respond')], [{ x: 22, y: 24 }], 'collaboration-barn'),
    station('recovery-blocked', 'recovery-clinic', [slot('blocked-1', 33, 24, 'up', 'repair')], [{ x: 32, y: 24 }], 'recovery-clinic'),
    station('recovery-heal', 'recovery-clinic', [slot('heal-1', 33, 24, 'up', 'repair'), slot('heal-2', 34, 24, 'up', 'repair')], [{ x: 35, y: 24 }], 'recovery-clinic'),
    station('rest-sofa', 'rest-cabin', [slot('rest-1', 42, 24, 'up', 'rest'), slot('rest-2', 43, 24, 'up', 'rest')], [{ x: 41, y: 24 }], 'rest-cabin'),
  ],
};
