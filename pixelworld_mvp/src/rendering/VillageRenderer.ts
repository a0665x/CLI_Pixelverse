import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import type { GridPoint, TerrainArea, WorldBuilding, WorldDefinition } from '../world/types';
import { WORLD_ATLAS, WORLD_ATLAS_FALLBACK_KEY } from './assetManifest';
import {
  BUILDING_REGION_SETS,
  punyFrameIndex,
  type PunyRegionName,
} from './punyVillageAtlas';
import {
  buildingForegroundGeometry,
  type PixelRect,
  type RenderedForeground,
  type VillageForegroundKind,
} from './buildingForeground';

export const VILLAGE_LAYER = {
  grass: 0,
  roads: 1,
  waterAndDecorations: 2,
  wallsAndThresholds: 3,
  trunksAndWorkZones: 4,
  foregrounds: 5,
  signboards: 6,
} as const;

type VillageLayerName = keyof typeof VILLAGE_LAYER;

export interface AtlasTileCommand {
  primitive: 'atlas';
  layer: VillageLayerName;
  region: PunyRegionName;
  x: number;
  y: number;
  depth: number;
  scale?: number;
  flipX?: boolean;
  tint?: number;
  originX?: number;
  originY?: number;
  buildingId?: string;
  buildingRole?: 'roof' | 'wall' | 'door' | 'door-frame' | 'threshold' | 'signboard';
  sceneryRole?: 'river' | 'bridge' | 'crop' | 'pasture' | 'fence' | 'prop';
  foregroundKind?: VillageForegroundKind;
  foregroundGroup?: string;
}

export interface PlannedForeground {
  kind: VillageForegroundKind;
  groupId: string;
  buildingId?: string;
  bounds: PixelRect;
  baselineY: number;
}

export interface VillageRenderPlan {
  commands: AtlasTileCommand[];
  roadTiles: GridPoint[];
  buildingTiles: AtlasTileCommand[];
  foregrounds: PlannedForeground[];
  hitRegions: Array<{ buildingId: string; bounds: PixelRect }>;
}

export interface BuildingHitRegion {
  buildingId: string;
  bounds: Phaser.Geom.Rectangle;
  object: Phaser.GameObjects.Zone;
}

export interface RenderedVillage {
  foregrounds: RenderedForeground[];
  roadTiles: GridPoint[];
  buildingTiles: AtlasTileCommand[];
  hitRegions: BuildingHitRegion[];
}

const tilePosition = (point: GridPoint) => ({ x: point.x * TILE_SIZE, y: point.y * TILE_SIZE });

function pointsInArea(area: TerrainArea): GridPoint[] {
  const points: GridPoint[] = [];
  for (let y = area.bounds.y; y < area.bounds.y + area.bounds.height; y += 1) {
    for (let x = area.bounds.x; x < area.bounds.x + area.bounds.width; x += 1) points.push({ x, y });
  }
  return points;
}

const gridKey = ({ x, y }: GridPoint): string => `${x},${y}`;

function roadRegion(point: GridPoint, roads: Set<string>, plazas: Set<string>): PunyRegionName {
  if (plazas.has(gridKey(point))) return 'dirtPlaza';
  const left = roads.has(`${point.x - 1},${point.y}`);
  const right = roads.has(`${point.x + 1},${point.y}`);
  const up = roads.has(`${point.x},${point.y - 1}`);
  const down = roads.has(`${point.x},${point.y + 1}`);
  const horizontal = left || right;
  const vertical = up || down;
  if (horizontal && vertical) return 'dirtJunction';
  if (horizontal) return left && right ? 'dirtHorizontal' : left ? 'dirtHorizontalRight' : 'dirtHorizontalLeft';
  if (vertical) return up && down ? 'dirtVertical' : up ? 'dirtVerticalBottom' : 'dirtVerticalTop';
  return 'dirtCenter';
}

function tileCommand(
  layer: VillageLayerName,
  region: PunyRegionName,
  point: GridPoint,
  depth: number,
  extras: Partial<AtlasTileCommand> = {},
): AtlasTileCommand {
  const position = tilePosition(point);
  return { primitive: 'atlas', layer, region, ...position, depth, ...extras };
}

