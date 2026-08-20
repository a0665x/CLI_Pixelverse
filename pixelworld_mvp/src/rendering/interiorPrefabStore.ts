import type {
  FurnitureDefinition,
  FurniturePrefab,
  GridPoint,
  InteriorDefinition,
  InteriorLayoutClipboard,
  OfficePrefabDefinition,
} from '../world/types';
import { BUILT_IN_OFFICE_PREFABS } from './builtInOfficePrefabs';
import { modernOfficeCompositePrefabs } from './modernOfficeCompositeCatalog';
import { catalogItem } from './modernOfficeCatalog';
import {
  diagnoseFinePlacement,
  furnitureCollidesWithLayout,
  resolvedFurnitureAsset,
  snapFurniturePoint,
} from './interiorPlacement';
import { cloneOfficePrefab } from './prefabGeometry';
import type { StorageReadStatus } from './interiorLayoutEditor';
import { isCompatibleStackSupport, stackRoleForFurniture } from './interiorAutoStack';
import {
  canonicalFurnitureBounds,
  translateFurnitureGeometry,
} from './canonicalFurnitureGeometry';

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
const finitePoint = (value: unknown): value is GridPoint => Boolean(
  value && typeof value === 'object'
  && 'x' in value && Number.isFinite(value.x)
  && 'y' in value && Number.isFinite(value.y),
);
const isFinitePoint = (item: FurnitureDefinition): boolean => Number.isFinite(item.point?.x) && Number.isFinite(item.point?.y);
const FACING_VALUES = ['left', 'right', 'up', 'down'] as const;
const FURNITURE_KIND_VALUES = [
  'sofa', 'chair', 'television', 'bed', 'bookcase', 'computer', 'map-table',
  'planning-board', 'reading-desk', 'workbench', 'tool-wall', 'repair-table',
  'dispatch-pod', 'radio-console', 'response-desk', 'meeting-table', 'decor',
  'office-chair', 'display', 'desk', 'cabinet', 'plant', 'beverage-station', 'printer',
] as const;
const ICON_VALUES = [
  'rest', 'offline', 'think', 'plan', 'read', 'web', 'edit',
  'tool', 'repair', 'clone', 'respond', 'generic',
] as const;
const SCALE_VALUES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3] as const;
const ROTATION_VALUES = [0, 90, 180, 270] as const;
const LAYER_VALUES = ['floor', 'furniture', 'surface', 'wall'] as const;
const SEMANTIC_VALUES = ['rest', 'search', 'work'] as const;
const isValidTemplate = (item: FurnitureDefinition): boolean => (
  typeof item.id === 'string' && item.id.length > 0
  && FURNITURE_KIND_VALUES.includes(item.kind) && isFinitePoint(item) && Array.isArray(item.supportedActions) &&
  item.supportedActions.length === 0 && item.requirementId === undefined
  && (item.assetId === undefined || catalogItem(item.assetId) !== undefined) &&
  FACING_VALUES.includes(item.facing) && ICON_VALUES.includes(item.icon) &&
  (item.scale === undefined || SCALE_VALUES.includes(item.scale)) &&
  (item.rotation === undefined || ROTATION_VALUES.includes(item.rotation)) &&
  (item.layer === undefined || LAYER_VALUES.includes(item.layer)) &&
  (item.semantic === undefined || SEMANTIC_VALUES.includes(item.semantic)) &&
  (item.footprint === undefined || (
    Number.isFinite(item.footprint.width) && item.footprint.width > 0
    && Number.isFinite(item.footprint.height) && item.footprint.height > 0
  )) &&
  (item.visualOffset === undefined || finitePoint(item.visualOffset)) &&
  (item.interactionPoint === undefined || finitePoint(item.interactionPoint)) &&
  (item.blocksNavigation === undefined || typeof item.blocksNavigation === 'boolean') &&
  (item.zIndex === undefined || Number.isFinite(item.zIndex)) &&
  (item.supportedByIds === undefined || (
    Array.isArray(item.supportedByIds) && item.supportedByIds.every((id) => typeof id === 'string' && id.length > 0)
  ))
);

const clonePrefab = (prefab: FurniturePrefab): FurniturePrefab => ({
  ...prefab,
  ...(prefab.origin ? { origin: { ...prefab.origin } } : {}),
  ...(prefab.memberOffsets ? { memberOffsets: Object.fromEntries(
    Object.entries(prefab.memberOffsets).map(([id, point]) => [id, { ...point }]),
  ) } : {}),
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
  anchor: { ...(prefab.origin ?? { x: 0, y: 0 }) },
  interactionAnchors: [],
});

export function isBuiltInPrefab(prefab: FurniturePrefab): prefab is OfficePrefabDefinition {
  return 'source' in prefab && prefab.source === 'modern-office-v1.2'
    && 'immutable' in prefab && prefab.immutable === true;
}

export interface StorageReadResult<T> { storageRead: StorageReadStatus; value: T }

interface PersistedPrefabMemberV2 {
  offset: GridPoint;
  item: FurnitureDefinition;
}

