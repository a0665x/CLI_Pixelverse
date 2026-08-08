import { describe, expect, it } from 'vitest';
import { ROUTE_DESTINATIONS } from '../src/events/behaviorRouter';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { validateWorld } from '../src/world/validateWorld';

describe('WORLD_DEFINITION', () => {
  it('is a valid 40x22 village with four dispersed themed houses', () => {
    expect(validateWorld(WORLD_DEFINITION)).toEqual([]);
    expect(WORLD_DEFINITION.width).toBe(40);
    expect(WORLD_DEFINITION.height).toBe(22);
    expect(WORLD_DEFINITION.buildings.map(({ themeId }) => themeId)).toEqual([
      'research-library', 'maker-workshop', 'rest-cabin', 'collaboration-barn',
    ]);
    expect(new Set(WORLD_DEFINITION.buildings.map(({ themeId }) => themeId)).size).toBe(4);
    expect(Object.keys(INTERIOR_DEFINITIONS)).toHaveLength(4);
  });

  it('defines every destination referenced by the behavior router', () => {
    const ids = new Set(WORLD_DEFINITION.stations.map((station) => station.id));
    expect(ROUTE_DESTINATIONS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it.each([
    { x: 0.5, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: Infinity, height: 1 },
  ])('rejects a malformed obstacle rectangle %#', (obstacle) => {
    const world = structuredClone(WORLD_DEFINITION);
    world.obstacleRects = [obstacle];

    expect(validateWorld(world)).toContain('invalid obstacle rectangle: 0');
  });

  it.each(['approachAnchors', 'queueAnchors'] as const)(
    'rejects a blocked building station %s',
    (pointList) => {
      const world = structuredClone(WORLD_DEFINITION);
      const station = world.stations.find((item) => item.id === 'research-plan')!;
      station[pointList] = [{ x: 3, y: 4 }];

      expect(validateWorld(world)).toContain('station point blocked: research-plan@3,4');
    },
  );

  it('allows a blocked but in-bounds building interaction slot as logical capacity', () => {
    const world = structuredClone(WORLD_DEFINITION);
    const station = world.stations.find((item) => item.id === 'research-plan')!;
    station.interactionSlots[0]!.point = { x: 3, y: 4 };

    expect(validateWorld(world)).toEqual([]);
  });

  it('still rejects an out-of-bounds building interaction slot', () => {
    const world = structuredClone(WORLD_DEFINITION);
    const station = world.stations.find((item) => item.id === 'research-plan')!;
    station.interactionSlots[0]!.point = { x: -1, y: 2 };

    expect(validateWorld(world)).toContain('station point outside world: research-plan@-1,2');
  });
});
