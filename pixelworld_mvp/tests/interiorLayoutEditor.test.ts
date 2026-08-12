import { describe, expect, it } from 'vitest';
import {
  addFurniture,
  canPlaceFurniture,
  furnitureCells,
  hasSavedInteriorLayout,
  loadInteriorLayout,
  readInteriorLayout,
  moveFurniture,
  placementDiagnostic,
  resizeFurniture,
  rotateFurniture,
  saveInteriorLayout,
  collectAllFurniture,
  requiredHookInventory,
  revertInteriorDraft,
  reorderFurniture,
  shiftFurnitureLayer,
  FURNITURE_PALETTE,
  FURNITURE_SCALES,
} from '../src/rendering/interiorLayoutEditor';
import { modernOfficeKindForFurniture } from '../src/rendering/InteriorCutawaySystem';
import { INTERIOR_DEFINITIONS, INTERIOR_LAYOUT_REVISION } from '../src/world/interiorDefinitions';
import type { FurnitureDefinition } from '../src/world/types';

describe('interior furniture editor model', () => {
  const room = INTERIOR_DEFINITIONS['rest-cabin'];
  const normalizedRoomLayout = () => loadInteriorLayout('unsaved-test-house', room, undefined);

  it('moves furniture inside the room and allows visual overlap', () => {
    const layout = normalizedRoomLayout();
    expect(moveFurniture(room, layout, 'rest-sofa-a', { x: 6, y: 1 }).find(({ id }) => id === 'rest-sofa-a')?.point)
      .toEqual({ x: 6, y: 1 });
    expect(moveFurniture(room, layout, 'rest-sofa-a', { x: -3, y: 2 })).toEqual(layout);

    const moved = moveFurniture(room, layout, 'rest-sofa-a', { x: 3, y: 4 });
    expect(moved.find(({ id }) => id === 'rest-sofa-a')?.point).toEqual({ x: 3, y: 4 });
    expect(canPlaceFurniture(room, moved.find(({ id }) => id === 'rest-sofa-a')!, moved, 'rest-sofa-a')).toBe(true);
  });

  it('adds palette furniture at legal points even when visuals overlap', () => {
    const layout = normalizedRoomLayout();
    expect(addFurniture(room, layout, 'chair', { x: 7, y: 4 })).toHaveLength(layout.length + 1);
    expect(addFurniture(room, layout, 'sofa', { x: 6, y: 1 })).toHaveLength(layout.length + 1);
  });

  it('saves and restores a building-specific arrangement', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const layout = resizeFurniture(room, moveFurniture(room, normalizedRoomLayout(), 'rest-sofa-a', { x: 3, y: 4 }), 'rest-sofa-a', 1.25);
    saveInteriorLayout('rest-cabin-house', layout, storage);
    expect(JSON.parse(memory.get('pixelworld:interior-layout:rest-cabin-house')!)).toMatchObject({
      version: 5,
      authoredRevision: 2,
    });
    expect(loadInteriorLayout('rest-cabin-house', room, storage)).toEqual(
      layout.map((item) => ({ ...item, scale: item.scale ?? 1, rotation: item.rotation ?? 0 })),
    );
  });

  it('migrates legacy authored furniture to the current preset while preserving custom additions', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const oldAuthored = {
      id: 'rest-sofa-a', kind: 'sofa' as const, point: { x: 1, y: 1 }, facing: 'right' as const,
      supportedActions: ['rest' as const], icon: 'rest' as const, assetId: 225,
    };
    const custom = {
      id: 'custom-office-kept', kind: 'decor' as const, point: { x: 3.125, y: 7.25 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 120, layer: 'surface' as const,
      blocksNavigation: false,
    };
    memory.set('pixelworld:interior-layout:migrate-house', JSON.stringify({ version: 4, furniture: [oldAuthored, custom] }));
    const loaded = loadInteriorLayout('migrate-house', room, storage);
    expect(loaded.find(({ id }) => id === 'rest-sofa-a')).toMatchObject(room.furniture.find(({ id }) => id === 'rest-sofa-a')!);
    expect(loaded.find(({ id }) => id === custom.id)).toMatchObject({ point: custom.point, assetId: 120 });
    expect(loaded.filter(({ id }) => id === custom.id)).toHaveLength(1);
    saveInteriorLayout('migrate-house', loaded, storage);
    expect(JSON.parse(memory.get('pixelworld:interior-layout:migrate-house')!)).toMatchObject({
      version: 5,
      authoredRevision: 2,
    });
  });

  it('rotates furniture only when the rotated footprint is legal', () => {
    const item = {
      ...room.furniture[0]!, point: { x: 2.5, y: 2 }, rotation: 0 as const,
      footprint: { width: 2, height: 1 },
    };
    const rotated = rotateFurniture(room, [item], item.id, 90);
    expect(rotated[0]).toMatchObject({ rotation: 90, point: { x: 2.5, y: 2 } });
  });

  it('rotates a normalized visual offset by the editor delta exactly once', () => {
    const item = {
      ...room.furniture[0]!, point: { x: 5, y: 4 }, rotation: 0 as const,
      visualOffset: { x: 0.5, y: 0.25 },
    };
    const quarterTurn = rotateFurniture(room, [item], item.id, 90)[0]!;
    const halfTurn = rotateFurniture(room, [quarterTurn], item.id, 180)[0]!;

    expect(quarterTurn.visualOffset).toEqual({ x: -0.25, y: 0.5 });
    expect(halfTurn.visualOffset).toEqual({ x: -0.5, y: -0.25 });
  });

  it('persists an authored interaction point through save and load', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const item = { ...normalizedRoomLayout()[0]!, interactionPoint: { x: 3.25, y: 4.5 } };

    saveInteriorLayout('interaction-house', [item], storage);
    const loaded = loadInteriorLayout('interaction-house', room, storage)[0]!;
    expect(loaded.interactionPoint).toEqual(item.interactionPoint);
    expect(loaded.interactionPoint).not.toBe(item.interactionPoint);
  });

  it('migrates legacy arrays and falls back from corrupted saved layouts', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const key = 'pixelworld:interior-layout:legacy-house';
    memory.set(key, JSON.stringify(room.furniture));
    expect(loadInteriorLayout('legacy-house', room, storage)).toEqual(normalizedRoomLayout());
    memory.set(key, JSON.stringify({ version: 99, furniture: [] }));
    expect(loadInteriorLayout('legacy-house', room, storage)).toEqual(normalizedRoomLayout());
  });

  it('returns a valid saved work layout unchanged when authored defaults gain office prefabs', () => {
    const workRoom = INTERIOR_DEFINITIONS['research-library'];
    const savedFurniture = [{
      id: 'saved-network-workstation',
      kind: 'reading-desk' as const,
      point: { x: 2, y: 2 },
      facing: 'down' as const,
      supportedActions: ['read' as const],
      icon: 'read' as const,
      assetId: 193,
    }];
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    saveInteriorLayout('network-lab', savedFurniture, storage);
    const key = 'pixelworld:interior-layout:network-lab';
    const saved = JSON.parse(memory.get(key)!);
    saved.authoredRevision = INTERIOR_LAYOUT_REVISION - 1;
    memory.set(key, JSON.stringify(saved));
    const originalPayload = memory.get(key);

    expect(hasSavedInteriorLayout('network-lab', storage)).toBe(true);
    expect(loadInteriorLayout('network-lab', workRoom, storage)).toEqual(
      saved.furniture.map((item: FurnitureDefinition) => ({
        ...item,
        requirementId: item.requirementId ?? `${workRoom.id}:${item.id}`,
      })),
    );
    expect(memory.get(key)).toBe(originalPayload);
  });

  it('falls back from malformed saved data in memory without auto-writing it', () => {
    const key = 'pixelworld:interior-layout:malformed-house';
    const memory = new Map([[key, '{not-json']]);
    let writes = 0;
    const storage = {
      getItem: (candidate: string) => memory.get(candidate) ?? null,
      setItem: (candidate: string, value: string) => { writes += 1; memory.set(candidate, value); },
    };

    expect(hasSavedInteriorLayout('malformed-house', storage)).toBe(false);
    expect(loadInteriorLayout('malformed-house', room, storage)).toEqual(normalizedRoomLayout());
    expect(memory.get(key)).toBe('{not-json');
    expect(writes).toBe(0);
  });

  it('falls back to the authored room when storage access throws', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => { throw new Error('storage denied'); },
    };

    expect(hasSavedInteriorLayout('throwing-house', throwingStorage)).toBe(false);
    expect(loadInteriorLayout('throwing-house', room, throwingStorage)).toEqual(normalizedRoomLayout());
    expect(revertInteriorDraft('throwing-house', room, throwingStorage)).toEqual(normalizedRoomLayout());
  });

  it('distinguishes a failed layout read from a missing saved layout', () => {
    const failed = readInteriorLayout('throwing-house', room, {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => undefined,
    });
    const missing = readInteriorLayout('missing-house', room, {
      getItem: () => null,
      setItem: () => undefined,
    });

    expect(failed).toMatchObject({ storageRead: 'failed' });
    expect(failed.layout).toEqual(missing.layout);
    expect(missing.storageRead).toBe('success');
  });

  it.each([
    { id: 123, kind: 'chair', point: { x: 2, y: 2 }, facing: 'up', supportedActions: [], icon: 'generic' },
    { id: 'bad-kind', kind: 'spaceship', point: { x: 2, y: 2 }, facing: 'up', supportedActions: [], icon: 'generic' },
    { id: 'bad-point', kind: 'chair', point: { x: Infinity, y: 2 }, facing: 'up', supportedActions: [], icon: 'generic' },
    { id: 'bad-facing', kind: 'chair', point: { x: 2, y: 2 }, facing: 'north', supportedActions: [], icon: 'generic' },
    { id: 'bad-actions', kind: 'chair', point: { x: 2, y: 2 }, facing: 'up', supportedActions: ['dance'], icon: 'generic' },
    { id: 'bad-icon', kind: 'chair', point: { x: 2, y: 2 }, facing: 'up', supportedActions: [], icon: 'sparkle' },
  ])('rejects a structurally invalid saved furniture item without writing: %#', (invalidItem) => {
    const key = 'pixelworld:interior-layout:invalid-item-house';
    const raw = JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [invalidItem] });
    let writes = 0;
    const storage = {
      getItem: (candidate: string) => candidate === key ? raw : null,
      setItem: () => { writes += 1; },
    };

    expect(hasSavedInteriorLayout('invalid-item-house', storage)).toBe(false);
    expect(loadInteriorLayout('invalid-item-house', room, storage)).toEqual(normalizedRoomLayout());
    expect(writes).toBe(0);
  });

  it('treats a saved empty room as valid and authoritative', () => {
    const key = 'pixelworld:interior-layout:empty-house';
    const raw = JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [] });
    const storage = { getItem: (candidate: string) => candidate === key ? raw : null, setItem: () => undefined };

    expect(hasSavedInteriorLayout('empty-house', storage)).toBe(true);
    expect(loadInteriorLayout('empty-house', room, storage)).toEqual([]);
  });
  it('offers a complete Modern Office palette and maps every item to that family', () => {
    expect(FURNITURE_PALETTE).toEqual(expect.arrayContaining([
      'sofa', 'chair', 'office-chair', 'television', 'display', 'computer', 'desk',
      'meeting-table', 'bookcase', 'cabinet', 'planning-board', 'plant', 'beverage-station', 'printer',
    ]));
    FURNITURE_PALETTE.forEach((kind) => expect(modernOfficeKindForFurniture(kind)).toBeTruthy());
  });

  it('projects blocking alpha bounds and explains rejected placement', () => {
    expect(furnitureCells({ kind: 'sofa', point: { x: 4, y: 4 }, scale: 1.5 }).length).toBeGreaterThan(0);
    const layout = normalizedRoomLayout();
    const overlapping = { ...layout[0]!, id: 'candidate', kind: 'chair' as const, point: { x: 4, y: 5 } };
    const atDoor = { ...overlapping, point: { x: Math.floor(room.width / 2), y: room.height - 1 } };
    expect(placementDiagnostic(room, overlapping, layout)).toBe('valid');
    expect(placementDiagnostic(room, atDoor, layout)).toBe('blocks-door');
    expect(placementDiagnostic(room, { ...overlapping, point: { x: -1, y: 2 } }, layout)).toBe('outside-room');
  });

  it('resizes when transformed alpha bounds remain in the room', () => {
    const sofa = { ...room.furniture.find(({ id }) => id === 'rest-sofa-a')!, scale: 1 as const };
    const valid = resizeFurniture(room, [sofa], sofa.id, 1.25);
    expect(valid[0]?.scale).toBe(1.25);

    const blocker = { ...room.furniture.find(({ id }) => id === 'rest-lamp')!, point: { x: 3, y: 4 } };
    expect(resizeFurniture(room, [sofa, blocker], sofa.id, 1.5)[0]?.scale).toBe(1.5);
  });

  it('tracks required Hook furniture independently from decorative furniture', () => {
    const layout = normalizedRoomLayout();
    const required = requiredHookInventory(room, layout);
    expect(required.length).toBeGreaterThan(0);
    expect(required.every(({ furniture }) => furniture.supportedActions.length > 0)).toBe(true);
    expect(required.every(({ placed }) => placed)).toBe(true);
    expect(requiredHookInventory(room, collectAllFurniture(layout)).every(({ placed }) => !placed)).toBe(true);
  });

  it('collects the draft and can revert it to the last saved configuration', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const saved = moveFurniture(room, normalizedRoomLayout(), 'rest-sofa-a', { x: 5, y: 3 });
    saveInteriorLayout('revert-house', saved, storage);
    expect(collectAllFurniture(saved)).toEqual([]);
    expect(revertInteriorDraft('revert-house', room, storage)).toEqual(saved);
  });

  it('moves furniture between semantic layers and reorders within a layer', () => {
    const layout = normalizedRoomLayout().slice(0, 3).map((item, index) => ({
      ...item, layer: 'furniture' as const, zIndex: index,
    }));
    const id = layout[1]!.id;
    expect(shiftFurnitureLayer(layout, id, 'next').find((item) => item.id === id)?.layer).toBe('surface');
    expect(shiftFurnitureLayer(layout, id, 'previous').find((item) => item.id === id)?.layer).toBe('floor');
    expect(reorderFurniture(layout, id, 'front').find((item) => item.id === id)?.zIndex).toBe(3);
    expect(reorderFurniture(layout, id, 'back').find((item) => item.id === id)?.zIndex).toBe(-1);
  });

  it('deeply clones visual offsets through layer editing', () => {
    const source = { ...normalizedRoomLayout()[0]!, visualOffset: { x: -0.25, y: 0.125 } };
    const edited = shiftFurnitureLayer([source], source.id, 'next');

    edited[0]!.visualOffset!.x = 9;
    expect(source.visualOffset).toEqual({ x: -0.25, y: 0.125 });
  });

  it('supports quarter-step scaling through three hundred percent', () => {
    expect(FURNITURE_SCALES).toEqual([0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]);
    const sofa = { ...normalizedRoomLayout().find(({ id }) => id === 'rest-sofa-a')!, point: { x: 6, y: 4 } };
    expect(resizeFurniture(room, [sofa], sofa.id, 3 as never)[0]?.scale).toBe(3);
  });

  it('preserves finite off-grid edge-fit anchors through save and load', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const item = { ...normalizedRoomLayout()[0]!, point: { x: 2.113636, y: 3.181818 } };
    saveInteriorLayout('precise-edge-house', [item], storage);
    expect(loadInteriorLayout('precise-edge-house', room, storage)[0]?.point.x).toBeCloseTo(2.113636);
    expect(loadInteriorLayout('precise-edge-house', room, storage)[0]?.point.y).toBeCloseTo(3.181818);
  });
});
