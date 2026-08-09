import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition } from '../src/world/types';
import {
  createFurniturePrefab,
  moveSelection,
  selectedFurnitureIds,
} from '../src/rendering/interiorSelection';

const furniture = (id: string, assetId: number, x: number, y: number, actions: FurnitureDefinition['supportedActions'] = []): FurnitureDefinition => ({
  id, assetId, kind: 'decor', point: { x, y }, facing: 'up', supportedActions: actions,
  icon: actions.length ? 'tool' : 'generic', scale: 1, rotation: 0,
  layer: actions.length ? 'furniture' : 'surface', zIndex: 0, blocksNavigation: actions.length > 0,
});

describe('interior marquee selection and prefabs', () => {
  it('selects items whose exact visible alpha bounds intersect the marquee', () => {
    const desk = furniture('desk', 225, 2, 2);
    const monitor = furniture('monitor', 129, 2.5, 2.25);
    const outside = furniture('outside', 98, 9, 7);
    expect(selectedFurnitureIds({ x: 1.5, y: 1.5, width: 3, height: 3 }, [desk, monitor, outside]))
      .toEqual(['desk', 'monitor']);
  });

  it('creates a relative prefab and strips Hook identity', () => {
    const desk = furniture('desk', 225, 3, 4);
    const monitor = furniture('monitor', 129, 3.5, 4.25);
    const hook = { ...furniture('hook', 225, 4, 4, ['terminal']), requirementId: 'maker:terminal' };
    const prefab = createFurniturePrefab('工作桌組', [desk, monitor, hook], 1_000);
    expect(prefab.items).toHaveLength(2);
    expect(prefab.items.every(({ supportedActions, requirementId }) => supportedActions.length === 0 && requirementId === undefined)).toBe(true);
    expect(Math.min(...prefab.items.map(({ point }) => point.x))).toBe(0);
    expect(Math.min(...prefab.items.map(({ point }) => point.y))).toBe(0);
  });

  it('moves a selected arrangement without changing relative spacing', () => {
    const desk = furniture('desk', 225, 2, 2);
    const monitor = furniture('monitor', 129, 2.5, 2.25);
    const moved = moveSelection([desk, monitor], ['desk', 'monitor'], { x: 1.25, y: -0.5 });
    expect(moved.map(({ point }) => point)).toEqual([{ x: 3.25, y: 1.5 }, { x: 3.75, y: 1.75 }]);
  });
});
