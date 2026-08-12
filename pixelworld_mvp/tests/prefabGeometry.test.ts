import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition, OfficePrefabDefinition } from '../src/world/types';
import {
  cloneOfficePrefab,
  placeOfficePrefab,
  prefabBounds,
  rotatePrefab,
  validateOfficePrefab,
} from '../src/rendering/prefabGeometry';
import { transformedAlphaBounds } from '../src/rendering/interiorPlacement';

const room: InteriorDefinition = {
  id: 'rest-cabin', label: 'Geometry room', width: 14, height: 9, floor: 'wood', wall: 'cream', furniture: [], overflow: [],
};

const desk = (id: string, point: { x: number; y: number }): FurnitureDefinition => ({
  id, kind: 'desk', assetId: 193, point, facing: 'up', supportedActions: ['terminal'], icon: 'edit',
  footprint: { width: 1, height: 1 }, layer: 'furniture', blocksNavigation: true,
});

const samplePrefab: OfficePrefabDefinition = {
  id: 'bench-a', name: 'Bench A', createdAt: 1, width: 2, height: 2,
  source: 'modern-office-v1.2', immutable: true, category: 'bench', hookActions: ['terminal'],
  anchor: { x: 0, y: 0 },
  interactionAnchors: [{ point: { x: 0, y: 1 }, actions: ['terminal'] }],
  items: [
    desk('desk', { x: 0, y: 0 }),
    {
      id: 'monitor', kind: 'display', assetId: 141, point: { x: 1, y: 1 }, facing: 'up', supportedActions: [], icon: 'generic',
      footprint: { width: 1, height: 1 }, layer: 'surface', blocksNavigation: false, visualOffset: { x: -0.25, y: 0.125 },
    },
  ],
};

const aisleRoom: InteriorDefinition = {
  id: 'rest-cabin', label: 'Aisle room', width: 6, height: 6, floor: 'wood', wall: 'cream', furniture: [], overflow: [],
};

const blocker = (id: string, x: number, y: number): FurnitureDefinition => ({
  id, kind: 'decor', assetId: 98, point: { x, y }, facing: 'up', supportedActions: [], icon: 'generic',
  layer: 'furniture', blocksNavigation: true,
});

const aislePrefab: OfficePrefabDefinition = {
  ...samplePrefab,
  id: 'aisle-bench',
  items: [desk('aisle-desk', { x: 0, y: 0 })],
  interactionAnchors: [{ point: { x: 0, y: 1 }, actions: ['terminal'] }],
};

