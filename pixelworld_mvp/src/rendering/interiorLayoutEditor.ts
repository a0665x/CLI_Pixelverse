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
  navigationCells,
  normalizeRotation,
  resolvePlacementCandidate,
  defaultFurnitureLayer,
  furnitureBlocksNavigation,
  type PlacementDiagnostic,
} from './interiorPlacement';

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
}));

export function furnitureCells(item: Pick<FurnitureDefinition, 'kind' | 'point' | 'scale'>): GridPoint[] {
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
  const candidate = resolvePlacementCandidate(room, layout, current, point, furnitureId);
  return commitPlacementCandidate(room, layout, candidate);
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
  return commitPlacementCandidate(room, layout, resolvePlacementCandidate(room, layout, candidate, point));
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
  return commitPlacementCandidate(room, layout, candidate);
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
    room, layout, { ...current, rotation: normalizeRotation(rotation) }, current.point, furnitureId,
  );
  return commitPlacementCandidate(room, layout, candidate);
}

const storageKey = (buildingId: string): string => `pixelworld:interior-layout:${buildingId}`;
const browserStorage = (): StorageLike | undefined => typeof window === 'undefined' ? undefined : window.localStorage;

interface SavedInteriorLayoutV5 {
  version: 5;
  authoredRevision: number;
  furniture: FurnitureDefinition[];
}

interface ParsedSavedInteriorLayout {
  furniture: unknown[];
  legacy: boolean;
}

const parseSavedInteriorLayout = (raw: string): ParsedSavedInteriorLayout | undefined => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { furniture: parsed, legacy: true };
    if (!parsed || typeof parsed !== 'object') return undefined;
    const saved = parsed as { version?: unknown; furniture?: unknown };
    if (!Array.isArray(saved.furniture)) return undefined;
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
  storage: StorageLike | undefined = browserStorage(),
): boolean {
  const raw = storage?.getItem(storageKey(buildingId));
  return raw !== null && raw !== undefined && parseSavedInteriorLayout(raw) !== undefined;
}

const rotationFromFacing = (facing: FurnitureDefinition['facing']): FurnitureRotation => ({
  up: 0, right: 90, down: 180, left: 270,
} satisfies Record<FurnitureDefinition['facing'], FurnitureRotation>)[facing];

const normalizeLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] =>
  cloneLayout(layout).map((item) => {
    const normalized = {
      ...item,
      scale: normalizeFurnitureScale(item.scale),
      rotation: normalizeRotation(item.rotation ?? rotationFromFacing(item.facing)),
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
    ? { ...item, requirementId: requiredId(room, authoredHook ?? item), blocksNavigation: true }
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
  const saved: SavedInteriorLayoutV5 = {
    version: 5,
    authoredRevision: INTERIOR_LAYOUT_REVISION,
    furniture: normalizeLayout(layout),
  };
  storage?.setItem(storageKey(buildingId), JSON.stringify(saved));
}

export function loadInteriorLayout(
  buildingId: string,
  room: InteriorDefinition,
  storage: StorageLike | undefined = browserStorage(),
): FurnitureDefinition[] {
  const fallback = normalizeRoomLayout(room, room.furniture);
  const raw = storage?.getItem(storageKey(buildingId));
  if (!raw) return fallback;
  const parsed = parseSavedInteriorLayout(raw);
  if (!parsed) return fallback;
  const authoredIds = new Set(room.furniture.map(({ id }) => id));
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
    const normalized = normalizeRoomLayout(room, [{
      ...item,
      point: { ...item.point },
      scale: normalizeFurnitureScale(item.scale),
      rotation: normalizeRotation(item.rotation ?? rotationFromFacing(item.facing)),
    }])[0]!;
    if (canPlaceFurniture(room, normalized, accepted)) accepted.push(normalized);
  }
  return accepted.length > 0 || !parsed.legacy ? accepted : fallback;
}

export function revertInteriorDraft(
  buildingId: string,
  room: InteriorDefinition,
  storage: StorageLike | undefined = browserStorage(),
): FurnitureDefinition[] {
  return loadInteriorLayout(buildingId, room, storage);
}
