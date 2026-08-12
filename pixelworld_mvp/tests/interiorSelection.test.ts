import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  createFurniturePrefab,
  duplicateFurniture,
  moveSelection,
  removeSelection,
  selectedFurnitureIds,
  transformSelectionAtomically,
} from '../src/rendering/interiorSelection';

const furniture = (id: string, assetId: number, x: number, y: number, actions: FurnitureDefinition['supportedActions'] = []): FurnitureDefinition => ({
  id, assetId, kind: 'decor', point: { x, y }, facing: 'up', supportedActions: actions,
  icon: actions.length ? 'tool' : 'generic', scale: 1, rotation: 0,
  layer: actions.length ? 'furniture' : 'surface', zIndex: 0, blocksNavigation: actions.length > 0,
});
const room: InteriorDefinition = {
  id: 'maker-workshop', label: 'Test', width: 14, height: 9, floor: 'tile', wall: 'brick', furniture: [], overflow: [],
};

describe('interior marquee selection and prefabs', () => {
  it('selects items whose exact visible alpha bounds intersect the marquee', () => {
    const desk = furniture('desk', 225, 2, 2);
    const monitor = furniture('monitor', 129, 2.5, 2.25);
    const outside = furniture('outside', 98, 9, 7);
    expect(selectedFurnitureIds({ x: 1.5, y: 1.5, width: 3, height: 3 }, [desk, monitor, outside]))
      .toEqual(['desk', 'monitor']);
  });

  it('selects the same offset alpha bounds used by the renderer highlight', () => {
    const shifted = { ...furniture('shifted', 98, 2, 2), visualOffset: { x: 3, y: 0 } };

    expect(selectedFurnitureIds({ x: 4.9, y: 2, width: 1.2, height: 1.2 }, [shifted])).toEqual(['shifted']);
    expect(selectedFurnitureIds({ x: 1.9, y: 2, width: 1.2, height: 1.2 }, [shifted])).toEqual([]);
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
    const desk = { ...furniture('desk', 225, 2, 2), interactionPoint: { x: 2.5, y: 4 } };
    const monitor = furniture('monitor', 129, 2.5, 2.25);
    const moved = moveSelection([desk, monitor], ['desk', 'monitor'], { x: 1.25, y: -0.5 });
    expect(moved.map(({ point }) => point)).toEqual([{ x: 3.25, y: 1.5 }, { x: 3.75, y: 1.75 }]);
    expect(moved[0]!.interactionPoint).toEqual({ x: 3.75, y: 3.5 });
  });

  it('returns every selected furniture instance to the shelf', () => {
    const layout = [furniture('a', 225, 2, 2), furniture('b', 129, 3, 2), furniture('c', 98, 4, 2)];
    expect(removeSelection(layout, ['a', 'b']).map(({ id }) => id)).toEqual(['c']);
    expect(layout).toHaveLength(3);
  });

  it('applies selection transforms atomically', () => {
    const layout = [furniture('a', 225, 2, 2), furniture('b', 129, 3, 2)];
    const layered = transformSelectionAtomically(room, layout, ['a', 'b'], (item) => ({ ...item, layer: 'surface' }));
    expect(layered.accepted).toBe(true);
    expect(layered.layout.every(({ layer }) => layer === 'surface')).toBe(true);

    const rejected = transformSelectionAtomically(room, layout, ['a', 'b'], (item) => (
      item.id === 'b' ? { ...item, point: { x: -10, y: -10 } } : { ...item, layer: 'wall' }
    ));
    expect(rejected).toEqual({ accepted: false, layout });
  });

  it('duplicates one item nearby without duplicating Hook identity', () => {
    const hook = { ...furniture('hook', 225, 4, 4, ['terminal']), requirementId: 'maker:terminal' };
    const duplicated = duplicateFurniture(room, [hook], hook.id, 1_234);
    expect(duplicated.accepted).toBe(true);
    expect(duplicated.layout).toHaveLength(2);
    expect(duplicated.layout[1]).toMatchObject({
      id: 'duplicate-1234-hook', supportedActions: [], icon: 'generic', assetId: 225,
    });
    expect(duplicated.layout[1]).not.toHaveProperty('requirementId');
    expect(duplicated.selectedIds).toEqual(['hook', 'duplicate-1234-hook']);
  });
});
