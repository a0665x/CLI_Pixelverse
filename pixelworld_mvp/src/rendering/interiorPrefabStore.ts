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
import { diagnoseFinePlacement, resolvedFurnitureAsset, snapFurniturePoint } from './interiorPlacement';
import { cloneOfficePrefab } from './prefabGeometry';
import type { StorageReadStatus } from './interiorLayoutEditor';
import { isCompatibleStackSupport, stackRoleForFurniture } from './interiorAutoStack';

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
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
  ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
});
const cloneLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] => layout.map(cloneFurniture);
const isFinitePoint = (item: FurnitureDefinition): boolean => Number.isFinite(item.point?.x) && Number.isFinite(item.point?.y);
const isValidTemplate = (item: FurnitureDefinition): boolean => (
  typeof item.id === 'string' && isFinitePoint(item) && Array.isArray(item.supportedActions) &&
  item.supportedActions.length === 0 && !item.requirementId && (item.assetId === undefined || catalogItem(item.assetId) !== undefined) &&
  (item.supportedByIds === undefined || (
    Array.isArray(item.supportedByIds) && item.supportedByIds.every((id) => typeof id === 'string' && id.length > 0)
  ))
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
  let copied = layout.filter(({ supportedActions, requirementId }) => supportedActions.length === 0 && !requirementId);
  while (true) {
    const copiedIds = new Set(copied.map(({ id }) => id));
    const closed = copied.filter(({ supportedByIds }) => (
      supportedByIds === undefined || supportedByIds.some((id) => copiedIds.has(id))
    ));
    if (closed.length === copied.length) break;
    copied = closed;
  }
  const copiedIds = new Set(copied.map(({ id }) => id));
  return {
    version: 1,
    sourceBuildingId,
    copiedAt,
    items: cloneLayout(copied).map((item) => item.supportedByIds ? {
      ...item,
      supportedByIds: item.supportedByIds.filter((id) => copiedIds.has(id)),
    } : item),
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
): boolean => {
  const combined = [...fixed, ...additions];
  const byId = new Map(combined.map((item) => [item.id, item]));
  if (byId.size !== combined.length) return false;
  for (const item of additions) {
    if (!resolvedFurnitureAsset(item) || diagnoseFinePlacement(room, item, [], item.id) !== 'valid') return false;
    if (item.supportedByIds?.some((id) => (
      stackRoleForFurniture(item) !== 'surface' || !isCompatibleStackSupport(byId.get(id))
    ))) return false;
  }
  return true;
};

const freshIdMap = (
  items: readonly FurnitureDefinition[],
  fixed: readonly FurnitureDefinition[],
  prefix: string,
): Map<string, string> | undefined => {
  const occupied = new Set(fixed.map(({ id }) => id));
  const ids = new Map<string, string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.id)) return undefined;
    const base = `${prefix}-${index}`;
    let fresh = base;
    let suffix = 0;
    while (occupied.has(fresh)) fresh = `${base}-${++suffix}`;
    occupied.add(fresh);
    ids.set(item.id, fresh);
  }
  return ids;
};

const remapAdditions = (
  items: readonly FurnitureDefinition[],
  fixed: readonly FurnitureDefinition[],
  prefix: string,
  pointFor: (item: FurnitureDefinition) => GridPoint,
): FurnitureDefinition[] | undefined => {
  const ids = freshIdMap(items, fixed, prefix);
  if (!ids) return undefined;
  const destinationIds = new Set([...fixed.map(({ id }) => id), ...ids.values()]);
  const occupiedInstanceIds = new Set(fixed.flatMap(({ prefabInstanceId }) => prefabInstanceId ? [prefabInstanceId] : []));
  const instanceIds = new Map<string, string>();
  for (const item of items) {
    if (!item.prefabInstanceId || instanceIds.has(item.prefabInstanceId)) continue;
    const base = `${prefix}-instance-${instanceIds.size}`;
    let fresh = base;
    let suffix = 0;
    while (occupiedInstanceIds.has(fresh)) fresh = `${base}-${++suffix}`;
    occupiedInstanceIds.add(fresh);
    instanceIds.set(item.prefabInstanceId, fresh);
  }
  const additions: FurnitureDefinition[] = [];
  for (const item of items) {
    const supportedByIds = item.supportedByIds?.map((id) => ids.get(id) ?? id);
    if (supportedByIds?.some((id) => !destinationIds.has(id))) return undefined;
    additions.push({
      ...cloneFurniture(item),
      id: ids.get(item.id)!,
      point: snapFurniturePoint(pointFor(item)),
      supportedActions: [],
      ...(supportedByIds ? { supportedByIds } : {}),
      ...(item.prefabInstanceId ? { prefabInstanceId: instanceIds.get(item.prefabInstanceId)! } : {}),
    });
  }
  return additions;
};

