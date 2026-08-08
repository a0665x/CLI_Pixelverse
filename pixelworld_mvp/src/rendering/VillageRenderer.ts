import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import type { GridPoint, TerrainArea, WorldBuilding, WorldDefinition } from '../world/types';
import { WORLD_ATLAS } from './assetManifest';
import {
  BUILDING_REGION_SETS,
  punyFrameIndex,
  type PunyRegionName,
} from './punyVillageAtlas';
import {
  buildingForegroundGeometry,
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
  originX?: number;
  originY?: number;
  buildingId?: string;
  foregroundKind?: VillageForegroundKind;
}

export interface PlannedForeground {
  kind: VillageForegroundKind;
  buildingId?: string;
  tile: GridPoint;
  baselineY: number;
}

export interface VillageRenderPlan {
  commands: AtlasTileCommand[];
  roadTiles: GridPoint[];
  buildingTiles: AtlasTileCommand[];
  foregrounds: PlannedForeground[];
}

export interface RenderedVillage {
  foregrounds: RenderedForeground[];
  roadTiles: GridPoint[];
  buildingTiles: AtlasTileCommand[];
}

const tilePosition = (point: GridPoint) => ({ x: point.x * TILE_SIZE, y: point.y * TILE_SIZE });

function pointsInArea(area: TerrainArea): GridPoint[] {
  const points: GridPoint[] = [];
  for (let y = area.bounds.y; y < area.bounds.y + area.bounds.height; y += 1) {
    for (let x = area.bounds.x; x < area.bounds.x + area.bounds.width; x += 1) points.push({ x, y });
  }
  return points;
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
  const style = BUILDING_REGION_SETS[building.id];
  if (!style) throw new Error(`[pixelworld] missing Puny building regions for ${building.id}`);
  const frontY = (building.bounds.y + building.bounds.height) * TILE_SIZE;
  const centerX = building.entrance.threshold.x * TILE_SIZE + TILE_SIZE / 2;
  const roofBaseline = buildingForegroundGeometry(building, TILE_SIZE).find(({ kind }) => kind === 'roof')!.baselineY;
  const doorBaseline = buildingForegroundGeometry(building, TILE_SIZE).find(({ kind }) => kind === 'door-frame')!.baselineY;
  const common = {
    layer: 'foregrounds' as const,
    primitive: 'atlas' as const,
    originX: 0.5,
    originY: 1,
    scale: 4,
    depth: roofBaseline,
    buildingId: building.id,
    foregroundKind: 'roof' as const,
  };
  const tiles: AtlasTileCommand[] = [
    { ...common, region: style.roof, x: centerX - 44, y: frontY },
    { ...common, region: style.door, x: centerX, y: frontY },
    { ...common, region: style.facade, x: centerX + 44, y: frontY },
    tileCommand('wallsAndThresholds', 'doorThreshold', building.entrance.threshold, -690, { buildingId: building.id }),
    {
      primitive: 'atlas', layer: 'foregrounds', region: style.doorFrame,
      x: centerX, y: frontY, originX: 0.5, originY: 1, scale: 2,
      depth: doorBaseline, buildingId: building.id, foregroundKind: 'door-frame',
    },
    {
      primitive: 'atlas', layer: 'signboards', region: style.signboard,
      x: centerX + 24, y: frontY - 8, originX: 0.5, originY: 1,
      depth: doorBaseline + 1, buildingId: building.id,
    },
  ];
  return {
    tiles,
    foregrounds: [
      { kind: 'roof', buildingId: building.id, tile: { ...building.entrance.threshold }, baselineY: roofBaseline },
      { kind: 'door-frame', buildingId: building.id, tile: { ...building.entrance.threshold }, baselineY: doorBaseline },
    ],
  };
}

