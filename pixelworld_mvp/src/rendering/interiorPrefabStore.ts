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
import type { StorageReadStatus } from './interiorLayoutEditor';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LayoutMutationResult { accepted: boolean; layout: FurnitureDefinition[] }

const PREFAB_KEY = 'pixelworld:interior-prefabs:v1';
const CLIPBOARD_KEY = 'pixelworld:interior-clipboard:v1';
const browserStorage = (): StorageLike | undefined => {
  if (typeof window === 'undefined') return undefined;
  try { return window.localStorage; } catch { return undefined; }
};

const readStorage = (
  storage: StorageLike | undefined,
  key: string,
): { storageRead: StorageReadStatus; value: string | null } => {
  let resolved = storage;
  if (!resolved && typeof window !== 'undefined') {
    try { resolved = window.localStorage; } catch { return { storageRead: 'failed', value: null }; }
    if (!resolved) return { storageRead: 'failed', value: null };
  }
  if (!resolved) return { storageRead: 'success', value: null };
  try { return { storageRead: 'success', value: resolved.getItem(key) }; }
  catch { return { storageRead: 'failed', value: null }; }
};

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

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

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
  if (typeof window !== 'undefined' && !storage) throw new Error('Prefab storage unavailable');
  const userPrefabs = prefabs.filter((prefab) => !isBuiltInPrefab(prefab)).map(clonePrefab);
  storage?.setItem(PREFAB_KEY, JSON.stringify({ version: 1, prefabs: userPrefabs }));
}

export interface StorageReadResult<T> { storageRead: StorageReadStatus; value: T }

export function readPrefabs(storage?: StorageLike): StorageReadResult<FurniturePrefab[]> {
  const read = readStorage(storage, PREFAB_KEY);
  if (read.storageRead === 'failed' || !read.value) return { storageRead: read.storageRead, value: [] };
  try {
    const parsed = JSON.parse(read.value) as { version?: unknown; prefabs?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.prefabs)) return { storageRead: 'success', value: [] };
    const value = parsed.prefabs.filter((value): value is FurniturePrefab => {
      const prefab = value as FurniturePrefab;
      return Boolean(prefab && typeof prefab.id === 'string' && typeof prefab.name === 'string' &&
        Number.isFinite(prefab.createdAt) && Number.isFinite(prefab.width) && Number.isFinite(prefab.height) &&
        Array.isArray(prefab.items) && prefab.items.length >= 2 && prefab.items.every(isValidTemplate));
    }).map(clonePrefab);
    return { storageRead: 'success', value };
  } catch {
    return { storageRead: 'success', value: [] };
  }
}

export function loadPrefabs(storage?: StorageLike): FurniturePrefab[] {
  return readPrefabs(storage).value;
}

export function readAvailablePrefabs(
  storage?: StorageLike,
): StorageReadResult<OfficePrefabDefinition[]> {
  const read = readPrefabs(storage);
  return {
    storageRead: read.storageRead,
    value: [
      ...BUILT_IN_OFFICE_PREFABS.map((prefab) => deepFreeze(cloneOfficePrefab(prefab))),
      ...read.value.map(asUserOfficePrefab),
    ],
  };
}

export function availablePrefabs(storage?: StorageLike): OfficePrefabDefinition[] {
  return readAvailablePrefabs(storage).value;
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
  if (typeof window !== 'undefined' && !storage) throw new Error('Clipboard storage unavailable');
  storage?.setItem(CLIPBOARD_KEY, JSON.stringify(clipboard));
}

export function readLayoutClipboard(
  storage?: StorageLike,
): StorageReadResult<InteriorLayoutClipboard | undefined> {
  const read = readStorage(storage, CLIPBOARD_KEY);
  if (read.storageRead === 'failed' || !read.value) return { storageRead: read.storageRead, value: undefined };
  try {
    const parsed = JSON.parse(read.value) as InteriorLayoutClipboard;
    if (parsed.version !== 1 || typeof parsed.sourceBuildingId !== 'string' || !Number.isFinite(parsed.copiedAt) ||
      !Array.isArray(parsed.items) || !parsed.items.every(isValidTemplate)) return { storageRead: 'success', value: undefined };
    return { storageRead: 'success', value: { ...parsed, items: cloneLayout(parsed.items) } };
  } catch {
    return { storageRead: 'success', value: undefined };
  }
}

export function loadLayoutClipboard(
  storage?: StorageLike,
): InteriorLayoutClipboard | undefined {
  return readLayoutClipboard(storage).value;
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
