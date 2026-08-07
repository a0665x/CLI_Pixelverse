import { describe, expect, it } from 'vitest';
import { NavigationGrid } from '../src/navigation/navigationGrid';
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
});
