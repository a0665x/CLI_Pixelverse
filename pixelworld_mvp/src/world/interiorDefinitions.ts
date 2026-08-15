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
  GridPoint,
  InteriorDefinition,
  WorldBuilding,
} from './types';
import {
  prefabsForTheme,
  type BuiltInOfficePrefabId,
} from '../rendering/builtInOfficePrefabs';
import { catalogItem } from '../rendering/modernOfficeCatalog';
import { normalizeBuiltInFurniture } from '../rendering/interiorFurnitureScale';
import { officeLayoutIssues, placeOfficePrefab, rotatePrefab } from '../rendering/prefabGeometry';

export const INTERIOR_LAYOUT_REVISION = 2;

type FurnitureOptions = Partial<Pick<
  FurnitureDefinition,
  'assetId' | 'blocksNavigation' | 'footprint' | 'interactionPoint' | 'layer' | 'rotation' | 'scale'
  | 'supportedByIds' | 'visualOffset' | 'zIndex'
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
): FurnitureDefinition => {
  const item: FurnitureDefinition = { id, kind, point: { x, y }, facing, supportedActions, icon, ...options };
  return options.assetId === undefined ? item : normalizeBuiltInFurniture(item, catalogItem(options.assetId));
};

const base = (
  id: string, kind: FurnitureKind, x: number, y: number, facing: Facing,
  supportedActions: AgentAction[], icon: ActivityIconKind, assetId: number,
  scale: FurnitureScale = 1,
): FurnitureDefinition => furniture(id, kind, x, y, facing, supportedActions, icon, {
  assetId, scale, layer: 'furniture', zIndex: 0, blocksNavigation: true,
});

