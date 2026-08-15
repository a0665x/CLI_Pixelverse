import { describe, expect, it } from 'vitest';
import {
  authoredPlacement,
  furnitureSizeFamily,
  normalizeBuiltInFurniture,
  supportedRotations,
  type FurnitureSizeFamily,
} from '../src/rendering/interiorFurnitureScale';
import { catalogItem } from '../src/rendering/modernOfficeCatalog';
import type { FurnitureDefinition } from '../src/world/types';

const representativeAssets = {
  'surface-small': 120,
  chair: 101,
  'desk-cabinet': 247,
  'sofa-bed': 210,
  assembly: 225,
} as const satisfies Record<FurnitureSizeFamily, number>;

const authoredLongEdgeBands = {
  'surface-small': [15, 22],
  chair: [20, 25],
  'desk-cabinet': [16, 30],
  'sofa-bed': [22, 33],
  assembly: [24, 42],
} as const satisfies Record<FurnitureSizeFamily, readonly [number, number]>;

const readableLongEdgeAtOnePointFive = {
  'surface-small': 22,
  chair: 30,
  'desk-cabinet': 24,
  'sofa-bed': 30,
  assembly: 36,
} as const satisfies Record<FurnitureSizeFamily, number>;

describe('interior furniture authored presentation', () => {
  it('normalizes representative trimmed alpha bounds into five family bands', () => {
    for (const [family, assetId] of Object.entries(representativeAssets) as Array<[FurnitureSizeFamily, number]>) {
      const asset = catalogItem(assetId)!;
      const placement = authoredPlacement(assetId);
      const longEdge = Math.max(asset.opaqueBounds.width, asset.opaqueBounds.height) * placement.scale;
      const [minimum, maximum] = authoredLongEdgeBands[family];

      expect(furnitureSizeFamily(assetId), `asset ${assetId}`).toBe(family);
      expect(longEdge, `${family}:${assetId}`).toBeGreaterThanOrEqual(minimum);
      expect(longEdge, `${family}:${assetId}`).toBeLessThanOrEqual(maximum);
      expect(placement.rotation).toBe(0);
      expect(placement.scale, `${family}:${assetId}`).toBeGreaterThanOrEqual(0.75);
      expect(placement.scale, `${family}:${assetId}`).toBeLessThanOrEqual(1);
      expect(longEdge * 1.5, `${family}:${assetId}:1.5x projected`).toBeGreaterThanOrEqual(
        readableLongEdgeAtOnePointFive[family],
      );
    }
  });

  it('keeps source-authored directional sprites fixed and rotates only meaningful flat assets', () => {
    expect(supportedRotations(101)).toEqual([0]);
    expect(supportedRotations(247)).toEqual([0]);
    expect(supportedRotations(4)).toEqual([0, 90, 180, 270]);
    expect(supportedRotations(9999)).toEqual([0]);
  });

  it('replaces arbitrary built-in transforms with catalog-authored placement', () => {
    const source: FurnitureDefinition = {
      id: 'authored-desk', kind: 'desk', assetId: 247, point: { x: 2, y: 2 }, facing: 'up',
      supportedActions: [], icon: 'generic', scale: 3, rotation: 270,
    };

    expect(normalizeBuiltInFurniture(source, catalogItem(247))).toMatchObject({
      scale: authoredPlacement(247).scale,
      rotation: authoredPlacement(247).rotation,
    });
  });
});
