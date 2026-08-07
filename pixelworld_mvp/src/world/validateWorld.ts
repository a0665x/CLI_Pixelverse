import type { GridPoint, GridRect, WorldDefinition } from './types';

const inside = (point: GridPoint, world: WorldDefinition) =>
  Number.isInteger(point.x) && Number.isInteger(point.y) &&
  point.x >= 0 && point.y >= 0 && point.x < world.width && point.y < world.height;
const blocked = (point: GridPoint, rect: GridRect) =>
  point.x >= rect.x && point.y >= rect.y &&
  point.x < rect.x + rect.width && point.y < rect.y + rect.height;

export function validateWorld(world: WorldDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const locationIds = new Set([...world.zones.map((item) => item.id), ...world.buildings.map((item) => item.id)]);
  const buildingIds = new Set(world.buildings.map((item) => item.id));
  if (world.width !== 40 || world.height !== 22) errors.push('world must be 40x22 tiles');
  if (!inside(world.spawn, world)) errors.push('spawn is outside the world');
  world.obstacleRects.forEach((rect, index) => {
    if (rect.width <= 0 || rect.height <= 0 || rect.x < 0 || rect.y < 0 ||
        rect.x + rect.width > world.width || rect.y + rect.height > world.height) {
      errors.push(`invalid obstacle rectangle: ${index}`);
    }
  });
  for (const station of world.stations) {
    if (ids.has(station.id)) errors.push(`duplicate station: ${station.id}`);
    ids.add(station.id);
    if (!locationIds.has(station.zoneId)) errors.push(`unknown station zone: ${station.id}@${station.zoneId}`);
    if (station.buildingId && !buildingIds.has(station.buildingId)) errors.push(`unknown station building: ${station.id}@${station.buildingId}`);
    if (station.interactionSlots.length === 0) errors.push(`station has no slots: ${station.id}`);
    for (const point of [...station.approachAnchors, ...station.interactionSlots.map((item) => item.point), ...station.queueAnchors]) {
      if (!inside(point, world)) errors.push(`station point outside world: ${station.id}@${point.x},${point.y}`);
      if (world.obstacleRects.some((rect) => blocked(point, rect))) errors.push(`station point blocked: ${station.id}@${point.x},${point.y}`);
    }
  }
  return errors;
}
