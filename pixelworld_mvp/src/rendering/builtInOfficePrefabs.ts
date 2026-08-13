import type {
  AgentAction,
  BuildingThemeId,
  Facing,
  FurnitureDefinition,
  FurnitureKind,
  FurnitureLayer,
  GridPoint,
  OfficePrefabDefinition,
} from '../world/types';
import { catalogItem } from './modernOfficeCatalog';

export const BUILT_IN_OFFICE_PREFAB_IDS = ['bench-four', 'pod-l-two', 'control-m-three'] as const;
export type BuiltInOfficePrefabId = typeof BUILT_IN_OFFICE_PREFAB_IDS[number];

export const isBuiltInOfficePrefabId = (id: string): id is BuiltInOfficePrefabId => (
  BUILT_IN_OFFICE_PREFAB_IDS.includes(id as BuiltInOfficePrefabId)
);

interface ItemOptions {
  id: string;
  kind: FurnitureKind;
  assetId: number;
  point: GridPoint;
  facing: Facing;
  layer: FurnitureLayer;
  zIndex: number;
  blocksNavigation: boolean;
  supportedActions?: AgentAction[];
  icon?: FurnitureDefinition['icon'];
}

// Catalog offsets are source-pixel deltas on a 16 px furniture tile; prefab geometry uses tile units.
const SOURCE_TILE_PIXELS = 16;

const furniture = ({ supportedActions = [], icon = 'generic', ...options }: ItemOptions): FurnitureDefinition => {
  const asset = catalogItem(options.assetId);
  if (!asset) throw new Error(`Unknown Modern Office v1.2 asset ${options.assetId}`);
  return {
    ...options,
    supportedActions: [...supportedActions],
    icon,
    rotation: 0,
    scale: 1,
    footprint: { ...asset.footprint },
    visualOffset: {
      x: asset.visualOffset.x / SOURCE_TILE_PIXELS,
      y: asset.visualOffset.y / SOURCE_TILE_PIXELS,
    },
  };
};

const desk = (id: string, assetId: number, point: GridPoint, facing: Facing, actions: AgentAction[], icon: FurnitureDefinition['icon']) => (
  furniture({ id, kind: 'desk', assetId, point, facing, supportedActions: actions, icon, layer: 'furniture', zIndex: 0, blocksNavigation: true })
);

const chair = (id: string, assetId: number, point: GridPoint, facing: Facing) => (
  furniture({ id, kind: 'office-chair', assetId, point, facing, layer: 'furniture', zIndex: 1, blocksNavigation: false })
);

const divider = (id: string, assetId: number, point: GridPoint, facing: Facing) => (
  furniture({ id, kind: 'cabinet', assetId, point, facing, layer: 'furniture', zIndex: 5, blocksNavigation: false })
);

const surface = (id: string, kind: FurnitureKind, assetId: number, point: GridPoint, facing: Facing) => (
  furniture({ id, kind, assetId, point, facing, layer: 'surface', zIndex: 20, blocksNavigation: false })
);

const plant = (id: string, assetId: number, point: GridPoint) => (
  furniture({ id, kind: 'plant', assetId, point, facing: 'up', layer: 'furniture', zIndex: 2, blocksNavigation: false })
);

type PrefabInput = Omit<OfficePrefabDefinition, 'source' | 'immutable' | 'createdAt' | 'width' | 'height'>;

const freezePoint = (point: GridPoint): void => { Object.freeze(point); };

