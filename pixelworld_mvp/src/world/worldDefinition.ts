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
// Station slots and waiting points are offsets from the current front door.
const station = (
  id: string,
  zoneId: string,
  slots: ReturnType<typeof slot>[],
  queue: GridPoint[] = [],
  buildingId?: string,
): StationDefinition => {
  const home = buildings.find((item) => item.id === buildingId);
  const relocate = (point: GridPoint): GridPoint => home ? {
    x: home.entrance.outside.x + point.x,
    y: home.entrance.outside.y + point.y,
  } : point;
  return ({
  id,
  zoneId,
  ...(buildingId ? { buildingId, interiorSceneId: `${buildingId}-interior` } : {}),
  approachAnchors: slots.map((item) => relocate(item.point)),
  interactionSlots: slots.map((item) => ({ ...item, point: relocate(item.point) })),
  queueAnchors: queue.map(relocate),
});
};

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
  interiorProfile: NonNullable<WorldBuilding['interiorProfile']>,
): WorldBuilding => ({
  id,
  label,
  themeId,
  interiorProfile,
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
  building('arrival-lodge', 'Arrival Lodge · 啟程小屋', 'collaboration-barn', 2, 3, 4, 'compact'),
  building('thinkers-cottage', 'Thinker’s Cottage · 思考屋', 'research-library', 11, 1, 13, 'work-office'),
  building('archive-library', 'Archive Library · 檔案館', 'research-library', 19, 4, 21, 'work-office'),
  building('network-lab', 'Web / MCP Lab · 網路屋', 'research-library', 31, 2, 33, 'work-office'),
  building('heartbeat-tower', 'Heartbeat Tower · 心跳塔', 'collaboration-barn', 40, 5, 42, 'work-office'),
  building('offline-dormitory', 'Offline Dormitory · 離線宿舍', 'rest-cabin', 3, 11, 5, 'compact'),
  building('maker-workshop', 'Maker Workshop · 編輯工坊', 'maker-workshop', 39, 13, 41, 'work-office'),
  building('tool-smithy', 'Tool Smithy · 工具鐵舖', 'maker-workshop', 1, 21, 3, 'work-office'),
  building('awaiting-post', 'Awaiting Post · 等候站', 'collaboration-barn', 10, 18, 12, 'compact'),
  building('collaboration-barn', 'Agent Guild · 協作公會', 'collaboration-barn', 18, 21, 20, 'work-office'),
  building('recovery-clinic', 'Recovery Clinic · 修復所', 'maker-workshop', 29, 22, 31, 'work-office'),
  building('rest-cabin', 'Rest Cabin · 休息小屋', 'rest-cabin', 40, 22, 42, 'compact'),
];

// The stream stays continuous underneath the three crossings. Each row overlaps
// the next; the varying banks form bends without disconnected diagonal water.
const river = Array.from({ length: 28 }, (_, y) => ({
  x: y < 5 ? 27 : y < 9 ? 26 : y < 13 ? 27 : y < 17 ? 28 : y < 20 ? 26 : y < 24 ? 24 : 25,
  y, width: y === 17 ? 4 : 3, height: 1,
}));
const bridges = [
  { x: 27, y: 9, width: 3, height: 1 },
  { x: 28, y: 16, width: 3, height: 1 },
  { x: 25, y: 24, width: 3, height: 1 },
];
const bridgePoints = bridges.flatMap(({ x, y, width, height }) => rectPoints(x, y, width, height));
// Hand-authored footpaths follow clearings and banks instead of a street grid.
const lane = (...corners: [number, number][]): GridPoint[] => corners.slice(1).flatMap(([x, y], index) => {
  const [px, py] = corners[index]!;
  if (px !== x && py !== y) throw new Error('Village lane segments must be orthogonal');
  return px === x ? lineV(x, Math.min(py, y), Math.max(py, y)) : lineH(Math.min(px, x), Math.max(px, x), y);
});
const authoredRoadPoints = [
  ...lane([4,7],[8,7],[8,9],[16,9],[16,11],[21,11],[21,14]),
  ...lane([13,5],[16,5],[16,9]),
  ...lane([21,8],[21,9],[32,9]),
  ...lane([5,15],[7,15],[7,17],[16,17],[16,14],[21,14]),
  ...lane([3,25],[8,25],[8,23],[12,23],[12,22],[16,22],[16,17]),
  ...lane([16,22],[16,25],[23,25],[23,24],[28,24],[28,20],[31,20],[31,16],[24,16],[24,14],[21,14]),
  ...lane([33,6],[36,6],[36,9],[36,14],[38,14],[38,18],[41,18],[41,17]),
  ...lane([42,9],[42,11],[36,11]),
  ...lane([30,9],[36,9]),

  ...lane([28,24],[28,26],[42,26]),
  ...lane([38,26],[38,18]),
  ...bridgePoints,

];
// Remove decorative dead ends: paths end at doors, crossings or other paths.
const roadCells = new Map(authoredRoadPoints.map(point => [pointKey(point), point]));
const destinations = new Set(buildings.map(({ entrance }) => pointKey(entrance.outside)));
let pruning = true;
while (pruning) {
  pruning = false;
  for (const [key, point] of roadCells) {
    if (destinations.has(key)) continue;
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => roadCells.has(`${point.x+dx!},${point.y+dy!}`));
    if (neighbors.length < 2) { roadCells.delete(key); pruning = true; }
  }
}
const roadPoints = [...roadCells.values()];
const plazaPoints = [...rectPoints(19,12,4,3), ...rectPoints(20,11,2,5)];
const pastures = [{ x: 32, y: 15, width: 6, height: 5 }];
const cropFields = [{ x: 9, y: 11, width: 5, height: 4 }];
const flowerBeds = [{ x: 10, y: 7, width: 3, height: 1 }, { x: 33, y: 7, width: 2, height: 1 }];
const treePoints = [[2,2],[4,1],[8,3],[9,2],[17,3],[24,3],[25,2],[31,1],[38,3],[46,4],
  [2,10],[8,12],[16,13],[17,12],[24,12],[46,12],[45,13],[2,18],[4,19],[6,18],
  [18,18],[20,17],[22,19],[30,18],[46,20],[45,19],[8,21],[17,26],[24,26],[37,25]];
