import type {
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  FurnitureRotation,
  FurnitureLayer,
  GridPoint,
  InteriorDefinition,
} from '../world/types';
import { INTERIOR_LAYOUT_REVISION } from '../world/interiorDefinitions';
import {
  commitPlacementCandidate,
  diagnoseFinePlacement,
  effectiveFurnitureFootprint,
  fitBoundsDeltaToRoom,
  navigationCells,
  normalizeRotation,
  resolvePlacementCandidate,
  defaultFurnitureLayer,
  furnitureBlocksNavigation,
  furnitureWithRotation,
  rotateGridPoint,
  snapFurniturePoint,
  transformedAlphaBounds,
  type PlacementDiagnostic,
} from './interiorPlacement';
import {
  isCompatibleStackSupport,
  resolveAutomaticSupport,
  stackDependencies,
  stackRoleForFurniture,
} from './interiorAutoStack';

export type { PlacementDiagnostic } from './interiorPlacement';

export const FURNITURE_PALETTE: readonly FurnitureKind[] = [
  'sofa', 'chair', 'office-chair', 'television', 'display', 'computer', 'desk',
  'meeting-table', 'bookcase', 'cabinet', 'planning-board', 'plant', 'beverage-station', 'printer',
];
const SAVED_FURNITURE_KINDS: readonly FurnitureKind[] = [
  'sofa', 'chair', 'television', 'bed', 'bookcase', 'computer', 'map-table',
  'planning-board', 'reading-desk', 'workbench', 'tool-wall', 'repair-table',
  'dispatch-pod', 'radio-console', 'response-desk', 'meeting-table', 'decor',
  'office-chair', 'display', 'desk', 'cabinet', 'plant', 'beverage-station', 'printer',
];

export const FURNITURE_SCALES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3] as const satisfies readonly FurnitureScale[];
export function normalizeFurnitureScale(value: unknown): FurnitureScale {
  return FURNITURE_SCALES.includes(value as FurnitureScale) ? value as FurnitureScale : 1;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const cloneLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] => layout.map((item) => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
  ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
}));

export function furnitureCells(item: Pick<
  FurnitureDefinition,
  'kind' | 'point' | 'scale'
> & Partial<Pick<
  FurnitureDefinition,
  'assetId' | 'footprint' | 'rotation' | 'visualOffset' | 'layer' | 'blocksNavigation' | 'supportedActions'
>>): GridPoint[] {
  return navigationCells(item);
}

export function canPlaceFurniture(
  room: InteriorDefinition,
  candidate: FurnitureDefinition,
  layout: readonly FurnitureDefinition[],
  ignoreId?: string,
): boolean {
  return placementDiagnostic(room, candidate, layout, ignoreId) === 'valid';
}

export function placementDiagnostic(
  room: InteriorDefinition,
  candidate: FurnitureDefinition,
  layout: readonly FurnitureDefinition[],
  ignoreId?: string,
): PlacementDiagnostic {
  return diagnoseFinePlacement(room, candidate, layout, ignoreId);
}

