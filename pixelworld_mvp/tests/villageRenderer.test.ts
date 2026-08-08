import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/game/constants';
import {
  BUILDING_REGION_SETS,
  PUNY_REGIONS,
  type PunyRegionName,
} from '../src/rendering/punyVillageAtlas';
import { buildVillageRenderPlan, VILLAGE_LAYER } from '../src/rendering/VillageRenderer';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const pointKey = (x: number, y: number) => `${x},${y}`;

describe('Puny village renderer contracts', () => {
  it('defines named, 16-pixel-aligned source regions for every visual family', () => {
    const required: PunyRegionName[] = [
      'grassPlain', 'grassTufts', 'dirtCenter', 'dirtEdgeLeft', 'dirtEdgeRight',
      'waterCenter', 'waterEdgeTop', 'treeTrunk', 'treeCanopy', 'flowerPink',
      'rock', 'fence', 'doorThreshold', 'doorFrame', 'signboard',
    ];

    expect(Object.keys(PUNY_REGIONS)).toEqual(expect.arrayContaining(required));
    for (const region of Object.values(PUNY_REGIONS)) {
      expect(region.x % TILE_SIZE).toBe(0);
      expect(region.y % TILE_SIZE).toBe(0);
      expect(region.width % TILE_SIZE).toBe(0);
      expect(region.height % TILE_SIZE).toBe(0);
    }
  });

  it('gives every building a facade, roof, door, door frame, and signboard region', () => {
    for (const building of WORLD_DEFINITION.buildings) {
      const regions = BUILDING_REGION_SETS[building.id];
      expect(regions, building.id).toBeDefined();
      if (!regions) throw new Error(`Missing regions for ${building.id}`);
      expect(PUNY_REGIONS[regions.facade]).toBeDefined();
      expect(PUNY_REGIONS[regions.roof]).toBeDefined();
      expect(PUNY_REGIONS[regions.door]).toBeDefined();
      expect(PUNY_REGIONS[regions.doorFrame]).toBeDefined();
      expect(PUNY_REGIONS[regions.signboard]).toBeDefined();
    }
  });

  it('derives every visible road and plaza tile from world terrain', () => {
    const expected = new Set<string>();
    for (const area of WORLD_DEFINITION.terrain.filter(({ kind }) => kind === 'road' || kind === 'plaza')) {
      for (let y = area.bounds.y; y < area.bounds.y + area.bounds.height; y += 1) {
        for (let x = area.bounds.x; x < area.bounds.x + area.bounds.width; x += 1) expected.add(pointKey(x, y));
      }
    }

    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    expect(new Set(plan.roadTiles.map(({ x, y }) => pointKey(x, y)))).toEqual(expected);
  });

  it('builds only atlas-backed building shells and a foreground for each real door frame', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);

    expect(plan.buildingTiles.length).toBeGreaterThan(0);
    expect(plan.buildingTiles.every(({ primitive }) => primitive === 'atlas')).toBe(true);
    expect(plan.buildingTiles.some((tile) => tile.primitive === ('rectangle' as 'atlas'))).toBe(false);
    expect(plan.foregrounds.filter(({ kind }) => kind === 'door-frame')).toHaveLength(WORLD_DEFINITION.buildings.length);
    for (const building of WORLD_DEFINITION.buildings) {
      expect(plan.foregrounds).toContainEqual(expect.objectContaining({
        kind: 'door-frame',
        buildingId: building.id,
        tile: building.entrance.threshold,
      }));
    }
  });

  it('keeps render stages in the fixed world-depth order', () => {
    expect(VILLAGE_LAYER).toEqual({
      grass: 0,
      roads: 1,
      waterAndDecorations: 2,
      wallsAndThresholds: 3,
      trunksAndWorkZones: 4,
      foregrounds: 5,
      signboards: 6,
    });
  });
});
