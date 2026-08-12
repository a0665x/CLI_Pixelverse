import type {
  ActivityIconKind,
  AgentAction,
  BuildingThemeId,
  Facing,
  FurnitureDefinition,
  FurnitureKind,
  FurnitureLayer,
  FurnitureRotation,
  FurnitureScale,
  InteriorDefinition,
  WorldBuilding,
} from './types';
import { prefabsForTheme } from '../rendering/builtInOfficePrefabs';
import { officeLayoutIssues, placeOfficePrefab } from '../rendering/prefabGeometry';

export const INTERIOR_LAYOUT_REVISION = 2;

type FurnitureOptions = Partial<Pick<
  FurnitureDefinition,
  'assetId' | 'blocksNavigation' | 'footprint' | 'layer' | 'rotation' | 'scale' | 'zIndex'
>>;

const furniture = (
  id: string,
  kind: FurnitureKind,
  x: number,
  y: number,
  facing: Facing,
  supportedActions: AgentAction[],
  icon: ActivityIconKind,
  options: FurnitureOptions = {},
): FurnitureDefinition => ({ id, kind, point: { x, y }, facing, supportedActions, icon, ...options });

const base = (
  id: string, kind: FurnitureKind, x: number, y: number, facing: Facing,
  supportedActions: AgentAction[], icon: ActivityIconKind, assetId: number,
  scale: FurnitureScale = 1,
): FurnitureDefinition => furniture(id, kind, x, y, facing, supportedActions, icon, {
  assetId, scale, layer: 'furniture', zIndex: 0, blocksNavigation: true,
});

const surface = (
  id: string, kind: FurnitureKind, x: number, y: number, assetId: number,
  scale: FurnitureScale = 1, zIndex = 1,
): FurnitureDefinition => furniture(id, kind, x, y, 'up', [], 'generic', {
  assetId, scale, layer: 'surface', zIndex, blocksNavigation: false,
});

const wall = (
  id: string, kind: FurnitureKind, x: number, y: number, facing: Facing,
  supportedActions: AgentAction[], icon: ActivityIconKind, assetId: number,
  rotation: FurnitureRotation = 0,
): FurnitureDefinition => furniture(id, kind, x, y, facing, supportedActions, icon, {
  assetId, rotation, layer: 'wall', zIndex: 0, blocksNavigation: supportedActions.length > 0,
});

const floor = (
  id: string, x: number, y: number, assetId: number, scale: FurnitureScale = 1,
): FurnitureDefinition => furniture(id, 'decor', x, y, 'down', [], 'generic', {
  assetId, scale, layer: 'floor' satisfies FurnitureLayer, zIndex: 0, blocksNavigation: false,
});

const FURNITURE_FOOTPRINTS: Record<FurnitureKind, { width: number; height: number }> = {
  sofa: { width: 2, height: 2 }, chair: { width: 1, height: 1 }, television: { width: 2, height: 2 },
  bed: { width: 2, height: 3 }, bookcase: { width: 2, height: 2 }, computer: { width: 1, height: 2 },
  'map-table': { width: 3, height: 2 }, 'planning-board': { width: 2, height: 2 },
  'reading-desk': { width: 3, height: 2 }, workbench: { width: 3, height: 2 },
  'tool-wall': { width: 2, height: 2 }, 'repair-table': { width: 3, height: 2 },
  'dispatch-pod': { width: 2, height: 2 }, 'radio-console': { width: 2, height: 2 },
  'response-desk': { width: 2, height: 2 }, 'meeting-table': { width: 3, height: 2 },
  decor: { width: 1, height: 1 },
  'office-chair': { width: 1, height: 1 }, display: { width: 2, height: 2 },
  desk: { width: 3, height: 2 }, cabinet: { width: 2, height: 2 }, plant: { width: 1, height: 2 },
  'beverage-station': { width: 1, height: 2 }, printer: { width: 2, height: 2 },
};

export const furnitureFootprint = (kind: FurnitureKind): { width: number; height: number } => ({
  ...FURNITURE_FOOTPRINTS[kind],
});

