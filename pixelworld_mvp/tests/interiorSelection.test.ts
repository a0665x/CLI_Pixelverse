import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, InteriorDefinition } from '../src/world/types';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { transformedAlphaBounds } from '../src/rendering/interiorPlacement';
import { stackDependencies } from '../src/rendering/interiorAutoStack';
import * as interiorSelectionModule from '../src/rendering/interiorSelection';
import {
  createFurniturePrefab,
  duplicateSelection,
  duplicateFurniture,
  expandSelection,
  moveSelection,
  moveSelectionAtomically,
  previewSelectionMove,
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

  it('moves and returns surface dependencies with an ungrouped support', () => {
    const desk = {
      ...furniture('dependency-desk', 247, 4, 3), kind: 'desk' as const, layer: 'furniture' as const,
      blocksNavigation: false,
    };
    const monitor = {
      ...furniture('dependency-monitor', 129, 4, 3), kind: 'display' as const,
      supportedByIds: [desk.id],
    };
    const chair = { ...furniture('dependency-chair', 101, 8, 3), kind: 'chair' as const };

    const moved = moveSelectionAtomically(room, [desk, monitor, chair], [desk.id], { x: 1, y: 0 });
    expect(moved.accepted).toBe(true);
    expect(moved.layout.slice(0, 2).map(({ point }) => point)).toEqual([{ x: 5, y: 3 }, { x: 5, y: 3 }]);
    expect(removeSelection(moved.layout, [desk.id]).map(({ id }) => id)).toEqual([chair.id]);
  });

  it('detaches a surface object when it is dragged away from its support', () => {
    const desk = {
      ...furniture('detach-desk', 247, 4, 3), kind: 'desk' as const, layer: 'furniture' as const,
      blocksNavigation: false,
    };
    const monitor = {
      ...furniture('detach-monitor', 129, 4, 3), kind: 'display' as const,
      supportedByIds: [desk.id],
    };

    const moved = moveSelectionAtomically(room, [desk, monitor], [monitor.id], { x: 4, y: 2 });
    expect(moved.accepted).toBe(true);
    expect(moved.layout[1]).not.toHaveProperty('supportedByIds');
  });

  it('re-resolves transformed surface support without retaining a remote dependency', () => {
    const desk = {
      ...furniture('external-desk', 247, 4, 4), kind: 'desk' as const, layer: 'furniture' as const,
      blocksNavigation: false,
    };
    const monitor = {
      ...furniture('group-monitor', 129, 4, 4), kind: 'display' as const,
      prefabInstanceId: 'accessory-group', supportedByIds: [desk.id],
    };
    const chair = {
      ...furniture('group-chair', 101, 6, 4), kind: 'chair' as const,
      prefabInstanceId: 'accessory-group',
    };
    const layout = [desk, monitor, chair];

    const detached = rotateSelectionAtomically(room, layout, [monitor.id], 90);
    expect(detached.accepted).toBe(true);
    expect(detached.layout[1]).not.toHaveProperty('supportedByIds');
    expect(stackDependencies([desk.id], detached.layout)).toEqual([desk.id]);

    const together = rotateSelectionAtomically(room, layout, [desk.id, monitor.id, chair.id], 90);
    expect(together.accepted).toBe(true);
    expect(together.layout[1]?.supportedByIds).toEqual([desk.id]);
  });

  it('preserves the declared support when it still contains a transformed surface', () => {
    const declared = {
      ...furniture('declared-desk', 247, 4, 4), kind: 'desk' as const, layer: 'furniture' as const,
      scale: 3 as const, blocksNavigation: false,
    };
    const higherBaseline = {
      ...furniture('higher-desk', 247, 4, 4.5), kind: 'desk' as const, layer: 'furniture' as const,
      scale: 3 as const, blocksNavigation: false,
    };
    const monitor = {
      ...furniture('stable-monitor', 129, 4.5, 4.5), kind: 'display' as const,
      supportedByIds: [declared.id],
    };

    const transformed = transformSelectionAtomically(
      room, [declared, higherBaseline, monitor], [monitor.id], (item) => ({ ...item }),
    );

    expect(transformed.accepted).toBe(true);
    expect(transformed.layout[2]?.supportedByIds).toEqual([declared.id]);
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

  it('moves a prefab with one shared snapped delta and fits the whole move at an edge', () => {
    const grouped = [
      { ...furniture('group-a', 98, 3, 3), prefabInstanceId: 'instance-one', interactionPoint: { x: 3, y: 4 } },
      { ...furniture('group-b', 129, 5.5, 3.25), prefabInstanceId: 'instance-one' },
    ];

    const moved = moveSelectionAtomically(room, grouped, ['group-a'], { x: 1.18, y: -0.46 });
    expect(moved.accepted).toBe(true);
    expect(moved.layout.map(({ point }) => point)).toEqual([{ x: 4.25, y: 2.5 }, { x: 6.75, y: 2.75 }]);
    expect(moved.layout[0]!.interactionPoint).toEqual({ x: 4.25, y: 3.5 });
    expect(moved.layout[1]!.point.x - moved.layout[0]!.point.x).toBe(2.5);

    const edgeFit = moveSelectionAtomically(room, grouped, ['group-b'], { x: 8, y: 0 });
    expect(edgeFit.accepted).toBe(true);
    expect(edgeFit.layout[1]!.point.x - edgeFit.layout[0]!.point.x).toBe(2.5);
  });

  it('returns a fitted proposed group layout for drag preview without mutating the committed layout', () => {
    const grouped = [
      { ...furniture('preview-a', 98, 3, 3), prefabInstanceId: 'preview-instance', interactionPoint: { x: 3, y: 4 } },
      { ...furniture('preview-b', 129, 5.5, 3.25), prefabInstanceId: 'preview-instance' },
    ];
    const before = structuredClone(grouped);

    const preview = previewSelectionMove(room, grouped, ['preview-a'], { x: 8, y: 0 });

    expect(preview.accepted).toBe(true);
    expect(preview.layout[1]!.point.x - preview.layout[0]!.point.x).toBe(2.5);
    expect(preview.layout[0]!.interactionPoint!.x - preview.layout[0]!.point.x).toBe(0);
    expect(preview.layout[0]!.interactionPoint!.y - preview.layout[0]!.point.y).toBe(1);
    expect(Math.max(...preview.layout.map((item) => transformedAlphaBounds(item).x + transformedAlphaBounds(item).width)))
      .toBeCloseTo(room.width);
    expect(preview.layout[1]!.point.x - preview.layout[0]!.point.x).toBe(2.5);
    expect(grouped).toEqual(before);
  });

  it('fits a group with one shared delta and preserves geometry, rotations, and support identity', () => {
    const grouped = [
      {
        ...furniture('group-desk', 247, 3, 3), kind: 'desk' as const, footprint: { width: 1, height: 1 },
        prefabInstanceId: 'edge-group', rotation: 90 as const,
      },
      {
        ...furniture('group-display', 129, 5, 3), kind: 'display' as const, footprint: { width: 1, height: 1 },
        prefabInstanceId: 'edge-group', rotation: 270 as const, supportedByIds: ['group-desk'],
      },
    ];
    const preview = previewSelectionMove({ ...room, width: 18, height: 12 }, grouped, ['group-desk'], { x: -3.5, y: 0 });
    const moved = preview.layout.filter((item) => ['group-desk', 'group-display'].includes(item.id));

    expect(moved[1]!.point.x - moved[0]!.point.x).toBe(grouped[1]!.point.x - grouped[0]!.point.x);
    expect(moved.map(({ rotation }) => rotation)).toEqual(grouped.map(({ rotation }) => rotation));
    expect(moved[1]!.supportedByIds).toEqual(['group-desk']);
  });

  it('uses the latest preview as the basis for consecutive edge moves', () => {
    const item = { ...furniture('edge-item', 247, 3, 3), kind: 'desk' as const, footprint: { width: 1, height: 1 } };
    const first = previewSelectionMove(room, [item], [item.id], { x: -3.5, y: 0 });
    const second = previewSelectionMove(room, first.layout, [item.id], { x: 2, y: 0 });

    expect(transformedAlphaBounds(first.layout[0]!).x).toBeCloseTo(0);
    expect(second.accepted).toBe(true);
    expect(second.layout[0]!.point.x).toBeGreaterThan(1.5);
    expect(second.layout[0]!.point.y).toBe(3);
  });

  it('allows an intentional move even when strict route validation reports a stranded Hook anchor', () => {
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

    const moved = moveSelectionAtomically(narrowRoom, layout, ['wall-0'], { x: -5, y: 0 });
    expect(moved.accepted).toBe(true);
    expect(moved.layout.slice(1).every(({ point }) => point.x === 1)).toBe(true);
    expect(officeLayoutIssues({ ...narrowRoom, furniture: moved.layout })
      .some(({ diagnostic }) => diagnostic === 'unreachable-interaction-anchor')).toBe(true);
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

    const layered = shiftSelectionLayer(room, grouped, ['group-b'], 'next');
    expect(layered.accepted).toBe(true);
    expect(layered.layout.slice(0, 2).map(({ layer }) => layer)).toEqual(['wall', 'wall']);
    expect(layered.layout.slice(0, 2).map(({ zIndex }) => zIndex)).toEqual([3, 5]);
    expect(layered.layout[2]!.layer).toBe('surface');

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

    expect(shiftSelectionLayer(room, mixed, ['group-a'], 'next')).toEqual({ accepted: false, layout: mixed });
  });

  it('atomically rejects a Research bench layer shift that would invalidate support overlap semantics', () => {
    const research = structuredClone(INTERIOR_DEFINITIONS['research-library']);
    const benchId = research.furniture.find(({ prefabInstanceId }) => prefabInstanceId?.includes('bench-four-1'))!.id;
    const before = structuredClone(research.furniture);

    const layered = shiftSelectionLayer(research, research.furniture, [benchId], 'next');

    expect(layered).toEqual({ accepted: false, layout: before });
    expect(officeLayoutIssues({ ...research, furniture: layered.layout })).toEqual([]);
    const moved = moveSelectionAtomically(research, layered.layout, [benchId], { x: 0, y: 0 });
    expect(moved.accepted).toBe(true);
    for (const result of [
      rotateSelectionAtomically(research, layered.layout, [benchId], 90),
      resizeSelectionAtomically(research, layered.layout, [benchId], 1),
    ]) {
      if (result.accepted) expect(officeLayoutIssues({ ...research, furniture: result.layout })
        .filter(({ diagnostic }) => diagnostic === 'invalid-support')).toEqual([]);
      else expect(result.layout).toEqual(before);
    }
    expect(research.furniture).toEqual(before);
  });

  it('keeps move, rotate, and scale interoperable after rejecting an invalid supported-group layer shift', () => {
    const supported = [{
      ...furniture('supported-desk', 193, 4, 4), kind: 'desk' as const, layer: 'furniture' as const,
      prefabInstanceId: 'supported-instance', blocksNavigation: false,
    }, {
      ...furniture('supported-monitor', 141, 4, 4), kind: 'display' as const,
      prefabInstanceId: 'supported-instance', supportedByIds: ['supported-desk'],
    }];

    expect(shiftSelectionLayer(room, supported, ['supported-monitor'], 'next'))
      .toEqual({ accepted: false, layout: supported });
    for (const result of [
      moveSelectionAtomically(room, supported, ['supported-desk'], { x: 1, y: 0 }),
      rotateSelectionAtomically(room, supported, ['supported-desk'], 90),
      resizeSelectionAtomically(room, supported, ['supported-desk'], 1),
    ]) {
      expect(result.accepted).toBe(true);
      expect(officeLayoutIssues({ ...room, furniture: result.layout })).toEqual([]);
      expect(result.layout[1]?.supportedByIds).toEqual(['supported-desk']);
    }
  });

  it('sends an entire group below negative duplicate peers while preserving its z gaps', () => {
    const layout = [
      { ...furniture('group-a', 98, 4, 4), prefabInstanceId: 'instance-one', layer: 'surface' as const, zIndex: 3 },
      { ...furniture('group-b', 129, 6, 4), prefabInstanceId: 'instance-one', layer: 'surface' as const, zIndex: 5 },
      { ...furniture('peer-a', 98, 8, 4), layer: 'surface' as const, zIndex: -5 },
      { ...furniture('peer-b', 129, 10, 4), layer: 'surface' as const, zIndex: -5 },
    ];

    const sentBack = reorderSelection(layout, ['group-b'], 'back');
    expect(sentBack.slice(0, 2).map(({ zIndex }) => zIndex)).toEqual([-8, -6]);
    expect(sentBack[1]!.zIndex! - sentBack[0]!.zIndex!).toBe(2);
    expect(sentBack.slice(2).map(({ zIndex }) => zIndex)).toEqual([-5, -5]);
  });

  it('reorders each selected layer as one block and leaves front/back unchanged without peers', () => {
    const mixedLayers = [
      { ...furniture('group-surface-a', 98, 2, 2), prefabInstanceId: 'mixed-instance', layer: 'surface' as const, zIndex: 3 },
      { ...furniture('group-surface-b', 129, 4, 2), prefabInstanceId: 'mixed-instance', layer: 'surface' as const, zIndex: 5 },
      { ...furniture('group-wall', 98, 6, 2), prefabInstanceId: 'mixed-instance', layer: 'wall' as const, zIndex: 10 },
      { ...furniture('surface-peer', 129, 8, 2), layer: 'surface' as const, zIndex: -5 },
      { ...furniture('wall-peer', 98, 10, 2), layer: 'wall' as const, zIndex: -2 },
    ];

    expect(reorderSelection(mixedLayers, ['group-surface-a'], 'back').slice(0, 3).map(({ zIndex }) => zIndex))
      .toEqual([-8, -6, -3]);
    expect(reorderSelection(mixedLayers, ['group-surface-a'], 'front').slice(0, 3).map(({ zIndex }) => zIndex))
      .toEqual([-4, -2, -1]);
    expect(reorderSelection(mixedLayers, ['group-surface-a'], 'backward').slice(0, 3).map(({ zIndex }) => zIndex))
      .toEqual([2, 4, 9]);
    expect(reorderSelection(mixedLayers, ['group-surface-a'], 'forward').slice(0, 3).map(({ zIndex }) => zIndex))
      .toEqual([4, 6, 11]);

    const selectedOnly = mixedLayers.slice(0, 3);
    expect(reorderSelection(selectedOnly, ['group-surface-a'], 'back')).toEqual(selectedOnly);
    expect(reorderSelection(selectedOnly, ['group-surface-a'], 'front')).toEqual(selectedOnly);
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

  it('duplicates an arbitrary ungrouped multi-selection atomically with fresh IDs', () => {
    const first = { ...furniture('loose-a', 98, 3, 3), interactionPoint: { x: 3, y: 4 } };
    const second = furniture('loose-b', 129, 5, 3);

    const duplicated = duplicateSelection(room, [first, second], [first.id, second.id], 4_321);

    expect(duplicated.accepted).toBe(true);
    expect(duplicated.layout).toHaveLength(4);
    const copy = duplicated.layout.slice(2);
    expect(duplicated.selectedIds).toEqual(copy.map(({ id }) => id));
    expect(new Set(copy.map(({ id }) => id)).size).toBe(2);
    expect(copy.every(({ id }) => id !== first.id && id !== second.id)).toBe(true);
    expect(copy.every(({ prefabInstanceId }) => prefabInstanceId === undefined)).toBe(true);
    expect(copy[1]!.point.x - copy[0]!.point.x).toBe(2);
    expect(copy[0]!.interactionPoint!.y - copy[0]!.point.y).toBe(1);
  });

  it('normalizes Hook navigation metadata in an arbitrary multi-selection copy', () => {
    const hook = {
      ...furniture('loose-hook', 98, 3, 3, ['terminal']),
      requirementId: 'maker:terminal', interactionPoint: { x: 3, y: 4 }, blocksNavigation: true,
    };
    const ordinary = furniture('loose-neighbor', 98, 5, 3);

    const duplicated = duplicateSelection(room, [hook, ordinary], [hook.id, ordinary.id], 5_432);

    expect(duplicated.accepted).toBe(true);
    const hookCopy = duplicated.layout.find(({ id }) => id === 'duplicate-5432-loose-hook')!;
    expect(hookCopy).toMatchObject({ supportedActions: [], icon: 'generic', blocksNavigation: false });
    expect(hookCopy).not.toHaveProperty('requirementId');
    expect(hookCopy).not.toHaveProperty('interactionPoint');
  });

  it('re-resolves copied surface objects that move off an external support', () => {
    const desk = {
      ...furniture('external-narrow-desk', 193, 4, 4), kind: 'desk' as const,
      layer: 'furniture' as const, scale: 0.75 as const, blocksNavigation: false,
    };
    const deskBounds = transformedAlphaBounds(desk);
    const surfaceX = deskBounds.x + deskBounds.width - 0.55;
    const surfaceA = {
      ...furniture('external-surface-a', 129, surfaceX, 4), kind: 'display' as const,
      prefabInstanceId: 'external-surface-group', supportedByIds: [desk.id],
    };
    const surfaceB = {
      ...furniture('external-surface-b', 141, surfaceX, 4.25), kind: 'display' as const,
      prefabInstanceId: 'external-surface-group', supportedByIds: [desk.id],
    };

    const duplicated = duplicateSelection(
      { ...room, width: 18, height: 12 },
      [desk, surfaceA, surfaceB],
      [surfaceA.id],
      7_654,
    );

    expect(duplicated.accepted).toBe(true);
    const copies = duplicated.layout.filter(({ id }) => duplicated.selectedIds.includes(id));
    expect(copies).toHaveLength(2);
    expect(copies.every(({ supportedByIds }) => !supportedByIds?.includes(desk.id))).toBe(true);
    expect(stackDependencies([desk.id], duplicated.layout)).toEqual([desk.id, surfaceA.id, surfaceB.id]);
  });

  it('resets a uniformly scaled selection to 100% around its shared anchor', () => {
    const resetSelectionScaleAtomically = (
      interiorSelectionModule as unknown as {
        resetSelectionScaleAtomically?: typeof resizeSelectionAtomically;
      }
    ).resetSelectionScaleAtomically;
    expect(resetSelectionScaleAtomically).toBeTypeOf('function');
    if (!resetSelectionScaleAtomically) return;
    const grouped = [
      { ...furniture('reset-a', 98, 3.75, 4), prefabInstanceId: 'reset-group', scale: 1.25 as const },
      { ...furniture('reset-b', 129, 6.25, 4), prefabInstanceId: 'reset-group', scale: 1.25 as const },
    ];

    const reset = resetSelectionScaleAtomically(room, grouped, [grouped[0]!.id], 1 as never);

    expect(reset.accepted).toBe(true);
    expect(reset.layout.map(({ scale }) => scale)).toEqual([1, 1]);
    expect(reset.layout.map(({ point }) => point)).toEqual([{ x: 4, y: 4 }, { x: 6, y: 4 }]);
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
