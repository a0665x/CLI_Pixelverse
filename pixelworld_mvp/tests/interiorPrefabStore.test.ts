import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, FurniturePrefab, InteriorDefinition } from '../src/world/types';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import {
  availablePrefabs,
  copyDecorativeLayout,
  isBuiltInPrefab,
  loadLayoutClipboard,
  readLayoutClipboard,
  loadPrefabs,
  readPrefabs,
  pasteDecorativeLayout,
  placePrefab,
  saveLayoutClipboard,
  savePrefabs,
  createUserGroupPrefab,
  deletePrefab,
} from '../src/rendering/interiorPrefabStore';

const room: InteriorDefinition = {
  id: 'rest-cabin', label: 'Room', width: 14, height: 9, floor: 'wood', wall: 'cream', furniture: [], overflow: [],
};
const item = (id: string, x: number, y: number, actions: FurnitureDefinition['supportedActions'] = []): FurnitureDefinition => ({
  id, kind: 'decor', assetId: 98, point: { x, y }, facing: 'up', supportedActions: actions,
  icon: actions.length ? 'tool' : 'generic', layer: actions.length ? 'furniture' : 'surface', zIndex: 0,
  blocksNavigation: actions.length > 0, scale: 1, rotation: 0,
});
const deskSurfaceKit = (deskId: string, surfaceId: string, declared = true): FurnitureDefinition[] => [{
  id: deskId, kind: 'desk', assetId: 193, point: { x: 0, y: 0 }, facing: 'up', supportedActions: [],
  icon: 'generic', layer: 'furniture', blocksNavigation: false, scale: 1, rotation: 0,
}, {
  id: surfaceId, kind: 'display', assetId: 141, point: { x: 0, y: 0 }, facing: 'up', supportedActions: [],
  icon: 'generic', layer: 'surface', blocksNavigation: false, scale: 1, rotation: 0,
  ...(declared ? { supportedByIds: [deskId] } : {}),
}];
const storage = () => {
  const memory = new Map<string, string>();
  return { memory, getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
};

describe('interior prefab and room clipboard store', () => {
  it('normalizes a selected group into a durable template with local support references', () => {
    const desk = item('room-desk', 4, 5);
    const monitor = { ...item('room-monitor', 4, 5), layer: 'surface' as const, supportedByIds: ['room-desk'] };
    const prefab = createUserGroupPrefab([desk, monitor], [], 100);
    expect(prefab).toMatchObject({ id: 'user-group-100-1', name: 'Group 01', createdAt: 100, width: 1, height: 1 });
    expect(prefab.items.map(({ id, point, supportedByIds }) => ({ id, point, supportedByIds }))).toEqual([
      { id: 'group-item-1', point: { x: 0, y: 0 }, supportedByIds: undefined },
      { id: 'group-item-2', point: { x: 0, y: 0 }, supportedByIds: ['group-item-1'] },
    ]);
  });

  it('deletes only the reusable group record and leaves placed room instances intact', () => {
    const placed = [item('placed-a', 2, 2), item('placed-b', 3, 2)];
    const original = structuredClone(placed);
    const prefab = createUserGroupPrefab(placed, [], 100);
    expect(deletePrefab([prefab], prefab.id)).toEqual([]);
    expect(placed).toEqual(original);
  });
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
      'bench-four', 'pod-l-two', 'control-m-three',
      'modern-office-storage-run-dark', 'modern-office-storage-run-blue', 'modern-office-storage-run-light',
      'user-desk-kit',
    ]);
    expect(listed.slice(0, 6).every((prefab) => isBuiltInPrefab(prefab) && prefab.immutable)).toBe(true);
    expect(listed.find(({ id }) => id === 'user-desk-kit')).toMatchObject({ source: 'user', immutable: false, anchor: { x: 0, y: 0 } });

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

    const listed = availablePrefabs(memory);
    const builtIn = listed[0];
    const user = listed.find(({ id }) => id === 'user-kit');

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

  it('copies the semantic decorative closure without Hook furniture or dangling support refs', () => {
    const hookDesk = {
      ...deskSurfaceKit('hook-desk', 'unused')[0]!, supportedActions: ['terminal' as const],
      requirementId: 'required-hook', blocksNavigation: true,
    };
    const dependent = { ...deskSurfaceKit('unused', 'dependent-monitor')[1]!, supportedByIds: ['hook-desk'] };
    const independent = item('independent-plant', 6, 6);
    const source = [hookDesk, dependent, independent];

    const clipboard = copyDecorativeLayout('source-house', source, 11);

    expect(clipboard.items.map(({ id }) => id)).toEqual(['independent-plant']);
    expect(clipboard.items.flatMap(({ supportedByIds = [] }) => supportedByIds)).toEqual([]);
    expect(source).toEqual([hookDesk, dependent, independent]);
  });

  it('copies and pastes every work-theme decorative closure within and across themes', () => {
    const themes = ['research-library', 'maker-workshop', 'collaboration-barn'] as const;
    for (const sourceId of themes) {
      const source = INTERIOR_DEFINITIONS[sourceId];
      const sourceBefore = structuredClone(source.furniture);
      const clipboard = copyDecorativeLayout(`${sourceId}-source`, source.furniture, 12);
      const copiedBefore = structuredClone(clipboard);
      const copiedIds = new Set(clipboard.items.map(({ id }) => id));

      expect(clipboard.items.length, sourceId).toBeGreaterThan(0);
      expect(clipboard.items.every(({ supportedActions, requirementId }) => (
        supportedActions.length === 0 && requirementId === undefined
      )), sourceId).toBe(true);
      expect(clipboard.items.every(({ supportedByIds = [] }) => supportedByIds.every((id) => copiedIds.has(id))), sourceId)
        .toBe(true);

      for (const targetId of themes) {
        const target = INTERIOR_DEFINITIONS[targetId];
        const targetBefore = structuredClone(target.furniture);
        const result = pasteDecorativeLayout(target, target.furniture, clipboard, 120);
        expect(result.accepted, `${sourceId}->${targetId}`).toBe(true);
        const requiredInstanceIds = new Set(target.furniture
          .filter(({ supportedActions, requirementId }) => supportedActions.length > 0 || Boolean(requirementId))
          .flatMap(({ prefabInstanceId }) => prefabInstanceId ? [prefabInstanceId] : []));
        for (const instanceId of requiredInstanceIds) {
          expect(result.layout.filter(({ prefabInstanceId }) => prefabInstanceId === instanceId), `${sourceId}->${targetId}:${instanceId}`)
            .toEqual(target.furniture.filter(({ prefabInstanceId }) => prefabInstanceId === instanceId));
        }
        const directHooks = target.furniture
          .filter(({ supportedActions, requirementId }) => supportedActions.length > 0 || Boolean(requirementId))
          .map((item) => structuredClone(item));
        expect(result.layout.filter(({ id }) => directHooks.some((hook) => hook.id === id)), `${sourceId}->${targetId}`)
          .toEqual(directHooks);
        const pasted = result.layout.filter(({ id }) => id.startsWith('pasted-120-'));
        expect(pasted.length, `${sourceId}->${targetId}`).toBeGreaterThan(0);
        expect(pasted.every(({ prefabInstanceId }) => !prefabInstanceId || !requiredInstanceIds.has(prefabInstanceId)), `${sourceId}->${targetId}`)
          .toBe(true);
        const pastedIds = new Set(pasted.map(({ id }) => id));
        expect(pasted.every(({ supportedByIds = [] }) => supportedByIds.every((id) => pastedIds.has(id))), `${sourceId}->${targetId}`)
          .toBe(true);
        expect(source.furniture, sourceId).toEqual(sourceBefore);
        expect(target.furniture, targetId).toEqual(targetBefore);
        expect(clipboard, sourceId).toEqual(copiedBefore);
      }
    }
  });

  it('retains an ungrouped Hook with its complete support and dependent closure', () => {
    const supportDesk = {
      ...deskSurfaceKit('target-support', 'unused')[0]!, point: { x: 4, y: 4 },
    };
    const hookSurface: FurnitureDefinition = {
      ...deskSurfaceKit('unused', 'target-hook')[1]!, point: { x: 4, y: 4 },
      supportedActions: ['terminal'], requirementId: 'target:terminal', supportedByIds: ['target-support'],
    };
    const { requirementId: _requirementId, ...surfaceWithoutRequirement } = hookSurface;
    const dependentSurface: FurnitureDefinition = {
      ...surfaceWithoutRequirement, id: 'target-dependent', assetId: 251, supportedActions: [],
    };
    const target = [supportDesk, hookSurface, dependentSurface, item('old-ordinary', 10, 7)];
    const clipboard = copyDecorativeLayout('source', [item('new-independent', 8, 6)], 14);

    const result = pasteDecorativeLayout(room, target, clipboard, 140);

    expect(result.accepted).toBe(true);
    expect(result.layout.slice(0, 3)).toEqual([supportDesk, hookSurface, dependentSurface]);
    expect(result.layout.map(({ id }) => id)).toEqual([
      'target-support', 'target-hook', 'target-dependent', 'pasted-140-0',
    ]);
    expect(target).toEqual([supportDesk, hookSurface, dependentSurface, item('old-ordinary', 10, 7)]);
  });

  it('keeps an overlapping source dependency component with target Hooks and independent decor', () => {
    const hook = {
      ...deskSurfaceKit('target-hook', 'unused')[0]!, point: { x: 4, y: 4 },
      supportedActions: ['terminal' as const], requirementId: 'target:terminal', blocksNavigation: true,
    };
    const source = deskSurfaceKit('source-desk', 'source-monitor').map((entry) => ({
      ...entry, point: { x: 4, y: 4 },
    }));
    const independent = item('source-independent', 8, 6);
    const clipboard = copyDecorativeLayout('source', [...source, independent], 13);

    const result = pasteDecorativeLayout(room, [hook], clipboard, 130);

    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ id }) => id)).toEqual([
      'target-hook', 'pasted-130-0', 'pasted-130-1', 'pasted-130-2',
    ]);
    expect(result.layout[0]).toEqual(hook);
    expect(result.layout[2]?.supportedByIds).toEqual(['pasted-130-0']);
    expect(result.layout[3]).toMatchObject({ point: independent.point });
    expect(result.layout[3]).not.toHaveProperty('supportedByIds');
  });

  it('keeps a complete source prefab instance when one member overlaps a target Hook', () => {
    const hook = {
      ...deskSurfaceKit('target-hook', 'unused')[0]!, point: { x: 4, y: 4 },
      supportedActions: ['terminal' as const], requirementId: 'target:terminal', blocksNavigation: true,
    };
    const sourceGroup = [
      { ...item('source-conflict', 4, 4), prefabInstanceId: 'source-instance' },
      { ...item('source-clear', 8, 6), prefabInstanceId: 'source-instance' },
    ];
    const independent = item('source-independent', 10, 6);
    const clipboard = copyDecorativeLayout('source', [...sourceGroup, independent], 15);

    const result = pasteDecorativeLayout(room, [hook], clipboard, 150);

    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ id }) => id)).toEqual([
      'target-hook', 'pasted-150-0', 'pasted-150-1', 'pasted-150-2',
    ]);
    expect(result.layout.slice(1, 3).every(({ prefabInstanceId }) => prefabInstanceId === 'pasted-150-instance-0')).toBe(true);
  });

  it('falls back safely when prefab and clipboard storage reads throw', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => { throw new Error('storage denied'); },
    };

    expect(loadPrefabs(throwingStorage)).toEqual([]);
    expect(availablePrefabs(throwingStorage).map(({ id }) => id)).toEqual([
      'bench-four', 'pod-l-two', 'control-m-three',
      'modern-office-storage-run-dark', 'modern-office-storage-run-blue', 'modern-office-storage-run-light',
    ]);
    expect(loadLayoutClipboard(throwingStorage)).toBeUndefined();
  });

  it('reports failed prefab and clipboard reads separately from empty storage', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => undefined,
    };

    expect(readPrefabs(throwingStorage)).toEqual({ storageRead: 'failed', value: [] });
    expect(readLayoutClipboard(throwingStorage)).toEqual({ storageRead: 'failed', value: undefined });
  });

  it('treats malformed prefab payloads as failed reads instead of a writable empty library', () => {
    const malformedStorage = {
      getItem: () => '{"version":1,"prefabs":[{"id":"broken"}]}',
      setItem: () => undefined,
    };
    expect(readPrefabs(malformedStorage)).toEqual({ storageRead: 'failed', value: [] });
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
    const prefab: FurniturePrefab = { id: 'prefab-1', name: 'Kit', createdAt: 1, width: 2, height: 2, items: [item('a', 0, 0), item('b', 1.5, 0.25)] };
    const result = placePrefab(room, [], prefab, { x: 4.12, y: 3.63 }, 50);
    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ point }) => point)).toEqual([{ x: 4, y: 3.75 }, { x: 5.5, y: 4 }]);
    expect(new Set(result.layout.map(({ id }) => id)).size).toBe(2);
  });

  it('atomically remaps a prefab desk/surface support relationship to fresh ids', () => {
    const prefab: FurniturePrefab = {
      id: 'desk-kit', name: 'Desk kit', createdAt: 1, width: 1, height: 1,
      items: deskSurfaceKit('template-desk', 'template-surface'),
    };

    const result = placePrefab(room, [], prefab, { x: 4, y: 4 }, 60);

    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ id }) => id)).toEqual(['prefab-item-60-0', 'prefab-item-60-1']);
    expect(result.layout[1]?.supportedByIds).toEqual(['prefab-item-60-0']);
    expect(prefab.items[1]?.supportedByIds).toEqual(['template-desk']);
  });

  it('atomically remaps a pasted source desk/surface relationship to fresh ids', () => {
    const source = deskSurfaceKit('source-desk', 'source-surface');
    const clipboard = copyDecorativeLayout('source', source, 10);

    const result = pasteDecorativeLayout(room, [], clipboard, 70);

    expect(result.accepted).toBe(true);
    expect(result.layout.map(({ id }) => id)).toEqual(['pasted-70-0', 'pasted-70-1']);
    expect(result.layout[1]?.supportedByIds).toEqual(['pasted-70-0']);
    expect(clipboard.items[1]?.supportedByIds).toEqual(['source-desk']);
  });

  it('accepts intentional undeclared prefab overlap without mutating the source', () => {
    const target = [item('existing', 8, 7)];
    const before = structuredClone(target);
    const prefab: FurniturePrefab = {
      id: 'invalid-kit', name: 'Invalid kit', createdAt: 1, width: 1, height: 1,
      items: deskSurfaceKit('template-desk', 'template-surface', false),
    };

    const result = placePrefab(room, target, prefab, { x: 4, y: 4 }, 80);
    expect(result.accepted).toBe(true);
    expect(result.layout).toHaveLength(target.length + prefab.items.length);
    expect(target).toEqual(before);
  });

  it('rejects dangling external support refs and preserves valid fixed refs', () => {
    const fixedDesk: FurnitureDefinition = {
      ...deskSurfaceKit('fixed-desk', 'unused')[0]!, point: { x: 4, y: 4 },
      supportedActions: ['terminal'], requirementId: 'terminal-1', blocksNavigation: true,
    };
    const externalSurface = {
      ...deskSurfaceKit('unused-desk', 'template-surface')[1]!, supportedByIds: ['fixed-desk'],
    };
    const validPrefab: FurniturePrefab = {
      id: 'fixed-support', name: 'Fixed support', createdAt: 1, width: 1, height: 1, items: [externalSurface],
    };
    const invalidPrefab: FurniturePrefab = {
      ...validPrefab, id: 'dangling-support', items: [{ ...externalSurface, supportedByIds: ['missing-desk'] }],
    };

    const accepted = placePrefab(room, [fixedDesk], validPrefab, { x: 4, y: 4 }, 90);
    expect(accepted.accepted).toBe(true);
    expect(accepted.layout[1]?.supportedByIds).toEqual(['fixed-desk']);
    expect(placePrefab(room, [fixedDesk], invalidPrefab, { x: 4, y: 4 }, 91)).toEqual({
      accepted: false, layout: [fixedDesk],
    });
  });

  it('rejects a pasted dangling ref without replacing target ordinary furniture', () => {
    const target = [item('ordinary', 8, 7)];
    const clipboard = {
      version: 1 as const, sourceBuildingId: 'source', copiedAt: 10,
      items: [{ ...deskSurfaceKit('unused-desk', 'source-surface')[1]!, supportedByIds: ['missing-desk'] }],
    };

    expect(pasteDecorativeLayout(room, target, clipboard, 100)).toEqual({ accepted: false, layout: target });
    expect(target).toEqual([item('ordinary', 8, 7)]);
  });
});
