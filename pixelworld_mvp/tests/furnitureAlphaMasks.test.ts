import { afterEach, describe, expect, it } from 'vitest';
import {
  clearFurnitureAlphaMasksForTests,
  furnitureAlphaMask,
  furnitureAlphaMasksInstalled,
  installFurnitureAlphaMasks,
  parseFurnitureAlphaMaskManifest,
} from '../src/rendering/furnitureAlphaMasks';

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
});