const surface = (
  id: string, kind: FurnitureKind, x: number, y: number, assetId: number,
  scale: FurnitureScale = 1, zIndex = 1, supportedByIds: string[] = [],
): FurnitureDefinition => furniture(id, kind, x, y, 'up', [], 'generic', {
  assetId, scale, layer: 'surface', zIndex, blocksNavigation: false,
  ...(supportedByIds.length > 0 ? { supportedByIds: [...supportedByIds] } : {}),
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

type ModernSupportOptions = Partial<Pick<
  FurnitureDefinition,
  'blocksNavigation' | 'interactionPoint' | 'supportedByIds' | 'zIndex'
>>;

const modernSupport = (
  id: string, kind: FurnitureKind, assetId: number, x: number, y: number, facing: Facing,
  layer: FurnitureLayer, supportedActions: AgentAction[] = [], icon: ActivityIconKind = 'generic',
  options: ModernSupportOptions = {},
): FurnitureDefinition => {
  const asset = catalogItem(assetId);
  if (!asset) throw new Error(`Unknown Modern Office v1.2 support asset ${assetId}`);
  return furniture(id, kind, x, y, facing, supportedActions, icon, {
    assetId,
    footprint: { ...asset.footprint },
    visualOffset: { x: asset.visualOffset.x / 16, y: asset.visualOffset.y / 16 },
    rotation: 0,
    scale: 1,
    layer,
    zIndex: options.zIndex ?? (layer === 'surface' ? 20 : 0),
    blocksNavigation: options.blocksNavigation ?? supportedActions.length > 0,
    ...(options.interactionPoint ? { interactionPoint: { ...options.interactionPoint } } : {}),
    ...(options.supportedByIds ? { supportedByIds: [...options.supportedByIds] } : {}),
  });
};

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
      surface('rest-coffee-cups', 'decor', 4, 6.25, 120, 1.25, 1, ['rest-coffee-table']),
      wall('rest-tv', 'television', 6.25, 1, 'up', [], 'generic', 172),
      { ...base('rest-bed-a', 'bed', 11.25, 3.25, 'right', ['offline'], 'offline', 200, 1.25), blocksNavigation: false },
      { ...base('rest-bed-b', 'bed', 11.25, 6.5, 'right', ['offline'], 'offline', 214, 1.25), blocksNavigation: false },
      surface('rest-bedside-a', 'decor', 11.25, 3.25, 119),
      surface('rest-bedside-b', 'decor', 11.25, 6.5, 120),
      surface('rest-lamp', 'decor', 4, 6.25, 153, 1, 2, ['rest-coffee-table']),
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
      surface('research-map-display', 'display', 5.5, 4, 168, 1, 1, ['research-map-a']),
      base('research-reading-a', 'reading-desk', 2.25, 6.5, 'down', ['read'], 'read', 193, 1.5),
      surface('research-reading-books-a', 'decor', 2.25, 6.5, 156, 1, 1, ['research-reading-a']),
      base('research-reading-b', 'reading-desk', 5.25, 6.5, 'down', ['read'], 'read', 194, 1.5),
      surface('research-reading-books-b', 'decor', 5.25, 6.5, 157, 1, 1, ['research-reading-b']),
      base('research-computer-a', 'computer', 8.5, 2.25, 'up', ['signal'], 'web', 193, 1.5),
      surface('research-monitor-a', 'display', 8.5, 2.25, 141, 1, 1, ['research-computer-a']),
      base('research-computer-b', 'computer', 11.25, 2.25, 'up', ['signal'], 'web', 194, 1.5),
      surface('research-monitor-b', 'display', 11.25, 2.25, 144, 1, 1, ['research-computer-b']),
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
      surface('maker-monitor-a', 'display', 2.25, 2.25, 141, 1, 1, ['maker-terminal-a']),
      surface('maker-lamp-a', 'decor', 2.25, 2.25, 251, 1, 2, ['maker-terminal-a']),
      base('maker-terminal-b', 'computer', 5.25, 2.25, 'up', ['type', 'terminal'], 'tool', 194, 1.5),
      surface('maker-monitor-b', 'display', 5.25, 2.25, 144, 1, 1, ['maker-terminal-b']),
      surface('maker-lamp-b', 'decor', 5.25, 2.25, 252, 1, 2, ['maker-terminal-b']),
      base('maker-chair-a', 'chair', 2.25, 4, 'up', [], 'generic', 101),
      base('maker-chair-b', 'chair', 5.25, 4, 'up', [], 'generic', 102),
      base('maker-workbench-a', 'workbench', 8.25, 4.25, 'down', ['terminal'], 'tool', 207, 1.5),
      surface('maker-tools-a', 'decor', 8.25, 4.25, 239, 1, 1, ['maker-workbench-a']),
      base('maker-workbench-b', 'workbench', 11.25, 4.25, 'down', ['terminal'], 'tool', 208, 1.5),
      surface('maker-tools-b', 'decor', 11.25, 4.25, 243, 1, 1, ['maker-workbench-b']),
      wall('maker-tool-wall-a', 'tool-wall', 9, 1, 'up', ['terminal'], 'tool', 175),
      wall('maker-tool-wall-b', 'tool-wall', 12, 1, 'up', ['terminal'], 'tool', 174),
      wall('maker-tool-books', 'bookcase', 12, 7, 'right', ['terminal'], 'tool', 176),
      wall('maker-tool-board', 'planning-board', 8.25, 7, 'up', ['terminal'], 'tool', 171),
      base('maker-repair-a', 'repair-table', 2.25, 6.5, 'down', ['repair'], 'repair', 193, 1.5),
      surface('maker-repair-device-a', 'printer', 2.25, 6.5, 177, 1, 1, ['maker-repair-a']),
      base('maker-repair-b', 'repair-table', 5.25, 6.5, 'down', ['repair'], 'repair', 194, 1.5),
      surface('maker-repair-device-b', 'printer', 5.25, 6.5, 178, 1, 1, ['maker-repair-b']),
      surface('maker-parts', 'decor', 8.25, 4.25, 256, 1, 2, ['maker-workbench-a']),
      surface('maker-crates', 'decor', 11.25, 4.25, 259, 1, 2, ['maker-workbench-b']),
    ],
    overflow: [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 7, y: 6 }],
  },
  'collaboration-barn': {
    id: 'collaboration-barn', label: 'COLLABORATION BARN · 協作穀倉', width: 14, height: 9, floor: 'wood', wall: 'green',
    furniture: [
      base('collab-dispatch-a', 'dispatch-pod', 2.25, 2.25, 'up', ['dispatch'], 'clone', 193, 1.5),
      surface('collab-display-a', 'display', 2.25, 2.25, 141, 1, 1, ['collab-dispatch-a']),
      base('collab-dispatch-b', 'dispatch-pod', 5.25, 2.25, 'up', ['dispatch'], 'clone', 194, 1.5),
      surface('collab-display-b', 'display', 5.25, 2.25, 144, 1, 1, ['collab-dispatch-b']),
      base('collab-radio-a', 'radio-console', 9, 2.25, 'up', ['respond', 'pulse'], 'respond', 193, 1.5),
      surface('collab-radio-screen-a', 'display', 9, 2.25, 145, 1, 1, ['collab-radio-a']),
      base('collab-radio-b', 'response-desk', 12, 2.25, 'up', ['respond'], 'respond', 194, 1.5),
      surface('collab-radio-screen-b', 'display', 12, 2.25, 146, 1, 1, ['collab-radio-b']),
      { ...base('collab-chair-a', 'chair', 2.25, 4, 'up', [], 'generic', 101), blocksNavigation: false },
      { ...base('collab-chair-b', 'chair', 5.25, 4, 'up', [], 'generic', 102), blocksNavigation: false },
      { ...base('collab-chair-c', 'chair', 9, 4, 'up', [], 'generic', 107), blocksNavigation: false },
      { ...base('collab-chair-d', 'chair', 12, 4, 'up', [], 'generic', 108), blocksNavigation: false },
      floor('collab-meeting-rug', 3, 6.25, 188, 2),
      base('collab-meeting', 'meeting-table', 3, 6, 'right', ['arrive', 'queue'], 'generic', 4, 1.75),
      surface('collab-meeting-notes', 'decor', 3, 6, 156, 1, 1, ['collab-meeting']),
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
interface OfficeZonePlacement {
  prefabId: BuiltInOfficePrefabId;
  anchor: GridPoint;
  rotation?: FurnitureRotation;
}

const HYBRID_OFFICE_ZONES = {
  'research-library': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 1.5 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 6.25 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
  'maker-workshop': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 1.5 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 6.25 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
  'collaboration-barn': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 1.5 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 6.25 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
} satisfies Record<Exclude<BuildingThemeId, 'rest-cabin'>, {
  central: OfficeZonePlacement[];
  specialist: OfficeZonePlacement[];
}>;

const hybridOfficePlacements = (
  themeId: Exclude<BuildingThemeId, 'rest-cabin'>,
): readonly OfficeZonePlacement[] => [
  ...HYBRID_OFFICE_ZONES[themeId].central,
  ...HYBRID_OFFICE_ZONES[themeId].specialist,
];

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
  ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
});