function buildingCommands(building: WorldBuilding): {
  tiles: AtlasTileCommand[];
  foregrounds: PlannedForeground[];
} {
  const style = BUILDING_REGION_SETS[building.themeId];
  if (!style) throw new Error(`[pixelworld] missing Puny building regions for ${building.id}`);
  const frontY = (building.bounds.y + building.bounds.height) * TILE_SIZE;
  const geometry = buildingForegroundGeometry(building, TILE_SIZE);
  const roofGeometry = geometry.find(({ kind }) => kind === 'roof')!;
  const doorGeometry = geometry.find(({ kind }) => kind === 'door-frame')!;
  const roofGroup = `roof:${building.id}`;
  const doorGroup = `door:${building.id}`;
  const tiles: AtlasTileCommand[] = [];
  const roofRows = [
    [style.roofTopCorner, style.roofTop],
    [style.roofMiddleCorner, style.roofMiddle],
    [style.roofEaveCorner, style.roofEave],
  ] as const;

  roofRows.forEach(([corner, fill], localY) => {
    for (let localX = 0; localX < building.bounds.width; localX += 1) {
      const edge = localX === 0 || localX === building.bounds.width - 1;
      tiles.push(tileCommand(
        'foregrounds', edge ? corner : fill,
        { x: building.bounds.x + localX, y: building.bounds.y + localY },
        roofGeometry.baselineY,
        {
          buildingId: building.id,
          buildingRole: 'roof',
          foregroundKind: 'roof',
          foregroundGroup: roofGroup,
          flipX: localX === building.bounds.width - 1,
          tint: style.tint,
        },
      ));
    }
  });

  for (let localY = 3; localY < building.bounds.height; localY += 1) {
    for (let localX = 0; localX < building.bounds.width; localX += 1) {
      const point = { x: building.bounds.x + localX, y: building.bounds.y + localY };
      const isDoor = point.x === building.entrance.threshold.x && point.y === building.entrance.threshold.y;
      const edge = localX === 0 || localX === building.bounds.width - 1;
      tiles.push(tileCommand(
        'wallsAndThresholds', isDoor ? style.door : edge ? style.wallCorner : style.wall,
        point,
        isDoor ? -699 : -700,
        {
          buildingId: building.id,
          buildingRole: isDoor ? 'door' : 'wall',
          flipX: localX === building.bounds.width - 1,
          tint: style.tint,
        },
      ));
    }
  }

  tiles.push(
    tileCommand('wallsAndThresholds', 'doorThreshold', building.entrance.threshold, -710, {
      buildingId: building.id,
      buildingRole: 'threshold',
    }),
    tileCommand('foregrounds', style.doorFrame, building.entrance.threshold, doorGeometry.baselineY, {
      buildingId: building.id,
      buildingRole: 'door-frame',
      foregroundKind: 'door-frame',
      foregroundGroup: doorGroup,
      tint: style.tint,
    }),
    tileCommand(
      'signboards', style.signboard,
      { x: building.bounds.x + building.bounds.width - 2, y: building.bounds.y + 3 },
      frontY + 1,
      { buildingId: building.id, buildingRole: 'signboard' },
    ),
  );
  return {
    tiles,
    foregrounds: [
      { kind: 'roof', groupId: roofGroup, buildingId: building.id, bounds: roofGeometry.bounds, baselineY: roofGeometry.baselineY },
      { kind: 'door-frame', groupId: doorGroup, buildingId: building.id, bounds: doorGeometry.bounds, baselineY: doorGeometry.baselineY },
    ],
  };
}

function waterRegion(point: GridPoint, water: Set<string>): PunyRegionName {
  const left = water.has(`${point.x - 1},${point.y}`);
  const right = water.has(`${point.x + 1},${point.y}`);
  const up = water.has(`${point.x},${point.y - 1}`);
  const down = water.has(`${point.x},${point.y + 1}`);
  if (!up && !left) return 'waterTopLeft';
  if (!up && !right) return 'waterTopRight';
  if (!down && !left) return 'waterBottomLeft';
  if (!down && !right) return 'waterBottomRight';
  if (!up) return 'waterEdgeTop';
  if (!down) return 'waterEdgeBottom';
  if (!left) return 'waterEdgeLeft';
  if (!right) return 'waterEdgeRight';
  return 'waterCenter';
}

