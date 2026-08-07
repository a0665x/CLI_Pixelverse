import { describe, expect, it } from 'vitest';
import { findPath } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
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
    expect(findPath(grid, WORLD_DEFINITION.spawn, { x: 3, y: 3 })).toBeNull();
  });

  it('returns a one-point path when start equals goal', () => {
    expect(findPath(grid, { x: 20, y: 11 }, { x: 20, y: 11 })).toEqual([{ x: 20, y: 11 }]);
  });
});
