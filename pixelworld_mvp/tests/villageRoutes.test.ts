import { describe, expect, it } from 'vitest';
import { findPathVia } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const pointIndex = (path: readonly { x: number; y: number }[], point: { x: number; y: number }) =>
  path.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y);

describe('village building routes', () => {
  const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

  it('provides twelve dispersed hook destinations with unique doors', () => {
    expect(WORLD_DEFINITION.buildings).toHaveLength(12);
    expect(new Set(WORLD_DEFINITION.buildings.map(({ id }) => id))).toEqual(new Set([
      'arrival-lodge', 'thinkers-cottage', 'archive-library', 'network-lab',
      'heartbeat-tower', 'offline-dormitory', 'maker-workshop', 'tool-smithy',
      'awaiting-post', 'collaboration-barn', 'recovery-clinic', 'rest-cabin',
    ]));
    expect(new Set(WORLD_DEFINITION.buildings.map(({ entrance }) => `${entrance.threshold.x},${entrance.threshold.y}`)).size).toBe(12);
  });

  it('uses several road junctions instead of a single sparse spine', () => {
    const roads = new Set(WORLD_DEFINITION.terrain
      .filter(({ kind }) => kind === 'road' || kind === 'plaza')
      .map(({ bounds }) => `${bounds.x},${bounds.y}`));
    const junctions = [...roads].filter((entry) => {
      const [x, y] = entry.split(',').map(Number);
      return [[x! + 1, y!], [x! - 1, y!], [x!, y! + 1], [x!, y! - 1]]
        .filter(([nx, ny]) => roads.has(`${nx},${ny}`)).length >= 3;
    });
    expect(junctions.length).toBeGreaterThanOrEqual(10);
  });

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
