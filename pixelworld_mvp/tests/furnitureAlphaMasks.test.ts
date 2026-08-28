import { afterEach, describe, expect, it } from 'vitest';
import {
  clearFurnitureAlphaMasksForTests,
  furnitureAlphaMask,
  furnitureAlphaMasksInstalled,
  furnitureAlphaMaskVersion,
  installFurnitureAlphaMasks,
  parseFurnitureAlphaMaskManifest,
  transformedFurnitureMaskCells,
} from '../src/rendering/furnitureAlphaMasks';
import type { FurnitureDefinition } from '../src/world/types';

const rawManifest = () => ({
  schemaVersion: 1,
  alphaThreshold: 1,
  assets: {
    '1': { width: 4, height: 3, runs: [[0, 0, 2], [1, 0, 1]] },
  },
});

afterEach(() => clearFurnitureAlphaMasksForTests());

describe('furniture alpha mask manifest', () => {
  it('parses and installs copied immutable alpha runs for required assets', () => {
    const raw = rawManifest();
    const parsed = parseFurnitureAlphaMaskManifest(raw, { requiredAssetIds: [1] });
    raw.assets['1'].runs[0]![1] = 3;

    expect(parsed.assets.get(1)?.runs).toEqual([[0, 0, 2], [1, 0, 1]]);
    installFurnitureAlphaMasks(parsed);
    expect(furnitureAlphaMasksInstalled()).toBe(true);
    expect(furnitureAlphaMask(1)).toEqual({ width: 4, height: 3, runs: [[0, 0, 2], [1, 0, 1]] });
  });

  it.each([
    ['schema', { ...rawManifest(), schemaVersion: 2 }],
    ['threshold', { ...rawManifest(), alphaThreshold: 0 }],
    ['dimensions', { ...rawManifest(), assets: { '1': { width: 0, height: 3, runs: [[0, 0, 1]] } } }],
    ['range', { ...rawManifest(), assets: { '1': { width: 4, height: 3, runs: [[0, 0, 5]] } } }],
    ['ordering', { ...rawManifest(), assets: { '1': { width: 4, height: 3, runs: [[1, 0, 1], [0, 0, 1]] } } }],
    ['overlap', { ...rawManifest(), assets: { '1': { width: 4, height: 3, runs: [[0, 0, 2], [0, 1, 3]] } } }],
    ['empty', { ...rawManifest(), assets: { '1': { width: 4, height: 3, runs: [] } } }],
  ])('rejects invalid %s data', (_label, raw) => {
    expect(() => parseFurnitureAlphaMaskManifest(raw, { requiredAssetIds: [1] }))
      .toThrow(/collision mask/i);
  });

  it('rejects a manifest that omits a caller-required asset ID', () => {
    expect(() => parseFurnitureAlphaMaskManifest(rawManifest(), { requiredAssetIds: [1, 2] }))
      .toThrow(/asset 2/i);
  });

  it('publishes a stable version that changes with opaque run content', () => {
    const first = parseFurnitureAlphaMaskManifest(rawManifest(), { requiredAssetIds: [1] });
    installFurnitureAlphaMasks(first);
    const baseline = furnitureAlphaMaskVersion();
    installFurnitureAlphaMasks(parseFurnitureAlphaMaskManifest({
      ...rawManifest(), assets: { '1': { width: 4, height: 3, runs: [[0, 0, 3], [1, 0, 1]] } },
    }, { requiredAssetIds: [1] }));

    expect(furnitureAlphaMaskVersion()).not.toBe(baseline);
    clearFurnitureAlphaMasksForTests();
    expect(furnitureAlphaMaskVersion()).toBe('geometry-fallback');
  });

  it.each([
    [0, [{ x: 3, y: 4 }]],
    [90, [{ x: 4, y: 3 }]],
    [180, [{ x: 5, y: 4 }]],
    [270, [{ x: 4, y: 5 }]],
  ] as const)('projects an L silhouette at %i degrees without filling its transparent corner', (rotation, expected) => {
    const manifest = parseFurnitureAlphaMaskManifest({
      schemaVersion: 1,
      alphaThreshold: 1,
      assets: { '1': {
        width: 32,
        height: 48,
        runs: [
          [41, 0, 16], [42, 0, 16],
          [43, 0, 2], [44, 0, 2], [45, 0, 2], [46, 0, 2], [47, 0, 2],
        ],
      } },
    }, { requiredAssetIds: [1] });
    const item: FurnitureDefinition = {
      id: 'l-mask', kind: 'desk', assetId: 1, point: { x: 4, y: 4 }, facing: 'up',
      supportedActions: [], icon: 'generic', scale: 3, rotation,
    };

    expect(transformedFurnitureMaskCells(item, manifest.assets.get(1)!, { x: 0, y: 0 }))
      .toEqual(expected);
  });

  it('applies visual offset, scale, and feet clearance to the same silhouette', () => {
    const manifest = parseFurnitureAlphaMaskManifest({
      schemaVersion: 1,
      alphaThreshold: 1,
      assets: { '1': {
        width: 32, height: 48,
        runs: [[41, 0, 16], [42, 0, 16], [43, 0, 2], [44, 0, 2], [45, 0, 2], [46, 0, 2], [47, 0, 2]],
      } },
    }, { requiredAssetIds: [1] });
    const item: FurnitureDefinition = {
      id: 'offset-mask', kind: 'desk', assetId: 1, point: { x: 4, y: 4 }, facing: 'up',
      supportedActions: [], icon: 'generic', scale: 3, rotation: 0, visualOffset: { x: 1, y: 0 },
    };

    expect(transformedFurnitureMaskCells(item, manifest.assets.get(1)!, { x: 0, y: 0 }))
      .toEqual([{ x: 6, y: 4 }]);
    expect(transformedFurnitureMaskCells(item, manifest.assets.get(1)!, { x: 0, y: 0.22 }))
      .toEqual([{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }]);
  });
});
