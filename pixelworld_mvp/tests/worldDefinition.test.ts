import { describe, expect, it } from 'vitest';
import { findPath } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const key = ({ x, y }: { x: number; y: number }): string => `${x},${y}`;

describe('Smallville-style village composition', () => {
  it('connects every doorway through narrow paths with staggered house setbacks', () => {
    const streetCells = new Set(WORLD_DEFINITION.terrain
      .filter(({ kind }) => kind === 'road' || kind === 'plaza')
      .map(({ bounds }) => key(bounds)));
    const pending = [WORLD_DEFINITION.spawn];
    const visited = new Set<string>();
    while (pending.length) {
      const point = pending.pop()!;
      if (visited.has(key(point)) || !streetCells.has(key(point))) continue;
      visited.add(key(point));
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) pending.push({ x: point.x + dx!, y: point.y + dy! });
    }
    expect(visited.size).toBe(streetCells.size);
    for (const home of WORLD_DEFINITION.buildings) expect(visited.has(key(home.entrance.outside))).toBe(true);
    expect(new Set(WORLD_DEFINITION.buildings.map(({ bounds }) => bounds.y)).size).toBeGreaterThanOrEqual(8);
    expect(streetCells.size).toBeLessThan(280);
  });

  it('only ends a path at a house entrance', () => {
    const roads = new Set(WORLD_DEFINITION.terrain.map(t => key(t.bounds)));
    const doors = new Set(WORLD_DEFINITION.buildings.map(b => key(b.entrance.outside)));
    for (const tile of roads) {
      const [x,y] = tile.split(',').map(Number);
      const neighbors = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => roads.has(`${x!+dx!},${y!+dy!}`));
      if (neighbors.length < 2) expect(doors.has(tile), `pointless path end ${tile}`).toBe(true);
    }
  });

  it('distributes lived-in scenery across all three village districts', () => {
    const points = [
      ...WORLD_DEFINITION.scenery.trees.map(({ trunk }) => trunk),
      ...WORLD_DEFINITION.scenery.decorations.map(({ point }) => point),
    ];
    const districts = [
      points.filter(({ x }) => x < 16),
      points.filter(({ x }) => x >= 16 && x < 32),
      points.filter(({ x }) => x >= 32),
    ];

    expect(WORLD_DEFINITION.scenery.trees.length).toBeGreaterThanOrEqual(28);
    expect(WORLD_DEFINITION.scenery.decorations.length).toBeGreaterThanOrEqual(12);
    expect(districts.every((district) => district.length >= 10)).toBe(true);
  });

  it('keeps each decorative prop on a distinct tile', () => {
    const decorationTiles = WORLD_DEFINITION.scenery.decorations.map(({ point }) => key(point));

    expect(new Set(decorationTiles).size).toBe(decorationTiles.length);
  });

  it('keeps every Hook house reachable from the fixed spawn', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      expect(findPath(grid, WORLD_DEFINITION.spawn, building.entrance.outside), building.id).not.toBeNull();
    }
  });
});