const COMPACT_INTERIOR_DEFINITIONS: Record<BuildingThemeId, InteriorDefinition> = {
  'rest-cabin': {
    id: 'rest-cabin', label: 'REST CABIN · 休息小屋', width: 14, height: 9, floor: 'wood', wall: 'cream',
    furniture: [
      floor('rest-rug', 6.5, 5.25, 189, 2),
      { ...base('rest-sofa-a', 'sofa', 4, 5, 'down', ['rest'], 'rest', 200, 1.25), blocksNavigation: false },
      { ...base('rest-sofa-b', 'sofa', 8.5, 5, 'down', ['rest', 'queue'], 'rest', 214, 1.25), blocksNavigation: false },
      base('rest-coffee-table', 'decor', 4, 6.25, 'down', [], 'generic', 193, 1.5),
      surface('rest-coffee-cups', 'decor', 4, 6.25, 120, 1.25),
      wall('rest-tv', 'television', 6.25, 1, 'up', [], 'generic', 172),
      { ...base('rest-bed-a', 'bed', 11.25, 3.25, 'right', ['offline'], 'offline', 200, 1.25), blocksNavigation: false },
      { ...base('rest-bed-b', 'bed', 11.25, 6.5, 'right', ['offline'], 'offline', 214, 1.25), blocksNavigation: false },
      surface('rest-bedside-a', 'decor', 11.25, 3.25, 119),
      surface('rest-bedside-b', 'decor', 11.25, 6.5, 120),
      surface('rest-lamp', 'decor', 4, 6.25, 153, 1, 2),
      surface('rest-plant', 'plant', 12.25, 1, 98),
      wall('rest-blocked-board', 'planning-board', 2, 1, 'up', ['repair'], 'repair', 171),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 4 }],
  },
  'research-library': {
    id: 'research-library', label: 'RESEARCH LIBRARY · 研究圖書館', width: 14, height: 9, floor: 'wood', wall: 'blue',
    furniture: [
      wall('research-planning-a', 'planning-board', 2, 1, 'up', ['ponder', 'plan'], 'plan', 171),
      base('research-map-a', 'map-table', 5.5, 4, 'down', ['ponder', 'plan'], 'think', 207, 1.5),
      surface('research-map-display', 'display', 5.5, 4, 168),
      base('research-reading-a', 'reading-desk', 2.25, 6.5, 'down', ['read'], 'read', 193, 1.5),
      surface('research-reading-books-a', 'decor', 2.25, 6.5, 156),
      base('research-reading-b', 'reading-desk', 5.25, 6.5, 'down', ['read'], 'read', 194, 1.5),
      surface('research-reading-books-b', 'decor', 5.25, 6.5, 157),
      base('research-computer-a', 'computer', 8.5, 2.25, 'up', ['signal'], 'web', 193, 1.5),
      surface('research-monitor-a', 'display', 8.5, 2.25, 141),
      base('research-computer-b', 'computer', 11.25, 2.25, 'up', ['signal'], 'web', 194, 1.5),
      surface('research-monitor-b', 'display', 11.25, 2.25, 144),
      base('research-chair-a', 'chair', 8.5, 4, 'up', [], 'generic', 101),
      base('research-chair-b', 'chair', 11.25, 4, 'up', [], 'generic', 102),
      wall('research-bookcase-a', 'bookcase', 9.5, 6.75, 'right', ['signal', 'read'], 'web', 176),
      wall('research-bookcase-b', 'bookcase', 12.25, 6.75, 'right', ['signal', 'read'], 'web', 174),
      wall('research-cabinet', 'cabinet', 13, 1.25, 'up', [], 'generic', 175),
      surface('research-plant', 'plant', 5.75, 1, 99),
    ],
    overflow: [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 4 }],
  },
  'maker-workshop': {
    id: 'maker-workshop', label: 'MAKER WORKSHOP · 製作工坊', width: 14, height: 9, floor: 'tile', wall: 'brick',
    furniture: [
      base('maker-terminal-a', 'computer', 2.25, 2.25, 'up', ['type', 'terminal'], 'edit', 193, 1.5),
      surface('maker-monitor-a', 'display', 2.25, 2.25, 141),
      surface('maker-lamp-a', 'decor', 2.25, 2.25, 251, 1, 2),
      base('maker-terminal-b', 'computer', 5.25, 2.25, 'up', ['type', 'terminal'], 'tool', 194, 1.5),
      surface('maker-monitor-b', 'display', 5.25, 2.25, 144),
      surface('maker-lamp-b', 'decor', 5.25, 2.25, 252, 1, 2),
      base('maker-chair-a', 'chair', 2.25, 4, 'up', [], 'generic', 101),
      base('maker-chair-b', 'chair', 5.25, 4, 'up', [], 'generic', 102),
      base('maker-workbench-a', 'workbench', 8.25, 4.25, 'down', ['terminal'], 'tool', 207, 1.5),
      surface('maker-tools-a', 'decor', 8.25, 4.25, 239),
      base('maker-workbench-b', 'workbench', 11.25, 4.25, 'down', ['terminal'], 'tool', 208, 1.5),
      surface('maker-tools-b', 'decor', 11.25, 4.25, 243),
      wall('maker-tool-wall-a', 'tool-wall', 9, 1, 'up', ['terminal'], 'tool', 175),
      wall('maker-tool-wall-b', 'tool-wall', 12, 1, 'up', ['terminal'], 'tool', 174),
      wall('maker-tool-books', 'bookcase', 12, 7, 'right', ['terminal'], 'tool', 176),
      wall('maker-tool-board', 'planning-board', 8.25, 7, 'up', ['terminal'], 'tool', 171),
      base('maker-repair-a', 'repair-table', 2.25, 6.5, 'down', ['repair'], 'repair', 193, 1.5),
      surface('maker-repair-device-a', 'printer', 2.25, 6.5, 177),
      base('maker-repair-b', 'repair-table', 5.25, 6.5, 'down', ['repair'], 'repair', 194, 1.5),
      surface('maker-repair-device-b', 'printer', 5.25, 6.5, 178),
      surface('maker-parts', 'decor', 8.25, 4.25, 256, 1, 2),
      surface('maker-crates', 'decor', 11.25, 4.25, 259, 1, 2),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 6 }],
  },
  'collaboration-barn': {
    id: 'collaboration-barn', label: 'COLLABORATION BARN · 協作穀倉', width: 14, height: 9, floor: 'wood', wall: 'green',
    furniture: [
      base('collab-dispatch-a', 'dispatch-pod', 2.25, 2.25, 'up', ['dispatch'], 'clone', 193, 1.5),
      surface('collab-display-a', 'display', 2.25, 2.25, 141),
      base('collab-dispatch-b', 'dispatch-pod', 5.25, 2.25, 'up', ['dispatch'], 'clone', 194, 1.5),
      surface('collab-display-b', 'display', 5.25, 2.25, 144),
      base('collab-radio-a', 'radio-console', 9, 2.25, 'up', ['respond', 'pulse'], 'respond', 193, 1.5),
      surface('collab-radio-screen-a', 'display', 9, 2.25, 145),
      base('collab-radio-b', 'response-desk', 12, 2.25, 'up', ['respond'], 'respond', 194, 1.5),
      surface('collab-radio-screen-b', 'display', 12, 2.25, 146),
      { ...base('collab-chair-a', 'chair', 2.25, 4, 'up', [], 'generic', 101), blocksNavigation: false },
      { ...base('collab-chair-b', 'chair', 5.25, 4, 'up', [], 'generic', 102), blocksNavigation: false },
      { ...base('collab-chair-c', 'chair', 9, 4, 'up', [], 'generic', 107), blocksNavigation: false },
      { ...base('collab-chair-d', 'chair', 12, 4, 'up', [], 'generic', 108), blocksNavigation: false },
      floor('collab-meeting-rug', 3, 6.25, 188, 2),
      base('collab-meeting', 'meeting-table', 3, 6, 'right', ['arrive', 'queue'], 'generic', 207, 1.75),
      surface('collab-meeting-notes', 'decor', 3, 6, 156),
      { ...base('collab-meeting-chair-w', 'chair', 1, 6, 'right', [], 'generic', 109), blocksNavigation: false },
      { ...base('collab-meeting-chair-e', 'chair', 5, 6, 'left', [], 'generic', 110), blocksNavigation: false },
      { ...base('collab-meeting-chair-s', 'chair', 3, 7.5, 'up', [], 'generic', 107), blocksNavigation: false },
      wall('collab-message-board', 'planning-board', 7, 1, 'up', [], 'generic', 171),
      wall('collab-storage-a', 'cabinet', 12, 7, 'up', [], 'generic', 175),
      wall('collab-storage-b', 'cabinet', 2, 7, 'up', [], 'generic', 174),
    ],
    overflow: [{ x: 6, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 6 }],
  },
};