function pondRegion(x: number, y: number, width: number, height: number): PunyRegionName {
  const horizontal = x === 0 ? 'Left' : x === width - 1 ? 'Right' : '';
  if (y === 0) return horizontal ? (`waterTop${horizontal}`) as PunyRegionName : 'waterEdgeTop';
  if (y === height - 1) return horizontal ? (`waterBottom${horizontal}`) as PunyRegionName : 'waterEdgeBottom';
  if (horizontal === 'Left') return 'waterEdgeLeft';
  if (horizontal === 'Right') return 'waterEdgeRight';
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
  uniqueRoadTiles.forEach((point) => commands.push(tileCommand('roads', 'dirtCenter', point, -900)));

  const pond = world.scenery.pond;
  for (let y = 0; y < pond.height; y += 1) {
    for (let x = 0; x < pond.width; x += 1) {
      commands.push(tileCommand(
        'waterAndDecorations',
        pondRegion(x, y, pond.width, pond.height),
        { x: pond.x + x, y: pond.y + y },
        -800,
      ));
    }
  }
  for (const bed of world.scenery.flowerBeds) {
    for (let y = bed.y; y < bed.y + bed.height; y += 1) {
      for (let x = bed.x; x < bed.x + bed.width; x += 1) {
        commands.push(tileCommand('waterAndDecorations', 'flowerPink', { x, y }, -790));
      }
    }
  }

  const foregrounds: PlannedForeground[] = [];
  for (const tree of world.scenery.trees) {
    const footY = (tree.trunk.y + 1) * TILE_SIZE;
    const canopyRegions = ['treeCanopyLeft', 'treeCanopy', 'treeCanopyRight'] as const;
    const trunkRegions = ['treeTrunkLeft', 'treeTrunk', 'treeTrunkRight'] as const;
    canopyRegions.forEach((region, index) => commands.push(tileCommand(
      'foregrounds', region, { x: tree.trunk.x + index - 1, y: tree.trunk.y - 1 }, footY,
      { foregroundKind: 'canopy' },
    )));
    trunkRegions.forEach((region, index) => commands.push(tileCommand(
      'foregrounds', region, { x: tree.trunk.x + index - 1, y: tree.trunk.y }, footY,
      { foregroundKind: 'canopy' },
    )));
    foregrounds.push({ kind: 'canopy', tile: { ...tree.trunk }, baselineY: footY });
  }

  // The obstacle border doubles as a compact GBA-style village fence.
  for (let x = 0; x < world.width; x += 1) {
    commands.push(tileCommand('waterAndDecorations', 'fence', { x, y: 0 }, -780));
    if (x < 18 || x > 21) commands.push(tileCommand('waterAndDecorations', 'fence', { x, y: world.height - 1 }, -780));
  }
  for (let y = 1; y < world.height - 1; y += 1) {
    commands.push(tileCommand('waterAndDecorations', 'fence', { x: 0, y }, -780));
    commands.push(tileCommand('waterAndDecorations', 'fence', { x: world.width - 1, y }, -780));
  }

  const buildingTiles: AtlasTileCommand[] = [];
  for (const building of world.buildings) {
    const built = buildingCommands(building);
    buildingTiles.push(...built.tiles);
    foregrounds.push(...built.foregrounds);
  }
  commands.push(...buildingTiles);

  commands.push(
    tileCommand('trunksAndWorkZones', 'signboard', { x: 10, y: 14 }, 14 * TILE_SIZE + 12),
    tileCommand('trunksAndWorkZones', 'bench', { x: 20, y: 17 }, 17 * TILE_SIZE + 12),
    tileCommand('trunksAndWorkZones', 'supplyCrate', { x: 34, y: 14 }, 14 * TILE_SIZE + 12),
    tileCommand('waterAndDecorations', 'rock', { x: 36, y: 18 }, -770),
  );

  return { commands, roadTiles: uniqueRoadTiles, buildingTiles, foregrounds };
}

export class VillageRenderer {
  constructor(private readonly scene: Phaser.Scene) {}

  render(world: WorldDefinition): RenderedVillage {
    const plan = buildVillageRenderPlan(world);
    const foregrounds: RenderedForeground[] = [];
    for (const command of plan.commands) {
      const image = this.scene.add.image(command.x, command.y, WORLD_ATLAS.key, punyFrameIndex(command.region))
        .setOrigin(command.originX ?? 0, command.originY ?? 0)
        .setDepth(command.depth);
      if (command.scale) image.setScale(command.scale);
      if (command.foregroundKind) {
        foregrounds.push({
          object: image,
          bounds: image.getBounds(),
          baselineY: command.depth,
          kind: command.foregroundKind,
        });
      }
    }
    return { foregrounds, roadTiles: plan.roadTiles, buildingTiles: plan.buildingTiles };
  }
}
