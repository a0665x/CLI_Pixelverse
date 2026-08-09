import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import type { GridPoint, TerrainArea, WorldBuilding, WorldDefinition } from '../world/types';
import { SERENE_VILLAGE_ASSETS, WORLD_ATLAS, WORLD_ATLAS_FALLBACK_KEY } from './assetManifest';
import {
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
  textureKey?: string;
  frame?: number;
  x: number;
  y: number;
  depth: number;
  scale?: number;
  flipX?: boolean;
  tint?: number;
  originX?: number;
  originY?: number;
  buildingId?: string;
  buildingRole?: 'roof' | 'wall' | 'window' | 'door' | 'door-frame' | 'threshold' | 'signboard';
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
  if (horizontal) return 'dirtHorizontal';
  if (vertical) return 'dirtVertical';
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
  const houseStyle: Record<string, { row: number; column: number }> = {
    'arrival-lodge': { row: 25, column: 0 },
    'thinkers-cottage': { row: 33, column: 0 },
    'archive-library': { row: 41, column: 0 },
    'network-lab': { row: 33, column: 5 },
    'heartbeat-tower': { row: 41, column: 0 },
    'offline-dormitory': { row: 41, column: 5 },
    'maker-workshop': { row: 25, column: 5 },
    'tool-smithy': { row: 25, column: 0 },
    'awaiting-post': { row: 33, column: 0 },
    'collaboration-barn': { row: 33, column: 5 },
    'recovery-clinic': { row: 25, column: 5 },
    'rest-cabin': { row: 41, column: 5 },
  };
  const style = houseStyle[building.id] ?? houseStyle['arrival-lodge']!;
  const geometry = buildingForegroundGeometry(building, TILE_SIZE);
  const roofGeometry = geometry.find(({ kind }) => kind === 'roof')!;
  const doorGeometry = geometry.find(({ kind }) => kind === 'door-frame')!;
  const roofGroup = `roof:${building.id}`;
  const doorGroup = `door:${building.id}`;
  const tiles: AtlasTileCommand[] = [];
  const frameAt = (localX: number, localY: number): number =>
    (style.row + localY) * 19 + style.column + localX;

  for (let localY = 0; localY < 3; localY += 1) {
    for (let localX = 0; localX < building.bounds.width; localX += 1) {
      tiles.push(tileCommand(
        'foregrounds', 'grassPlain',
        { x: building.bounds.x + localX, y: building.bounds.y + localY },
        roofGeometry.baselineY,
        {
          textureKey: SERENE_VILLAGE_ASSETS.atlas.key,
          frame: frameAt(localX, localY),
          buildingId: building.id,
          buildingRole: 'roof',
          foregroundKind: 'roof',
          foregroundGroup: roofGroup,
        },
      ));
    }
  }

  const facadeY = building.bounds.y + building.bounds.height - 1;
  for (let localX = 0; localX < building.bounds.width; localX += 1) {
    const point = { x: building.bounds.x + localX, y: facadeY };
    const isDoor = point.x === building.entrance.threshold.x;
    const isWindow = localX === 1 || localX === building.bounds.width - 2;
    tiles.push(tileCommand(
      'wallsAndThresholds', 'grassPlain', point, isDoor ? -699 : -700,
      {
        textureKey: SERENE_VILLAGE_ASSETS.atlas.key,
        frame: frameAt(localX, 3),
        buildingId: building.id,
        buildingRole: isDoor ? 'door' : isWindow ? 'window' : 'wall',
      },
    ));
  }

  tiles.push(
    tileCommand('wallsAndThresholds', 'doorThreshold', building.entrance.threshold, -710, {
      buildingId: building.id,
      buildingRole: 'threshold',
    }),
    tileCommand('foregrounds', 'grassPlain', building.entrance.threshold, doorGeometry.baselineY, {
      textureKey: SERENE_VILLAGE_ASSETS.atlas.key,
      frame: frameAt(2, 3),
      buildingId: building.id,
      buildingRole: 'door-frame',
      foregroundKind: 'door-frame',
      foregroundGroup: doorGroup,
    }),
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
      commands.push(tileCommand('grass', 'grassPlain', { x, y }, -1_000));
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

  const decorationRegion = {
    bench: 'bench', signboard: 'signboard', crate: 'supplyCrate',
    rock: 'rock', flowers: 'grassFlowers',
  } as const satisfies Record<Exclude<(typeof world.scenery.decorations)[number]['kind'], 'campfire'>, PunyRegionName>;
  for (const decoration of world.scenery.decorations) {
    const depth = decoration.point.y * TILE_SIZE + 12;
    commands.push(decoration.kind === 'campfire'
      ? tileCommand('trunksAndWorkZones', 'grassPlain', decoration.point, depth, {
        textureKey: SERENE_VILLAGE_ASSETS.campfire.key, frame: 0, sceneryRole: 'prop',
      })
      : tileCommand(
        'trunksAndWorkZones', decorationRegion[decoration.kind], decoration.point, depth,
        { sceneryRole: 'prop' },
      ));
  }

  for (const pasture of world.scenery.pastures) {
    for (let x = pasture.x; x < pasture.x + pasture.width; x += 1) {
      commands.push(tileCommand('trunksAndWorkZones', 'fence', { x, y: pasture.y }, pasture.y * TILE_SIZE + 12, { sceneryRole: 'fence' }));
      commands.push(tileCommand('trunksAndWorkZones', 'fence', { x, y: pasture.y + pasture.height - 1 }, (pasture.y + pasture.height) * TILE_SIZE, { sceneryRole: 'fence' }));
    }
  }

  const foregrounds: PlannedForeground[] = [];
  for (const tree of world.scenery.trees) {
    const footY = (tree.trunk.y + 1) * TILE_SIZE;
    const canopyGroup = `canopy:${tree.id}`;
    // Columns 9-10 at rows 12-14 are one complete standalone tree. The first
    // canopy row is essential; starting at row 13 visibly shears off its crown.
    // Adjacent packed objects use different vertical bounds and must not be
    // treated as interchangeable tile variants.
    const treeColumn = 9;
    for (let localY = 0; localY < 3; localY += 1) {
      for (let localX = 0; localX < 2; localX += 1) {
        commands.push(tileCommand(
          'foregrounds', localY === 0 ? 'treeCanopy' : 'treeTrunk',
          { x: tree.trunk.x + localX - 1, y: tree.trunk.y + localY - 2 }, footY,
          {
            textureKey: SERENE_VILLAGE_ASSETS.atlas.key,
            frame: (12 + localY) * 19 + treeColumn + localX,
            foregroundKind: 'canopy', foregroundGroup: canopyGroup,
          },
        ));
      }
    }
    foregrounds.push({
      kind: 'canopy',
      groupId: canopyGroup,
      bounds: {
        x: (tree.trunk.x - 1) * TILE_SIZE,
        y: (tree.trunk.y - 2) * TILE_SIZE,
        width: 2 * TILE_SIZE,
        height: 3 * TILE_SIZE,
      },
      baselineY: footY,
    });
  }

  const buildingTiles: AtlasTileCommand[] = [];
  for (const building of world.buildings) {
    const built = buildingCommands(building);
    buildingTiles.push(...built.tiles);
    foregrounds.push(...built.foregrounds);
  }
  commands.push(...buildingTiles);

  commands.push(
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
      const textureKey = command.textureKey ?? this.atlasTextureKey;
      const frame = command.frame ?? (command.textureKey || this.atlasTextureKey === WORLD_ATLAS_FALLBACK_KEY
        ? undefined
        : punyFrameIndex(command.region));
      const image = this.scene.add.image(command.x, command.y, textureKey, frame)
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