const cloneInterior = (room: InteriorDefinition): InteriorDefinition => ({
  ...room,
  furniture: room.furniture.map(cloneFurniture),
  overflow: room.overflow.map((point) => ({ ...point })),
});

const composeThemeLayout = (
  themeId: Exclude<BuildingThemeId, 'rest-cabin'>,
  placements: readonly OfficeZonePlacement[],
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
  placements.forEach(({ prefabId, anchor, rotation = 0 }, placementIndex) => {
    const prefab = prefabs.find(({ id }) => id === prefabId);
    if (!prefab) throw new Error(`Missing ${themeId} office prefab: ${prefabId}`);
    const placedPrefab = rotation === 0 ? prefab : rotatePrefab(prefab, rotation);
    const result = placeOfficePrefab(room, layout, placedPrefab, anchor, placementIndex + 1);
    if (!result.accepted) {
      throw new Error(`Invalid ${themeId} office prefab ${prefabId}: ${result.diagnostics.join(', ')}`);
    }
    const instanceId = `${themeId}-${prefabId}-${placementIndex + 1}`;
    const placedItems = result.layout.slice(layout.length);
    const renamedIds = new Map(placedItems.map((item, itemIndex) => [
      item.id,
      themeId === 'research-library' && prefabId === 'bench-four' && itemIndex === 0
        ? `research-computer-${placementIndex + 1}`
        : `${instanceId}-${itemIndex + 1}`,
    ]));
    layout = [
      ...result.layout.slice(0, layout.length),
      ...placedItems.map((item, itemIndex) => ({
        ...item,
        id: renamedIds.get(item.id)!,
        prefabInstanceId: instanceId,
        ...(item.supportedByIds ? {
          supportedByIds: item.supportedByIds.map((id) => renamedIds.get(id) ?? id),
        } : {}),
      })),
    ];
  });
  room.furniture = [...layout, ...supportFurniture.map(cloneFurniture)];
  const issues = officeLayoutIssues(room);
  if (issues.length > 0) {
    throw new Error(`Invalid ${themeId} office layout: ${JSON.stringify({ themeId, issues })}`);
  }
  return room;
};

