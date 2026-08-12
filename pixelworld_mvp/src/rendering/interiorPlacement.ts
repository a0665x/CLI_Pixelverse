import { furnitureFootprint } from '../world/interiorDefinitions';
import type {
  FurnitureDefinition,
  FurnitureFootprint,
  FurnitureLayer,
  FurnitureRotation,
  GridPoint,
  InteriorDefinition,
} from '../world/types';
import { catalogItem, type ModernOfficeCatalogItem } from './modernOfficeCatalog';

export const EDITOR_CELL = 5.5;
export type PlacementDiagnostic = 'valid' | 'outside-room' | 'blocks-door' | 'overlap' | 'invalid-asset';
export interface FurnitureBounds { x: number; y: number; width: number; height: number }

export interface PlacementCandidate {
  furniture: FurnitureDefinition;
  diagnostic: PlacementDiagnostic;
  fineCells: GridPoint[];
  bounds: FurnitureBounds;
}

const DEFAULT_ASSET_ID: Partial<Record<FurnitureDefinition['kind'], number>> = {
  sofa: 200, bed: 200, chair: 101, 'office-chair': 101, television: 129, display: 129,
  computer: 225, 'dispatch-pod': 225, 'radio-console': 225, bookcase: 176,
  'planning-board': 171, 'map-table': 207, 'meeting-table': 207, 'reading-desk': 193,
  workbench: 193, 'repair-table': 193, 'response-desk': 193, desk: 193,
  'tool-wall': 175, cabinet: 175, decor: 98, plant: 98, 'beverage-station': 173, printer: 177,
};

const normalizeScale = (value: unknown): number => (
  typeof value === 'number' && value >= 0.75 && value <= 3 && value * 4 === Math.round(value * 4) ? value : 1
);

export function normalizeRotation(value: unknown): FurnitureRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

export function rotatedFootprint(size: FurnitureFootprint, rotation: FurnitureRotation): FurnitureFootprint {
  return rotation % 180 === 0 ? { ...size } : { width: size.height, height: size.width };
}

export function baseFurnitureFootprint(item: Pick<FurnitureDefinition, 'kind' | 'footprint'>): FurnitureFootprint {
  return item.footprint ? { ...item.footprint } : furnitureFootprint(item.kind);
}

export function effectiveFurnitureFootprint(
  item: Pick<FurnitureDefinition, 'kind' | 'footprint' | 'rotation' | 'scale'>,
): FurnitureFootprint {
  const rotated = rotatedFootprint(baseFurnitureFootprint(item), normalizeRotation(item.rotation));
  const scale = normalizeScale(item.scale);
  return {
    width: Math.max(1, Math.ceil(rotated.width * scale)),
    height: Math.max(1, Math.ceil(rotated.height * scale)),
  };
}

const snapAxis = (value: number, size: number): number => (
  size % 2 === 0 ? Math.round(value - 0.5) + 0.5 : Math.round(value)
);

export function snapFurnitureCenter(point: GridPoint, footprint: FurnitureFootprint): GridPoint {
  return { x: snapAxis(point.x, footprint.width), y: snapAxis(point.y, footprint.height) };
}

export function snapFurniturePoint(point: GridPoint): GridPoint {
  return { x: Math.round(point.x * 4) / 4, y: Math.round(point.y * 4) / 4 };
}

export const resolvedFurnitureAsset = (item: Pick<FurnitureDefinition, 'kind' | 'assetId'>): ModernOfficeCatalogItem | undefined =>
  catalogItem(item.assetId ?? DEFAULT_ASSET_ID[item.kind] ?? -1);

