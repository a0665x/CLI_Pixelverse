import { describe, expect, it } from 'vitest';
import { findPathVia } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const pointIndex = (path: readonly { x: number; y: number }[], point: { x: number; y: number }) =>
  path.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y);

describe('village building routes', () => {
  const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

  it('visits each destination outside and threshold in order for every ordered building pair', () => {
    for (const source of WORLD_DEFINITION.buildings) {
      for (const target of WORLD_DEFINITION.buildings) {
        if (source.id === target.id) continue;

        const path = findPathVia(grid, source.entrance.outside, [
          target.entrance.outside,
          target.entrance.threshold,
        ]);

        expect(path, `${source.id} -> ${target.id}`).not.toBeNull();
        const outsideIndex = pointIndex(path!, target.entrance.outside);
        const thresholdIndex = pointIndex(path!, target.entrance.threshold);
        expect(outsideIndex).toBeGreaterThanOrEqual(0);
        expect(thresholdIndex).toBeGreaterThan(outsideIndex);
        expect(path!.every((point) => grid.costAt(point) !== undefined)).toBe(true);
      }
    }
  });
});