export function moveFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  point: GridPoint,
): FurnitureDefinition[] {
  const current = layout.find(({ id }) => id === furnitureId);
  if (!current) return cloneLayout(layout);
  const dependencyIds = new Set(stackDependencies([furnitureId], layout));
  if (dependencyIds.size > 1) {
    const snapped = snapFurniturePoint(point);
    const requestedDelta = { x: snapped.x - current.point.x, y: snapped.y - current.point.y };
    const translated = cloneLayout(layout).map((item) => {
      if (!dependencyIds.has(item.id)) return item;
      return {
        ...item,
        point: { x: item.point.x + requestedDelta.x, y: item.point.y + requestedDelta.y },
        ...(item.interactionPoint ? { interactionPoint: {
          x: item.interactionPoint.x + requestedDelta.x,
          y: item.interactionPoint.y + requestedDelta.y,
        } } : {}),
      };
    });
    const dependencyBounds = translated.filter(({ id }) => dependencyIds.has(id))
      .map((item) => transformedAlphaBounds(item));
    const x = Math.min(...dependencyBounds.map((bounds) => bounds.x));
    const y = Math.min(...dependencyBounds.map((bounds) => bounds.y));
    const right = Math.max(...dependencyBounds.map((bounds) => bounds.x + bounds.width));
    const bottom = Math.max(...dependencyBounds.map((bounds) => bounds.y + bounds.height));
    const bounds = { x, y, width: right - x, height: bottom - y };
    const impossibleFit = bounds.width > room.width || bounds.height > room.height;
    const entirelyOutside = right <= 0 || x >= room.width || bottom <= 0 || y >= room.height;
    if (impossibleFit || entirelyOutside) return cloneLayout(layout);
    const fitDelta = fitBoundsDeltaToRoom(room, bounds);
    const moved = translated.map((item) => {
      if (!dependencyIds.has(item.id)) return item;
      return {
        ...item,
        point: { x: item.point.x + fitDelta.x, y: item.point.y + fitDelta.y },
        ...(item.interactionPoint ? { interactionPoint: {
          x: item.interactionPoint.x + fitDelta.x,
          y: item.interactionPoint.y + fitDelta.y,
        } } : {}),
      };
    });
    return moved.filter(({ id }) => dependencyIds.has(id))
      .every((item) => diagnoseFinePlacement(room, item, moved, item.id) === 'valid')
      ? moved
      : cloneLayout(layout);
  }
  const candidate = resolvePlacementCandidate(room, layout, current, point, furnitureId);
  const resolved = {
    ...candidate,
    furniture: resolveAutomaticSupport(candidate.furniture, layout).item,
  };
  return commitPlacementCandidate(room, layout, resolved);
}

export function addFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  kind: FurnitureKind,
  point: GridPoint,
): FurnitureDefinition[] {
  const candidate: FurnitureDefinition = {
    id: `custom-${kind}-${Date.now()}-${layout.length}`,
    kind,
    point: { ...point },
    facing: 'up',
    supportedActions: [],
    icon: 'generic',
    scale: 1,
    rotation: 0,
  };
  const placement = resolvePlacementCandidate(room, layout, candidate, point);
  return commitPlacementCandidate(room, layout, {
    ...placement,
    furniture: resolveAutomaticSupport(placement.furniture, layout).item,
  });
}

export function resizeFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  scale: FurnitureScale,
): FurnitureDefinition[] {
  const current = layout.find(({ id }) => id === furnitureId);
  if (!current) return cloneLayout(layout);
  const candidate = resolvePlacementCandidate(
    room, layout, { ...current, scale: normalizeFurnitureScale(scale) }, current.point, furnitureId,
  );
  return commitPlacementCandidate(room, layout, {
    ...candidate,
    furniture: resolveAutomaticSupport(candidate.furniture, layout).item,
  });
}

export function rotateFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  rotation: FurnitureRotation,
): FurnitureDefinition[] {
  const current = layout.find(({ id }) => id === furnitureId);
  if (!current) return cloneLayout(layout);
  const candidate = resolvePlacementCandidate(
    room, layout, furnitureWithRotation(current, normalizeRotation(rotation)), current.point, furnitureId,
  );
  return commitPlacementCandidate(room, layout, {
    ...candidate,
    furniture: resolveAutomaticSupport(candidate.furniture, layout).item,
  });
}

const storageKey = (buildingId: string): string => `pixelworld:interior-layout:${buildingId}`;
const browserStorage = (): StorageLike | undefined => {
  if (typeof window === 'undefined') return undefined;
  try { return window.localStorage; } catch { return undefined; }
};

export type StorageReadStatus = 'success' | 'failed';

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

