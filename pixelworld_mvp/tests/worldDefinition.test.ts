import { describe, expect, it } from 'vitest';
import { findPath } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const key = ({ x, y }: { x: number; y: number }): string => `${x},${y}`;

describe('Smallville-style village composition', () => {
  it('uses connected neighborhood streets instead of sparse single-tile lines', () => {
    const streetCells = new Set(WORLD_DEFINITION.terrain
      .filter(({ kind }) => kind === 'road' || kind === 'plaza')
      .map(({ bounds }) => key(bounds)));

    expect(streetCells.size).toBeGreaterThanOrEqual(300);
    expect([7, 13, 25].every((y) => (
      [...streetCells].filter((cell) => cell.endsWith(`,${y}`)).length >= 30
    ))).toBe(true);
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
    expect(WORLD_DEFINITION.scenery.decorations.length).toBeGreaterThanOrEqual(28);
    expect(districts.every((district) => district.length >= 14)).toBe(true);
  });

  it('keeps every Hook house reachable from the fixed spawn', () => {
    const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      expect(findPath(grid, WORLD_DEFINITION.spawn, building.entrance.outside), building.id).not.toBeNull();
    }
  });
});