interface PersistedPrefabV2 {
  version: 2;
  id: string;
  name: string;
  createdAt: number;
  width: number;
  height: number;
  origin: GridPoint;
  members: PersistedPrefabMemberV2[];
}

interface PersistedPrefabStoreV2 { version: 2; prefabs: PersistedPrefabV2[] }

const canonicalizedPrefab = (prefab: FurniturePrefab): FurniturePrefab => {
  const origin = { ...(prefab.origin ?? { x: 0, y: 0 }) };
  const items = cloneLayout(prefab.items);
  const memberOffsets = Object.fromEntries(items.map((item) => [
    item.id,
    { ...(prefab.memberOffsets?.[item.id] ?? {
      x: item.point.x - origin.x,
      y: item.point.y - origin.y,
    }) },
  ]));
  return { ...clonePrefab(prefab), version: 2, origin, memberOffsets, items };
};

const validPrefabHeader = (prefab: Partial<FurniturePrefab>): boolean => Boolean(
  typeof prefab.id === 'string' && prefab.id.length > 0
  && typeof prefab.name === 'string' && prefab.name.length > 0
  && Number.isFinite(prefab.createdAt)
  && Number.isFinite(prefab.width) && prefab.width! > 0
  && Number.isFinite(prefab.height) && prefab.height! > 0,
);

const near = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-9;

const validCanonicalPrefab = (prefab: FurniturePrefab): boolean => {
  if (!validPrefabHeader(prefab) || !finitePoint(prefab.origin)
    || !prefab.memberOffsets || prefab.items.length < 2 || !prefab.items.every(isValidTemplate)) return false;
  const ids = new Set(prefab.items.map(({ id }) => id));
  if (ids.size !== prefab.items.length || Object.keys(prefab.memberOffsets).length !== ids.size) return false;
  return prefab.items.every((item) => {
    const offset = prefab.memberOffsets?.[item.id];
    return finitePoint(offset)
      && near(item.point.x, prefab.origin!.x + offset.x)
      && near(item.point.y, prefab.origin!.y + offset.y)
      && (item.supportedByIds ?? []).every((id) => ids.has(id));
  });
};

const parsePrefabPayload = (raw: string): FurniturePrefab[] | undefined => {
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; prefabs?: unknown };
    if (!Array.isArray(parsed.prefabs)) return undefined;
    if (parsed.version === 1) {
      const legacy = parsed.prefabs as FurniturePrefab[];
      if (new Set(legacy.map(({ id }) => id)).size !== legacy.length) return undefined;
      if (!legacy.every((prefab) => validPrefabHeader(prefab)
        && Array.isArray(prefab.items) && prefab.items.length >= 2 && prefab.items.every(isValidTemplate))) return undefined;
      const migrated = legacy.map((prefab) => canonicalizedPrefab(prefab));
      return migrated.every(validCanonicalPrefab) ? migrated : undefined;
    }
    if (parsed.version !== 2) return undefined;
    const persisted = parsed.prefabs as PersistedPrefabV2[];
    if (new Set(persisted.map(({ id }) => id)).size !== persisted.length) return undefined;
    if (!persisted.every((prefab) => {
      if (!prefab || prefab.version !== 2 || !validPrefabHeader(prefab) || !finitePoint(prefab.origin)
        || !Array.isArray(prefab.members) || prefab.members.length < 2) return false;
      const memberIds = new Set<string>();
      return prefab.members.every((member) => {
        if (!member || !finitePoint(member.offset) || !isValidTemplate(member.item)
          || memberIds.has(member.item.id)) return false;
        memberIds.add(member.item.id);
        return near(member.item.point.x, prefab.origin.x + member.offset.x)
          && near(member.item.point.y, prefab.origin.y + member.offset.y);
      });
    })) return undefined;
    const migrated = persisted.map((prefab): FurniturePrefab => ({
      version: 2,
      id: prefab.id,
      name: prefab.name,
      createdAt: prefab.createdAt,
      width: prefab.width,
      height: prefab.height,
      origin: { ...prefab.origin },
      memberOffsets: Object.fromEntries(prefab.members.map(({ item, offset }) => [item.id, { ...offset }])),
      items: prefab.members.map(({ item }) => cloneFurniture(item)),
    }));
    return migrated.every(validCanonicalPrefab) ? migrated : undefined;
  } catch {
    return undefined;
  }
};

const persistedPrefab = (prefab: FurniturePrefab): PersistedPrefabV2 => {
  const canonical = canonicalizedPrefab(prefab);
  return {
    version: 2,
    id: canonical.id,
    name: canonical.name,
    createdAt: canonical.createdAt,
    width: canonical.width,
    height: canonical.height,
    origin: { ...canonical.origin! },
    members: canonical.items.map((item) => ({
      offset: { ...canonical.memberOffsets![item.id]! },
      item: cloneFurniture(item),
    })),
  };
};

