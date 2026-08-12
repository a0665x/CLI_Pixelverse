import { describe, expect, it } from 'vitest';
import {
  INTERIOR_DEFINITIONS,
  INTERIOR_LAYOUT_REVISION,
  interiorDefinitionForBuilding,
} from '../src/world/interiorDefinitions';
import type { AgentAction, BuildingThemeId } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const expectedActions = {
  'rest-cabin': ['offline', 'queue', 'repair', 'rest'],
  'research-library': ['plan', 'ponder', 'read', 'signal'],
  'maker-workshop': ['repair', 'terminal', 'type'],
  'collaboration-barn': ['arrive', 'dispatch', 'pulse', 'queue', 'respond'],
} as const;

describe('Smallville-style authored interiors', () => {
  it('publishes the composed preset revision', () => {
    expect(INTERIOR_LAYOUT_REVISION).toBe(2);
  });

  it.each(Object.entries(INTERIOR_DEFINITIONS))(
    '%s contains an editable furniture and surface composition at one anchor',
    (_themeId, room) => {
      const anchors = new Map<string, typeof room.furniture>();
      room.furniture.forEach((item) => {
        const key = `${item.point.x},${item.point.y}`;
        anchors.set(key, [...(anchors.get(key) ?? []), item]);
      });

      const composed = [...anchors.values()].find((items) => (
        items.some(({ layer }) => layer === 'furniture')
        && items.some(({ layer }) => layer === 'surface')
      ));

      expect(composed, `${room.id} needs a shared-anchor workstation`).toBeDefined();
      expect(composed?.filter(({ layer }) => layer === 'surface').every(({ blocksNavigation }) => blocksNavigation === false)).toBe(true);
    },
  );

  it.each(Object.entries(expectedActions) as Array<[BuildingThemeId, readonly AgentAction[]]>)('%s preserves every Hook action', (themeId, actions) => {
    const actual = [...new Set(INTERIOR_DEFINITIONS[themeId].furniture
      .flatMap(({ supportedActions }) => supportedActions))].sort();
    expect(actual).toEqual([...actions].sort());
  });

  it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)(
    '%s uses the work-office footprint and composed prefab instances',
    (id) => {
      const room = INTERIOR_DEFINITIONS[id];
      expect(room).toMatchObject({ width: 18, height: 12 });
      expect(new Set(room.furniture.map(({ id: furnitureId }) => furnitureId)).size).toBe(room.furniture.length);
      expect(new Set(room.furniture.flatMap(({ prefabInstanceId }) => prefabInstanceId ? [prefabInstanceId] : [])).size)
        .toBeGreaterThanOrEqual(2);
    },
  );

  it('keeps compact buildings compact independently of their outdoor visual theme', () => {
    const waitingPost = WORLD_DEFINITION.buildings.find(({ id }) => id === 'awaiting-post')!;
    const arrivalLodge = WORLD_DEFINITION.buildings.find(({ id }) => id === 'arrival-lodge')!;

    expect(waitingPost).toMatchObject({ themeId: 'collaboration-barn', interiorProfile: 'compact' });
    expect(arrivalLodge).toMatchObject({ themeId: 'collaboration-barn', interiorProfile: 'compact' });
    expect(interiorDefinitionForBuilding(waitingPost)).toMatchObject({ width: 14, height: 9 });
    expect(interiorDefinitionForBuilding(arrivalLodge)).toMatchObject({ width: 14, height: 9 });
  });

  it('returns a fresh interior definition for every building resolution', () => {
    const building = WORLD_DEFINITION.buildings.find(({ id }) => id === 'network-lab')!;
    const first = interiorDefinitionForBuilding(building);
    const second = interiorDefinitionForBuilding(building);

    first.furniture[0]!.point.x = -99;
    first.overflow[0]!.x = -99;
    expect(second.furniture[0]!.point.x).not.toBe(-99);
    expect(second.overflow[0]!.x).not.toBe(-99);
  });
});