const trees = treePoints.map(([x, y], index) => ({ id: `grove-${index}`, trunk: { x: x!, y: y! } }));

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
    { id: 'village-square', label: 'Village Square', bounds: { x: 19, y: 11, width: 4, height: 5 } },
  ],
  scenery: {
    trees,
    decorations: [
      { id: 'hill-flowers', kind: 'flowers', point: { x: 38, y: 6 } },
      { id: 'east-seat', kind: 'bench', point: { x: 44, y: 11 } },
      { id: 'square-fire', kind: 'campfire', point: { x: 18, y: 13 } },
      { id: 'square-seat', kind: 'bench', point: { x: 18, y: 16 } },
      { id: 'square-board', kind: 'signboard', point: { x: 23, y: 12 } },
      { id: 'farm-crate', kind: 'crate', point: { x: 14, y: 15 } },
      { id: 'archive-crate', kind: 'crate', point: { x: 24, y: 8 } },
      { id: 'north-bank-rock', kind: 'rock', point: { x: 30, y: 4 } },
      { id: 'bend-rock', kind: 'rock', point: { x: 25, y: 18 } },
      { id: 'west-flowers', kind: 'flowers', point: { x: 2, y: 16 } },
      { id: 'east-flowers', kind: 'flowers', point: { x: 45, y: 18 } },
      { id: 'orchard-seat', kind: 'bench', point: { x: 5, y: 19 } },
      { id: 'lane-sign', kind: 'signboard', point: { x: 9, y: 16 } },
      { id: 'guild-flowers', kind: 'flowers', point: { x: 23, y: 22 } },
      { id: 'pasture-crate', kind: 'crate', point: { x: 39, y: 20 } },
      { id: 'south-bank-rock', kind: 'rock', point: { x: 27, y: 23 } },
    ],
    river, bridges, pastures, cropFields, flowerBeds,
    animals: [
      { id: 'cow-mochi', species: 'cow', patrolBounds: { x: 32, y: 15, width: 3, height: 3 }, start: { x: 32, y: 16 }, speed: 6 },
      { id: 'cow-cocoa', species: 'cow', patrolBounds: { x: 32, y: 17, width: 3, height: 3 }, start: { x: 33, y: 18 }, speed: 5 },
      { id: 'sheep-cloud', species: 'sheep', patrolBounds: { x: 34, y: 16, width: 4, height: 4 }, start: { x: 35, y: 17 }, speed: 7 },
      { id: 'sheep-wool', species: 'sheep', patrolBounds: { x: 35, y: 16, width: 3, height: 4 }, start: { x: 37, y: 18 }, speed: 6 },
      { id: 'sheep-snow', species: 'sheep', patrolBounds: { x: 33, y: 15, width: 3, height: 3 }, start: { x: 34, y: 16 }, speed: 7 },
      { id: 'chicken-peep', species: 'chicken', patrolBounds: { x: 32, y: 17, width: 3, height: 3 }, start: { x: 32, y: 19 }, speed: 9 },
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
    ...river, ...pastures, ...cropFields, ...flowerBeds,
    ...trees.map(({ trunk }) => ({ ...trunk, width: 1, height: 1 })),
  ],
  walkableOverrides: [
    ...buildings.flatMap(({ entrance }) => [entrance.threshold, entrance.outside]),
    ...bridgePoints,
  ],
  stations: [
    station('arrival', 'arrival-lodge', [slot('arrival-1', 0, 0, 'up', 'arrive')], [], 'arrival-lodge'),
    station('think-plan', 'thinkers-cottage', [slot('think-1', 0, 0, 'up', 'ponder'), slot('plan-1', 1, 0, 'up', 'plan')], [{ x: -1, y: 0 }], 'thinkers-cottage'),
    station('archive-read', 'archive-library', [slot('read-1', 0, 0, 'up', 'read'), slot('read-2', 1, 0, 'up', 'read')], [{ x: -1, y: 0 }], 'archive-library'),
    station('network-web', 'network-lab', [slot('web-1', 0, 0, 'up', 'signal'), slot('web-2', 1, 0, 'up', 'signal')], [{ x: -1, y: 0 }], 'network-lab'),
    station('heartbeat-pulse', 'heartbeat-tower', [slot('pulse-1', 0, 0, 'up', 'pulse')], [{ x: 1, y: 0 }], 'heartbeat-tower'),
    station('offline-bed', 'offline-dormitory', [slot('offline-1', 0, 0, 'up', 'offline'), slot('offline-2', 1, 0, 'up', 'offline')], [{ x: 2, y: 0 }], 'offline-dormitory'),
    station('maker-edit', 'maker-workshop', [slot('edit-1', 0, 0, 'up', 'type'), slot('edit-2', 1, 0, 'up', 'type')], [{ x: -1, y: 0 }], 'maker-workshop'),
    station('tool-call', 'tool-smithy', [slot('tool-1', 0, 0, 'up', 'terminal'), slot('tool-2', 1, 0, 'up', 'terminal')], [{ x: 2, y: 0 }], 'tool-smithy'),
    station('awaiting-wait', 'awaiting-post', [slot('wait-1', 0, 0, 'up', 'queue'), slot('wait-2', 1, 0, 'up', 'queue')], [{ x: -1, y: 0 }], 'awaiting-post'),
    station('guild-dispatch', 'collaboration-barn', [slot('dispatch-1', 0, 0, 'up', 'dispatch'), slot('dispatch-2', 1, 0, 'up', 'dispatch')], [{ x: -1, y: 0 }], 'collaboration-barn'),
    station('guild-respond', 'collaboration-barn', [slot('respond-1', 0, 0, 'up', 'respond'), slot('respond-2', 1, 0, 'up', 'respond')], [{ x: 2, y: 0 }], 'collaboration-barn'),
    station('recovery-blocked', 'recovery-clinic', [slot('blocked-1', 0, 0, 'up', 'repair')], [{ x: -1, y: 0 }], 'recovery-clinic'),
    station('recovery-heal', 'recovery-clinic', [slot('heal-1', 0, 0, 'up', 'repair'), slot('heal-2', 1, 0, 'up', 'repair')], [{ x: 2, y: 0 }], 'recovery-clinic'),
    station('rest-sofa', 'rest-cabin', [slot('rest-1', 0, 0, 'up', 'rest'), slot('rest-2', 1, 0, 'up', 'rest')], [{ x: -1, y: 0 }], 'rest-cabin'),
  ],
};
