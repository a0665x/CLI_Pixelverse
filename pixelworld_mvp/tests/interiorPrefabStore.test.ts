import { describe, expect, it } from 'vitest';
import type { FurnitureDefinition, FurniturePrefab, InteriorDefinition } from '../src/world/types';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import { transformedAlphaBounds } from '../src/rendering/interiorPlacement';
import {
  furnitureRenderScreenPoint,
  prefabGhostScreenPoint,
} from '../src/rendering/InteriorCutawaySystem';
import { geometryInvariant } from '../src/rendering/canonicalFurnitureGeometry';
import { placeOfficePrefab } from '../src/rendering/prefabGeometry';
import {
  availablePrefabs,
  copyDecorativeLayout,
  isBuiltInPrefab,
  loadLayoutClipboard,
  readLayoutClipboard,
  loadPrefabs,
  readAvailablePrefabs,
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
  it('stores a canonical v2 group origin and member-local offsets', () => {
    const selected = [
      { ...item('room-desk', 4, 3), kind: 'desk' as const, assetId: 193, scale: 1.5 as const, rotation: 90 as const },
      { ...item('room-display', 6.5, 3.25), kind: 'display' as const, assetId: 129, scale: 0.75 as const, rotation: 270 as const },
    ];
    const memory = storage();
    const prefab = createUserGroupPrefab(selected, [], 100);

    expect(prefab).toMatchObject({
      version: 2,
      origin: { x: 4, y: 3 },
      memberOffsets: {
        'group-item-1': { x: 0, y: 0 },
        'group-item-2': { x: 2.5, y: 0.25 },
      },
    });
    savePrefabs([prefab], memory);
    const persisted = JSON.parse(memory.getItem('pixelworld:interior-prefabs:v1')!);
    expect(persisted).toMatchObject({
      version: 2,
      prefabs: [{
        version: 2,
        origin: { x: 4, y: 3 },
        members: [
          { offset: { x: 0, y: 0 } },
          { offset: { x: 2.5, y: 0.25 } },
        ],
      }],
    });
    expect(persisted.prefabs[0]).not.toHaveProperty('items');
  });

  it('reloads and places a saved group in the Starting Cabin and a differently sized house without scaling', () => {
    const source = [
      { ...item('source-a', 4, 2), scale: 1.25 as const, rotation: 90 as const, visualOffset: { x: -0.25, y: 0.125 } },
      { ...item('source-b', 6, 2.5), scale: 0.75 as const, rotation: 270 as const },
    ];
    const memory = storage();
    savePrefabs([createUserGroupPrefab(source, [], 101)], memory);
    const reloaded = loadPrefabs(memory)[0]!;
    const cabin = { ...INTERIOR_DEFINITIONS['rest-cabin'], furniture: [] };
    const workHouse = { ...INTERIOR_DEFINITIONS['maker-workshop'], furniture: [] };
    expect([cabin.width, cabin.height]).not.toEqual([workHouse.width, workHouse.height]);

    const inCabin = placePrefab(cabin, [], reloaded, { x: 2, y: 2 }, 201);
    const inWorkHouse = placePrefab(workHouse, [], reloaded, { x: 8, y: 5 }, 202);
    expect(inCabin.accepted).toBe(true);
    expect(inWorkHouse.accepted).toBe(true);
    const cabinMembers = inCabin.layout;
    const workMembers = inWorkHouse.layout;
    expect({
      x: cabinMembers[1]!.point.x - cabinMembers[0]!.point.x,
      y: cabinMembers[1]!.point.y - cabinMembers[0]!.point.y,
    }).toEqual({
      x: workMembers[1]!.point.x - workMembers[0]!.point.x,
      y: workMembers[1]!.point.y - workMembers[0]!.point.y,
    });
    cabinMembers.forEach((member, index) => {
      const other = workMembers[index]!;
      const firstBounds = transformedAlphaBounds(member);
      const secondBounds = transformedAlphaBounds(other);
      expect(secondBounds.width).toBeCloseTo(firstBounds.width);
      expect(secondBounds.height).toBeCloseTo(firstBounds.height);
      expect(other.scale).toBe(member.scale);
      expect(other.rotation).toBe(member.rotation);
      expect(other.visualOffset).toEqual(member.visualOffset);
    });
  });

  it('applies one translation to fractional member offsets without snapping members independently', () => {
    const source = [item('fraction-a', 3.1, 2.2), item('fraction-b', 4.47, 3.03)];
    const prefab = createUserGroupPrefab(source, [], 103);

    const placed = placePrefab(
      { ...INTERIOR_DEFINITIONS['maker-workshop'], furniture: [] },
      [],
      prefab,
      { x: 5.12, y: 4.13 },
      203,
    );

    expect(placed.accepted).toBe(true);
    expect(placed.layout[1]!.point.x - placed.layout[0]!.point.x).toBeCloseTo(1.37);
    expect(placed.layout[1]!.point.y - placed.layout[0]!.point.y).toBeCloseTo(0.83);
  });

  it('migrates a valid v1 group in memory without rewriting storage', () => {
    const memory = storage();
    const legacy = JSON.stringify({
      version: 1,
      prefabs: [{ id: 'legacy', name: 'Legacy', createdAt: 1, width: 2, height: 1, items: [item('a', 0, 0), item('b', 2, 0)] }],
    });
    memory.setItem('pixelworld:interior-prefabs:v1', legacy);

    expect(loadPrefabs(memory)[0]).toMatchObject({
      id: 'legacy', version: 2, origin: { x: 0, y: 0 },
      memberOffsets: { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
    });
    expect(memory.getItem('pixelworld:interior-prefabs:v1')).toBe(legacy);
  });

  it('never overwrites a malformed prefab store and emits origin-independent data', () => {
    const malformed = storage();
    const raw = '{"version":1,"prefabs":[{"id":"broken"}]}';
    malformed.setItem('pixelworld:interior-prefabs:v1', raw);
    const prefab = createUserGroupPrefab([item('a', 2, 2), item('b', 4, 2)], [], 102);

    expect(() => savePrefabs([prefab], malformed)).toThrow();
    expect(malformed.getItem('pixelworld:interior-prefabs:v1')).toBe(raw);

    const first = storage();
    const second = storage();
    savePrefabs([prefab], first);
    savePrefabs([prefab], second);
    expect(first.getItem('pixelworld:interior-prefabs:v1')).toBe(second.getItem('pixelworld:interior-prefabs:v1'));
    expect(first.getItem('pixelworld:interior-prefabs:v1')).not.toMatch(/https?:|localhost|docker/i);
  });

  it('rejects malformed v2 identities and enum values without overwriting storage', () => {
    const member = (id: string, x: number) => ({ offset: { x, y: 0 }, item: item(id, x, 0) });
    const prefab = (id: string) => ({
      version: 2, id, name: 'Valid', createdAt: 1, width: 2, height: 1,
      origin: { x: 0, y: 0 }, members: [member('a', 0), member('b', 1)],
    });
    const malformedPayloads = [
      { version: 2, prefabs: [{ ...prefab('empty-member'), members: [member('', 0), member('b', 1)] }] },
      { version: 2, prefabs: [{ ...prefab('bad-kind'), members: [
        member('a', 0), { ...member('b', 1), item: { ...member('b', 1).item, kind: 'spaceship' } },
      ] }] },
      { version: 2, prefabs: [{ ...prefab('bad-icon'), members: [
        member('a', 0), { ...member('b', 1), item: { ...member('b', 1).item, icon: 'sparkles' } },
      ] }] },
      { version: 2, prefabs: [{ ...prefab('bad-semantic'), members: [
        member('a', 0), { ...member('b', 1), item: { ...member('b', 1).item, semantic: 'unknown' } },
      ] }] },
      { version: 2, prefabs: [prefab('duplicate'), prefab('duplicate')] },
    ];
    const replacement = createUserGroupPrefab([item('x', 2, 2), item('y', 4, 2)], [], 104);

    for (const payload of malformedPayloads) {
      const memory = storage();
      const raw = JSON.stringify(payload);
      memory.setItem('pixelworld:interior-prefabs:v1', raw);
      expect(readPrefabs(memory).storageRead).toBe('failed');
      expect(() => savePrefabs([replacement], memory)).toThrow();
      expect(memory.getItem('pixelworld:interior-prefabs:v1')).toBe(raw);
    }
  });

  it('normalizes a selected group into a durable template with local support references', () => {
    const desk = item('room-desk', 4, 5);
    const monitor = { ...item('room-monitor', 4, 5), layer: 'surface' as const, supportedByIds: ['room-desk'] };
    const prefab = createUserGroupPrefab([desk, monitor], [], 100);
    expect(prefab).toMatchObject({
      id: 'user-group-100-1', name: 'Group 01', createdAt: 100,
      version: 2, origin: { x: 4, y: 5 },
    });
    expect(prefab.width).toBeCloseTo(16 / 22);
    expect(prefab.height).toBeCloseTo(28 / 22);
    expect(prefab.items.map(({ id, point, supportedByIds }) => ({ id, point, supportedByIds }))).toEqual([
      { id: 'group-item-1', point: { x: 4, y: 5 }, supportedByIds: undefined },
      { id: 'group-item-2', point: { x: 4, y: 5 }, supportedByIds: ['group-item-1'] },
    ]);
  });

  it('deletes only the reusable group record and leaves placed room instances intact', () => {
    const memory = storage();
    const prefab = createUserGroupPrefab([item('template-a', 2, 2), item('template-b', 3, 2)], [], 100);
    savePrefabs([prefab], memory);
    const reloaded = readAvailablePrefabs(memory).value.find(({ id }) => id === prefab.id)!;
    const placed = placeOfficePrefab(room, [], reloaded, { x: 5, y: 3 }, 200);
    expect(placed.accepted).toBe(true);
    const placedBeforeDeletion = structuredClone(placed.layout);

    savePrefabs(deletePrefab([reloaded], reloaded.id), memory);

    expect(readAvailablePrefabs(memory).value.some(({ id }) => id === prefab.id)).toBe(false);
    expect(placed.layout).toEqual(placedBeforeDeletion);
  });
  it('persists prefabs independently from room layouts', () => {
    const memory = storage();
    const prefab: FurniturePrefab = { id: 'prefab-1', name: 'Desk kit', createdAt: 1, width: 2, height: 2, items: [item('a', 0, 0), item('b', 1, 1)] };
    savePrefabs([prefab], memory);
    expect(loadPrefabs(memory)).toEqual([{
      ...prefab,
      version: 2,
      origin: { x: 0, y: 0 },
      memberOffsets: { a: { x: 0, y: 0 }, b: { x: 1, y: 1 } },
    }]);
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

  it('reloads a user group through the office runtime with canonical placement and ghost geometry', () => {
    const memory = storage();
    const source = [
      { ...item('source-a', 3.25, 2.5), scale: 1.25 as const, rotation: 90 as const, visualOffset: { x: -0.25, y: 0.125 } },
      { ...item('source-b', 5.12, 3.33), scale: 0.75 as const, rotation: 270 as const },
    ];
    const saved = createUserGroupPrefab(source, [], 110);
    savePrefabs([saved], memory);
    const reloaded = readAvailablePrefabs(memory).value.find(({ id }) => id === saved.id)!;
    const destination = { ...INTERIOR_DEFINITIONS['maker-workshop'], furniture: [] };
    const anchor = { x: 8, y: 5 };
    const placed = placeOfficePrefab(destination, [], reloaded, anchor, 210);

    expect(placed.accepted).toBe(true);
    const cell = 17;
    const screenAnchor = { x: 420, y: 260 };
    const roomOrigin = {
      x: screenAnchor.x - (anchor.x + 0.5) * cell,
      y: screenAnchor.y - (anchor.y + 0.5) * cell,
    };
    reloaded.items.forEach((template, index) => {
      const member = placed.layout[index]!;
      expect(geometryInvariant(template, member)).toBe(true);
      const ghost = prefabGhostScreenPoint(reloaded, template, screenAnchor, cell);
      const rendered = furnitureRenderScreenPoint(roomOrigin, member, cell);
      expect(ghost.x).toBeCloseTo(rendered.x);
      expect(ghost.y).toBeCloseTo(rendered.y);
    });
    expect(placed.layout[1]!.point.x - placed.layout[0]!.point.x).toBeCloseTo(1.87);
    expect(placed.layout[1]!.point.y - placed.layout[0]!.point.y).toBeCloseTo(0.83);
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

  it('rejects a prefab whose blocking member collides with destination furniture', () => {
    const existing = item('existing-blocker', 4, 4, ['terminal']);
    const prefab: FurniturePrefab = {
      id: 'blocking-kit', name: 'Blocking kit', createdAt: 1, width: 2, height: 1,
      items: [item('blocking-member', 0, 0, ['terminal']), item('decor-member', 2, 0)],
    };

    expect(placePrefab(room, [existing], prefab, { x: 4, y: 4 }, 55)).toEqual({
      accepted: false,
      layout: [existing],
    });
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
