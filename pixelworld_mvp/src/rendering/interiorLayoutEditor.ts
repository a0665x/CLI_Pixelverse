import type {
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  FurnitureRotation,
  GridPoint,
  InteriorDefinition,
} from '../world/types';
import {
  commitPlacementCandidate,
  diagnoseFinePlacement,
  effectiveFurnitureFootprint,
  navigationCells,
  normalizeRotation,
  resolvePlacementCandidate,
  snapFurniturePoint,
  defaultFurnitureLayer,
  furnitureBlocksNavigation,
  type PlacementDiagnostic,
} from './interiorPlacement';

export type { PlacementDiagnostic } from './interiorPlacement';

export const FURNITURE_PALETTE: readonly FurnitureKind[] = [
  'sofa', 'chair', 'office-chair', 'television', 'display', 'computer', 'desk',
  'meeting-table', 'bookcase', 'cabinet', 'planning-board', 'plant', 'beverage-station', 'printer',
];

export const FURNITURE_SCALES = [0.75, 1, 1.25, 1.5] as const satisfies readonly FurnitureScale[];
export function normalizeFurnitureScale(value: unknown): FurnitureScale {
  return FURNITURE_SCALES.includes(value as FurnitureScale) ? value as FurnitureScale : 1;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const cloneLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] => layout.map((item) => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
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

interface SavedInteriorLayoutV3 {
  version: 3;
  furniture: FurnitureDefinition[];
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
      point: snapFurniturePoint(item.point),
      layer: item.layer ?? defaultFurnitureLayer(normalized),
      zIndex: Number.isFinite(item.zIndex) ? Math.trunc(item.zIndex!) : 0,
      blocksNavigation: furnitureBlocksNavigation(normalized),
    };
  });

export function saveInteriorLayout(
  buildingId: string,
  layout: readonly FurnitureDefinition[],
  storage: StorageLike | undefined = browserStorage(),
): void {
  const saved: SavedInteriorLayoutV3 = { version: 3, furniture: normalizeLayout(layout) };
  storage?.setItem(storageKey(buildingId), JSON.stringify(saved));
}

export function loadInteriorLayout(
  buildingId: string,
  room: InteriorDefinition,
  storage: StorageLike | undefined = browserStorage(),
): FurnitureDefinition[] {
  const fallback = normalizeLayout(room.furniture);
  const raw = storage?.getItem(storageKey(buildingId));
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const source = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'version' in parsed && (parsed.version === 2 || parsed.version === 3) && 'furniture' in parsed && Array.isArray(parsed.furniture)
        ? parsed.furniture
        : undefined;
    if (!source) return fallback;
    const accepted: FurnitureDefinition[] = [];
    for (const candidate of source) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as FurnitureDefinition;
      if (
        typeof item.id !== 'string'
        || !item.point
        || !Number.isFinite(item.point.x)
        || !Number.isFinite(item.point.y)
        || !Array.isArray(item.supportedActions)
        || !FURNITURE_PALETTE.includes(item.kind) && !room.furniture.some(({ kind }) => kind === item.kind)
      ) continue;
      const normalized = {
        ...item,
        point: { ...item.point },
        scale: normalizeFurnitureScale(item.scale),
        rotation: normalizeRotation(item.rotation ?? rotationFromFacing(item.facing)),
      };
      if (canPlaceFurniture(room, normalized, accepted)) accepted.push(normalized);
    }
    return accepted.length > 0 ? accepted : fallback;
  } catch {
    return fallback;
  }
}