export function savePrefabs(
  prefabs: readonly FurniturePrefab[],
  storage: StorageLike | undefined = browserStorage(),
): void {
  if (typeof window !== 'undefined' && !storage) throw new Error('Prefab storage unavailable');
  if (!storage) return;
  const existing = readStorage(storage, PREFAB_KEY);
  if (existing.storageRead === 'failed') throw new Error('Prefab storage unavailable');
  if (existing.value !== null && parsePrefabPayload(existing.value) === undefined) {
    throw new Error('Refusing to overwrite malformed prefab storage');
  }
  const userPrefabs = prefabs.filter((prefab) => !isBuiltInPrefab(prefab)).map(canonicalizedPrefab);
  if (!userPrefabs.every(validCanonicalPrefab)) {
    throw new Error('Invalid prefab data');
  }
  const payload: PersistedPrefabStoreV2 = { version: 2, prefabs: userPrefabs.map(persistedPrefab) };
  const serialized = JSON.stringify(payload);
  if (parsePrefabPayload(serialized) === undefined) throw new Error('Invalid prefab data');
  storage.setItem(PREFAB_KEY, serialized);
}

export function readPrefabs(storage?: StorageLike): StorageReadResult<FurniturePrefab[]> {
  const read = readStorage(storage, PREFAB_KEY);
  if (read.storageRead === 'failed' || !read.value) return { storageRead: read.storageRead, value: [] };
  const parsed = parsePrefabPayload(read.value);
  return parsed
    ? { storageRead: 'success', value: parsed.map(clonePrefab) }
    : { storageRead: 'failed', value: [] };
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
      ...modernOfficeCompositePrefabs.map((prefab) => deepFreeze(cloneOfficePrefab(prefab))),
      ...read.value.map(asUserOfficePrefab),
    ],
  };
}

export function availablePrefabs(storage?: StorageLike): OfficePrefabDefinition[] {
  return readAvailablePrefabs(storage).value;
}

export function nextUserGroupName(existing: readonly FurniturePrefab[]): string {
  const used = new Set(existing.flatMap(({ name }) => {
    const match = /^Group\s+(\d+)$/i.exec(name);
    return match ? [Number(match[1])] : [];
  }));
  let sequence = 1;
  while (used.has(sequence)) sequence += 1;
  return `Group ${String(sequence).padStart(2, '0')}`;
}

export function createUserGroupPrefab(
  selection: readonly FurnitureDefinition[],
  existing: readonly FurniturePrefab[],
  createdAt: number = Date.now(),
): FurniturePrefab {
  if (selection.length < 2) throw new Error('A reusable group needs at least two furniture items');
  const origin = {
    x: Math.min(...selection.map(({ point }) => point.x)),
    y: Math.min(...selection.map(({ point }) => point.y)),
  };
  const bounds = selection.map((item) => canonicalFurnitureBounds(item));
  const left = Math.min(...bounds.map(({ x }) => x));
  const top = Math.min(...bounds.map(({ y }) => y));
  const right = Math.max(...bounds.map(({ x, width }) => x + width));
  const bottom = Math.max(...bounds.map(({ y, height }) => y + height));
  const idMap = new Map(selection.map(({ id }, index) => [id, `group-item-${index + 1}`]));
  const items = selection.map((source, index): FurnitureDefinition => {
    const { prefabInstanceId: _prefabInstanceId, supportedByIds, ...item } = cloneFurniture(source);
    const remappedSupports = supportedByIds?.flatMap((id) => {
      const mapped = idMap.get(id); return mapped ? [mapped] : [];
    });
    return {
      ...item,
      id: `group-item-${index + 1}`,
      point: { ...source.point },
      ...(remappedSupports?.length ? { supportedByIds: remappedSupports } : {}),
    };
  });
  let sequence = 1;
  const usedIds = new Set(existing.map(({ id }) => id));
  while (usedIds.has(`user-group-${createdAt}-${sequence}`)) sequence += 1;
  return {
    version: 2,
    id: `user-group-${createdAt}-${sequence}`,
    name: nextUserGroupName(existing),
    createdAt,
    width: right - left,
    height: bottom - top,
    origin,
    memberOffsets: Object.fromEntries(items.map((member) => [member.id, {
      x: member.point.x - origin.x,
      y: member.point.y - origin.y,
    }])),
    items,
  };
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
    if (furnitureCollidesWithLayout(item, fixed)) return false;
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
    const point = pointFor(item);
    const translated = translateFurnitureGeometry(item, {
      x: point.x - item.point.x,
      y: point.y - item.point.y,
    });
    additions.push({
      ...translated,
      id: ids.get(item.id)!,
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
  const canonical = canonicalizedPrefab(prefab);
  const additions = remapAdditions(prefab.items, layout, `prefab-item-${now}`, (item) => ({
    x: snapped.x + canonical.memberOffsets![item.id]!.x,
    y: snapped.y + canonical.memberOffsets![item.id]!.y,
  }));
  if (!additions || !validateAll(room, layout, additions)) return { accepted: false, layout: cloneLayout(layout) };
  return { accepted: true, layout: [...cloneLayout(layout), ...additions] };
}