export function buildVillageRenderPlan(world: WorldDefinition): VillageRenderPlan {
  const commands: AtlasTileCommand[] = [];
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      commands.push(tileCommand('grass', (x * 7 + y * 11) % 13 === 0 ? 'grassTufts' : 'grassPlain', { x, y }, -1_000));
    }
  }

  const roadTiles = world.terrain
    .filter(({ kind }) => kind === 'road' || kind === 'plaza')
    .flatMap(pointsInArea);
  const uniqueRoadTiles = [...new Map(roadTiles.map((point) => [`${point.x},${point.y}`, point])).values()];
  const roadSet = new Set(uniqueRoadTiles.map(gridKey));
  const plazaSet = new Set(world.terrain.filter(({ kind }) => kind === 'plaza').flatMap(pointsInArea).map(gridKey));
  uniqueRoadTiles.forEach((point) => commands.push(tileCommand('roads', roadRegion(point, roadSet, plazaSet), point, -900)));

  const riverPoints = [...new Map(world.scenery.river
    .flatMap((bounds) => pointsInArea({ kind: 'grass', cost: 1, bounds }))
    .map((point) => [gridKey(point), point])).values()];
  const riverSet = new Set(riverPoints.map(gridKey));
  riverPoints.forEach((point) => commands.push(tileCommand(
    'waterAndDecorations', waterRegion(point, riverSet), point, -800, { sceneryRole: 'river' },
  )));
  for (const pasture of world.scenery.pastures) {
    for (const point of pointsInArea({ kind: 'grass', cost: 2, bounds: pasture })) {
      if ((point.x + point.y) % 3 === 0) commands.push(tileCommand(
        'waterAndDecorations', 'grassFlowers', point, -805, { sceneryRole: 'pasture' },
      ));
    }
  }
  for (const field of world.scenery.cropFields) {
    for (const point of pointsInArea({ kind: 'grass', cost: 2, bounds: field })) {
      commands.push(tileCommand('waterAndDecorations', 'flowerPink', point, -790, { sceneryRole: 'crop' }));
    }
  }
  for (const bed of world.scenery.flowerBeds) {
    for (let y = bed.y; y < bed.y + bed.height; y += 1) {
      for (let x = bed.x; x < bed.x + bed.width; x += 1) {
        commands.push(tileCommand('waterAndDecorations', 'flowerPink', { x, y }, -790, { sceneryRole: 'prop' }));
      }
    }
  }
  for (const bridge of world.scenery.bridges) {
    for (const point of pointsInArea({ kind: 'road', cost: 1, bounds: bridge })) {
      commands.push(tileCommand('waterAndDecorations', 'brownWall', point, -760, { sceneryRole: 'bridge' }));
    }
  }

  const foregrounds: PlannedForeground[] = [];
  for (const tree of world.scenery.trees) {
    const footY = (tree.trunk.y + 1) * TILE_SIZE;
    const canopyGroup = `canopy:${tree.id}`;
    const canopyRegions = ['treeCanopyLeft', 'treeCanopy', 'treeCanopyRight'] as const;
    const trunkRegions = ['treeTrunkLeft', 'treeTrunk', 'treeTrunkRight'] as const;
    canopyRegions.forEach((region, index) => commands.push(tileCommand(
      'foregrounds', region, { x: tree.trunk.x + index - 1, y: tree.trunk.y - 1 }, footY,
      { foregroundKind: 'canopy', foregroundGroup: canopyGroup },
    )));
    trunkRegions.forEach((region, index) => commands.push(tileCommand(
      'foregrounds', region, { x: tree.trunk.x + index - 1, y: tree.trunk.y }, footY,
      { foregroundKind: 'canopy', foregroundGroup: canopyGroup },
    )));
    foregrounds.push({
      kind: 'canopy',
      groupId: canopyGroup,
      bounds: {
        x: (tree.trunk.x - 1) * TILE_SIZE,
        y: (tree.trunk.y - 1) * TILE_SIZE,
        width: 3 * TILE_SIZE,
        height: 2 * TILE_SIZE,
      },
      baselineY: footY,
    });
  }

  // The obstacle border doubles as a compact GBA-style village fence.
  for (let x = 0; x < world.width; x += 1) {
    commands.push(tileCommand('waterAndDecorations', 'fence', { x, y: 0 }, -780, { sceneryRole: 'fence' }));
    if (x < 18 || x > 21) commands.push(tileCommand('waterAndDecorations', 'fence', { x, y: world.height - 1 }, -780, { sceneryRole: 'fence' }));
  }
  for (let y = 1; y < world.height - 1; y += 1) {
    commands.push(tileCommand('waterAndDecorations', 'fence', { x: 0, y }, -780, { sceneryRole: 'fence' }));
    commands.push(tileCommand('waterAndDecorations', 'fence', { x: world.width - 1, y }, -780, { sceneryRole: 'fence' }));
  }

  const buildingTiles: AtlasTileCommand[] = [];
  for (const building of world.buildings) {
    const built = buildingCommands(building);
    buildingTiles.push(...built.tiles);
    foregrounds.push(...built.foregrounds);
  }
  commands.push(...buildingTiles);

  commands.push(
    tileCommand('trunksAndWorkZones', 'signboard', { x: 8, y: 7 }, 7 * TILE_SIZE + 12, { sceneryRole: 'prop' }),
    tileCommand('trunksAndWorkZones', 'bench', { x: 13, y: 12 }, 12 * TILE_SIZE + 12, { sceneryRole: 'prop' }),
    tileCommand('trunksAndWorkZones', 'bench', { x: 16, y: 12 }, 12 * TILE_SIZE + 12, { sceneryRole: 'prop' }),
    tileCommand('trunksAndWorkZones', 'supplyCrate', { x: 24, y: 7 }, 7 * TILE_SIZE + 12, { sceneryRole: 'prop' }),
    tileCommand('trunksAndWorkZones', 'supplyCrate', { x: 37, y: 17 }, 17 * TILE_SIZE + 12, { sceneryRole: 'prop' }),
    tileCommand('waterAndDecorations', 'rock', { x: 21, y: 18 }, -770, { sceneryRole: 'prop' }),
  );

  return {
    commands,
    roadTiles: uniqueRoadTiles,
    buildingTiles,
    foregrounds,
    hitRegions: world.buildings.map((building) => ({
      buildingId: building.id,
      bounds: {
        x: building.bounds.x * TILE_SIZE,
        y: building.bounds.y * TILE_SIZE,
        width: building.bounds.width * TILE_SIZE,
        height: building.bounds.height * TILE_SIZE,
      },
    })),
  };
}

