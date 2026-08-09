import { describe, expect, it } from 'vitest';
import { findPath, findPathVia } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import type { WorldDefinition } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('four-direction A*', () => {
  const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

  it('routes from spawn to every station destination and anchor without crossing blocked tiles', () => {
    for (const station of WORLD_DEFINITION.stations) {
      const destinations = [
        ...station.interactionSlots.map((slot) => ({ id: slot.id, point: slot.point })),
        ...station.approachAnchors.map((point, index) => ({ id: `approach-${index}`, point })),
        ...station.queueAnchors.map((point, index) => ({ id: `queue-${index}`, point })),
      ];
      for (const destination of destinations) {
        const path = findPath(grid, WORLD_DEFINITION.spawn, destination.point);
        expect(path, `${station.id}:${destination.id}`).not.toBeNull();
        expect(path!.at(0)).toEqual(WORLD_DEFINITION.spawn);
        expect(path!.at(-1)).toEqual(destination.point);
        expect(path!.every((point) => grid.isWalkable(point))).toBe(true);
        for (let index = 1; index < path!.length; index += 1) {
          const previous = path![index - 1]!;
          const current = path![index]!;
          expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(1);
        }
      }
    }
  });

  it('returns null for a blocked or unreachable goal', () => {
    expect(findPath(grid, WORLD_DEFINITION.spawn, { x: 2, y: 3 })).toBeNull();
  });

  it('returns a one-point path when start equals goal', () => {
    expect(findPath(grid, { x: 15, y: 11 }, { x: 15, y: 11 })).toEqual([{ x: 15, y: 11 }]);
  });

  it('prefers a longer road route over a shorter grass shortcut', () => {
    const world: WorldDefinition = {
      width: 5,
      height: 3,
      spawn: { x: 0, y: 1 },
      buildings: [],
      zones: [],
      scenery: { trees: [], decorations: [], river: [], bridges: [], pastures: [], cropFields: [], flowerBeds: [], animals: [] },
      terrain: [
        { kind: 'road', bounds: { x: 0, y: 0, width: 5, height: 1 }, cost: 1 },
        { kind: 'grass', bounds: { x: 0, y: 1, width: 5, height: 1 }, cost: 5 },
      ],
      obstacleRects: [{ x: 0, y: 2, width: 5, height: 1 }],
      walkableOverrides: [],
      stations: [],
    };

    const path = findPath(NavigationGrid.fromWorld(world), { x: 0, y: 1 }, { x: 4, y: 1 });

    expect(path).toEqual([
      { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 },
    ]);
  });

  it('uses terrain costs and reopens declared walkable overrides', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

    expect(grid.costAt({ x: 1, y: 1 })).toBe(5);
    expect(grid.costAt({ x: 15, y: 6 })).toBe(1);
    expect(grid.costAt({ x: 17, y: 18 })).toBe(5);
    expect(grid.costAt({ x: 3, y: 5 })).toBe(5);
    expect(grid.costAt({ x: 1, y: 2 })).toBeUndefined();
    expect(grid.costAt({ x: -1, y: 1 })).toBeUndefined();
  });

  it('reopens a walkable override located inside an actual obstacle', () => {
    const world: WorldDefinition = {
      width: 3,
      height: 3,
      spawn: { x: 0, y: 1 },
      buildings: [],
      zones: [],
      scenery: { trees: [], decorations: [], river: [], bridges: [], pastures: [], cropFields: [], flowerBeds: [], animals: [] },
      terrain: [{ kind: 'road', bounds: { x: 0, y: 1, width: 3, height: 1 }, cost: 1 }],
      obstacleRects: [{ x: 1, y: 0, width: 1, height: 3 }],
      walkableOverrides: [{ x: 1, y: 1 }],
      stations: [],
    };
    const overrideGrid = NavigationGrid.fromWorld(world);

    expect(overrideGrid.isWalkable({ x: 1, y: 1 })).toBe(true);
    expect(overrideGrid.costAt({ x: 1, y: 1 })).toBe(1);
    expect(findPath(overrideGrid, { x: 0, y: 1 }, { x: 2, y: 1 })).toEqual([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ]);
  });

  it('concatenates routes through each waypoint without duplicate junctions', () => {
    const path = findPathVia(grid, { x: 16, y: 13 }, [{ x: 17, y: 13 }, { x: 18, y: 13 }]);

    expect(path).toEqual([{ x: 16, y: 13 }, { x: 17, y: 13 }, { x: 18, y: 13 }]);
  });

  it('returns null when any waypoint segment is impossible', () => {
    expect(findPathVia(grid, { x: 16, y: 13 }, [{ x: 2, y: 3 }])).toBeNull();
  });
});