const supportComponents = (
  items: readonly FurnitureDefinition[],
): FurnitureDefinition[][] => {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const links = new Map(items.map(({ id }) => [id, new Set<string>()]));
  for (const item of items) {
    for (const supportId of item.supportedByIds ?? []) {
      if (!itemById.has(supportId)) continue;
      links.get(item.id)!.add(supportId);
      links.get(supportId)!.add(item.id);
    }
  }
  const instanceMembers = new Map<string, string[]>();
  for (const item of items) {
    if (!item.prefabInstanceId) continue;
    instanceMembers.set(item.prefabInstanceId, [...(instanceMembers.get(item.prefabInstanceId) ?? []), item.id]);
  }
  for (const members of instanceMembers.values()) {
    const first = members[0];
    if (!first) continue;
    for (const id of members.slice(1)) {
      links.get(first)!.add(id);
      links.get(id)!.add(first);
    }
  }
  const visited = new Set<string>();
  const components: FurnitureDefinition[][] = [];
  for (const item of items) {
    if (visited.has(item.id)) continue;
    const pending = [item.id];
    const componentIds = new Set<string>();
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      componentIds.add(id);
      pending.push(...links.get(id) ?? []);
    }
    components.push(items.filter(({ id }) => componentIds.has(id)));
  }
  return components;
};

const compatibleAdditions = (
  room: InteriorDefinition,
  fixed: readonly FurnitureDefinition[],
  additions: readonly FurnitureDefinition[],
): FurnitureDefinition[] | undefined => {
  if (!validateAll(room, [], additions)) return undefined;
  const accepted: FurnitureDefinition[] = [];
  for (const component of supportComponents(additions)) {
    if (validateAll(room, [...fixed, ...accepted], component)) accepted.push(...component.map(cloneFurniture));
  }
  return accepted;
};

const retainedDestinationLayout = (
  layout: readonly FurnitureDefinition[],
): FurnitureDefinition[] => {
  const retained = new Set(layout
    .filter(({ supportedActions, requirementId }) => supportedActions.length > 0 || Boolean(requirementId))
    .map(({ id }) => id));
  while (true) {
    const before = retained.size;
    const retainedInstanceIds = new Set(layout
      .filter(({ id }) => retained.has(id))
      .flatMap(({ prefabInstanceId }) => prefabInstanceId ? [prefabInstanceId] : []));
    for (const item of layout) {
      if (item.prefabInstanceId && retainedInstanceIds.has(item.prefabInstanceId)) retained.add(item.id);
      if (retained.has(item.id)) {
        for (const supportId of item.supportedByIds ?? []) {
          if (layout.some(({ id }) => id === supportId)) retained.add(supportId);
        }
      }
      if (item.supportedByIds?.some((supportId) => retained.has(supportId))) retained.add(item.id);
    }
    if (retained.size === before) break;
  }
  return cloneLayout(layout.filter(({ id }) => retained.has(id)));
};

export function pasteDecorativeLayout(
  room: InteriorDefinition,
  targetLayout: readonly FurnitureDefinition[],
  clipboard: InteriorLayoutClipboard,
  now: number = Date.now(),
): LayoutMutationResult {
  const retained = retainedDestinationLayout(targetLayout);
  const additions = remapAdditions(clipboard.items, retained, `pasted-${now}`, (item) => item.point);
  if (!additions) return { accepted: false, layout: cloneLayout(targetLayout) };
  const compatible = compatibleAdditions(room, retained, additions);
  if (!compatible) return { accepted: false, layout: cloneLayout(targetLayout) };
  return { accepted: true, layout: [...retained, ...compatible] };
}

export function placePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: FurniturePrefab,
  anchor: GridPoint,
  now: number = Date.now(),
): LayoutMutationResult {
  const snapped = snapFurniturePoint(anchor);
  const additions = remapAdditions(prefab.items, layout, `prefab-item-${now}`, (item) => ({
    x: snapped.x + item.point.x,
    y: snapped.y + item.point.y,
  }));
  if (!additions || !validateAll(room, layout, additions)) return { accepted: false, layout: cloneLayout(layout) };
  return { accepted: true, layout: [...cloneLayout(layout), ...additions] };
}