export class VillageRenderer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly atlasTextureKey: string = WORLD_ATLAS.key,
  ) {}

  render(world: WorldDefinition): RenderedVillage {
    const plan = buildVillageRenderPlan(world);
    const groupedImages = new Map<string, Phaser.GameObjects.Image[]>();
    for (const command of plan.commands) {
      const frame = this.atlasTextureKey === WORLD_ATLAS_FALLBACK_KEY ? undefined : punyFrameIndex(command.region);
      const image = this.scene.add.image(command.x, command.y, this.atlasTextureKey, frame)
        .setOrigin(0, 0)
        .setDepth(command.depth);
      if (command.scale) image.setScale(command.scale);
      if (command.flipX) image.setFlipX(true);
      if (command.tint) image.setTint(command.tint);
      if (!command.foregroundGroup) continue;
      const group = groupedImages.get(command.foregroundGroup) ?? [];
      group.push(image);
      groupedImages.set(command.foregroundGroup, group);
    }
    const foregrounds = plan.foregrounds.map((foreground): RenderedForeground => {
      const children = groupedImages.get(foreground.groupId) ?? [];
      const groupObject: RenderedForeground['object'] = {
        alpha: 1,
        depth: foreground.baselineY,
        setAlpha(alpha: number) {
          groupObject.alpha = alpha;
          children.forEach((child) => child.setAlpha(alpha));
          return groupObject;
        },
        setDepth(depth: number) {
          groupObject.depth = depth;
          children.forEach((child) => child.setDepth(depth));
          return groupObject;
        },
      };
      return {
        object: groupObject,
        bounds: { ...foreground.bounds } as Phaser.Geom.Rectangle,
        baselineY: foreground.baselineY,
        kind: foreground.kind,
      };
    });
    const hitRegions = plan.hitRegions.map(({ buildingId, bounds }): BuildingHitRegion => ({
      buildingId,
      bounds: { ...bounds } as Phaser.Geom.Rectangle,
      object: this.scene.add.zone(bounds.x, bounds.y, bounds.width, bounds.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true }),
    }));
    return { foregrounds, roadTiles: plan.roadTiles, buildingTiles: plan.buildingTiles, hitRegions };
  }
}
