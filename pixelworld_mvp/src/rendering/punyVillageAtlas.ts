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
  dirtHorizontal: region(5, 3),
  dirtHorizontalLeft: region(4, 3),
  dirtHorizontalRight: region(6, 3),
  dirtVertical: region(3, 1),
  dirtVerticalTop: region(3, 0),
  dirtVerticalBottom: region(3, 2),
  dirtJunction: region(5, 1),
  dirtPlaza: region(7, 1),
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
  signboard: region(8, 31),
  bench: region(7, 31),
  supplyCrate: region(2, 29),
  // Two adjoining deck cells from Puny World's original CC0 timber structure.
  // They read as one continuous east-west crossing over the two-cell river.
  timberBridgeLeft: region(22, 27),
  timberBridgeRight: region(23, 27),

  brownRoofTopCorner: region(4, 26),
  brownRoofTop: region(5, 26),
  brownRoofMiddleCorner: region(4, 27),
  brownRoofMiddle: region(5, 27),
  brownRoofEaveCorner: region(4, 28),
  brownRoofEave: region(5, 28),
  brownWallCorner: region(7, 29),
  brownWall: region(4, 29),
  brownDoor: region(5, 30),
  brownDoorFrame: region(4, 30),

  tealRoofTopCorner: region(4, 33),
  tealRoofTop: region(5, 33),
  tealRoofMiddleCorner: region(4, 34),
  tealRoofMiddle: region(5, 34),
  tealRoofEaveCorner: region(4, 35),
  tealRoofEave: region(5, 35),
  tealWallCorner: region(7, 36),
  tealWall: region(4, 36),
  tealDoor: region(5, 37),
  tealDoorFrame: region(4, 37),

  redRoofTopCorner: region(14, 33),
  redRoofTop: region(15, 33),
  redRoofMiddleCorner: region(14, 34),
  redRoofMiddle: region(15, 34),
  redRoofEaveCorner: region(14, 35),
  redRoofEave: region(15, 35),
  redWallCorner: region(17, 36),
  redWall: region(14, 36),
  redDoor: region(15, 37),
  redDoorFrame: region(14, 37),
} as const satisfies Record<string, PunyAtlasRegion>;

export type PunyRegionName = keyof typeof PUNY_REGIONS;

export interface BuildingRegionSet {
  roofTopCorner: PunyRegionName;
  roofTop: PunyRegionName;
  roofMiddleCorner: PunyRegionName;
  roofMiddle: PunyRegionName;
  roofEaveCorner: PunyRegionName;
  roofEave: PunyRegionName;
  wallCorner: PunyRegionName;
  wall: PunyRegionName;
  door: PunyRegionName;
  doorFrame: PunyRegionName;
  signboard: PunyRegionName;
  tint: number;
}

export const BUILDING_REGION_SETS: Record<string, BuildingRegionSet> = {
  'rest-cabin': {
    roofTopCorner: 'brownRoofTopCorner', roofTop: 'brownRoofTop',
    roofMiddleCorner: 'brownRoofMiddleCorner', roofMiddle: 'brownRoofMiddle',
    roofEaveCorner: 'brownRoofEaveCorner', roofEave: 'brownRoofEave',
    wallCorner: 'brownWallCorner', wall: 'brownWall',
    door: 'brownDoor', doorFrame: 'brownDoorFrame',
    signboard: 'signboard', tint: 0xffe6b8,
  },
  'research-library': {
    roofTopCorner: 'tealRoofTopCorner', roofTop: 'tealRoofTop',
    roofMiddleCorner: 'tealRoofMiddleCorner', roofMiddle: 'tealRoofMiddle',
    roofEaveCorner: 'tealRoofEaveCorner', roofEave: 'tealRoofEave',
    wallCorner: 'tealWallCorner', wall: 'tealWall',
    door: 'tealDoor', doorFrame: 'tealDoorFrame',
    signboard: 'signboard', tint: 0xc7e7ff,
  },
  'maker-workshop': {
    roofTopCorner: 'redRoofTopCorner', roofTop: 'redRoofTop',
    roofMiddleCorner: 'redRoofMiddleCorner', roofMiddle: 'redRoofMiddle',
    roofEaveCorner: 'redRoofEaveCorner', roofEave: 'redRoofEave',
    wallCorner: 'redWallCorner', wall: 'redWall',
    door: 'redDoor', doorFrame: 'redDoorFrame',
    signboard: 'signboard', tint: 0xffc8a8,
  },
  'collaboration-barn': {
    roofTopCorner: 'tealRoofTopCorner', roofTop: 'tealRoofTop',
    roofMiddleCorner: 'tealRoofMiddleCorner', roofMiddle: 'tealRoofMiddle',
    roofEaveCorner: 'tealRoofEaveCorner', roofEave: 'tealRoofEave',
    wallCorner: 'brownWallCorner', wall: 'brownWall',
    door: 'brownDoor', doorFrame: 'brownDoorFrame',
    signboard: 'signboard', tint: 0xbfe2a2,
  },
};

const ATLAS_COLUMNS = 27;

export function punyFrameIndex(name: PunyRegionName): number {
  const source = PUNY_REGIONS[name];
  return source.y / TILE_SIZE * ATLAS_COLUMNS + source.x / TILE_SIZE;
}
