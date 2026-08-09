import { furnitureFootprint } from '../world/interiorDefinitions';
import type {
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  GridPoint,
  InteriorDefinition,
} from '../world/types';

export const FURNITURE_PALETTE: readonly FurnitureKind[] = [
  'sofa', 'chair', 'office-chair', 'television', 'display', 'computer', 'desk',
  'meeting-table', 'bookcase', 'cabinet', 'planning-board', 'plant', 'beverage-station', 'printer',
];

export const FURNITURE_SCALES = [0.75, 1, 1.25, 1.5] as const satisfies readonly FurnitureScale[];
export type PlacementDiagnostic = 'valid' | 'outside-room' | 'blocks-door' | 'overlap';

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

const footprintBounds = (item: Pick<FurnitureDefinition, 'kind' | 'point' | 'scale'>) => {
  const base = furnitureFootprint(item.kind);
  const scale = normalizeFurnitureScale(item.scale);
  const width = Math.ceil(base.width * scale);
  const height = Math.ceil(base.height * scale);
  return {
    left: Math.round(item.point.x - (width - 1) / 2),
    top: Math.round(item.point.y - (height - 1) / 2),
    right: Math.round(item.point.x - (width - 1) / 2) + width - 1,
    bottom: Math.round(item.point.y - (height - 1) / 2) + height - 1,
  };
};

export function furnitureCells(item: Pick<FurnitureDefinition, 'kind' | 'point' | 'scale'>): GridPoint[] {
  const bounds = footprintBounds(item);
  const cells: GridPoint[] = [];
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) cells.push({ x, y });
  }
  return cells;
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
  const cells = furnitureCells(candidate);
  const door = { x: Math.floor(room.width / 2), y: room.height - 1 };
  if (cells.some(({ x, y }) => x < 0 || y < 0 || x >= room.width || y >= room.height)) return 'outside-room';
  if (cells.some(({ x, y }) => x === door.x && y === door.y)) return 'blocks-door';
  const occupied = new Set(layout
    .filter(({ id }) => id !== ignoreId)
    .flatMap(furnitureCells)
    .map(({ x, y }) => `${x},${y}`));
  return cells.some(({ x, y }) => occupied.has(`${x},${y}`)) ? 'overlap' : 'valid';
}

export function moveFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  point: GridPoint,
): FurnitureDefinition[] {
  const current = layout.find(({ id }) => id === furnitureId);
  if (!current) return cloneLayout(layout);
  const candidate = { ...current, point: { x: Math.round(point.x), y: Math.round(point.y) } };
  if (!canPlaceFurniture(room, candidate, layout, furnitureId)) return cloneLayout(layout);
  return layout.map((item) => item.id === furnitureId ? candidate : { ...item, point: { ...item.point } });
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
    point: { x: Math.round(point.x), y: Math.round(point.y) },
    facing: 'up',
    supportedActions: [],
    icon: 'generic',
    scale: 1,
  };
  return canPlaceFurniture(room, candidate, layout) ? [...cloneLayout(layout), candidate] : cloneLayout(layout);
}

export function resizeFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  scale: FurnitureScale,
): FurnitureDefinition[] {
  const current = layout.find(({ id }) => id === furnitureId);
  if (!current) return cloneLayout(layout);
  const candidate = { ...current, scale: normalizeFurnitureScale(scale) };
  if (!canPlaceFurniture(room, candidate, layout, furnitureId)) return cloneLayout(layout);
  return layout.map((item) => item.id === furnitureId ? candidate : { ...item, point: { ...item.point } });
}

const storageKey = (buildingId: string): string => `pixelworld:interior-layout:${buildingId}`;
const browserStorage = (): StorageLike | undefined => typeof window === 'undefined' ? undefined : window.localStorage;

interface SavedInteriorLayoutV2 {
  version: 2;
  furniture: FurnitureDefinition[];
}

const normalizeLayout = (layout: readonly FurnitureDefinition[]): FurnitureDefinition[] =>
  cloneLayout(layout).map((item) => ({ ...item, scale: normalizeFurnitureScale(item.scale) }));

export function saveInteriorLayout(
  buildingId: string,
  layout: readonly FurnitureDefinition[],
  storage: StorageLike | undefined = browserStorage(),
): void {
  const saved: SavedInteriorLayoutV2 = { version: 2, furniture: normalizeLayout(layout) };
  storage?.setItem(storageKey(buildingId), JSON.stringify(saved));
}

export function loadInteriorLayout(
  buildingId: string,
  room: InteriorDefinition,
  storage: StorageLike | undefined = browserStorage(),
): FurnitureDefinition[] {
  const fallback = cloneLayout(room.furniture);
  const raw = storage?.getItem(storageKey(buildingId));
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const source = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 2 && 'furniture' in parsed && Array.isArray(parsed.furniture)
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
      const normalized = { ...item, point: { ...item.point }, scale: normalizeFurnitureScale(item.scale) };
      if (canPlaceFurniture(room, normalized, accepted)) accepted.push(normalized);
    }
    return accepted.length > 0 ? accepted : fallback;
  } catch {
    return fallback;
  }
}
