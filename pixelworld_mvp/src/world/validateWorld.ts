import type { GridPoint, GridRect, TerrainArea, WorldDefinition } from './types';

const inside = (point: GridPoint, world: WorldDefinition) =>
  Number.isInteger(point.x) && Number.isInteger(point.y) &&
  point.x >= 0 && point.y >= 0 && point.x < world.width && point.y < world.height;
const blocked = (point: GridPoint, rect: GridRect) =>
  point.x >= rect.x && point.y >= rect.y &&
  point.x < rect.x + rect.width && point.y < rect.y + rect.height;
const validRect = (rect: GridRect, world: WorldDefinition) =>
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
  [rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) &&
  rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 &&
  rect.x + rect.width <= world.width && rect.y + rect.height <= world.height;
const key = (point: GridPoint) => `${point.x},${point.y}`;
const pointsIn = (rect: GridRect): GridPoint[] => Array.from(
  { length: rect.width * rect.height },
  (_, index) => ({ x: rect.x + (index % rect.width), y: rect.y + Math.floor(index / rect.width) }),
);
const terrainContains = (areas: TerrainArea[], point: GridPoint) => areas.some((area) => blocked(point, area.bounds));

export function validateWorld(world: WorldDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const locationIds = new Set([...world.zones.map((item) => item.id), ...world.buildings.map((item) => item.id)]);
  const buildingIds = new Set(world.buildings.map((item) => item.id));
  if (world.width !== 40 || world.height !== 22) errors.push('world must be 40x22 tiles');
  if (!inside(world.spawn, world)) errors.push('spawn is outside the world');
  const terrainPoints = new Set<string>();
  for (const [index, area] of world.terrain.entries()) {
    if (!['road', 'plaza', 'grass'].includes(area.kind) || !validRect(area.bounds, world) || !Number.isFinite(area.cost) || area.cost <= 0) {
      errors.push(`invalid terrain area: ${index}`);
      continue;
    }
    for (const point of pointsIn(area.bounds)) {
      if (terrainPoints.has(key(point))) errors.push(`duplicate terrain point: ${key(point)}`);
      terrainPoints.add(key(point));
    }
  }
  world.obstacleRects.forEach((rect, index) => {
    if (!validRect(rect, world)) {
      errors.push(`invalid obstacle rectangle: ${index}`);
    }
  });
  const walkableOverrides = new Set<string>();
  for (const point of world.walkableOverrides) {
    if (!inside(point, world)) errors.push(`walkable override outside world: ${key(point)}`);
    if (walkableOverrides.has(key(point))) errors.push(`duplicate walkable override: ${key(point)}`);
    walkableOverrides.add(key(point));
    if (world.obstacleRects.some((rect) => blocked(point, rect))) errors.push(`walkable override blocked: ${key(point)}`);
  }
  const entrancePoints = new Set<string>();
  for (const building of world.buildings) {
    if (!validRect(building.bounds, world)) errors.push(`invalid building bounds: ${building.id}`);
    const entrance = building.entrance;
    if (!entrance) {
      errors.push(`missing entrance: ${building.id}`);
      continue;
    }
    const { outside, threshold } = entrance;
    if (!inside(outside, world) || !inside(threshold, world)) errors.push(`entrance outside world: ${building.id}`);
    if (outside.x !== threshold.x || outside.y !== threshold.y + 1 ||
      threshold.x < building.bounds.x || threshold.x >= building.bounds.x + building.bounds.width ||
      threshold.y !== building.bounds.y + building.bounds.height - 1 ||
      entrance.entryFacing !== 'up' || entrance.exitFacing !== 'down') {
      errors.push(`invalid entrance facade: ${building.id}`);
    }
    if (!terrainContains(world.terrain.filter((area) => area.kind === 'road' || area.kind === 'plaza'), outside)) {
      errors.push(`entrance outside is not road or plaza: ${building.id}`);
    }
    if (!walkableOverrides.has(key(threshold))) errors.push(`entrance threshold is not walkable override: ${building.id}`);
    for (const point of [outside, threshold]) {
      if (entrancePoints.has(key(point))) errors.push(`duplicate entrance point: ${key(point)}`);
      entrancePoints.add(key(point));
    }
  }
  for (const area of world.terrain.filter((item) => item.kind === 'road' || item.kind === 'plaza')) {
    for (const point of pointsIn(area.bounds)) {
      if (world.obstacleRects.some((rect) => blocked(point, rect))) errors.push(`blocked outdoor terrain: ${key(point)}`);
    }
  }
  for (const station of world.stations) {
    if (ids.has(station.id)) errors.push(`duplicate station: ${station.id}`);
    ids.add(station.id);
    if (!locationIds.has(station.zoneId)) errors.push(`unknown station zone: ${station.id}@${station.zoneId}`);
    if (station.buildingId && !buildingIds.has(station.buildingId)) errors.push(`unknown station building: ${station.id}@${station.buildingId}`);
    if (station.interactionSlots.length === 0) errors.push(`station has no slots: ${station.id}`);
    for (const point of [...station.approachAnchors, ...station.queueAnchors]) {
      if (!inside(point, world)) errors.push(`station point outside world: ${station.id}@${point.x},${point.y}`);
      if (world.obstacleRects.some((rect) => blocked(point, rect))) {
        errors.push(`station point blocked: ${station.id}@${point.x},${point.y}`);
      }
    }
    for (const { point } of station.interactionSlots) {
      if (!inside(point, world)) errors.push(`station point outside world: ${station.id}@${point.x},${point.y}`);
      if (!station.buildingId && world.obstacleRects.some((rect) => blocked(point, rect))) {
        errors.push(`station point blocked: ${station.id}@${point.x},${point.y}`);
      }
    }
  }
  return errors;
}