export function transformedAlphaBounds(
  item: Pick<FurnitureDefinition, 'kind' | 'point' | 'assetId' | 'rotation' | 'scale' | 'footprint'>,
  asset: ModernOfficeCatalogItem | undefined = resolvedFurnitureAsset(item),
): FurnitureBounds {
  const scale = normalizeScale(item.scale);
  const fallback = baseFurnitureFootprint(item);
  const sourceWidth = asset?.opaqueBounds.width ?? fallback.width * 22;
  const sourceHeight = asset?.opaqueBounds.height ?? fallback.height * 22;
  const rotation = normalizeRotation(item.rotation);
  const width = (rotation % 180 === 0 ? sourceWidth : sourceHeight) * scale / 22;
  const height = (rotation % 180 === 0 ? sourceHeight : sourceWidth) * scale / 22;
  const center = { x: item.point.x + 0.5, y: item.point.y + 0.5 };
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

export function defaultFurnitureLayer(
  item: Pick<FurnitureDefinition, 'kind' | 'assetId' | 'supportedActions'>,
): FurnitureLayer {
  if (item.supportedActions.length > 0) return 'furniture';
  if (['sofa', 'bed', 'chair', 'office-chair', 'desk', 'reading-desk', 'workbench', 'repair-table',
    'response-desk', 'map-table', 'meeting-table', 'computer', 'dispatch-pod', 'radio-console',
    'bookcase', 'cabinet', 'tool-wall'].includes(item.kind)) return 'furniture';
  const asset = resolvedFurnitureAsset(item);
  if (asset?.category === 'surfaces') return 'floor';
  if (asset?.category === 'screens-electronics') return 'surface';
  if (asset?.category === 'storage-partitions') return 'wall';
  if (item.kind === 'plant' || item.kind === 'decor' || item.kind === 'beverage-station' || item.kind === 'printer') return 'surface';
  return 'furniture';
}

export function furnitureBlocksNavigation(
  item: Pick<FurnitureDefinition, 'kind' | 'assetId' | 'supportedActions' | 'blocksNavigation'>,
): boolean {
  return item.blocksNavigation ?? (item.supportedActions.length > 0 || defaultFurnitureLayer(item) === 'furniture');
}

export function fineFootprintCells(
  item: Pick<FurnitureDefinition, 'kind' | 'point' | 'footprint' | 'rotation' | 'scale' | 'assetId'>,
): GridPoint[] {
  const bounds = transformedAlphaBounds(item);
  const left = Math.floor(bounds.x * 4 + 1e-6);
  const top = Math.floor(bounds.y * 4 + 1e-6);
  const right = Math.ceil((bounds.x + bounds.width) * 4 - 1e-6);
  const bottom = Math.ceil((bounds.y + bounds.height) * 4 - 1e-6);
  const cells: GridPoint[] = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) cells.push({ x, y });
  }
  return cells;
}

export function navigationCells(
  item: Pick<FurnitureDefinition, 'kind' | 'point' | 'footprint' | 'rotation' | 'scale' | 'assetId'> &
    Partial<Pick<FurnitureDefinition, 'layer' | 'blocksNavigation' | 'supportedActions'>>,
): GridPoint[] {
  const withActions = { ...item, supportedActions: item.supportedActions ?? [] };
  if (!furnitureBlocksNavigation(withActions)) return [];
  const bounds = transformedAlphaBounds(item);
  const unique = new Map<string, GridPoint>();
  const left = Math.floor(bounds.x + 1e-6);
  const top = Math.floor(bounds.y + 1e-6);
  const right = Math.ceil(bounds.x + bounds.width - 1e-6);
  const bottom = Math.ceil(bounds.y + bounds.height - 1e-6);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) unique.set(`${x},${y}`, { x, y });
  }
  return [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function diagnoseFinePlacement(
  room: InteriorDefinition,
  candidate: FurnitureDefinition,
  layout: readonly FurnitureDefinition[],
  ignoreId?: string,
): PlacementDiagnostic {
  const bounds = transformedAlphaBounds(candidate);
  const doorX = Math.floor(room.width / 2);
  const door = { x: doorX, y: room.height - 1, width: 1, height: 1 };
  const intersectsDoor = bounds.x < door.x + door.width && bounds.x + bounds.width > door.x &&
    bounds.y < door.y + door.height && bounds.y + bounds.height > door.y;
  if (intersectsDoor) return 'blocks-door';
  return bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > room.width || bounds.y + bounds.height > room.height
    ? 'outside-room'
    : 'valid';
}

export function fitFurniturePointToRoom(
  room: InteriorDefinition,
  furniture: FurnitureDefinition,
  point: GridPoint,
): GridPoint {
  const bounds = transformedAlphaBounds({ ...furniture, point });
  if (bounds.width > room.width || bounds.height > room.height) return { ...point };
  const intersectsRoom = bounds.x < room.width && bounds.x + bounds.width > 0
    && bounds.y < room.height && bounds.y + bounds.height > 0;
  if (!intersectsRoom) return { ...point };
  return {
    x: point.x + Math.max(0, -bounds.x) - Math.max(0, bounds.x + bounds.width - room.width),
    y: point.y + Math.max(0, -bounds.y) - Math.max(0, bounds.y + bounds.height - room.height),
  };
}

export function resolvePlacementCandidate(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furniture: FurnitureDefinition,
  pointerPoint: GridPoint,
  ignoreId?: string,
): PlacementCandidate {
  const point = fitFurniturePointToRoom(room, furniture, snapFurniturePoint(pointerPoint));
  const resolved = { ...furniture, point, rotation: normalizeRotation(furniture.rotation) };
  return {
    furniture: resolved,
    diagnostic: diagnoseFinePlacement(room, resolved, layout, ignoreId),
    fineCells: fineFootprintCells(resolved),
    bounds: transformedAlphaBounds(resolved),
  };
}

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
});

export function commitPlacementCandidate(
  _room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  candidate: PlacementCandidate,
): FurnitureDefinition[] {
  if (candidate.diagnostic !== 'valid') return layout.map(cloneFurniture);
  const committed = cloneFurniture(candidate.furniture);
  const existing = layout.some(({ id }) => id === committed.id);
  return existing
    ? layout.map((item) => item.id === committed.id ? committed : cloneFurniture(item))
    : [...layout.map(cloneFurniture), committed];
}