interface SavedInteriorLayoutV5 {
  version: 5;
  authoredRevision: number;
  furniture: FurnitureDefinition[];
}

interface ParsedSavedInteriorLayout {
  furniture: FurnitureDefinition[];
  legacy: boolean;
}

const FACING_VALUES = ['left', 'right', 'up', 'down'] as const;
const ACTION_VALUES = [
  'arrive', 'ponder', 'plan', 'read', 'type', 'terminal', 'signal', 'dispatch',
  'respond', 'queue', 'repair', 'rest', 'offline', 'pulse',
] as const;
const ICON_VALUES = [
  'rest', 'offline', 'think', 'plan', 'read', 'web', 'edit', 'tool', 'repair',
  'clone', 'respond', 'generic',
] as const;
const LAYER_VALUES = ['floor', 'furniture', 'surface', 'wall'] as const;

const finitePoint = (value: unknown): value is GridPoint => Boolean(
  value && typeof value === 'object'
  && 'x' in value && Number.isFinite(value.x)
  && 'y' in value && Number.isFinite(value.y),
);

const optionalFinite = (value: unknown): boolean => value === undefined || Number.isFinite(value);
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';

const isSavedFurniture = (value: unknown): value is FurnitureDefinition => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FurnitureDefinition>;
  return typeof item.id === 'string' && item.id.length > 0
    && SAVED_FURNITURE_KINDS.includes(item.kind as FurnitureKind)
    && finitePoint(item.point)
    && FACING_VALUES.includes(item.facing as typeof FACING_VALUES[number])
    && Array.isArray(item.supportedActions)
    && item.supportedActions.every((action) => ACTION_VALUES.includes(action))
    && ICON_VALUES.includes(item.icon as typeof ICON_VALUES[number])
    && optionalFinite(item.assetId)
    && (item.scale === undefined || FURNITURE_SCALES.includes(item.scale))
    && (item.rotation === undefined || [0, 90, 180, 270].includes(item.rotation))
    && (item.footprint === undefined || (
      item.footprint && Number.isFinite(item.footprint.width) && item.footprint.width > 0
      && Number.isFinite(item.footprint.height) && item.footprint.height > 0
    ))
    && (item.layer === undefined || LAYER_VALUES.includes(item.layer))
    && optionalFinite(item.zIndex)
    && (item.blocksNavigation === undefined || typeof item.blocksNavigation === 'boolean')
    && optionalString(item.requirementId)
    && (item.visualOffset === undefined || finitePoint(item.visualOffset))
    && (item.interactionPoint === undefined || finitePoint(item.interactionPoint))
    && optionalString(item.prefabInstanceId)
    && (item.supportedByIds === undefined || (
      Array.isArray(item.supportedByIds) && item.supportedByIds.every((id) => typeof id === 'string' && id.length > 0)
    ));
};

const parseSavedInteriorLayout = (raw: string): ParsedSavedInteriorLayout | undefined => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.every(isSavedFurniture) ? { furniture: parsed, legacy: true } : undefined;
    }
    if (!parsed || typeof parsed !== 'object') return undefined;
    const saved = parsed as { version?: unknown; furniture?: unknown };
    if (!Array.isArray(saved.furniture) || !saved.furniture.every(isSavedFurniture)) return undefined;
    if (saved.version === 5) return { furniture: saved.furniture, legacy: false };
    if (saved.version === 2 || saved.version === 3 || saved.version === 4) {
      return { furniture: saved.furniture, legacy: true };
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export function hasSavedInteriorLayout(
  buildingId: string,
  storage?: StorageLike,
): boolean {
  const read = readStorage(storage, storageKey(buildingId));
  return read.storageRead === 'success' && read.value !== null && parseSavedInteriorLayout(read.value) !== undefined;
}

const normalizeLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] =>
  cloneLayout(layout).map((item) => {
    const normalized = {
      ...item,
      scale: normalizeFurnitureScale(item.scale),
      rotation: normalizeRotation(item.rotation ?? 0),
    };
    return {
      ...normalized,
      point: { ...item.point },
      layer: item.layer ?? defaultFurnitureLayer(normalized),
      zIndex: Number.isFinite(item.zIndex) ? Math.trunc(item.zIndex!) : 0,
      blocksNavigation: furnitureBlocksNavigation(normalized),
    };
  });

