import type { AgentAction, Facing, GridPoint, StationDefinition, TerrainArea, TerrainKind, WorldDefinition } from './types';

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

const topBridge = rectPoints(18, 8, 3, 1);
const southBridge = rectPoints(18, 16, 3, 1);
const roadPoints = [
  ...lineH(5, 28, 8),
  ...lineH(10, 28, 16),
  ...lineV(10, 7, 19),
  ...lineV(28, 7, 18),
  ...lineH(5, 10, 7),
  ...lineH(5, 10, 19),
  ...lineH(28, 35, 18),
  ...lineH(10, 17, 11),
  ...lineH(22, 28, 8),
  ...topBridge,
  ...southBridge,
];
const plazaPoints = rectPoints(12, 9, 6, 5);

export const WORLD_DEFINITION: WorldDefinition = {
  width: 40,
  height: 22,
  spawn: { x: 15, y: 11 },
  buildings: [
    {
      id: 'research-library', label: 'Research Library', themeId: 'research-library',
      bounds: { x: 3, y: 4, width: 5, height: 3 }, labelAnchor: { x: 5.5, y: 3 },
      entrance: { outside: { x: 5, y: 7 }, threshold: { x: 5, y: 6 }, entryFacing: 'up', exitFacing: 'down' },
    },
    {
      id: 'maker-workshop', label: 'Maker Workshop', themeId: 'maker-workshop',
      bounds: { x: 26, y: 4, width: 5, height: 3 }, labelAnchor: { x: 28.5, y: 3 },
      entrance: { outside: { x: 28, y: 7 }, threshold: { x: 28, y: 6 }, entryFacing: 'up', exitFacing: 'down' },
    },
    {
      id: 'rest-cabin', label: 'Rest Cabin', themeId: 'rest-cabin',
      bounds: { x: 3, y: 16, width: 5, height: 3 }, labelAnchor: { x: 5.5, y: 15 },
      entrance: { outside: { x: 5, y: 19 }, threshold: { x: 5, y: 18 }, entryFacing: 'up', exitFacing: 'down' },
    },
    {
      id: 'collaboration-barn', label: 'Collaboration Barn', themeId: 'collaboration-barn',
      bounds: { x: 32, y: 15, width: 5, height: 3 }, labelAnchor: { x: 34.5, y: 14 },
      entrance: { outside: { x: 34, y: 18 }, threshold: { x: 34, y: 17 }, entryFacing: 'up', exitFacing: 'down' },
    },
  ],
  zones: [
    { id: 'arrival-square', label: 'Village Square', bounds: { x: 12, y: 9, width: 6, height: 5 } },
    { id: 'workshop-apron', label: 'Repair Apron', bounds: { x: 22, y: 7, width: 3, height: 3 } },
    { id: 'riverside-wait', label: 'Riverside Benches', bounds: { x: 11, y: 14, width: 7, height: 3 } },
  ],
  scenery: {
    trees: [
      { id: 'tree-northwest', trunk: { x: 10, y: 3 } },
      { id: 'tree-library', trunk: { x: 13, y: 6 } },
      { id: 'tree-river-north', trunk: { x: 22, y: 4 } },
      { id: 'tree-northeast', trunk: { x: 35, y: 4 } },
      { id: 'tree-square-west', trunk: { x: 3, y: 10 } },
      { id: 'tree-square-south', trunk: { x: 9, y: 12 } },
      { id: 'tree-east-bank', trunk: { x: 37, y: 9 } },
      { id: 'tree-rest-garden', trunk: { x: 2, y: 20 } },
      { id: 'tree-crops', trunk: { x: 14, y: 20 } },
      { id: 'tree-barn', trunk: { x: 38, y: 20 } },
    ],
    river: [
      { x: 18, y: 1, width: 2, height: 8 },
      { x: 19, y: 8, width: 2, height: 9 },
      { x: 18, y: 16, width: 2, height: 5 },
    ],
    bridges: [{ x: 18, y: 8, width: 3, height: 1 }, { x: 18, y: 16, width: 3, height: 1 }],
    pastures: [{ x: 22, y: 10, width: 6, height: 5 }],
    cropFields: [{ x: 11, y: 17, width: 6, height: 3 }],
    flowerBeds: [{ x: 8, y: 14, width: 2, height: 2 }],
    animals: [
      { id: 'cow-mochi', species: 'cow', patrolBounds: { x: 22, y: 10, width: 3, height: 3 }, start: { x: 23, y: 11 }, speed: 6 },
      { id: 'sheep-cloud', species: 'sheep', patrolBounds: { x: 24, y: 11, width: 4, height: 4 }, start: { x: 26, y: 12 }, speed: 7 },
      { id: 'chicken-peep', species: 'chicken', patrolBounds: { x: 22, y: 12, width: 3, height: 3 }, start: { x: 23, y: 13 }, speed: 9 },
      { id: 'pig-bean', species: 'pig', patrolBounds: { x: 25, y: 10, width: 3, height: 3 }, start: { x: 26, y: 11 }, speed: 6 },
    ],
  },
  terrain: terrainCells([
    { kind: 'road', cost: 1, points: roadPoints },
    { kind: 'plaza', cost: 1, points: plazaPoints },
  ]),
  obstacleRects: [
    { x: 0, y: 0, width: 40, height: 1 }, { x: 0, y: 21, width: 40, height: 1 },
    { x: 0, y: 1, width: 1, height: 20 }, { x: 39, y: 1, width: 1, height: 20 },
    { x: 3, y: 4, width: 5, height: 2 }, { x: 3, y: 6, width: 2, height: 1 }, { x: 6, y: 6, width: 2, height: 1 },
    { x: 26, y: 4, width: 5, height: 2 }, { x: 26, y: 6, width: 2, height: 1 }, { x: 29, y: 6, width: 2, height: 1 },
    { x: 3, y: 16, width: 5, height: 2 }, { x: 3, y: 18, width: 2, height: 1 }, { x: 6, y: 18, width: 2, height: 1 },
    { x: 32, y: 15, width: 5, height: 2 }, { x: 32, y: 17, width: 2, height: 1 }, { x: 35, y: 17, width: 2, height: 1 },
    { x: 18, y: 1, width: 2, height: 8 }, { x: 19, y: 8, width: 2, height: 9 }, { x: 18, y: 16, width: 2, height: 5 },
    { x: 22, y: 10, width: 6, height: 5 }, { x: 11, y: 17, width: 6, height: 3 }, { x: 8, y: 14, width: 2, height: 2 },
    { x: 10, y: 3, width: 1, height: 1 }, { x: 13, y: 6, width: 1, height: 1 },
    { x: 22, y: 4, width: 1, height: 1 }, { x: 35, y: 4, width: 1, height: 1 },
    { x: 3, y: 10, width: 1, height: 1 }, { x: 9, y: 12, width: 1, height: 1 },
    { x: 37, y: 9, width: 1, height: 1 }, { x: 2, y: 20, width: 1, height: 1 },
    { x: 14, y: 20, width: 1, height: 1 }, { x: 38, y: 20, width: 1, height: 1 },
  ],
  walkableOverrides: [
    { x: 5, y: 6 }, { x: 28, y: 6 }, { x: 5, y: 18 }, { x: 34, y: 17 },
    ...topBridge, ...southBridge,
  ],
  stations: [
    station('arrival', 'arrival-square', [slot('arrival-1', 15, 11, 'down', 'arrive')]),
    station('research-plan', 'research-library', [slot('plan-1', 4, 7, 'up', 'plan'), slot('plan-2', 5, 7, 'up', 'ponder')], [{ x: 6, y: 7 }], 'research-library'),
    station('research-read', 'research-library', [slot('read-1', 6, 7, 'up', 'read'), slot('read-2', 7, 7, 'up', 'read')], [{ x: 8, y: 8 }], 'research-library'),
    station('research-web', 'research-library', [slot('web-1', 8, 8, 'up', 'signal'), slot('web-2', 9, 8, 'up', 'signal')], [{ x: 10, y: 8 }], 'research-library'),
    station('maker-edit', 'maker-workshop', [slot('edit-1', 26, 7, 'up', 'type'), slot('edit-2', 27, 7, 'up', 'type')], [{ x: 25, y: 7 }], 'maker-workshop'),
    station('maker-tool', 'maker-workshop', [slot('tool-1', 28, 7, 'up', 'terminal'), slot('tool-2', 29, 7, 'up', 'terminal')], [{ x: 30, y: 7 }], 'maker-workshop'),
    station('maker-heal', 'maker-workshop', [slot('heal-1', 27, 8, 'up', 'repair'), slot('heal-2', 28, 8, 'up', 'repair')], [{ x: 26, y: 8 }], 'maker-workshop'),
    station('rest-sofa', 'rest-cabin', [slot('rest-1', 4, 19, 'up', 'rest'), slot('rest-2', 5, 19, 'up', 'rest')], [{ x: 6, y: 19 }], 'rest-cabin'),
    station('rest-bed', 'rest-cabin', [slot('offline-1', 6, 19, 'up', 'offline'), slot('offline-2', 7, 19, 'up', 'offline')], [{ x: 8, y: 19 }], 'rest-cabin'),
    station('dispatch-pod', 'collaboration-barn', [slot('dispatch-1', 32, 18, 'up', 'dispatch'), slot('dispatch-2', 33, 18, 'up', 'dispatch')], [{ x: 31, y: 18 }], 'collaboration-barn'),
    station('response-radio', 'collaboration-barn', [slot('respond-1', 34, 18, 'up', 'respond'), slot('respond-2', 35, 18, 'up', 'respond')], [{ x: 36, y: 18 }], 'collaboration-barn'),
    station('queue-benches', 'arrival-square', [slot('queue-1', 13, 12, 'right', 'queue'), slot('queue-2', 14, 12, 'right', 'queue'), slot('queue-3', 15, 12, 'right', 'queue')], [{ x: 16, y: 12 }, { x: 17, y: 12 }]),
    station('blocked-apron', 'workshop-apron', [slot('blocked-1', 23, 8, 'right', 'repair'), slot('blocked-2', 24, 8, 'right', 'repair')], [{ x: 22, y: 8 }]),
  ],
};
