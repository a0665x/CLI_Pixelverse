import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/game/constants';
import { buildingForegroundGeometry } from '../src/rendering/buildingForeground';
import { shouldFadeForeground } from '../src/rendering/DepthOcclusionSystem';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

describe('building foreground geometry', () => {
  it('creates one roof and one real door-frame foreground per building', () => {
    for (const building of WORLD_DEFINITION.buildings) {
      const geometry = buildingForegroundGeometry(building, TILE_SIZE);
      expect(geometry.map(({ kind }) => kind)).toEqual(['roof', 'door-frame']);
      const door = geometry.find(({ kind }) => kind === 'door-frame')!;
      const thresholdCenter = {
        x: building.entrance.threshold.x * TILE_SIZE + TILE_SIZE / 2,
        y: building.entrance.threshold.y * TILE_SIZE + TILE_SIZE / 2,
      };
      expect(thresholdCenter.x).toBeGreaterThanOrEqual(door.bounds.x);
      expect(thresholdCenter.x).toBeLessThanOrEqual(door.bounds.x + door.bounds.width);
      expect(thresholdCenter.y).toBeGreaterThanOrEqual(door.bounds.y);
      expect(thresholdCenter.y).toBeLessThanOrEqual(door.bounds.y + door.bounds.height);
      expect(door.baselineY).toBeGreaterThan(thresholdCenter.y);
      expect(door.bounds).toEqual({
        x: building.entrance.threshold.x * TILE_SIZE,
        y: building.entrance.threshold.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
  });

  it('uses roof bounds that can occlude an Agent standing behind the facade', () => {
    const building = WORLD_DEFINITION.buildings[0]!;
    const roof = buildingForegroundGeometry(building, TILE_SIZE)[0]!;
    expect(roof.bounds).toEqual({ x: 48, y: 64, width: 80, height: 32 });
    const agentBounds = { x: roof.bounds.x + 16, y: roof.bounds.y + 16, width: 12, height: 14 };
    expect(shouldFadeForeground(agentBounds, roof.bounds, roof.bounds.y + 30, roof.baselineY)).toBe(true);
  });
});
