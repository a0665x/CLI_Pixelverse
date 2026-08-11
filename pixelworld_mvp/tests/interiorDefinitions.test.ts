import { describe, expect, it } from 'vitest';
import {
  INTERIOR_DEFINITIONS,
  INTERIOR_LAYOUT_REVISION,
} from '../src/world/interiorDefinitions';
import type { AgentAction, BuildingThemeId } from '../src/world/types';

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
});
