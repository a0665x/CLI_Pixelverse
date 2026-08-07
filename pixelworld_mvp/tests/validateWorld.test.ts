import { describe, expect, it } from 'vitest';
import { ROUTE_DESTINATIONS } from '../src/events/behaviorRouter';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { validateWorld } from '../src/world/validateWorld';

describe('WORLD_DEFINITION', () => {
  it('is a valid 40x22 village with three buildings and four open zones', () => {
    expect(validateWorld(WORLD_DEFINITION)).toEqual([]);
    expect(WORLD_DEFINITION.width).toBe(40);
    expect(WORLD_DEFINITION.height).toBe(22);
    expect(WORLD_DEFINITION.buildings).toHaveLength(3);
    expect(WORLD_DEFINITION.zones).toHaveLength(4);
  });

  it('defines every destination referenced by the behavior router', () => {
    const ids = new Set(WORLD_DEFINITION.stations.map((station) => station.id));
    expect(ROUTE_DESTINATIONS.filter((id) => !ids.has(id))).toEqual([]);
  });
});
