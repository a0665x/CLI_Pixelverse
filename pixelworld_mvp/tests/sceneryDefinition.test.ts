import { describe, expect, it } from 'vitest';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { zoneLabelDefinitions } from '../src/rendering/zoneLabels';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('village scenery definition', () => {
  it('contains a river, two bridges, pasture life, crops, and four themed houses', () => {
    expect(WORLD_DEFINITION.scenery.trees.length).toBeGreaterThanOrEqual(8);
    expect(WORLD_DEFINITION.scenery.river.length).toBeGreaterThanOrEqual(3);
    expect(WORLD_DEFINITION.scenery.bridges).toHaveLength(2);
    expect(WORLD_DEFINITION.scenery.pastures).toHaveLength(1);
    expect(WORLD_DEFINITION.scenery.cropFields).toHaveLength(1);
    expect(new Set(WORLD_DEFINITION.scenery.animals.map(({ species }) => species))).toEqual(
      new Set(['cow', 'sheep', 'chicken', 'pig']),
    );
    expect(WORLD_DEFINITION.buildings.map((item) => item.id)).toEqual([
      'research-library', 'maker-workshop', 'rest-cabin', 'collaboration-barn',
    ]);
  });

  it('blocks water while keeping both bridge crossings walkable', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);
    for (const tree of WORLD_DEFINITION.scenery.trees) expect(grid.isWalkable(tree.trunk)).toBe(false);
    expect(grid.isWalkable({ x: 18, y: 5 })).toBe(false);
    for (const bridge of WORLD_DEFINITION.scenery.bridges) {
      for (let x = bridge.x; x < bridge.x + bridge.width; x += 1) {
        for (let y = bridge.y; y < bridge.y + bridge.height; y += 1) {
          expect(grid.isWalkable({ x, y })).toBe(true);
        }
      }
    }
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
