import type {
  FurnitureDefinition,
  FurniturePrefab,
  GridPoint,
  InteriorDefinition,
  InteriorLayoutClipboard,
  OfficePrefabDefinition,
} from '../world/types';
import { BUILT_IN_OFFICE_PREFABS } from './builtInOfficePrefabs';
import { catalogItem } from './modernOfficeCatalog';
import { resolvePlacementCandidate, snapFurniturePoint } from './interiorPlacement';
import { cloneOfficePrefab } from './prefabGeometry';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LayoutMutationResult { accepted: boolean; layout: FurnitureDefinition[] }

const PREFAB_KEY = 'pixelworld:interior-prefabs:v1';
const CLIPBOARD_KEY = 'pixelworld:interior-clipboard:v1';
const browserStorage = (): StorageLike | undefined => typeof window === 'undefined' ? undefined : window.localStorage;

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
});
const cloneLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] => layout.map(cloneFurniture);
const isFinitePoint = (item: FurnitureDefinition): boolean => Number.isFinite(item.point?.x) && Number.isFinite(item.point?.y);
const isValidTemplate = (item: FurnitureDefinition): boolean => (
  typeof item.id === 'string' && isFinitePoint(item) && Array.isArray(item.supportedActions) &&
  item.supportedActions.length === 0 && !item.requirementId && (item.assetId === undefined || catalogItem(item.assetId) !== undefined)
);

const clonePrefab = (prefab: FurniturePrefab): FurniturePrefab => ({
  ...prefab,
  items: cloneLayout(prefab.items),
});

const asUserOfficePrefab = (prefab: FurniturePrefab): OfficePrefabDefinition => ({
  ...clonePrefab(prefab),
  source: 'user',
  immutable: false,
  category: 'support',
  hookActions: [],
  anchor: { x: 0, y: 0 },
  interactionAnchors: [],
});

export function isBuiltInPrefab(prefab: FurniturePrefab): prefab is OfficePrefabDefinition {
  return 'source' in prefab && prefab.source === 'modern-office-v1.2'
    && 'immutable' in prefab && prefab.immutable === true;
}

export function savePrefabs(
  prefabs: readonly FurniturePrefab[],
  storage: StorageLike | undefined = browserStorage(),
): void {
  const userPrefabs = prefabs.filter((prefab) => !isBuiltInPrefab(prefab)).map(clonePrefab);
  storage?.setItem(PREFAB_KEY, JSON.stringify({ version: 1, prefabs: userPrefabs }));
}

export function loadPrefabs(storage: StorageLike | undefined = browserStorage()): FurniturePrefab[] {
  const raw = storage?.getItem(PREFAB_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; prefabs?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.prefabs)) return [];
    return parsed.prefabs.filter((value): value is FurniturePrefab => {
      const prefab = value as FurniturePrefab;
      return Boolean(prefab && typeof prefab.id === 'string' && typeof prefab.name === 'string' &&
        Number.isFinite(prefab.createdAt) && Number.isFinite(prefab.width) && Number.isFinite(prefab.height) &&
        Array.isArray(prefab.items) && prefab.items.length >= 2 && prefab.items.every(isValidTemplate));
    }).map(clonePrefab);
  } catch {
    return [];
  }
}

export function availablePrefabs(storage: StorageLike | undefined = browserStorage()): OfficePrefabDefinition[] {
  return [
    ...BUILT_IN_OFFICE_PREFABS.map(cloneOfficePrefab),
    ...loadPrefabs(storage).map(asUserOfficePrefab),
  ];
}

export function upsertPrefab(
  prefabs: readonly FurniturePrefab[],
  prefab: FurniturePrefab,
): FurniturePrefab[] {
  const without = prefabs.filter(({ id }) => id !== prefab.id).map(clonePrefab);
  return [...without, clonePrefab(prefab)].sort((a, b) => a.createdAt - b.createdAt);
}

export function deletePrefab(prefabs: readonly FurniturePrefab[], prefabId: string): FurniturePrefab[] {
  return prefabs.filter(({ id }) => id !== prefabId).map(clonePrefab);
}

export function copyDecorativeLayout(
  sourceBuildingId: string,
  layout: readonly FurnitureDefinition[],
  copiedAt: number = Date.now(),
): InteriorLayoutClipboard {
  return {
    version: 1,
    sourceBuildingId,
    copiedAt,
    items: cloneLayout(layout.filter(({ supportedActions, requirementId }) => supportedActions.length === 0 && !requirementId)),
  };
}

export function saveLayoutClipboard(
  clipboard: InteriorLayoutClipboard,
  storage: StorageLike | undefined = browserStorage(),
): void {
  storage?.setItem(CLIPBOARD_KEY, JSON.stringify(clipboard));
}

export function loadLayoutClipboard(
  storage: StorageLike | undefined = browserStorage(),
): InteriorLayoutClipboard | undefined {
  const raw = storage?.getItem(CLIPBOARD_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as InteriorLayoutClipboard;
    if (parsed.version !== 1 || typeof parsed.sourceBuildingId !== 'string' || !Number.isFinite(parsed.copiedAt) ||
      !Array.isArray(parsed.items) || !parsed.items.every(isValidTemplate)) return undefined;
    return { ...parsed, items: cloneLayout(parsed.items) };
  } catch {
    return undefined;
  }
}

const validateAll = (
  room: InteriorDefinition,
  fixed: readonly FurnitureDefinition[],
  additions: readonly FurnitureDefinition[],
): boolean => additions.every((item) => resolvePlacementCandidate(room, fixed, item, item.point).diagnostic === 'valid');

export function pasteDecorativeLayout(
  room: InteriorDefinition,
  targetLayout: readonly FurnitureDefinition[],
  clipboard: InteriorLayoutClipboard,
  now: number = Date.now(),
): LayoutMutationResult {
  const hooks = cloneLayout(targetLayout.filter(({ supportedActions, requirementId }) => supportedActions.length > 0 || Boolean(requirementId)));
  const additions = clipboard.items.map((item, index): FurnitureDefinition => ({
    ...cloneFurniture(item),
    id: `pasted-${now}-${index}`,
    point: snapFurniturePoint(item.point),
    supportedActions: [],
  }));
  if (!validateAll(room, hooks, additions)) return { accepted: false, layout: cloneLayout(targetLayout) };
  return { accepted: true, layout: [...hooks, ...additions] };
}

export function placePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: FurniturePrefab,
  anchor: GridPoint,
  now: number = Date.now(),
): LayoutMutationResult {
  const snapped = snapFurniturePoint(anchor);
  const additions = prefab.items.map((item, index): FurnitureDefinition => ({
    ...cloneFurniture(item),
    id: `prefab-item-${now}-${index}`,
    point: snapFurniturePoint({ x: snapped.x + item.point.x, y: snapped.y + item.point.y }),
    supportedActions: [],
  }));
  if (!validateAll(room, layout, additions)) return { accepted: false, layout: cloneLayout(layout) };
  return { accepted: true, layout: [...cloneLayout(layout), ...additions] };
}