const WORK_THEME_SIZE = { width: 18, height: 12 } as const;
type PrefabPlacement = readonly [prefabId: string, anchor: { x: number; y: number }];

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
});

const cloneInterior = (room: InteriorDefinition): InteriorDefinition => ({
  ...room,
  furniture: room.furniture.map(cloneFurniture),
  overflow: room.overflow.map((point) => ({ ...point })),
});

const composeThemeLayout = (
  themeId: Exclude<BuildingThemeId, 'rest-cabin'>,
  placements: readonly PrefabPlacement[],
  supportFurniture: readonly FurnitureDefinition[],
  overflow: InteriorDefinition['overflow'],
): InteriorDefinition => {
  const compact = COMPACT_INTERIOR_DEFINITIONS[themeId];
  const room: InteriorDefinition = {
    ...compact,
    ...WORK_THEME_SIZE,
    furniture: [],
    overflow: overflow.map((point) => ({ ...point })),
  };
  const prefabs = prefabsForTheme(themeId);
  let layout: FurnitureDefinition[] = [];
  placements.forEach(([prefabId, anchor], placementIndex) => {
    const prefab = prefabs.find(({ id }) => id === prefabId);
    if (!prefab) throw new Error(`Missing ${themeId} office prefab: ${prefabId}`);
    const result = placeOfficePrefab(room, layout, prefab, anchor, placementIndex + 1);
    if (!result.accepted) {
      throw new Error(`Invalid ${themeId} office prefab ${prefabId}: ${result.diagnostics.join(', ')}`);
    }
    const instanceId = `${themeId}-${prefabId}-${placementIndex + 1}`;
    layout = [
      ...result.layout.slice(0, layout.length),
      ...result.layout.slice(layout.length).map((item, itemIndex) => ({
        ...item,
        id: themeId === 'research-library' && prefabId === 'bench-four' && itemIndex === 0
          ? `research-computer-${placementIndex + 1}`
          : `${instanceId}-${itemIndex + 1}`,
        prefabInstanceId: instanceId,
      })),
    ];
  });
  room.furniture = [...layout, ...supportFurniture.map(cloneFurniture)];
  const issues = officeLayoutIssues(room);
  if (issues.length > 0) throw new Error(`Invalid ${themeId} office layout: ${JSON.stringify(issues)}`);
  return room;
};