const requiredId = (room: InteriorDefinition, item: FurnitureDefinition): string =>
  item.requirementId ?? `${room.id}:${item.id}`;

const normalizeRoomLayout = (
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
): FurnitureDefinition[] => normalizeLayout(layout).map((item) => {
  const authoredHook = room.furniture.find(({ id }) => id === item.id && item.supportedActions.length > 0);
  return item.supportedActions.length > 0 || authoredHook
    ? {
        ...item,
        requirementId: requiredId(room, authoredHook ?? item),
        blocksNavigation: item.blocksNavigation ?? authoredHook?.blocksNavigation ?? true,
      }
    : item;
});

export interface RequiredHookInventoryItem {
  requirementId: string;
  furniture: FurnitureDefinition;
  placed: boolean;
}

export function requiredHookInventory(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
): RequiredHookInventoryItem[] {
  return normalizeRoomLayout(room, room.furniture)
    .filter(({ supportedActions }) => supportedActions.length > 0)
    .map((furniture) => ({
      requirementId: requiredId(room, furniture),
      furniture,
      placed: layout.some((item) =>
        item.requirementId === requiredId(room, furniture)
        || item.id === furniture.id,
      ),
    }));
}

export function collectAllFurniture(_layout: readonly FurnitureDefinition[]): FurnitureDefinition[] {
  return [];
}

const FURNITURE_LAYERS: readonly FurnitureLayer[] = ['floor', 'furniture', 'surface', 'wall'];

export function shiftFurnitureLayer(
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  direction: 'previous' | 'next',
): FurnitureDefinition[] {
  return cloneLayout(layout).map((item) => {
    if (item.id !== furnitureId) return item;
    const current = item.layer ?? defaultFurnitureLayer(item);
    const offset = direction === 'next' ? 1 : -1;
    const index = Math.max(0, Math.min(FURNITURE_LAYERS.length - 1, FURNITURE_LAYERS.indexOf(current) + offset));
    return { ...item, layer: FURNITURE_LAYERS[index]!, zIndex: 0 };
  });
}

export function reorderFurniture(
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  direction: 'back' | 'backward' | 'forward' | 'front',
): FurnitureDefinition[] {
  const selected = layout.find(({ id }) => id === furnitureId);
  if (!selected) return cloneLayout(layout);
  const layer = selected.layer ?? defaultFurnitureLayer(selected);
  const peers = layout.filter((item) => (item.layer ?? defaultFurnitureLayer(item)) === layer);
  const current = selected.zIndex ?? 0;
  const zIndex = direction === 'front'
    ? Math.max(...peers.map((item) => item.zIndex ?? 0)) + 1
    : direction === 'back'
      ? Math.min(...peers.map((item) => item.zIndex ?? 0)) - 1
      : current + (direction === 'forward' ? 1 : -1);
  return cloneLayout(layout).map((item) => item.id === furnitureId ? { ...item, zIndex } : item);
}

export function saveInteriorLayout(
  buildingId: string,
  layout: readonly FurnitureDefinition[],
  storage: StorageLike | undefined = browserStorage(),
): void {
  if (typeof window !== 'undefined' && !storage) throw new Error('Interior storage unavailable');
  const saved: SavedInteriorLayoutV5 = {
    version: 5,
    authoredRevision: INTERIOR_LAYOUT_REVISION,
    furniture: normalizeLayout(layout),
  };
  storage?.setItem(storageKey(buildingId), JSON.stringify(saved));
}

