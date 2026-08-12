import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import {
  createFurniturePrefab,
  duplicateSelection,
  duplicateFurniture,
  expandSelection,
  moveSelection,
  moveSelectionAtomically,
  removeSelection,
  reorderSelection,
  resizeSelectionAtomically,
  rotateSelectionAtomically,
  selectedFurnitureIds,
  shiftSelectionLayer,
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

  it('expands a clicked or marquee-hit prefab member to the complete atomic instance', () => {
    const grouped = [
      { ...furniture('group-a', 98, 3, 3), prefabInstanceId: 'instance-one' },
      { ...furniture('group-b', 129, 5, 3), prefabInstanceId: 'instance-one' },
      furniture('single', 98, 8, 3),
    ];

    expect(expandSelection(grouped, ['group-a'])).toEqual(['group-a', 'group-b']);
    expect(selectedFurnitureIds({ x: 2.5, y: 2.5, width: 1, height: 1 }, grouped))
      .toEqual(['group-a', 'group-b']);
    expect(expandSelection(grouped, ['group-a', 'single'])).toEqual(['group-a', 'group-b', 'single']);
  });

  it('moves a prefab with one shared snapped delta and rejects the whole move if one member is invalid', () => {
    const grouped = [
      { ...furniture('group-a', 98, 3, 3), prefabInstanceId: 'instance-one', interactionPoint: { x: 3, y: 4 } },
      { ...furniture('group-b', 129, 5.5, 3.25), prefabInstanceId: 'instance-one' },
    ];

    const moved = moveSelectionAtomically(room, grouped, ['group-a'], { x: 1.18, y: -0.46 });
    expect(moved.accepted).toBe(true);
    expect(moved.layout.map(({ point }) => point)).toEqual([{ x: 4.25, y: 2.5 }, { x: 6.75, y: 2.75 }]);
    expect(moved.layout[0]!.interactionPoint).toEqual({ x: 4.25, y: 3.5 });
    expect(moved.layout[1]!.point.x - moved.layout[0]!.point.x).toBe(2.5);

    const rejected = moveSelectionAtomically(room, grouped, ['group-b'], { x: 20, y: 0 });
    expect(rejected).toEqual({ accepted: false, layout: grouped });
  });

  it('rejects a group move that newly strands an unselected Hook interaction anchor', () => {
    const narrowRoom: InteriorDefinition = {
      ...room, width: 8, height: 7,
    };
    const hook = {
      ...furniture('unselected-hook', 98, 0, 1, ['terminal']),
      footprint: { width: 1, height: 1 }, interactionPoint: { x: 0, y: 2 },
      visualOffset: { x: 0, y: 0 }, scale: 0.75 as const,
    };
    const movableWall = Array.from({ length: 7 }, (_, y) => ({
      ...furniture(`wall-${y}`, 98, 6, y),
      footprint: { width: 1, height: 1 }, blocksNavigation: true,
      prefabInstanceId: 'movable-wall', visualOffset: { x: 0, y: 0 }, scale: 0.75 as const,
    }));
    const layout = [hook, ...movableWall];

    expect(moveSelectionAtomically(narrowRoom, layout, ['wall-0'], { x: -5, y: 0 }))
      .toEqual({ accepted: false, layout });
  });

  it('rotates every prefab point, interaction anchor, facing, rotation, and visual offset once around one stable anchor', () => {
    const grouped = [
      {
        ...furniture('group-a', 98, 4, 4), prefabInstanceId: 'instance-one',
        interactionPoint: { x: 4, y: 5 }, visualOffset: { x: 1, y: 0 },
      },
      { ...furniture('group-b', 129, 6, 4), prefabInstanceId: 'instance-one' },
    ];

    const rotated = rotateSelectionAtomically(room, grouped, ['group-a'], 90);
    expect(rotated.accepted).toBe(true);
    expect(rotated.layout[0]).toMatchObject({
      id: 'group-a', point: { x: 5, y: 3 }, interactionPoint: { x: 4, y: 3 },
      facing: 'right', rotation: 90,
    });
    expect(rotated.layout[0]!.visualOffset!.x).toBeCloseTo(0);
    expect(rotated.layout[0]!.visualOffset!.y).toBe(1);
    expect(rotated.layout[1]).toMatchObject({ id: 'group-b', point: { x: 5, y: 5 }, facing: 'right', rotation: 90 });
    const restored = rotateSelectionAtomically(room, rotated.layout, ['group-b'], -90);
    expect(restored.layout.map(({ point }) => point)).toEqual(grouped.map(({ point }) => point));
    expect(restored.layout[0]!.interactionPoint).toEqual(grouped[0]!.interactionPoint);
    expect(restored.layout[0]!.visualOffset).toEqual(grouped[0]!.visualOffset);
  });

  it('scales, shifts layers, and reorders every prefab member as one block', () => {
    const grouped = [
      { ...furniture('group-a', 98, 4, 4), prefabInstanceId: 'instance-one', zIndex: 3 },
      { ...furniture('group-b', 129, 6, 4), prefabInstanceId: 'instance-one', zIndex: 5 },
      { ...furniture('peer', 98, 9, 4), zIndex: 8 },
    ];

    const resized = resizeSelectionAtomically(room, grouped, ['group-a'], 1);
    expect(resized.accepted).toBe(true);
    expect(resized.layout.slice(0, 2).map(({ scale }) => scale)).toEqual([1.25, 1.25]);
    expect(resized.layout.slice(0, 2).map(({ point }) => point)).toEqual([{ x: 3.75, y: 4 }, { x: 6.25, y: 4 }]);

    const layered = shiftSelectionLayer(grouped, ['group-b'], 'next');
    expect(layered.slice(0, 2).map(({ layer }) => layer)).toEqual(['wall', 'wall']);
    expect(layered.slice(0, 2).map(({ zIndex }) => zIndex)).toEqual([3, 5]);
    expect(layered[2]!.layer).toBe('surface');

    const front = reorderSelection(grouped, ['group-a'], 'front');
    expect(front[0]!.zIndex).toBe(9);
    expect(front[1]!.zIndex).toBe(11);
    expect(front[1]!.zIndex! - front[0]!.zIndex!).toBe(2);
  });

  it('rejects a whole group layer shift if one shared layer delta cannot apply', () => {
    const mixed = [
      { ...furniture('group-a', 98, 4, 4), prefabInstanceId: 'instance-one', layer: 'surface' as const, zIndex: 3 },
      { ...furniture('group-b', 129, 6, 4), prefabInstanceId: 'instance-one', layer: 'wall' as const, zIndex: 5 },
    ];

    expect(shiftSelectionLayer(mixed, ['group-a'], 'next')).toEqual(mixed);
  });

  it('rejects a group resize when one shared scale factor cannot be represented by every member', () => {
    const mixed = [
      { ...furniture('group-a', 98, 4, 4), prefabInstanceId: 'instance-one', scale: 1 as const },
      { ...furniture('group-b', 129, 6, 4), prefabInstanceId: 'instance-one', scale: 1.25 as const },
    ];

    expect(resizeSelectionAtomically(room, mixed, ['group-a'], 1)).toEqual({ accepted: false, layout: mixed });
  });

  it('duplicates a prefab with fresh item and instance IDs while preserving metadata and relative geometry', () => {
    const grouped = [
      {
        ...furniture('group-a', 98, 3, 3, ['terminal']), prefabInstanceId: 'instance-one',
        requirementId: 'maker:terminal', interactionPoint: { x: 3, y: 4 }, visualOffset: { x: 0.25, y: -0.5 },
      },
      { ...furniture('group-b', 129, 5, 3), prefabInstanceId: 'instance-one', zIndex: 4 },
    ];

    const duplicated = duplicateSelection(room, grouped, ['group-b'], 1_234);
    expect(duplicated.accepted).toBe(true);
    expect(duplicated.layout).toHaveLength(4);
    const copy = duplicated.layout.slice(2);
    expect(new Set(copy.map(({ id }) => id)).size).toBe(2);
    expect(copy.every(({ id }) => !grouped.some((item) => item.id === id))).toBe(true);
    expect(copy.every(({ prefabInstanceId }) => prefabInstanceId && prefabInstanceId !== 'instance-one')).toBe(true);
    expect(new Set(copy.map(({ prefabInstanceId }) => prefabInstanceId)).size).toBe(1);
    expect(copy[1]!.point.x - copy[0]!.point.x).toBe(2);
    expect(copy[0]).toMatchObject({
      supportedActions: ['terminal'], requirementId: 'maker:terminal',
      visualOffset: { x: 0.25, y: -0.5 },
    });
    expect(copy[0]!.interactionPoint!.y - copy[0]!.point.y).toBe(1);
    expect(duplicated.selectedIds).toEqual(copy.map(({ id }) => id));
  });

  it('allocates collision-free IDs for repeated singleton and grouped duplicates', () => {
    const single = furniture('single', 98, 2, 2);
    const occupiedSingleId = furniture('duplicate-1234-single', 98, 9, 2);
    const singleCopy = duplicateFurniture(room, [single, occupiedSingleId], single.id, 1_234);
    expect(singleCopy.accepted).toBe(true);
    expect(singleCopy.layout.at(-1)!.id).toBe('duplicate-1234-single-1');

    const grouped = [
      { ...furniture('group-a', 98, 3, 4), prefabInstanceId: 'instance-one' },
      { ...furniture('group-b', 129, 5, 4), prefabInstanceId: 'instance-one' },
      furniture('prefab-1234-duplicate-instance-one-0', 98, 10, 4),
    ];
    const groupCopy = duplicateSelection(room, grouped, ['group-a'], 1_234);
    expect(groupCopy.accepted).toBe(true);
    expect(groupCopy.selectedIds).toEqual([
      'prefab-1234-duplicate-instance-one-1-0',
      'prefab-1234-duplicate-instance-one-1-1',
    ]);
    expect(new Set(groupCopy.layout.map(({ id }) => id)).size).toBe(groupCopy.layout.length);
  });

  it('returns a complete prefab to the shelf, while dissolved members become individually removable', () => {
    const grouped = [
      { ...furniture('group-a', 98, 3, 3), prefabInstanceId: 'instance-one' },
      { ...furniture('group-b', 129, 5, 3), prefabInstanceId: 'instance-one' },
      furniture('single', 98, 8, 3),
    ];
    expect(removeSelection(grouped, ['group-a']).map(({ id }) => id)).toEqual(['single']);

    const dissolved = grouped.map((item) => {
      const { prefabInstanceId: _prefabInstanceId, ...ordinary } = item;
      return ordinary;
    });
    expect(removeSelection(dissolved, ['group-a']).map(({ id }) => id)).toEqual(['group-b', 'single']);
  });
});
