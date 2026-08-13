import { describe, expect, it } from 'vitest';
import {
  INTERIOR_DEFINITIONS,
  INTERIOR_LAYOUT_REVISION,
  interiorDefinitionForBuilding,
} from '../src/world/interiorDefinitions';
import type { AgentAction, BuildingThemeId } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { builtInPrefab } from '../src/rendering/builtInOfficePrefabs';
import { furnitureCells } from '../src/rendering/interiorLayoutEditor';
import { interiorInteractionPoint, interiorPath } from '../src/rendering/interiorMotion';
import { officeLayoutIssues } from '../src/rendering/prefabGeometry';

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
    expect(actual).toEqual(expect.arrayContaining([...actions]));
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

  it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)(
    '%s has the complete hybrid office program',
    (themeId) => {
      const room = INTERIOR_DEFINITIONS[themeId];
      const instances = new Set(room.furniture.flatMap(({ prefabInstanceId }) => (
        prefabInstanceId ? [prefabInstanceId] : []
      )));
      const instanceIds = [...instances];
      const primarySeats = room.furniture.filter(({ kind, prefabInstanceId }) => (
        kind === 'office-chair' && prefabInstanceId !== undefined
      ));

      expect(instanceIds.filter((id) => id.includes('bench-four'))).toHaveLength(2);
      expect(instanceIds.filter((id) => id.includes('pod-l-two'))).toHaveLength(1);
      expect(instanceIds.filter((id) => id.includes('control-m-three'))).toHaveLength(1);
      expect(primarySeats).toHaveLength(13);
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

  it.each(['arrival-lodge', 'awaiting-post', 'offline-dormitory', 'rest-cabin'] as const)(
    '%s has a compact template that passes the complete-room validator and reaches every Hook',
    (buildingId) => {
      const building = WORLD_DEFINITION.buildings.find(({ id }) => id === buildingId)!;
      const room = interiorDefinitionForBuilding(building);
      const door = { x: Math.floor(room.width / 2), y: room.height - 1 };

      expect(room).toMatchObject({ width: 14, height: 9 });
      expect(officeLayoutIssues(room), buildingId).toEqual([]);
      room.furniture.filter(({ supportedActions }) => supportedActions.length > 0).forEach((item) => {
        const target = interiorInteractionPoint(room, item);
        expect(interiorPath(room, door, target, item.id).at(-1), `${buildingId}:${item.id}`).toEqual(target);
      });
    },
  );

  it('returns a fresh interior definition for every building resolution', () => {
    const building = WORLD_DEFINITION.buildings.find(({ id }) => id === 'network-lab')!;
    const first = interiorDefinitionForBuilding(building);
    const second = interiorDefinitionForBuilding(building);

    first.furniture[0]!.point.x = -99;
    first.overflow[0]!.x = -99;
    expect(second.furniture[0]!.point.x).not.toBe(-99);
    expect(second.overflow[0]!.x).not.toBe(-99);
  });

  it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)(
    '%s preserves every canonical M-control desk action and keeps all three desks assignable',
    (themeId) => {
      const canonical = builtInPrefab('control-m-three')!;
      const room = INTERIOR_DEFINITIONS[themeId];
      expect(officeLayoutIssues(room)).toEqual([]);
      const instanceId = room.furniture.find(({ prefabInstanceId }) => prefabInstanceId?.includes('control-m-three'))!.prefabInstanceId!;
      const placed = room.furniture.filter((item) => item.prefabInstanceId === instanceId);

      canonical.items.forEach((item, index) => {
        expect(placed[index]?.supportedActions, `${themeId}:${item.id}`).toEqual(item.supportedActions);
      });
      expect(placed.filter(({ kind, supportedActions }) => kind === 'desk' && supportedActions.length > 0)).toHaveLength(5);
    },
  );

  it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)(
    '%s keeps a two-wide main aisle and an ordinary route to every required workstation',
    (themeId) => {
      const room = INTERIOR_DEFINITIONS[themeId];
      const blocked = new Set(room.furniture.flatMap(furnitureCells).map(({ x, y }) => `${x},${y}`));
      for (const y of [11, 10, 9, 8, 7, 6]) {
        expect([8, 9].every((x) => !blocked.has(`${x},${y}`)), `${themeId}:main aisle @ y=${y}`).toBe(true);
      }
      const door = { x: 9, y: 11 };
      room.furniture.filter(({ supportedActions }) => supportedActions.length > 0).forEach((item) => {
        const target = interiorInteractionPoint(room, item);
        const path = interiorPath(room, door, target, item.id);
        expect(path.at(-1), `${themeId}:${item.id} target ${target.x},${target.y}`).toEqual(target);
      });
    },
  );

  it('keeps the reviewed support targets inside the room and reachable', () => {
    const maker = INTERIOR_DEFINITIONS['maker-workshop'];
    const collaboration = INTERIOR_DEFINITIONS['collaboration-barn'];
    for (const [room, id, expected] of [
      [maker, 'maker-support-meeting', { x: 2, y: 7 }],
      [collaboration, 'collab-service-device', { x: 6.5, y: 3 }],
      [collaboration, 'collab-support-meeting', { x: 2, y: 7 }],
    ] as const) {
      const target = interiorInteractionPoint(room, room.furniture.find((item) => item.id === id)!);
      expect(target).toEqual(expected);
      expect(interiorPath(room, { x: 9, y: 11 }, target, id).at(-1)).toEqual(target);
    }
  });
});
