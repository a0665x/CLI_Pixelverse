import type {
  FurnitureDefinition,
  FurnitureRotation,
  FurnitureScale,
  GridPoint,
} from '../world/types';
import { catalogItem, type ModernOfficeCatalogItem } from './modernOfficeCatalog';
import { furnitureFootprint } from '../world/furnitureGeometryData';

const CANONICAL_SOURCE_CELL = 22;

const DEFAULT_ASSET_ID: Partial<Record<FurnitureDefinition['kind'], number>> = {
  sofa: 200, bed: 200, chair: 101, 'office-chair': 101, television: 129, display: 129,
  computer: 225, 'dispatch-pod': 225, 'radio-console': 225, bookcase: 176,
  'planning-board': 171, 'map-table': 207, 'meeting-table': 4, 'reading-desk': 193,
  workbench: 193, 'repair-table': 193, 'response-desk': 193, desk: 193,
  'tool-wall': 175, cabinet: 175, decor: 98, plant: 98, 'beverage-station': 173, printer: 177,
};

export const canonicalFurnitureAsset = (
  item: Pick<FurnitureDefinition, 'kind' | 'assetId'>,
): ModernOfficeCatalogItem | undefined => catalogItem(item.assetId ?? DEFAULT_ASSET_ID[item.kind] ?? -1);

export interface CanonicalFurnitureGeometry {
  anchor: GridPoint;
  width: number;
  height: number;
  scale: FurnitureScale;
  rotation: FurnitureRotation;
}

export interface CanonicalFurnitureBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const normalizedScale = (value: unknown): FurnitureScale => (
  typeof value === 'number' && value >= 0.75 && value <= 3 && value * 4 === Math.round(value * 4)
    ? value as FurnitureScale
    : 1
);

const normalizedRotation = (value: unknown): FurnitureRotation => (
  value === 90 || value === 180 || value === 270 ? value : 0
);

const sourceDimensions = (
  item: Pick<FurnitureDefinition, 'kind' | 'assetId' | 'footprint'>,
  override?: { width: number; height: number },
): { width: number; height: number } => {
  if (override && Number.isFinite(override.width) && Number.isFinite(override.height)) return { ...override };
  const asset = canonicalFurnitureAsset(item);
  if (asset) return { width: asset.opaqueBounds.width, height: asset.opaqueBounds.height };
  const footprint = item.footprint ?? furnitureFootprint(item.kind);
  return { width: footprint.width * CANONICAL_SOURCE_CELL, height: footprint.height * CANONICAL_SOURCE_CELL };
};

/** Returns world-grid geometry. The anchor is the stable logical point; room size never participates. */
export function canonicalFurnitureGeometry(
  item: FurnitureDefinition,
  sourceOverride?: { width: number; height: number },
): CanonicalFurnitureGeometry {
  const scale = normalizedScale(item.scale);
  const rotation = normalizedRotation(item.rotation);
  const source = sourceDimensions(item, sourceOverride);
  return {
    anchor: { ...item.point },
    width: (rotation % 180 === 0 ? source.width : source.height) * scale / CANONICAL_SOURCE_CELL,
    height: (rotation % 180 === 0 ? source.height : source.width) * scale / CANONICAL_SOURCE_CELL,
    scale,
    rotation,
  };
}

export function canonicalFurnitureBounds(
  item: FurnitureDefinition,
  sourceOverride?: { width: number; height: number },
): CanonicalFurnitureBounds {
  const geometry = canonicalFurnitureGeometry(item, sourceOverride);
  const offset = {
    x: (item.visualOffset?.x ?? 0) * geometry.scale,
    y: (item.visualOffset?.y ?? 0) * geometry.scale,
  };
  const center = {
    x: geometry.anchor.x + 0.5 + offset.x,
    y: geometry.anchor.y + 0.5 + offset.y,
  };
  return {
    x: center.x - geometry.width / 2,
    y: center.y - geometry.height / 2,
    width: geometry.width,
    height: geometry.height,
  };
}

export function translateFurnitureGeometry(
  item: FurnitureDefinition,
  delta: GridPoint,
): FurnitureDefinition {
  return {
    ...item,
    point: { x: item.point.x + delta.x, y: item.point.y + delta.y },
    supportedActions: [...item.supportedActions],
    ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
    ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
    ...(item.interactionPoint ? { interactionPoint: {
      x: item.interactionPoint.x + delta.x,
      y: item.interactionPoint.y + delta.y,
    } } : {}),
    ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
  };
}

export function geometryInvariant(before: FurnitureDefinition, after: FurnitureDefinition): boolean {
  const left = canonicalFurnitureGeometry(before);
  const right = canonicalFurnitureGeometry(after);
  return left.width === right.width
    && left.height === right.height
    && left.scale === right.scale
    && left.rotation === right.rotation
    && (before.visualOffset?.x ?? 0) === (after.visualOffset?.x ?? 0)
    && (before.visualOffset?.y ?? 0) === (after.visualOffset?.y ?? 0);
}