describe('office prefab geometry', () => {
  it('preserves internal layers and off-grid offsets while cloning', () => {
    const cloned = cloneOfficePrefab(samplePrefab);

    expect(cloned).not.toBe(samplePrefab);
    expect(cloned.items[1]!.layer).toBe('surface');
    expect(cloned.items[1]!.visualOffset).toEqual({ x: -0.25, y: 0.125 });
    expect(cloned.items[1]!.visualOffset).not.toBe(samplePrefab.items[1]!.visualOffset);
  });

  it('returns the minimal union of its items opaque bounds', () => {
    const bounds = prefabBounds(samplePrefab);
    const itemBounds = samplePrefab.items.map((item) => transformedAlphaBounds(item));

    expect(bounds).toEqual({
      x: Math.min(...itemBounds.map(({ x }) => x)),
      y: Math.min(...itemBounds.map(({ y }) => y)),
      width: Math.max(...itemBounds.map(({ x, width }) => x + width)) - Math.min(...itemBounds.map(({ x }) => x)),
      height: Math.max(...itemBounds.map(({ y, height }) => y + height)) - Math.min(...itemBounds.map(({ y }) => y)),
    });
  });

  it('rotates every relative point around the prefab anchor', () => {
    const rotated = rotatePrefab(samplePrefab, 90);

    expect(rotated.items.map(({ point }) => point)).toEqual([
      { x: 0, y: 0 }, { x: -1, y: 1 },
    ]);
    expect(rotated.interactionAnchors[0]!.point).toEqual({ x: -1, y: 0 });
    expect(rotated.items[1]!.visualOffset).toEqual({ x: -0.125, y: -0.25 });
  });

  it('swaps rectangular prefab dimensions after a quarter turn', () => {
    expect(rotatePrefab({ ...samplePrefab, width: 3, height: 1 }, 90)).toMatchObject({ width: 1, height: 3 });
  });

  it('places fresh group items while permitting surface decoration over its desk', () => {
    const result = placeOfficePrefab(room, [], samplePrefab, { x: 4, y: 3 }, 50);

    expect(result).toMatchObject({ accepted: true, diagnostics: [] });
    expect(result.layout.map(({ point }) => point)).toEqual([{ x: 4, y: 3 }, { x: 5, y: 4 }]);
    expect(new Set(result.layout.map(({ prefabInstanceId }) => prefabInstanceId)).size).toBe(1);
  });

  it('creates distinct group and item IDs for placements sharing a timestamp', () => {
    const first = placeOfficePrefab(room, [], samplePrefab, { x: 4, y: 3 }, 52);
    const second = placeOfficePrefab(room, [], samplePrefab, { x: 4, y: 3 }, 52);

    expect(first.layout.map(({ id }) => id)).not.toEqual(second.layout.map(({ id }) => id));
    expect(first.layout[0]!.prefabInstanceId).not.toBe(second.layout[0]!.prefabInstanceId);
  });

  it('permits a nonblocking surface item to share its desk footprint', () => {
    const overlappingSurface: OfficePrefabDefinition = {
      ...samplePrefab,
      items: [samplePrefab.items[0]!, { ...samplePrefab.items[1]!, point: { x: 0, y: 0 } }],
    };

    expect(placeOfficePrefab(room, [], overlappingSurface, { x: 4, y: 3 }, 51).accepted).toBe(true);
  });

  it('requires a two-cell entrance/main aisle but permits one-cell branches to Hook anchors', () => {
    const oneCellChoke = [2, 3, 4].flatMap((y) => [blocker(`left-${y}`, 2, y), blocker(`right-${y}`, 4, y)]);
    const twoCellAisle = [2, 3, 4].map((y) => blocker(`far-left-${y}`, 1, y));
    const branchBlockers = [blocker('branch-left', 2, 1), blocker('branch-right', 4, 2)];

    expect(placeOfficePrefab(aisleRoom, oneCellChoke, aislePrefab, { x: 3, y: 1 }, 60)).toMatchObject({
      accepted: false,
      diagnostics: ['unreachable-interaction-anchor'],
    });
    expect(placeOfficePrefab(aisleRoom, twoCellAisle, aislePrefab, { x: 3, y: 1 }, 61)).toMatchObject({
      accepted: true,
      diagnostics: [],
    });
    expect(placeOfficePrefab(aisleRoom, [...twoCellAisle, ...branchBlockers], aislePrefab, { x: 3, y: 1 }, 62)).toMatchObject({
      accepted: true,
      diagnostics: [],
    });
  });

  it('rejects invalid assets, blocked doors, and unreachable Hook anchors', () => {
    expect(validateOfficePrefab(room, [], {
      ...samplePrefab,
      items: [{ ...samplePrefab.items[0]!, assetId: 999_999 }],
    }, { x: 4, y: 3 })).toContain('invalid-asset');

    expect(validateOfficePrefab(room, [], samplePrefab, { x: 7, y: 8 })).toContain('blocks-door');
    expect(validateOfficePrefab(room, [], samplePrefab, { x: -4, y: 3 })).toContain('outside-room');

    expect(validateOfficePrefab(room, [], {
      ...samplePrefab,
      items: [
        ...samplePrefab.items,
        { ...desk('wall', { x: 0, y: 1 }), supportedActions: [] },
      ],
    }, { x: 4, y: 3 })).toContain('unreachable-interaction-anchor');
  });
});