const researchDefinition = (): InteriorDefinition => composeThemeLayout('research-library', [
  ['bench-four', { x: 4, y: 3 }],
  ['bench-four', { x: 4, y: 7 }],
  ['pod-l-two', { x: 12, y: 3 }],
], [
  base('research-work-meeting', 'meeting-table', 12.5, 10, 'down', ['ponder', 'plan'], 'plan', 207, 1.5),
  surface('research-work-meeting-notes', 'decor', 12.5, 10, 156),
  wall('research-work-archive-a', 'bookcase', 15.5, 7.5, 'right', ['read'], 'read', 176),
  wall('research-work-archive-b', 'bookcase', 15.5, 9.5, 'right', ['read'], 'read', 174),
  { ...base('research-work-guest-chair', 'chair', 16.5, 10.5, 'up', [], 'generic', 101), blocksNavigation: false },
  surface('research-work-plant', 'plant', 16.5, 1.25, 99),
], [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 9 }]);

const makerDefinition = (): InteriorDefinition => composeThemeLayout('maker-workshop', [
  ['control-m-three', { x: 12, y: 2 }],
  ['bench-four', { x: 3, y: 3 }],
  ['bench-four', { x: 3, y: 7 }],
], [
  base('maker-work-repair', 'repair-table', 11.5, 8.25, 'down', ['repair'], 'repair', 193, 1.5),
  surface('maker-work-repair-printer', 'printer', 11.5, 8.25, 177),
  wall('maker-work-tool-wall', 'tool-wall', 10.5, 4, 'up', ['terminal'], 'tool', 175),
  base('maker-work-computer', 'computer', 11, 6, 'down', ['terminal'], 'tool', 193),
  wall('maker-work-bookcase', 'bookcase', 15, 7, 'down', ['terminal'], 'tool', 176),
  wall('maker-work-planning-board', 'planning-board', 16, 10, 'down', ['terminal'], 'tool', 171),
  { ...base('maker-work-guest-chair', 'chair', 11, 10, 'up', [], 'generic', 101), blocksNavigation: false },
  base('maker-work-support', 'cabinet', 14, 10.5, 'left', [], 'generic', 174),
  surface('maker-work-refresh', 'beverage-station', 14, 10.5, 173),
], [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 9 }]);

