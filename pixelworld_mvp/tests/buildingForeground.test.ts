import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/game/constants';
import { buildingEaveGeometry } from '../src/rendering/buildingForeground';
import { shouldFadeForeground } from '../src/rendering/DepthOcclusionSystem';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('building foreground geometry', () => {
  it('covers every reachable exterior approach with a visible front eave', () => {
    for (const building of WORLD_DEFINITION.buildings) {
      const eave = buildingEaveGeometry(building.bounds, TILE_SIZE);
      const approaches = WORLD_DEFINITION.stations
        .filter((station) => station.buildingId === building.id)
        .flatMap((station) => station.approachAnchors);

      expect(approaches.length).toBeGreaterThan(0);
      for (const point of approaches) {
        const footY = point.y * TILE_SIZE + TILE_SIZE / 2;
        const agentBounds = {
          x: point.x * TILE_SIZE + 1,
          y: footY - 14,
          width: TILE_SIZE - 2,
          height: 14,
        };
        expect(shouldFadeForeground(agentBounds, eave.bounds, footY, eave.baselineY), `${building.id}@${point.x},${point.y}`).toBe(true);
      }
    }
  });

  it('places the eave at the building front with matching bounds and baseline', () => {
    expect(buildingEaveGeometry({ x: 2, y: 2, width: 9, height: 5 }, 16)).toEqual({
      bounds: { x: 32, y: 112, width: 144, height: 28 },
      baselineY: 140,
    });
  });
});
