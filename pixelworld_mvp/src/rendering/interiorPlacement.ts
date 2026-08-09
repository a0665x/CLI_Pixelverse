import { furnitureFootprint } from '../world/interiorDefinitions';
import type {
  FurnitureDefinition,
  FurnitureFootprint,
  FurnitureRotation,
  GridPoint,
  InteriorDefinition,
} from '../world/types';

export const EDITOR_CELL = 11;
export type PlacementDiagnostic = 'valid' | 'outside-room' | 'blocks-door' | 'overlap' | 'invalid-asset';

export interface PlacementCandidate {
  furniture: FurnitureDefinition;
  diagnostic: PlacementDiagnostic;
  fineCells: GridPoint[];
}

const normalizeScale = (value: unknown): number => (
  value === 0.75 || value === 1.25 || value === 1.5 ? value : 1
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

export function fineFootprintCells(
  item: Pick<FurnitureDefinition, 'kind' | 'point' | 'footprint' | 'rotation' | 'scale'>,
): GridPoint[] {
  const size = effectiveFurnitureFootprint(item);
  const fineWidth = size.width * 2;
  const fineHeight = size.height * 2;
  const centerFineX = item.point.x * 2 + 1;
  const centerFineY = item.point.y * 2 + 1;
  const left = Math.floor(centerFineX - fineWidth / 2);
  const top = Math.floor(centerFineY - fineHeight / 2);
  const cells: GridPoint[] = [];
  for (let y = top; y < top + fineHeight; y += 1) {
    for (let x = left; x < left + fineWidth; x += 1) cells.push({ x, y });
  }
  return cells;
}

export function navigationCells(
  item: Pick<FurnitureDefinition, 'kind' | 'point' | 'footprint' | 'rotation' | 'scale'>,
): GridPoint[] {
  const unique = new Map<string, GridPoint>();
  for (const cell of fineFootprintCells(item)) {
    const logical = { x: Math.floor(cell.x / 2), y: Math.floor(cell.y / 2) };
    unique.set(`${logical.x},${logical.y}`, logical);
  }
  return [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function diagnoseFinePlacement(
  room: InteriorDefinition,
  candidate: FurnitureDefinition,
  layout: readonly FurnitureDefinition[],
  ignoreId?: string,
): PlacementDiagnostic {
  const cells = fineFootprintCells(candidate);
  if (cells.some(({ x, y }) => x < 0 || y < 0 || x >= room.width * 2 || y >= room.height * 2)) return 'outside-room';
  const doorX = Math.floor(room.width / 2);
  if (cells.some(({ x, y }) => Math.floor(x / 2) === doorX && Math.floor(y / 2) === room.height - 1)) return 'blocks-door';
  const occupied = new Set(layout
    .filter(({ id }) => id !== ignoreId)
    .flatMap(fineFootprintCells)
    .map(({ x, y }) => `${x},${y}`));
  return cells.some(({ x, y }) => occupied.has(`${x},${y}`)) ? 'overlap' : 'valid';
}

export function resolvePlacementCandidate(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furniture: FurnitureDefinition,
  pointerPoint: GridPoint,
  ignoreId?: string,
): PlacementCandidate {
  const point = snapFurnitureCenter(pointerPoint, effectiveFurnitureFootprint(furniture));
  const resolved = { ...furniture, point, rotation: normalizeRotation(furniture.rotation) };
  return {
    furniture: resolved,
    diagnostic: diagnoseFinePlacement(room, resolved, layout, ignoreId),
    fineCells: fineFootprintCells(resolved),
  };
}

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
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
