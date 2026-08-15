import { describe, expect, it } from 'vitest';
import {
  authoredPlacement,
  furnitureSizeFamily,
  normalizeBuiltInFurniture,
  supportedRotations,
  type FurnitureSizeFamily,
} from '../src/rendering/interiorFurnitureScale';
import {
  catalogFurnitureRole,
  catalogItem,
  MODERN_OFFICE_CATALOG,
} from '../src/rendering/modernOfficeCatalog';
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

const projectedFamilyBands = {
  'surface-small': { minimum: 22, maximum: 31, maximumSpread: 1.4 },
  chair: { minimum: 30, maximum: 38, maximumSpread: 1.3 },
  'desk-cabinet': { minimum: 24, maximum: 42, maximumSpread: 1.75 },
  'sofa-bed': { minimum: 34, maximum: 35, maximumSpread: 1.05 },
  assembly: { minimum: 34, maximum: 62, maximumSpread: 1.8 },
} as const satisfies Record<FurnitureSizeFamily, {
  minimum: number;
  maximum: number;
  maximumSpread: number;
}>;

const authoredLongEdge = (assetId: number): number => {
  const asset = catalogItem(assetId)!;
  return Math.max(asset.opaqueBounds.width, asset.opaqueBounds.height) * authoredPlacement(assetId).scale;
};

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

  it('keeps every catalog asset readable and internally consistent at the 1.5x editor viewport', () => {
    expect(MODERN_OFFICE_CATALOG).toHaveLength(339);
    const projectedByFamily = new Map<FurnitureSizeFamily, number[]>();

    for (const asset of MODERN_OFFICE_CATALOG) {
      const family = furnitureSizeFamily(asset.id);
      const projectedLongEdge = authoredLongEdge(asset.id) * 1.5;
      projectedByFamily.set(family, [...(projectedByFamily.get(family) ?? []), projectedLongEdge]);
    }

    expect([...projectedByFamily.values()].reduce((total, values) => total + values.length, 0)).toBe(339);
    for (const [family, band] of Object.entries(projectedFamilyBands) as Array<[
      FurnitureSizeFamily,
      (typeof projectedFamilyBands)[FurnitureSizeFamily],
    ]>) {
      const projected = projectedByFamily.get(family)!;
      const minimum = Math.min(...projected);
      const maximum = Math.max(...projected);
      expect(minimum, `${family}:minimum`).toBeGreaterThanOrEqual(band.minimum);
      expect(maximum, `${family}:maximum`).toBeLessThanOrEqual(band.maximum);
      expect(maximum / minimum, `${family}:spread`).toBeLessThanOrEqual(band.maximumSpread);
    }
  });

  it('rescales tiny surface 119 and separates full-height beverage station 173 from that family', () => {
    expect(furnitureSizeFamily(119)).toBe('surface-small');
    expect(authoredPlacement(119).scale).toBe(1.75);
    expect(authoredLongEdge(119)).toBe(17.5);

    expect(furnitureSizeFamily(173)).toBe('desk-cabinet');
    expect(authoredPlacement(173).scale).toBe(0.75);
    expect(authoredLongEdge(173)).toBe(22.5);
  });

  it('enlarges only geometry-safe catalog roles and the bounded chair variants', () => {
    const enlarged = MODERN_OFFICE_CATALOG.filter(({ id }) => authoredPlacement(id).scale > 1);
    expect(enlarged.length).toBeGreaterThan(0);
    for (const asset of enlarged) {
      const family = furnitureSizeFamily(asset.id);
      const safeRole = ['floor', 'surface'].includes(catalogFurnitureRole(asset.id));
      expect(safeRole || family === 'chair', `asset ${asset.id}`).toBe(true);
      if (family === 'chair') expect(authoredPlacement(asset.id).scale).toBeLessThanOrEqual(1.25);
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
