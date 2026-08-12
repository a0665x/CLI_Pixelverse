import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition } from '../src/world/types';
import { dissolvePrefabInstance, InteriorUndoStore } from '../src/rendering/interiorUndoStore';

const furniture = (
  id: string,
  layer: NonNullable<FurnitureDefinition['layer']>,
  prefabInstanceId?: string,
): FurnitureDefinition => ({
  id,
  kind: 'decor',
  point: { x: id.length, y: id.length + 0.25 },
  facing: 'up',
  supportedActions: [],
  icon: 'generic',
  footprint: { width: 1, height: 2 },
  visualOffset: { x: 0.25, y: -0.25 },
  layer,
  ...(prefabInstanceId ? { prefabInstanceId } : {}),
});

describe('InteriorUndoStore', () => {
  it('undoes one grouped mutation without sharing furniture references', () => {
    const initialLayout = [furniture('desk', 'furniture', 'instance-7')];
    const mutatedLayout = [{ ...initialLayout[0]!, point: { x: 8, y: 4 } }];
    const history = new InteriorUndoStore(initialLayout, 20);

    history.commit(mutatedLayout);
    initialLayout[0]!.point.x = 99;
    const restored = history.undo();

    expect(restored).toEqual([furniture('desk', 'furniture', 'instance-7')]);
    expect(restored![0]).not.toBe(initialLayout[0]);
    expect(restored![0]!.point).not.toBe(initialLayout[0]!.point);
    expect(restored![0]!.supportedActions).not.toBe(initialLayout[0]!.supportedActions);
    expect(restored![0]!.footprint).not.toBe(initialLayout[0]!.footprint);
    expect(restored![0]!.visualOffset).not.toBe(initialLayout[0]!.visualOffset);
  });

  it('bounds history and clears it when a new layout is loaded', () => {
    const initial = [furniture('a', 'furniture')];
    const history = new InteriorUndoStore(initial, 2);
    history.commit([furniture('b', 'furniture')]);
    history.commit([furniture('c', 'furniture')]);
    history.commit([furniture('d', 'furniture')]);

    expect(history.undo()?.[0]?.id).toBe('c');
    expect(history.undo()?.[0]?.id).toBe('b');
    expect(history.undo()).toBeUndefined();

    history.reset([furniture('loaded', 'surface')]);
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBeUndefined();
  });
});

describe('dissolvePrefabInstance', () => {
  it('dissolves one instance while preserving each item layer, position, and metadata', () => {
    const placedGroup: FurnitureDefinition[] = [
      furniture('desk', 'furniture', 'instance-7'),
      { ...furniture('monitor', 'surface', 'instance-7'), supportedActions: ['terminal'], requirementId: 'hook:terminal' },
      furniture('other', 'wall', 'instance-8'),
    ];

    const dissolved = dissolvePrefabInstance(placedGroup, 'instance-7');

    expect(dissolved.slice(0, 2).every(({ prefabInstanceId }) => prefabInstanceId === undefined)).toBe(true);
    expect(dissolved.map(({ layer }) => layer)).toEqual(['furniture', 'surface', 'wall']);
    expect(dissolved.map(({ point }) => point)).toEqual(placedGroup.map(({ point }) => point));
    expect(dissolved[1]).toMatchObject({ supportedActions: ['terminal'], requirementId: 'hook:terminal' });
    expect(dissolved[2]!.prefabInstanceId).toBe('instance-8');
    expect(dissolved[0]).not.toBe(placedGroup[0]);
    expect(dissolved[0]!.point).not.toBe(placedGroup[0]!.point);
  });
});