const researchDefinition = (): InteriorDefinition => composeThemeLayout(
  'research-library', hybridOfficePlacements('research-library'), [
  modernSupport('research-archive-west', 'bookcase', 199, 1, 1, 'up', 'wall'),
  modernSupport('research-archive-center', 'bookcase', 200, 2.25, 1, 'up', 'wall'),
  modernSupport('research-archive-east', 'bookcase', 204, 6, 1, 'up', 'wall'),
  modernSupport('research-reference-device', 'printer', 148, 1, 4.25, 'up', 'furniture'),
  modernSupport('research-reading-console', 'reading-desk', 225, 1.5, 7.75, 'down', 'furniture'),
  modernSupport('research-reading-notes', 'decor', 156, 1.5, 7.75, 'down', 'surface', [], 'read', {
    supportedByIds: ['research-reading-console'],
  }),
  modernSupport('research-reading-chair', 'chair', 101, 2.25, 9, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('research-reference-plant', 'plant', 99, 16.5, 1, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
], [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 9 }]);

const makerDefinition = (): InteriorDefinition => composeThemeLayout(
  'maker-workshop', hybridOfficePlacements('maker-workshop'), [
  modernSupport('maker-service-bookcase', 'bookcase', 168, 1, 1, 'up', 'wall', ['terminal'], 'tool', {
    interactionPoint: { x: 2, y: 2 },
  }),
  modernSupport('maker-equipment-cabinet', 'cabinet', 175, 2.75, 1, 'up', 'wall'),
  modernSupport('maker-service-planning-board', 'planning-board', 170, 6, 1, 'up', 'wall', ['terminal'], 'tool', {
    interactionPoint: { x: 7, y: 3 },
  }),
  modernSupport('maker-work-tool-wall', 'tool-wall', 175, 10.5, 4, 'up', 'wall', ['terminal'], 'tool', {
    interactionPoint: { x: 10.5, y: 7 },
  }),
  modernSupport('maker-repair-printer-station', 'repair-table', 323, 2, 8, 'down', 'furniture', ['repair'], 'repair', {
    interactionPoint: { x: 2, y: 7 },
  }),
  modernSupport('maker-repair-parts', 'decor', 239, 2, 8, 'down', 'surface', [], 'repair', {
    supportedByIds: ['maker-repair-printer-station'],
  }),
  modernSupport('maker-repair-chair', 'chair', 101, 2, 9.5, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('maker-service-refresh', 'beverage-station', 173, 16.5, 1, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
], [{ x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 9 }]);

const collaborationDefinition = (): InteriorDefinition => composeThemeLayout(
  'collaboration-barn', hybridOfficePlacements('collaboration-barn'), [
  modernSupport('collab-dispatch-console', 'dispatch-pod', 311, 1, 1, 'down', 'furniture', ['dispatch', 'pulse'], 'clone', {
    interactionPoint: { x: 1, y: 3 },
  }),
  modernSupport('collab-response-console', 'response-desk', 312, 3, 1, 'down', 'furniture', ['respond'], 'respond', {
    interactionPoint: { x: 3, y: 3 },
  }),
  modernSupport('collab-communication-credenza', 'radio-console', 165, 5.5, 1, 'up', 'wall'),
  modernSupport('collab-shared-refresh', 'beverage-station', 173, 10.5, 1, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('collab-meeting-table-west', 'meeting-table', 4, 1, 7, 'down', 'furniture', [], 'generic', {
    blocksNavigation: true,
  }),
  modernSupport('collab-meeting-table-center', 'meeting-table', 4, 2, 7, 'down', 'furniture', ['arrive', 'queue'], 'generic', {
    interactionPoint: { x: 2, y: 6 }, blocksNavigation: true,
  }),
  modernSupport('collab-meeting-table-east', 'meeting-table', 4, 3, 7, 'down', 'furniture', [], 'generic', {
    blocksNavigation: true,
  }),
  modernSupport('collab-meeting-notes', 'decor', 156, 2, 7, 'down', 'surface', [], 'generic', {
    supportedByIds: ['collab-meeting-table-center'],
  }),
  modernSupport('collab-meeting-chair-nw', 'chair', 105, 1, 6.25, 'down', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('collab-meeting-chair-ne', 'chair', 105, 3, 6.25, 'down', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('collab-meeting-chair-sw', 'chair', 101, 1, 8.25, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
  modernSupport('collab-meeting-chair-se', 'chair', 101, 3, 8.25, 'up', 'furniture', [], 'generic', {
    blocksNavigation: false,
  }),
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