export interface InteriorLayoutReadResult {
  layout: FurnitureDefinition[];
  storageRead: StorageReadStatus;
}

export function readInteriorLayout(
  buildingId: string,
  room: InteriorDefinition,
  storage?: StorageLike,
): InteriorLayoutReadResult {
  const fallback = normalizeRoomLayout(room, room.furniture);
  const read = readStorage(storage, storageKey(buildingId));
  if (read.storageRead === 'failed' || !read.value) return { layout: fallback, storageRead: read.storageRead };
  const parsed = parseSavedInteriorLayout(read.value);
  if (!parsed) return { layout: fallback, storageRead: 'success' };
  const authoredIds = new Set(room.furniture.map(({ id }) => id));
  const authoredFor = (item: FurnitureDefinition): FurnitureDefinition | undefined => fallback.find((candidate) => (
    candidate.id === item.id
    || Boolean(item.requirementId) && candidate.requirementId === item.requirementId
  ));
  const candidates = parsed.legacy
    ? [...fallback, ...parsed.furniture.filter((candidate) => (
      candidate && typeof candidate === 'object'
      && 'id' in candidate && typeof candidate.id === 'string'
      && !authoredIds.has(candidate.id)
    ))]
    : parsed.furniture;
  const accepted: FurnitureDefinition[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as FurnitureDefinition;
    if (
      typeof item.id !== 'string'
      || !item.point
      || !Number.isFinite(item.point.x)
      || !Number.isFinite(item.point.y)
      || !Array.isArray(item.supportedActions)
      || !SAVED_FURNITURE_KINDS.includes(item.kind)
    ) continue;
    const authored = authoredFor(item);
    const savedRotation = normalizeRotation(item.rotation ?? 0);
    const authoredRotation = authored
      ? normalizeRotation(authored.rotation ?? 0)
      : 0;
    const rotationDelta = (((savedRotation - authoredRotation) + 360) % 360) as FurnitureRotation;
    const authoredInteractionPoint = authored?.interactionPoint
      ? (() => {
          const relative = rotateGridPoint({
            x: authored.interactionPoint!.x - authored.point.x,
            y: authored.interactionPoint!.y - authored.point.y,
          }, rotationDelta);
          return { x: item.point.x + relative.x, y: item.point.y + relative.y };
        })()
      : undefined;
    const hydrated = !item.interactionPoint && authoredInteractionPoint
      ? { ...item, interactionPoint: authoredInteractionPoint }
      : item;
    const normalized = normalizeRoomLayout(room, [{
      ...hydrated,
      point: { ...hydrated.point },
      scale: normalizeFurnitureScale(hydrated.scale),
      rotation: savedRotation,
    }])[0]!;
    const diagnostic = placementDiagnostic(room, normalized, accepted);
    if (diagnostic === 'valid' || diagnostic === 'invalid-asset') accepted.push(normalized);
  }
  const byId = new Map(accepted.map((item) => [item.id, item]));
  const repaired = accepted.map((item) => {
    if (!item.supportedByIds) return item;
    const valid = stackRoleForFurniture(item) === 'surface'
      && item.supportedByIds.every((id) => isCompatibleStackSupport(byId.get(id)));
    if (valid) return item;
    const { supportedByIds: _supportedByIds, ...ordinaryDecor } = item;
    return ordinaryDecor;
  });
  return {
    layout: repaired.length > 0 || !parsed.legacy ? repaired : fallback,
    storageRead: 'success',
  };
}

export function loadInteriorLayout(
  buildingId: string,
  room: InteriorDefinition,
  storage?: StorageLike,
): FurnitureDefinition[] {
  return readInteriorLayout(buildingId, room, storage).layout;
}

export function revertInteriorDraft(
  buildingId: string,
  room: InteriorDefinition,
  storage?: StorageLike,
): FurnitureDefinition[] {
  return loadInteriorLayout(buildingId, room, storage);
}
