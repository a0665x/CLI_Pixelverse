import { describe, expect, it } from 'vitest';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { validateWorld } from '../src/world/validateWorld';

const key = ({ x, y }: { x: number; y: number }) => `${x},${y}`;

describe('village entrances and terrain', () => {
  it('connects every dispersed house front door to the outdoor road network', () => {
    const outdoorTerrain = new Set(
      WORLD_DEFINITION.terrain
        .filter((area) => area.kind === 'road' || area.kind === 'plaza')
        .flatMap((area) => Array.from(
          { length: area.bounds.width * area.bounds.height },
          (_, index) => ({
            x: area.bounds.x + (index % area.bounds.width),
            y: area.bounds.y + Math.floor(index / area.bounds.width),
          }),
        ))
        .map(key),
    );
    const walkableOverrides = new Set(WORLD_DEFINITION.walkableOverrides.map(key));

    for (const building of WORLD_DEFINITION.buildings) {
      expect(building.entrance.outside).toEqual({
        x: building.entrance.threshold.x,
        y: building.bounds.y + building.bounds.height,
      });
      expect(building.entrance.threshold).toEqual({
        x: building.entrance.outside.x,
        y: building.bounds.y + building.bounds.height - 1,
      });
      expect(building.entrance.entryFacing).toBe('up');
      expect(building.entrance.exitFacing).toBe('down');
      expect(outdoorTerrain.has(key(building.entrance.outside))).toBe(true);
      expect(walkableOverrides.has(key(building.entrance.threshold))).toBe(true);
    }
  });

  it('has a topology accepted by world validation', () => {
    expect(validateWorld(WORLD_DEFINITION)).toEqual([]);
  });
});
