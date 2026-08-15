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
import { authoredPlacement } from '../src/rendering/interiorFurnitureScale';
import { modernOfficeKindForFurniture } from '../src/rendering/InteriorCutawaySystem';
import { transformedAlphaBounds } from '../src/rendering/interiorPlacement';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { INTERIOR_DEFINITIONS, INTERIOR_LAYOUT_REVISION } from '../src/world/interiorDefinitions';
import type { FurnitureDefinition } from '../src/world/types';
import { semanticForFurniture } from '../src/rendering/interiorFurnitureSemantics';

describe('interior furniture editor model', () => {
  const room = INTERIOR_DEFINITIONS['rest-cabin'];
  const normalizedRoomLayout = () => loadInteriorLayout('unsaved-test-house', room, undefined);

  it('moves furniture inside the room and allows visual overlap', () => {
    const layout = normalizedRoomLayout();
    expect(moveFurniture(room, layout, 'rest-sofa-a', { x: 6, y: 1 }).find(({ id }) => id === 'rest-sofa-a')?.point)
      .toEqual({ x: 6, y: 1 });
    const edgeFitted = moveFurniture(room, layout, 'rest-sofa-a', { x: -0.25, y: 2 });
    expect(transformedAlphaBounds(edgeFitted.find(({ id }) => id === 'rest-sofa-a')!).x).toBeCloseTo(0);

    const moved = moveFurniture(room, layout, 'rest-sofa-a', { x: 3, y: 4 });
    expect(moved.find(({ id }) => id === 'rest-sofa-a')?.point).toEqual({ x: 3, y: 4 });
    expect(canPlaceFurniture(room, moved.find(({ id }) => id === 'rest-sofa-a')!, moved, 'rest-sofa-a')).toBe(true);
  });

  it('adds palette furniture at legal points even when visuals overlap', () => {
    const layout = normalizedRoomLayout();
    expect(addFurniture(room, layout, 'chair', { x: 7, y: 4 })).toHaveLength(layout.length + 1);
    expect(addFurniture(room, layout, 'sofa', { x: 6, y: 1 })).toHaveLength(layout.length + 1);
  });

  it('attaches and detaches a moved surface object without persisting the draft', () => {
    const support = {
      id: 'auto-desk', kind: 'desk' as const, assetId: 247, point: { x: 4, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'furniture' as const, blocksNavigation: false,
    };
    const monitor = {
      id: 'auto-monitor', kind: 'display' as const, assetId: 129, point: { x: 8, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'surface' as const, blocksNavigation: false,
    };

    const attached = moveFurniture(room, [support, monitor], monitor.id, support.point);
    expect(attached[1]?.supportedByIds).toEqual([support.id]);
    const detached = moveFurniture(room, attached, monitor.id, { x: 9, y: 5 });
    expect(detached[1]).not.toHaveProperty('supportedByIds');
  });

  it('moves an attached dependency when the public editor helper moves its support', () => {
    const support = {
      id: 'helper-desk', kind: 'desk' as const, assetId: 247, point: { x: 4, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'furniture' as const, blocksNavigation: false,
    };
    const monitor = {
      id: 'helper-monitor', kind: 'display' as const, assetId: 129, point: { x: 4, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'surface' as const, blocksNavigation: false,
      supportedByIds: [support.id],
    };

    const moved = moveFurniture(room, [support, monitor], support.id, { x: 5, y: 3 });
    expect(moved.map(({ point }) => point)).toEqual([{ x: 5, y: 3 }, { x: 5, y: 3 }]);
    expect(moved[1]?.supportedByIds).toEqual([support.id]);
  });

  it('closest-edge fits the complete public support dependency closure with one shared delta', () => {
    const support = {
      id: 'edge-desk', kind: 'desk' as const, assetId: 247, point: { x: 4, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'furniture' as const, blocksNavigation: false,
    };
    const monitor = {
      id: 'edge-monitor', kind: 'display' as const, assetId: 129, point: { x: 4.5, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'surface' as const, blocksNavigation: false,
      supportedByIds: [support.id],
    };
    const layout = [support, monitor];
    const before = structuredClone(layout);

    const moved = moveFurniture(room, layout, support.id, { x: 13, y: 3 });
    const delta = moved[0]!.point.x - support.point.x;

    expect(moved).not.toEqual(before);
    expect(moved[1]!.point.x - monitor.point.x).toBeCloseTo(delta);
    expect(Math.max(...moved.map((item) => {
      const bounds = transformedAlphaBounds(item);
      return bounds.x + bounds.width;
    }))).toBeCloseTo(room.width);
    expect(moved[1]?.supportedByIds).toEqual([support.id]);
    expect(layout).toEqual(before);
    expect(moved[0]).not.toBe(layout[0]);
    expect(moved[1]).not.toBe(layout[1]);
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

  it.each(['right', 'left', 'down'] as const)(
    'keeps source orientation for saved furniture facing %s when rotation is omitted',
    (facing) => {
      const saved = {
        id: `custom-source-facing-${facing}`,
        kind: 'decor' as const,
        point: { x: 3, y: 3 },
        facing,
        supportedActions: [],
        icon: 'generic' as const,
        assetId: 120,
      };
      const raw = JSON.stringify({
        version: 5,
        authoredRevision: INTERIOR_LAYOUT_REVISION,
        furniture: [saved],
      });
      const storage = { getItem: () => raw, setItem: () => undefined };

      expect(loadInteriorLayout(`source-facing-${facing}`, room, storage)[0]?.rotation).toBe(0);
    },
  );

  it('preserves an explicit saved furniture rotation independently of facing', () => {
    const saved = {
      id: 'custom-explicit-rotation',
      kind: 'decor' as const,
      point: { x: 3, y: 3 },
      facing: 'right' as const,
      supportedActions: [],
      icon: 'generic' as const,
      assetId: 120,
      rotation: 270 as const,
    };
    const raw = JSON.stringify({
      version: 5,
      authoredRevision: INTERIOR_LAYOUT_REVISION,
      furniture: [saved],
    });
    const storage = { getItem: () => raw, setItem: () => undefined };

    expect(loadInteriorLayout('explicit-source-rotation', room, storage)[0]?.rotation).toBe(270);
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

  it('round-trips a complete prefab instance without changing IDs, metadata, or relative geometry', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const instance = [
      {
        id: 'saved-prefab-a', kind: 'plant' as const, assetId: 98, point: { x: 3, y: 3 }, facing: 'right' as const,
        supportedActions: [], icon: 'generic' as const, scale: 1.25 as const, rotation: 90 as const,
        layer: 'surface' as const, zIndex: 2, blocksNavigation: false, prefabInstanceId: 'saved-prefab-instance',
        interactionPoint: { x: 3, y: 4 }, visualOffset: { x: -0.25, y: 0.5 },
      },
      {
        id: 'saved-prefab-b', kind: 'display' as const, assetId: 129, point: { x: 5.5, y: 3 }, facing: 'right' as const,
        supportedActions: [], icon: 'generic' as const, scale: 1.25 as const, rotation: 90 as const,
        layer: 'surface' as const, zIndex: 4, blocksNavigation: false, prefabInstanceId: 'saved-prefab-instance',
      },
    ];

    saveInteriorLayout('prefab-roundtrip-house', instance, storage);
    const restored = loadInteriorLayout('prefab-roundtrip-house', room, storage);

    expect(restored).toEqual(instance);
    expect(restored[1]!.point.x - restored[0]!.point.x).toBe(2.5);
    expect(new Set(restored.map(({ prefabInstanceId }) => prefabInstanceId))).toEqual(new Set(['saved-prefab-instance']));
  });

  it('round-trips supported group layer metadata without breaking its support references', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const instance = [{
      id: 'layer-desk', kind: 'desk' as const, assetId: 193, point: { x: 3, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'furniture' as const, blocksNavigation: false,
      prefabInstanceId: 'layer-instance', scale: 1 as const, rotation: 0 as const, zIndex: 0,
    }, {
      id: 'layer-monitor', kind: 'display' as const, assetId: 141, point: { x: 3, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, layer: 'surface' as const, blocksNavigation: false,
      prefabInstanceId: 'layer-instance', supportedByIds: ['layer-desk'], scale: 1 as const, rotation: 0 as const,
      zIndex: 0,
    }];

    saveInteriorLayout('supported-layer-house', instance, storage);
    const restored = loadInteriorLayout('supported-layer-house', room, storage);

    expect(restored).toEqual([{ ...instance[0], semantic: 'work' }, instance[1]]);
    expect(restored[1]?.supportedByIds).toEqual([restored[0]?.id]);
    expect(officeLayoutIssues({ ...room, furniture: restored })).toEqual([]);
  });

  it.each([
    ['unchanged', { x: 10.5, y: 4 }, 0, 1, { x: 10.5, y: 7 }],
    ['translated', { x: 11.5, y: 5 }, 0, 1, { x: 11.5, y: 8 }],
    ['rotated', { x: 10.5, y: 4 }, 90, 1, { x: 7.5, y: 4 }],
    ['translated and rotated', { x: 12, y: 5 }, 90, 1, { x: 9, y: 5 }],
    ['scaled without scaling its interaction anchor', { x: 10.5, y: 4 }, 0, 2, { x: 10.5, y: 7 }],
  ] as const)('hydrates a %s pre-anchor v5 item in its saved transform', (_label, point, rotation, scale, expectedAnchor) => {
    const workRoom = INTERIOR_DEFINITIONS['maker-workshop'];
    const authored = workRoom.furniture.find(({ id }) => id === 'maker-work-tool-wall')!;
    const { interactionPoint: _oldAnchor, ...authoredBeforeAnchor } = structuredClone(authored);
    const saved = {
      ...authoredBeforeAnchor,
      point,
      scale,
      rotation,
      requirementId: authoredBeforeAnchor.requirementId ?? `${workRoom.id}:${authoredBeforeAnchor.id}`,
    };
    const memory = new Map([[
      'pixelworld:interior-layout:old-work-house',
      JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [saved] }),
    ]]);
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: () => undefined };

    expect(loadInteriorLayout('old-work-house', workRoom, storage)[0]).toEqual({
      ...saved,
      semantic: 'work',
      interactionPoint: expectedAnchor,
    });
  });

  it('preserves an explicit saved interaction point instead of rehydrating it', () => {
    const workRoom = INTERIOR_DEFINITIONS['maker-workshop'];
    const authored = workRoom.furniture.find(({ id }) => id === 'maker-work-tool-wall')!;
    const saved = {
      ...structuredClone(authored), point: { x: 12, y: 5 }, rotation: 90 as const,
      interactionPoint: { x: 4.25, y: 3.5 }, scale: authored.scale ?? 1,
      requirementId: authored.requirementId ?? `${workRoom.id}:${authored.id}`,
    };
    const raw = JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [saved] });
    const storage = { getItem: () => raw, setItem: () => undefined };

    expect(loadInteriorLayout('explicit-anchor-house', workRoom, storage)[0]!.interactionPoint)
      .toEqual(saved.interactionPoint);
  });

  it('does not invent an authored anchor for unmatched custom v5 furniture', () => {
    const custom = {
      id: 'custom-terminal', kind: 'computer' as const, point: { x: 2, y: 2 }, facing: 'down' as const,
      supportedActions: ['terminal' as const], icon: 'tool' as const, assetId: 225, blocksNavigation: true,
    };
    const raw = JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [custom] });
    const storage = { getItem: () => raw, setItem: () => undefined };

    expect(loadInteriorLayout('custom-work-house', INTERIOR_DEFINITIONS['maker-workshop'], storage)[0])
      .not.toHaveProperty('interactionPoint');
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
        semantic: 'search',
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

  it('hydrates legacy v5 Hook metadata into a semantic in memory without writing before Save', () => {
    const key = 'pixelworld:interior-layout:semantic-v5-house';
    const legacy = {
      id: 'legacy-search-console', kind: 'decor' as const, point: { x: 3, y: 3 }, facing: 'up' as const,
      supportedActions: ['read' as const], icon: 'read' as const, requirementId: 'legacy:exact-bookcase',
      blocksNavigation: true,
    };
    const raw = JSON.stringify({ version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [legacy] });
    let writes = 0;
    const storage = {
      getItem: (candidate: string) => candidate === key ? raw : null,
      setItem: () => { writes += 1; },
    };

    expect(loadInteriorLayout('semantic-v5-house', room, storage)[0]).toMatchObject({
      id: legacy.id, semantic: 'search', requirementId: legacy.requirementId,
    });
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

  it('keeps only geometrically valid unknown saved assets so they remain returnable', () => {
    const key = 'pixelworld:interior-layout:unknown-asset-house';
    const unknown = {
      id: 'unknown-saved-asset', kind: 'decor' as const, assetId: 999_999,
      point: { x: 4, y: 3 }, facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
      footprint: { width: 1, height: 1 }, scale: 1 as const, rotation: 0 as const,
    };
    const outside = { ...unknown, id: 'outside-unknown', point: { x: -10, y: 3 } };
    const atDoor = {
      ...unknown, id: 'door-unknown', point: { x: Math.floor(room.width / 2), y: room.height - 1 },
    };
    const raw = JSON.stringify({
      version: 5, authoredRevision: INTERIOR_LAYOUT_REVISION, furniture: [unknown, outside, atDoor],
    });
    const storage = { getItem: (candidate: string) => candidate === key ? raw : null, setItem: () => undefined };

    expect(loadInteriorLayout('unknown-asset-house', room, storage)).toEqual([
      expect.objectContaining({ id: unknown.id, assetId: unknown.assetId }),
    ]);
  });

  it('keeps catalog support semantics and repairs malformed support graphs across v5 hydration', () => {
    const key = 'pixelworld:interior-layout:support-roundtrip-house';
    const support = {
      id: 'catalog-workstation', kind: 'decor' as const, assetId: 247, point: { x: 4, y: 3 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
    };
    const monitor = {
      id: 'catalog-monitor', kind: 'decor' as const, assetId: 129, point: { x: 4, y: 3 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
      supportedByIds: [support.id],
    };
    const chair = {
      id: 'catalog-chair', kind: 'chair' as const, assetId: 101, point: { x: 7, y: 3 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
    };
    const dangling = { ...monitor, id: 'dangling-monitor', point: { x: 8, y: 3 }, supportedByIds: ['missing'] };
    const invalidTarget = { ...monitor, id: 'chair-monitor', point: { x: 9, y: 3 }, supportedByIds: [chair.id] };
    const memory = new Map<string, string>();
    const storage = {
      getItem: (candidate: string) => memory.get(candidate) ?? null,
      setItem: (candidate: string, value: string) => { memory.set(candidate, value); },
    };

    saveInteriorLayout('support-roundtrip-house', [support, monitor, chair, dangling, invalidTarget], storage);
    const loaded = loadInteriorLayout('support-roundtrip-house', room, storage);

    expect(loaded.find(({ id }) => id === monitor.id)?.supportedByIds).toEqual([support.id]);
    expect(loaded.find(({ id }) => id === dangling.id)).not.toHaveProperty('supportedByIds');
    expect(loaded.find(({ id }) => id === invalidTarget.id)).not.toHaveProperty('supportedByIds');
    expect(officeLayoutIssues({ ...room, furniture: loaded })
      .filter(({ diagnostic }) => diagnostic === 'invalid-support')).toEqual([]);
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
    const overlapping = { ...layout[0]!, id: 'candidate', kind: 'chair' as const, point: { x: 4, y: 5 }, scale: 2 as const };
    const atDoor = { ...overlapping, point: { x: Math.floor(room.width / 2), y: room.height - 2 } };
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

  it('removes station semantics immediately and across Save/reload after shifting onto a floor layer', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const source = normalizedRoomLayout().find(({ id }) => id === 'rest-sofa-a')!;
    expect(source.semantic).toBe('rest');
    const shifted = shiftFurnitureLayer([source], source.id, 'previous');

    expect(shifted[0]?.layer).toBe('floor');
    expect(semanticForFurniture(shifted[0]!)).toBeUndefined();

    saveInteriorLayout('shifted-semantic-house', shifted, storage);
    const restored = loadInteriorLayout('shifted-semantic-house', room, storage);
    expect(restored[0]?.semantic).toBeUndefined();
    expect(semanticForFurniture(restored[0]!)).toBeUndefined();
  });

  it('round-trips an explicit semantic on ordinary furniture after layer exclusion', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const custom: FurnitureDefinition = {
      id: 'custom-semantic-object', kind: 'decor', point: { x: 3, y: 3 }, facing: 'up',
      supportedActions: [], icon: 'generic', layer: 'furniture', blocksNavigation: true,
      semantic: 'search', assetId: 98,
    };

    saveInteriorLayout('explicit-semantic-house', [custom], storage);
    expect(loadInteriorLayout('explicit-semantic-house', room, storage)[0]?.semantic).toBe('search');
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

  it('uses family placement for new palette furniture and rejects unsupported sprite rotation', () => {
    const added = addFurniture(room, [], 'sofa', { x: 6, y: 4 });
    expect(added[0]).toMatchObject(authoredPlacement(200));

    const chair = {
      ...normalizedRoomLayout().find(({ id }) => id === 'rest-sofa-a')!,
      id: 'single-orientation-chair', point: { x: 6, y: 4 }, rotation: 0 as const,
    };
    expect(rotateFurniture(room, [chair], chair.id, 90)).toEqual([chair]);
  });

  it('limits family migration to known authored furniture without changing custom scale intent', () => {
    const legacyAuthored = {
      ...room.furniture.find(({ id }) => id === 'rest-rug')!,
      scale: 2 as const,
    };
    const customWithoutScale = {
      id: 'legacy-custom-no-marker', kind: 'decor' as const, assetId: 207, point: { x: 3, y: 3 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
    };
    const storage = {
      getItem: () => JSON.stringify({ version: 4, furniture: [legacyAuthored, customWithoutScale] }),
      setItem: () => undefined,
    };

    const loaded = loadInteriorLayout('legacy-family-default', room, storage);
    expect(loaded.find(({ id }) => id === legacyAuthored.id)?.scale)
      .toBe(authoredPlacement(legacyAuthored.assetId).scale);
    expect(loaded.find(({ id }) => id === customWithoutScale.id)?.scale).toBe(1);
  });

  it('does not infer a family transform when saving custom furniture without an explicit marker', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const custom = {
      id: 'custom-no-transform-marker', kind: 'decor' as const, assetId: 207, point: { x: 3, y: 3 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
    };

    saveInteriorLayout('custom-no-transform-marker', [custom], storage);

    expect(JSON.parse(memory.get('pixelworld:interior-layout:custom-no-transform-marker')!)
      .furniture[0]).toMatchObject({ scale: 1, rotation: 0 });
  });

  it('round-trips explicit v5 scale and rotation even when the asset cannot rotate in the editor', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const explicit = {
      id: 'explicit-v5-chair', kind: 'chair' as const, assetId: 101, point: { x: 4, y: 4 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const,
      scale: 3 as const, rotation: 270 as const, blocksNavigation: false,
    };

    saveInteriorLayout('explicit-v5-transform', [explicit], storage);
    expect(loadInteriorLayout('explicit-v5-transform', room, storage)[0]).toMatchObject({
      scale: 3,
      rotation: 270,
    });
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