const collaborationDefinition = (): InteriorDefinition => composeThemeLayout('collaboration-barn', [
  ['control-m-three', { x: 3, y: 3 }],
  ['pod-l-two', { x: 12, y: 2 }],
], [
  base('collab-work-clone-a', 'dispatch-pod', 3.5, 8, 'down', ['dispatch'], 'clone', 193, 1.5),
  surface('collab-work-clone-screen-a', 'display', 3.5, 8, 141),
  base('collab-work-clone-b', 'dispatch-pod', 6.5, 8, 'down', ['dispatch'], 'clone', 194, 1.5),
  surface('collab-work-clone-screen-b', 'display', 6.5, 8, 144),
  base('collab-work-meeting', 'meeting-table', 13.5, 10, 'down', ['arrive', 'queue'], 'generic', 207, 1.5),
  surface('collab-work-meeting-notes', 'decor', 13.5, 10, 156),
  wall('collab-work-response-a', 'radio-console', 11.5, 6, 'up', ['pulse', 'respond'], 'respond', 193),
  wall('collab-work-response-b', 'response-desk', 15.5, 6, 'up', ['respond'], 'respond', 194),
  { ...base('collab-work-guest-chair', 'chair', 16.5, 10.5, 'up', [], 'generic', 101), blocksNavigation: false },
  surface('collab-work-plant', 'plant', 16.5, 1.25, 98),
], [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 9 }]);

const workDefinitionFactories = {
  'research-library': researchDefinition,
  'maker-workshop': makerDefinition,
  'collaboration-barn': collaborationDefinition,
};
const workDefinitionCache: Partial<Record<Exclude<BuildingThemeId, 'rest-cabin'>, InteriorDefinition>> = {};
const workDefinition = (themeId: Exclude<BuildingThemeId, 'rest-cabin'>): InteriorDefinition => (
  workDefinitionCache[themeId] ??= workDefinitionFactories[themeId]()
);

export const INTERIOR_DEFINITIONS = {
  'rest-cabin': cloneInterior(COMPACT_INTERIOR_DEFINITIONS['rest-cabin']),
  get 'research-library'(): InteriorDefinition { return workDefinition('research-library'); },
  get 'maker-workshop'(): InteriorDefinition { return workDefinition('maker-workshop'); },
  get 'collaboration-barn'(): InteriorDefinition { return workDefinition('collaboration-barn'); },
} satisfies Record<BuildingThemeId, InteriorDefinition>;

export function interiorDefinitionForBuilding(building: WorldBuilding): InteriorDefinition {
  const source = building.interiorProfile === 'compact'
    ? COMPACT_INTERIOR_DEFINITIONS[building.themeId]
    : INTERIOR_DEFINITIONS[building.themeId];
  return cloneInterior(source);
}
