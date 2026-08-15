import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition } from '../src/world/types';
import {
  compareAutomaticStack,
  resolveAutomaticSupport,
  stackDependencies,
  stackRoleForFurniture,
} from '../src/rendering/interiorAutoStack';

const furniture = (
  id: string,
  kind: FurnitureDefinition['kind'],
  assetId: number,
  point = { x: 4, y: 4 },
): FurnitureDefinition => ({
  id, kind, assetId, point, facing: 'up', supportedActions: [], icon: 'generic',
  scale: 1, rotation: 0,
});

describe('automatic interior stacking', () => {
  it('classifies floor decor, supports, surface objects, and free furniture semantically', () => {
    expect(stackRoleForFurniture({ ...furniture('rug', 'decor', 1), layer: 'floor' })).toBe('floor');
    expect(stackRoleForFurniture(furniture('catalog-rug', 'decor', 1))).toBe('floor');
    expect(stackRoleForFurniture(furniture('desk', 'desk', 247))).toBe('support');
    expect(stackRoleForFurniture(furniture('monitor', 'display', 129))).toBe('surface');
    expect(stackRoleForFurniture(furniture('chair', 'chair', 101))).toBe('free');
  });

  it('orders rugs below furniture, surface objects above supports, then uses the foot baseline', () => {
    const rug = { ...furniture('rug', 'decor', 1, { x: 4, y: 8 }), layer: 'floor' as const };
    const desk = furniture('desk', 'desk', 247, { x: 4, y: 6 });
    const monitor = furniture('monitor', 'display', 129, { x: 4, y: 2 });
    const laterDesk = furniture('later-desk', 'desk', 247, { x: 4, y: 7 });

    expect([monitor, laterDesk, rug, desk].sort(compareAutomaticStack).map(({ id }) => id))
      .toEqual(['rug', 'desk', 'later-desk', 'monitor']);
  });

  it('attaches a surface object to the topmost containing support and detaches it away from supports', () => {
    const lower = furniture('lower-desk', 'desk', 247);
    const upper = furniture('upper-desk', 'desk', 247);
    const monitor = furniture('monitor', 'display', 129);

    expect(resolveAutomaticSupport(monitor, [lower, upper])).toMatchObject({
      attachedTo: 'upper-desk',
      item: { supportedByIds: ['upper-desk'] },
    });
    const detached = resolveAutomaticSupport(
      { ...monitor, point: { x: 9, y: 7 }, supportedByIds: ['missing-support'] },
      [lower, upper],
    );
    expect(detached.attachedTo).toBeUndefined();
    expect(detached.item).not.toHaveProperty('supportedByIds');
  });

  it('expands a support selection to every attached dependency in layout order', () => {
    const desk = furniture('desk', 'desk', 247);
    const monitor = { ...furniture('monitor', 'display', 129), supportedByIds: ['desk'] };
    const lamp = { ...furniture('lamp', 'display', 141), supportedByIds: ['desk'] };
    const chair = furniture('chair', 'chair', 101);

    expect(stackDependencies(['desk'], [chair, desk, monitor, lamp]))
      .toEqual(['desk', 'monitor', 'lamp']);
    expect(stackDependencies(['monitor'], [chair, desk, monitor, lamp])).toEqual(['monitor']);
  });
});
