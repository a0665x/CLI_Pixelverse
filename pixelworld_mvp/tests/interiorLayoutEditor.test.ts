import { describe, expect, it } from 'vitest';
import {
  addFurniture,
  canPlaceFurniture,
  furnitureCells,
  loadInteriorLayout,
  moveFurniture,
  placementDiagnostic,
  resizeFurniture,
  rotateFurniture,
  saveInteriorLayout,
  FURNITURE_PALETTE,
} from '../src/rendering/interiorLayoutEditor';
import { modernOfficeKindForFurniture } from '../src/rendering/InteriorCutawaySystem';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';

describe('interior furniture editor model', () => {
  const room = INTERIOR_DEFINITIONS['rest-cabin'];
  const normalizedRoomLayout = () => loadInteriorLayout('unsaved-test-house', room, undefined);

  it('moves furniture inside the room and allows visual overlap', () => {
    const layout = normalizedRoomLayout();
    expect(moveFurniture(room, layout, 'rest-sofa-a', { x: 6, y: 1 }).find(({ id }) => id === 'rest-sofa-a')?.point)
      .toEqual({ x: 6, y: 1 });
    expect(moveFurniture(room, layout, 'rest-sofa-a', { x: -1, y: 2 })).toEqual(layout);

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
    expect(JSON.parse(memory.get('pixelworld:interior-layout:rest-cabin-house')!)).toMatchObject({ version: 3 });
    expect(loadInteriorLayout('rest-cabin-house', room, storage)).toEqual(
      layout.map((item) => ({ ...item, scale: item.scale ?? 1, rotation: item.rotation ?? 0 })),
    );
  });

  it('migrates v2 facing into rotation and retains catalog assets', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const item = { ...room.furniture[0]!, facing: 'right' as const, assetId: 225 };
    memory.set('pixelworld:interior-layout:migrate-house', JSON.stringify({ version: 2, furniture: [item] }));
    const loaded = loadInteriorLayout('migrate-house', room, storage);
    expect(loaded[0]).toMatchObject({ rotation: 90, assetId: 225 });
    saveInteriorLayout('migrate-house', loaded, storage);
    expect(JSON.parse(memory.get('pixelworld:interior-layout:migrate-house')!)).toMatchObject({
      version: 3,
      furniture: [{ rotation: 90, assetId: 225 }],
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

  it('migrates legacy arrays and falls back from corrupted saved layouts', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
    };
    const key = 'pixelworld:interior-layout:legacy-house';
    memory.set(key, JSON.stringify(room.furniture));
    expect(loadInteriorLayout('legacy-house', room, storage).every(({ scale }) => scale === 1)).toBe(true);
    memory.set(key, JSON.stringify({ version: 99, furniture: [] }));
    expect(loadInteriorLayout('legacy-house', room, storage)).toEqual(normalizedRoomLayout());
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
});
