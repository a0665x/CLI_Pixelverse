import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, FurniturePrefab, InteriorDefinition } from '../src/world/types';
import {
  availablePrefabs,
  copyDecorativeLayout,
  isBuiltInPrefab,
  loadLayoutClipboard,
  loadPrefabs,
  pasteDecorativeLayout,
  placePrefab,
  saveLayoutClipboard,
  savePrefabs,
} from '../src/rendering/interiorPrefabStore';

const room: InteriorDefinition = {
  id: 'rest-cabin', label: 'Room', width: 14, height: 9, floor: 'wood', wall: 'cream', furniture: [], overflow: [],
};
const item = (id: string, x: number, y: number, actions: FurnitureDefinition['supportedActions'] = []): FurnitureDefinition => ({
  id, kind: 'decor', assetId: 98, point: { x, y }, facing: 'up', supportedActions: actions,
  icon: actions.length ? 'tool' : 'generic', layer: actions.length ? 'furniture' : 'surface', zIndex: 0,
  blocksNavigation: actions.length > 0, scale: 1, rotation: 0,
});
const storage = () => {
  const memory = new Map<string, string>();
  return { memory, getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
};

describe('interior prefab and room clipboard store', () => {
  it('persists prefabs independently from room layouts', () => {
    const memory = storage();
    const prefab: FurniturePrefab = { id: 'prefab-1', name: 'Desk kit', createdAt: 1, width: 2, height: 2, items: [item('a', 0, 0), item('b', 1, 1)] };
    savePrefabs([prefab], memory);
    expect(loadPrefabs(memory)).toEqual([prefab]);
    expect(memory.memory.has('pixelworld:interior-prefabs:v1')).toBe(true);
  });

  it('lists immutable built-ins before user assemblies without persisting built-ins', () => {
    const memory = storage();
    const userPrefab: FurniturePrefab = {
      id: 'user-desk-kit', name: 'Desk kit', createdAt: 1, width: 2, height: 2,
      items: [item('a', 0, 0), item('b', 1, 1)],
    };
    savePrefabs([userPrefab], memory);

    const listed = availablePrefabs(memory);

    expect(listed.map(({ id }) => id)).toEqual([
      'bench-four', 'pod-l-two', 'control-m-three', 'user-desk-kit',
    ]);
    expect(listed.slice(0, 3).every((prefab) => isBuiltInPrefab(prefab) && prefab.immutable)).toBe(true);
    expect(listed[3]).toMatchObject({ source: 'user', immutable: false, anchor: { x: 0, y: 0 } });

    savePrefabs(listed, memory);
    const persisted = JSON.parse(memory.getItem('pixelworld:interior-prefabs:v1')!) as { prefabs: FurniturePrefab[] };
    expect(persisted.prefabs).toHaveLength(1);
    expect(persisted.prefabs[0]?.id).toBe('user-desk-kit');
  });

  it('deep-freezes returned built-in clones while keeping user assemblies mutable', () => {
    const memory = storage();
    savePrefabs([{
      id: 'user-kit', name: 'User kit', createdAt: 1, width: 2, height: 2,
      items: [item('a', 0, 0), item('b', 1, 1)],
    }], memory);

    const [builtIn, , , user] = availablePrefabs(memory);

    expect(Object.isFrozen(builtIn)).toBe(true);
    expect(Object.isFrozen(builtIn!.anchor)).toBe(true);
    expect(Object.isFrozen(builtIn!.hookActions)).toBe(true);
    expect(Object.isFrozen(builtIn!.items)).toBe(true);
    expect(Object.isFrozen(builtIn!.items[0])).toBe(true);
    expect(Object.isFrozen(builtIn!.items[0]!.point)).toBe(true);
    expect(Object.isFrozen(builtIn!.items[0]!.supportedActions)).toBe(true);
    expect(Object.isFrozen(builtIn!.items[0]!.footprint)).toBe(true);
    expect(Object.isFrozen(builtIn!.items[0]!.visualOffset)).toBe(true);
    expect(Object.isFrozen(builtIn!.interactionAnchors)).toBe(true);
    expect(Object.isFrozen(builtIn!.interactionAnchors[0])).toBe(true);
    expect(Object.isFrozen(builtIn!.interactionAnchors[0]!.point)).toBe(true);
    expect(Object.isFrozen(builtIn!.interactionAnchors[0]!.actions)).toBe(true);
    expect(Object.isFrozen(user)).toBe(false);
    expect(Object.isFrozen(user!.items)).toBe(false);
  });

  it('copies no Hook furniture and persists the clipboard', () => {
    const memory = storage();
    const clipboard = copyDecorativeLayout('source-house', [item('hook', 2, 2, ['terminal']), item('rug', 3, 3)], 10);
    expect(clipboard.items.map(({ id }) => id)).toEqual(['rug']);
    saveLayoutClipboard(clipboard, memory);
    expect(loadLayoutClipboard(memory)).toEqual(clipboard);
  });

  it('deeply clones visual offsets for copied persisted layout furniture', () => {
    const source = { ...item('offset', 3, 3), visualOffset: { x: -0.25, y: 0.125 } };
    const copied = copyDecorativeLayout('source-house', [source], 10);

    copied.items[0]!.visualOffset!.x = 9;
    expect(source.visualOffset).toEqual({ x: -0.25, y: 0.125 });
  });

  it('atomically replaces ordinary target furniture and preserves target Hooks', () => {
    const hook = item('target-hook', 1, 1, ['rest']);
    const clipboard = copyDecorativeLayout('source', [item('rug', 3, 3), item('monitor', 4, 3)], 10);
    const result = pasteDecorativeLayout(room, [hook, item('old-decor', 8, 7)], clipboard, 20);
    expect(result.accepted).toBe(true);
    expect(result.layout[0]).toEqual(hook);
    expect(result.layout.slice(1).map(({ id }) => id).every((id) => id.startsWith('pasted-20-'))).toBe(true);

    const invalid = { ...clipboard, items: clipboard.items.map((entry) => ({ ...entry, point: { x: -2, y: 0 } })) };
    expect(pasteDecorativeLayout(room, result.layout, invalid, 30)).toEqual({ accepted: false, layout: result.layout });
  });

  it('places a prefab with fresh ids at a quarter-grid anchor', () => {
    const prefab: FurniturePrefab = { id: 'prefab-1', name: 'Kit', createdAt: 1, width: 2, height: 2, items: [item('a', 0, 0), item('b', 0.5, 0.25)] };
    const result = placePrefab(room, [], prefab, { x: 4.12, y: 3.63 }, 50);
    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ point }) => point)).toEqual([{ x: 4, y: 3.75 }, { x: 4.5, y: 4 }]);
    expect(new Set(result.layout.map(({ id }) => id)).size).toBe(2);
  });
});
