import { TILE_SIZE } from '../game/constants';

export interface PunyAtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const region = (column: number, row: number, width = 1, height = 1): PunyAtlasRegion => ({
  x: column * TILE_SIZE,
  y: row * TILE_SIZE,
  width: width * TILE_SIZE,
  height: height * TILE_SIZE,
});

/**
 * Curated cells from Shade's CC0 Puny World overworld sheet.
 * Coordinates deliberately remain source-pixel aligned so Phaser can select
 * the original frames without generated textures or smoothing.
 */
export const PUNY_REGIONS = {
  grassPlain: region(0, 0),
  grassTufts: region(1, 0),
  grassFlowers: region(2, 0),
  dirtCenter: region(5, 1),
  dirtEdgeLeft: region(3, 1),
  dirtEdgeRight: region(6, 1),
  dirtEdgeTop: region(5, 0),
  dirtEdgeBottom: region(5, 2),
  doorThreshold: region(5, 1),

  waterTopLeft: region(1, 10),
  waterEdgeTop: region(2, 10),
  waterTopRight: region(3, 10),
  waterEdgeLeft: region(1, 11),
  waterCenter: region(2, 11),
  waterEdgeRight: region(3, 11),
  waterBottomLeft: region(1, 12),
  waterEdgeBottom: region(2, 12),
  waterBottomRight: region(3, 12),

  treeCanopyLeft: region(0, 7),
  treeCanopy: region(1, 7),
  treeCanopyRight: region(2, 7),
  treeTrunkLeft: region(0, 8),
  treeTrunk: region(1, 8),
  treeTrunkRight: region(2, 8),
  flowerPink: region(1, 28),
  rock: region(12, 6),
  fence: region(12, 4),
  signboard: region(4, 30),
  bench: region(4, 31),
  supplyCrate: region(2, 29),
  doorFrame: region(11, 30),

  houseBrownRoof: region(5, 27),
  houseBrownFacade: region(5, 28),
  houseBrownDoor: region(8, 29),
  houseTealRoof: region(5, 33),
  houseTealFacade: region(5, 34),
  houseTealDoor: region(8, 36),
  houseRedRoof: region(15, 33),
  houseRedFacade: region(15, 34),
  houseRedDoor: region(18, 36),
} as const satisfies Record<string, PunyAtlasRegion>;

export type PunyRegionName = keyof typeof PUNY_REGIONS;

export interface BuildingRegionSet {
  roof: PunyRegionName;
  facade: PunyRegionName;
  door: PunyRegionName;
  doorFrame: PunyRegionName;
  signboard: PunyRegionName;
}

export const BUILDING_REGION_SETS: Record<string, BuildingRegionSet> = {
  'knowledge-hall': {
    roof: 'houseBrownRoof',
    facade: 'houseBrownFacade',
    door: 'houseBrownDoor',
    doorFrame: 'doorFrame',
    signboard: 'signboard',
  },
  'build-workshop': {
    roof: 'houseTealRoof',
    facade: 'houseTealFacade',
    door: 'houseTealDoor',
    doorFrame: 'doorFrame',
    signboard: 'signboard',
  },
  'signal-station': {
    roof: 'houseRedRoof',
    facade: 'houseRedFacade',
    door: 'houseRedDoor',
    doorFrame: 'doorFrame',
    signboard: 'signboard',
  },
};

const ATLAS_COLUMNS = 27;

export function punyFrameIndex(name: PunyRegionName): number {
  const source = PUNY_REGIONS[name];
  return source.y / TILE_SIZE * ATLAS_COLUMNS + source.x / TILE_SIZE;
}
