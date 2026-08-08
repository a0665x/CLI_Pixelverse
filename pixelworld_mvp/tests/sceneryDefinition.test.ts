import { describe, expect, it } from 'vitest';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { zoneLabelDefinitions } from '../src/rendering/zoneLabels';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('village scenery definition', () => {
  it('contains trees, a pond, flowers, and three functionally named buildings', () => {
    expect(WORLD_DEFINITION.scenery.trees.length).toBeGreaterThanOrEqual(6);
    expect(WORLD_DEFINITION.scenery.pond).toEqual({ x: 27, y: 14, width: 4, height: 3 });
    expect(WORLD_DEFINITION.scenery.flowerBeds).toHaveLength(1);
    expect(WORLD_DEFINITION.buildings.map((item) => item.id)).toEqual([
      'knowledge-hall', 'build-workshop', 'signal-station',
    ]);
  });

  it('marks every tree trunk, pond tile, and closed flowerbed as blocked', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);
    for (const tree of WORLD_DEFINITION.scenery.trees) expect(grid.isWalkable(tree.trunk)).toBe(false);
    expect(grid.isWalkable({ x: 28, y: 15 })).toBe(false);
    expect(grid.isWalkable({ x: 3, y: 13 })).toBe(false);
    expect(grid.isWalkable({ x: 18, y: 7 })).toBe(false);
    expect(grid.isWalkable({ x: 20, y: 17 })).toBe(false);
  });

  it('keeps scenery obstacles clear of roads, plazas, and front doors', () => {
    const terrainPoints = new Set(
      WORLD_DEFINITION.terrain
        .filter((area) => area.kind === 'road' || area.kind === 'plaza')
        .flatMap((area) => Array.from(
          { length: area.bounds.width * area.bounds.height },
          (_, index) => `${area.bounds.x + (index % area.bounds.width)},${area.bounds.y + Math.floor(index / area.bounds.width)}`,
        )),
    );
    const entrances = new Set(WORLD_DEFINITION.buildings.flatMap((building) => [
      `${building.entrance.outside.x},${building.entrance.outside.y}`,
      `${building.entrance.threshold.x},${building.entrance.threshold.y}`,
    ]));
    const blocked = NavigationGrid.fromWorld(WORLD_DEFINITION).blockedPoints();

    for (const point of blocked) {
      expect(terrainPoints.has(`${point.x},${point.y}`)).toBe(false);
      expect(entrances.has(`${point.x},${point.y}`)).toBe(false);
    }
  });

  it('exposes every outdoor zone as a deterministic readable label', () => {
    expect(zoneLabelDefinitions(WORLD_DEFINITION.zones)).toEqual(
      WORLD_DEFINITION.zones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        anchor: { x: zone.bounds.x + zone.bounds.width / 2, y: zone.bounds.y + 0.25 },
      })),
    );
  });
});
