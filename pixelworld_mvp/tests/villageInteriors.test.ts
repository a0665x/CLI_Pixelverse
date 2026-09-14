import { describe, expect, it } from 'vitest';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';
import { interiorInteractionPoint, interiorPath } from '../src/rendering/interiorMotion';
import { readInteriorLayout, saveInteriorLayout } from '../src/rendering/interiorLayoutEditor';
import { BUILDING_PALETTES } from '../src/rendering/villageArtDirection';

describe('authored RPG village interiors', () => {
  it.each(WORLD_DEFINITION.buildings)('$id has a legal furnished plan with accessible work points', building => {
    const room = interiorDefinitionForBuilding(building);
    expect(BUILDING_PALETTES[building.id]).toBeDefined();
    expect(room.furniture.length).toBeGreaterThanOrEqual(6);
    expect(officeLayoutIssues(room)).toEqual([]);
    const door = { x: Math.floor(room.width / 2), y: room.height - 1 };
    for (const item of room.furniture.filter(item => item.supportedActions.length)) {
      const target = interiorInteractionPoint(room, item);
      expect(interiorPath(room, door, target, item.id).at(-1), item.id).toEqual(target);
    }
  });
  it('gives each building a different arrangement even within the same theme', () => {
    const arrangements = WORLD_DEFINITION.buildings.map(building => JSON.stringify(
      interiorDefinitionForBuilding(building).furniture.map(({ assetId, point }) => [assetId, point]),
    ));
    expect(new Set(arrangements).size).toBe(WORLD_DEFINITION.buildings.length);
  });
  it('preserves user saved layouts rather than replacing them when the authored defaults change', () => {
    const building = WORLD_DEFINITION.buildings.find(({ id }) => id === 'rest-cabin')!;
    const room = interiorDefinitionForBuilding(building);
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    saveInteriorLayout(building.id, room.furniture, storage);
    const before = [...memory.entries()];
    const changedDefaults = { ...room, furniture: room.furniture.slice(1) };
    const restored = readInteriorLayout(building.id, changedDefaults, storage);
    expect(restored.layout.map(item => item.id)).toContain(room.furniture[0]!.id);
    expect([...memory.entries()]).toEqual(before);
  });
});

it('projects bundled furniture alpha masks with their actual source image dimensions', async () => {
  const { VILLAGE_FURNITURE_CATALOG, VILLAGE_FURNITURE_MASKS } = await import('../src/rendering/villageFurnitureCatalog');
  const { transformedFurnitureMaskCells } = await import('../src/rendering/furnitureAlphaMasks');
  for (const asset of VILLAGE_FURNITURE_CATALOG) {
    const item = { id: 'source-geometry', assetId: asset.id, kind: 'decor' as const,
      point: { x: 4, y: 4 }, facing: 'down' as const, supportedActions: [], icon: 'generic' as const };
    expect(() => transformedFurnitureMaskCells(item, VILLAGE_FURNITURE_MASKS.get(asset.id)!, { x: .2, y: .2 })).not.toThrow();
    expect(transformedFurnitureMaskCells(item, VILLAGE_FURNITURE_MASKS.get(asset.id)!, { x: .2, y: .2 }).length).toBeGreaterThan(0);
  }
});