const defineOfficePrefab = (input: PrefabInput): OfficePrefabDefinition => {
  const maxX = Math.max(input.anchor.x, ...input.items.map(({ point }) => point.x));
  const maxY = Math.max(input.anchor.y, ...input.items.map(({ point }) => point.y));
  const minX = Math.min(input.anchor.x, ...input.items.map(({ point }) => point.x));
  const minY = Math.min(input.anchor.y, ...input.items.map(({ point }) => point.y));
  const prefab: OfficePrefabDefinition = {
    ...input,
    source: 'modern-office-v1.2',
    immutable: true,
    createdAt: 0,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  freezePoint(prefab.anchor);
  Object.freeze(prefab.hookActions);
  for (const item of prefab.items) {
    freezePoint(item.point);
    Object.freeze(item.supportedActions);
    if (item.footprint) Object.freeze(item.footprint);
    if (item.visualOffset) Object.freeze(item.visualOffset);
    Object.freeze(item);
  }
  Object.freeze(prefab.items);
  for (const anchor of prefab.interactionAnchors) {
    freezePoint(anchor.point);
    Object.freeze(anchor.actions);
    Object.freeze(anchor);
  }
  Object.freeze(prefab.interactionAnchors);
  return Object.freeze(prefab);
};

const benchActions: AgentAction[] = ['signal', 'terminal', 'type'];
const podActions: AgentAction[] = ['ponder', 'plan', 'read'];
const controlActions: AgentAction[] = ['terminal', 'type', 'signal'];

const benchFour = defineOfficePrefab({
  id: 'bench-four',
  name: 'Four-seat Double Bench',
  category: 'bench',
  hookActions: benchActions,
  anchor: { x: 0, y: 0 },
  items: [
    desk('bench-desk-nw', 247, { x: 0, y: 1 }, 'down', benchActions, 'edit'),
    desk('bench-desk-ne', 247, { x: 1, y: 1 }, 'down', benchActions, 'edit'),
    desk('bench-desk-sw', 247, { x: 0, y: 2 }, 'up', benchActions, 'edit'),
    desk('bench-desk-se', 247, { x: 1, y: 2 }, 'up', benchActions, 'edit'),
    divider('bench-divider-horizontal', 208, { x: 0, y: 2 }, 'right'),
    divider('bench-divider-cross', 209, { x: 1, y: 1 }, 'down'),
    surface('bench-monitor-nw', 'display', 121, { x: 0, y: 1 }, 'down'),
    surface('bench-monitor-ne', 'display', 121, { x: 1, y: 1 }, 'down'),
    surface('bench-monitor-sw', 'display', 125, { x: 0, y: 2 }, 'up'),
    surface('bench-monitor-se', 'display', 125, { x: 1, y: 2 }, 'up'),
    chair('bench-chair-nw', 105, { x: 0, y: 0 }, 'down'),
    chair('bench-chair-ne', 105, { x: 1, y: 0 }, 'down'),
    chair('bench-chair-sw', 101, { x: 0, y: 3 }, 'up'),
    chair('bench-chair-se', 101, { x: 1, y: 3 }, 'up'),
    surface('bench-keyboard-nw', 'decor', 124, { x: 0, y: 1 }, 'down'),
    surface('bench-keyboard-ne', 'decor', 124, { x: 1, y: 1 }, 'down'),
    surface('bench-papers-sw', 'decor', 153, { x: 0, y: 2 }, 'up'),
    surface('bench-lamp-se', 'decor', 141, { x: 1, y: 2 }, 'up'),
  ],
  interactionAnchors: [
    { point: { x: 0, y: 0 }, actions: [...benchActions] },
    { point: { x: 1, y: 0 }, actions: [...benchActions] },
    { point: { x: 0, y: 3 }, actions: [...benchActions] },
    { point: { x: 1, y: 3 }, actions: [...benchActions] },
  ],
});

const podLTwo = defineOfficePrefab({
  id: 'pod-l-two',
  name: 'Two-seat L Pod',
  category: 'pod',
  hookActions: podActions,
  anchor: { x: 0, y: 0 },
  items: [
    desk('pod-desk-north', 252, { x: 0, y: 1 }, 'down', podActions, 'think'),
    desk('pod-desk-west', 252, { x: 0, y: 2 }, 'right', podActions, 'think'),
    desk('pod-desk-east', 252, { x: 1, y: 1 }, 'up', podActions, 'think'),
    divider('pod-divider', 208, { x: 0, y: 1 }, 'right'),
    surface('pod-monitor-west', 'display', 129, { x: 0, y: 2 }, 'right'),
    surface('pod-monitor-east', 'display', 131, { x: 1, y: 1 }, 'up'),
    chair('pod-chair-west', 103, { x: 1, y: 2 }, 'left'),
    chair('pod-chair-east', 105, { x: 1, y: 0 }, 'down'),
    surface('pod-keyboard-west', 'decor', 124, { x: 0, y: 2 }, 'right'),
    surface('pod-keyboard-east', 'decor', 128, { x: 1, y: 1 }, 'up'),
    surface('pod-papers', 'decor', 155, { x: 0, y: 1 }, 'down'),
    plant('pod-plant', 99, { x: 2, y: 2 }),
  ],
  interactionAnchors: [
    { point: { x: 1, y: 2 }, actions: [...podActions] },
    { point: { x: 1, y: 0 }, actions: [...podActions] },
  ],
});

const controlMThree = defineOfficePrefab({
  id: 'control-m-three',
  name: 'Three-seat M Control Console',
  category: 'control',
  hookActions: controlActions,
  anchor: { x: 0, y: 0 },
  items: [
    desk('control-desk-left', 267, { x: 0, y: 0 }, 'down', controlActions, 'tool'),
    desk('control-desk-center', 267, { x: 2, y: 0 }, 'down', controlActions, 'tool'),
    desk('control-desk-right', 267, { x: 4, y: 0 }, 'down', controlActions, 'tool'),
    desk('control-wing-left', 266, { x: 1, y: 1 }, 'left', controlActions, 'tool'),
    desk('control-wing-right', 266, { x: 3, y: 1 }, 'right', controlActions, 'tool'),
    divider('control-divider-left', 207, { x: 1, y: 1 }, 'up'),
    divider('control-divider-right', 209, { x: 3, y: 1 }, 'up'),
    surface('control-monitor-left', 'display', 129, { x: 0, y: 0 }, 'down'),
    surface('control-monitor-center', 'display', 133, { x: 2, y: 0 }, 'down'),
    surface('control-monitor-right', 'display', 131, { x: 4, y: 0 }, 'down'),
    surface('control-keyboard-left', 'decor', 124, { x: 0, y: 0 }, 'down'),
    surface('control-keyboard-center', 'decor', 128, { x: 2, y: 0 }, 'down'),
    surface('control-keyboard-right', 'decor', 124, { x: 4, y: 0 }, 'down'),
    chair('control-chair-left', 101, { x: 0, y: 1 }, 'up'),
    chair('control-chair-center', 101, { x: 2, y: 1 }, 'up'),
    chair('control-chair-right', 101, { x: 4, y: 1 }, 'up'),
    surface('control-documents', 'decor', 155, { x: 2, y: 0 }, 'down'),
  ],
  interactionAnchors: [
    { point: { x: 0, y: 1 }, actions: [...controlActions] },
    { point: { x: 2, y: 1 }, actions: [...controlActions] },
    { point: { x: 4, y: 1 }, actions: [...controlActions] },
  ],
});

export const BUILT_IN_OFFICE_PREFABS: readonly OfficePrefabDefinition[] = Object.freeze([
  benchFour,
  podLTwo,
  controlMThree,
]);

export const builtInPrefab = (id: string): OfficePrefabDefinition | undefined => (
  BUILT_IN_OFFICE_PREFABS.find((prefab) => prefab.id === id)
);

const WORK_OFFICE_PREFABS = Object.freeze([...BUILT_IN_OFFICE_PREFAB_IDS]);
const THEME_PREFAB_IDS: Readonly<Record<BuildingThemeId, readonly string[]>> = Object.freeze({
  'rest-cabin': Object.freeze([]),
  'research-library': WORK_OFFICE_PREFABS,
  'maker-workshop': WORK_OFFICE_PREFABS,
  'collaboration-barn': WORK_OFFICE_PREFABS,
});

export const prefabsForTheme = (themeId: BuildingThemeId): readonly OfficePrefabDefinition[] => (
  Object.freeze(THEME_PREFAB_IDS[themeId].map((id) => builtInPrefab(id)!))
);
