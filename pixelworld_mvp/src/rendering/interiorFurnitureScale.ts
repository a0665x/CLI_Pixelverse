import type {
  FurnitureDefinition,
  FurnitureRotation,
  FurnitureScale,
} from '../world/types';
import {
  catalogFurnitureRole,
  catalogFurnitureSemantic,
  catalogItem,
  type ModernOfficeCatalogItem,
} from './modernOfficeCatalog';

export type FurnitureSizeFamily =
  | 'surface-small'
  | 'chair'
  | 'desk-cabinet'
  | 'sofa-bed'
  | 'assembly';

const SCALE_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3] as const satisfies readonly FurnitureScale[];

const TARGET_LONG_EDGE: Readonly<Record<FurnitureSizeFamily, number>> = {
  'surface-small': 18,
  chair: 22,
  'desk-cabinet': 26,
  'sofa-bed': 30,
  assembly: 36,
};

const SOURCE_ROTATION = 0 as const satisfies FurnitureRotation;
const SOURCE_ONLY_ROTATIONS = Object.freeze([SOURCE_ROTATION]) as readonly FurnitureRotation[];
const QUARTER_TURN_ROTATIONS = Object.freeze([0, 90, 180, 270]) as readonly FurnitureRotation[];

const isChairVariant = (assetId: number): boolean => assetId >= 101 && assetId <= 116;

export function furnitureSizeFamily(assetId: number): FurnitureSizeFamily {
  const asset = catalogItem(assetId);
  if (!asset) return 'desk-cabinet';
  if (isChairVariant(assetId)) return 'chair';
  if (catalogFurnitureSemantic(assetId) === 'rest') return 'sofa-bed';
  const role = catalogFurnitureRole(assetId);
  const area = asset.footprint.width * asset.footprint.height;
  const longEdge = Math.max(asset.opaqueBounds.width, asset.opaqueBounds.height);
  if (area >= 4 || longEdge >= 32) return 'assembly';
  if (role === 'surface') return 'surface-small';
  return 'desk-cabinet';
}

const scaleFor = (asset: ModernOfficeCatalogItem, family: FurnitureSizeFamily): FurnitureScale => {
  const longEdge = Math.max(asset.opaqueBounds.width, asset.opaqueBounds.height);
  const target = TARGET_LONG_EDGE[family];
  return SCALE_STEPS.filter((candidate) => candidate <= 1).reduce((closest, candidate) => (
    Math.abs(longEdge * candidate - target) < Math.abs(longEdge * closest - target)
      ? candidate
      : closest
  ));
};

export function authoredPlacement(assetId: number | undefined): {
  rotation: FurnitureRotation;
  scale: FurnitureScale;
} {
  const asset = assetId === undefined ? undefined : catalogItem(assetId);
  if (!asset) return { rotation: SOURCE_ROTATION, scale: 1 };
  return {
    rotation: SOURCE_ROTATION,
    scale: scaleFor(asset, furnitureSizeFamily(asset.id)),
  };
}

export function normalizeBuiltInFurniture(
  item: FurnitureDefinition,
  asset: ModernOfficeCatalogItem | undefined = item.assetId === undefined ? undefined : catalogItem(item.assetId),
): FurnitureDefinition {
  if (!asset) return { ...item };
  return { ...item, ...authoredPlacement(asset.id) };
}

export function supportedRotations(assetId: number | undefined): readonly FurnitureRotation[] {
  if (assetId === undefined || !catalogItem(assetId)) return SOURCE_ONLY_ROTATIONS;
  return catalogFurnitureRole(assetId) === 'floor' ? QUARTER_TURN_ROTATIONS : SOURCE_ONLY_ROTATIONS;
}
