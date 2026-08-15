import { describe, expect, it } from 'vitest';
import { assignInteriorOccupants, type InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { interiorInteractionPoint } from '../src/rendering/prefabGeometry';
import { interiorPath } from '../src/rendering/interiorMotion';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';
import { semanticForFurniture } from '../src/rendering/interiorFurnitureSemantics';
import { navigationCells } from '../src/rendering/interiorPlacement';

const snapshot = (overrides: Partial<InteriorAgentSnapshot>): InteriorAgentSnapshot => ({
  agentId: 'main', role: 'main', buildingId: 'rest-cabin', action: 'rest',
  eventKind: 'idle', eventId: 'idle-1', ...overrides,
});

const isAdjacentToFurniture = (point: { x: number; y: number }, furniture: Parameters<typeof navigationCells>[0]) => (
  navigationCells({ ...furniture, blocksNavigation: true }).some((cell) => (
    Math.abs(cell.x - Math.round(point.x)) + Math.abs(cell.y - Math.round(point.y)) === 1
  ))
);

describe('interior occupant assignment', () => {
  it('routes rest-category actions to the nearest compatible seat', () => {
    const rest = INTERIOR_DEFINITIONS['rest-cabin'];
    for (const assigned of [
      assignInteriorOccupants(rest, [snapshot({})])[0]!,
      assignInteriorOccupants(rest, [snapshot({ action: 'offline', eventKind: 'offline' })])[0]!,
    ]) {
      expect(semanticForFurniture(rest.furniture.find(({ id }) => id === assigned.furnitureId)!)).toBe('rest');
      expect(assigned).toMatchObject({ agentId: 'main', seated: true });
    }
  });

  it('maps web work to a stable nearby Search station independently of activity cycle id', () => {
    const research = INTERIOR_DEFINITIONS['research-library'];
    const first = assignInteriorOccupants(research, [snapshot({
      buildingId: 'research-library', action: 'signal', eventKind: 'web', eventId: 'web-cycle-0',
    })])[0]!;
    const second = assignInteriorOccupants(research, [snapshot({
      buildingId: 'research-library', action: 'signal', eventKind: 'web', eventId: 'web-cycle-1',
    })])[0]!;

    expect(semanticForFurniture(research.furniture.find(({ id }) => id === first.furnitureId)!)).toBe('search');
    expect(semanticForFurniture(research.furniture.find(({ id }) => id === second.furnitureId)!)).toBe('search');
    expect(first.furnitureId).toBe(second.furnitureId);
  });

  it('assigns multiple occupants to stable non-overlapping workstations before overflow', () => {
    const research = INTERIOR_DEFINITIONS['research-library'];
    const agents = Array.from({ length: 6 }, (_, index) => snapshot({
      agentId: `agent-${index}`, role: 'subagent', buildingId: 'research-library',
      action: 'signal', eventKind: 'web', eventId: `web-${index}`,
    }));
    const first = assignInteriorOccupants(research, agents);
    const second = assignInteriorOccupants(research, [...agents].reverse());

    expect(new Set(first.map(({ point }) => `${point.x},${point.y}`)).size).toBe(6);
    expect(first).toEqual(second);
    expect(first.every(({ furnitureId }) => furnitureId !== undefined)).toBe(true);
  });

  it('queues excess occupants at distinct reachable unblocked entrance points', () => {
    const room = {
      ...INTERIOR_DEFINITIONS['maker-workshop'], width: 7, height: 6,
      furniture: [
        {
          id: 'only-desk', kind: 'desk' as const, point: { x: 1, y: 1 }, facing: 'down' as const,
          supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
          interactionPoint: { x: 1, y: 2 },
        },
        {
          id: 'blocked-overflow', kind: 'decor' as const, point: { x: 4, y: 4 }, facing: 'up' as const,
          supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
        },
      ],
      overflow: [{ x: 4, y: 4 }, { x: 2, y: 4 }],
    };
    const agents = ['charlie', 'alpha', 'bravo'].map((agentId) => snapshot({
      agentId, role: 'subagent', buildingId: 'custom-house', action: 'terminal', eventId: `work-${agentId}`,
    }));

    const first = assignInteriorOccupants(room, agents, 'custom-house');
    const second = assignInteriorOccupants(room, [...agents].reverse(), 'custom-house');

    expect(first).toEqual(second);
    expect(new Set(first.map(({ point }) => `${point.x},${point.y}`)).size).toBe(3);
    expect(first.map(({ point }) => point)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 5 },
      { x: 2, y: 4 },
    ]);
    expect(first.some(({ point }) => point.x === 4 && point.y === 4)).toBe(false);
    expect(first.every(({ missingSemantic }) => missingSemantic === undefined)).toBe(true);
  });

  it('reserves semantic stations before assigning earlier missing-category occupants', () => {
    const room = {
      ...INTERIOR_DEFINITIONS['maker-workshop'], width: 7, height: 6,
      furniture: [{
        id: 'only-desk', kind: 'desk' as const, point: { x: 2, y: 3 }, facing: 'down' as const,
        supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
        interactionPoint: { x: 2, y: 4 },
      }],
      overflow: [{ x: 2, y: 4 }],
    };
    const assigned = assignInteriorOccupants(room, [
      snapshot({ agentId: 'alpha', buildingId: 'custom-house', action: 'read', eventId: 'missing-search-a' }),
      snapshot({ agentId: 'bravo', buildingId: 'custom-house', action: 'read', eventId: 'missing-search-b' }),
      snapshot({ agentId: 'charlie', buildingId: 'custom-house', action: 'terminal', eventId: 'work' }),
    ], 'custom-house');

    expect(assigned.find(({ agentId }) => agentId === 'charlie')).toMatchObject({
      furnitureId: 'only-desk', point: { x: 2, y: 4 },
    });
    expect(new Set(assigned.map(({ point }) => `${point.x},${point.y}`)).size).toBe(3);
  });

  it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)(
    '%s assigns thirteen hybrid-office occupants before overflow',
    (themeId) => {
      const agents = [
        ...Array.from({ length: 11 }, (_, index) => snapshot({
          agentId: `terminal-${index}`,
          role: 'subagent',
          buildingId: themeId,
          action: 'terminal',
          eventKind: 'tool',
          eventId: `terminal-cycle-${index}`,
        })),
        ...Array.from({ length: 2 }, (_, index) => snapshot({
          agentId: `plan-${index}`,
          role: 'subagent',
          buildingId: themeId,
          action: 'plan',
          eventKind: 'plan',
          eventId: `plan-cycle-${index}`,
        })),
      ];
      const assignments = assignInteriorOccupants(INTERIOR_DEFINITIONS[themeId], agents);

      expect(assignments).toHaveLength(13);
      expect(assignments.every(({ furnitureId }) => furnitureId !== undefined)).toBe(true);
      expect(new Set(assignments.map(({ point }) => `${point.x},${point.y}`)).size).toBe(13);
    },
  );

  it('assigns a reachable interaction anchor shared with interior motion', () => {
    const maker = INTERIOR_DEFINITIONS['maker-workshop'];
    const assigned = assignInteriorOccupants(maker, [snapshot({
      buildingId: 'tool-smithy', action: 'terminal', eventKind: 'tool', eventId: 'tool-anchor',
    })], 'tool-smithy')[0]!;
    const furniture = maker.furniture.find(({ id }) => id === assigned.furnitureId)!;
    const authoredAnchor = interiorInteractionPoint(maker, furniture);
    const door = { x: Math.floor(maker.width / 2), y: maker.height - 1 };
    const path = interiorPath(maker, door, assigned.point, furniture.id);

    expect(furniture.supportedActions).toContain('terminal');
    expect(assigned.point).not.toEqual(authoredAnchor);
    expect(isAdjacentToFurniture(assigned.point, furniture)).toBe(true);
    expect(path.at(-1)).toEqual(assigned.point);
  });

  it('uses the authored point of the selected item when same-action terminals coexist', () => {
    const room = {
      ...INTERIOR_DEFINITIONS['maker-workshop'], width: 8, height: 6,
      furniture: [
        {
          id: 'terminal-a', kind: 'computer' as const, point: { x: 1, y: 1 }, facing: 'down' as const,
          supportedActions: ['terminal' as const], icon: 'tool' as const, blocksNavigation: true,
          interactionPoint: { x: 1, y: 3 },
        },
        {
          id: 'terminal-b', kind: 'computer' as const, point: { x: 6, y: 1 }, facing: 'down' as const,
          supportedActions: ['terminal' as const], icon: 'tool' as const, blocksNavigation: true,
          interactionPoint: { x: 6, y: 3 },
        },
      ],
      overflow: [],
    };
    const assignments = assignInteriorOccupants(room, [
      snapshot({ agentId: 'a', buildingId: 'tool-smithy', action: 'terminal', eventId: 'one' }),
      snapshot({ agentId: 'b', buildingId: 'tool-smithy', action: 'terminal', eventId: 'two' }),
    ], 'tool-smithy');

    expect(assignments).toHaveLength(2);
    assignments.forEach((assignment) => {
      const furniture = room.furniture.find(({ id }) => id === assignment.furnitureId)!;
      expect(assignment.point).not.toEqual(furniture.interactionPoint);
      expect(isAdjacentToFurniture(assignment.point, furniture)).toBe(true);
    });
  });

  it('routes to the nearest compatible custom desk without exact Hook metadata', () => {
    const room = {
      ...INTERIOR_DEFINITIONS['maker-workshop'], width: 9, height: 7,
      furniture: [
        {
          id: 'far-custom-desk', kind: 'desk' as const, point: { x: 1, y: 1 }, facing: 'down' as const,
          supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
          interactionPoint: { x: 1, y: 2 }, requirementId: 'unrelated:legacy-id',
        },
        {
          id: 'near-custom-desk', kind: 'desk' as const, point: { x: 4, y: 3 }, facing: 'down' as const,
          supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
          interactionPoint: { x: 4, y: 5 },
        },
      ],
      overflow: [],
    };

    expect(assignInteriorOccupants(room, [snapshot({
      buildingId: 'custom-house', action: 'terminal', eventId: 'semantic-work',
    })], 'custom-house')[0]).toMatchObject({
      furnitureId: 'near-custom-desk', point: { x: 4, y: 4 },
    });
  });

  it('keeps an agent at the entrance and names the missing semantic category', () => {
    const room = {
      ...INTERIOR_DEFINITIONS['rest-cabin'], width: 9, height: 7, furniture: [], overflow: [{ x: 1, y: 1 }],
    };

    const assigned = assignInteriorOccupants(room, [snapshot({
      buildingId: 'empty-house', action: 'read', eventId: 'missing-search',
    })], 'empty-house')[0]!;
    expect(assigned).toMatchObject({
      point: { x: 4, y: 6 }, missingSemantic: 'search', seated: false,
    });
    expect(assigned.furnitureId).toBeUndefined();
  });

  it('exempts only the selected station at its anchor and rejects an unrelated target blocker', () => {
    const station = {
      id: 'blocking-station', kind: 'computer' as const, assetId: 225,
      point: { x: 2, y: 2 }, facing: 'down' as const,
      supportedActions: ['terminal' as const], icon: 'tool' as const, blocksNavigation: true,
      interactionPoint: { x: 2, y: 2 },
    };
    const baseRoom = {
      ...INTERIOR_DEFINITIONS['rest-cabin'], width: 6, height: 6,
      furniture: [station], overflow: [{ x: 1, y: 4 }],
    };
    const work = snapshot({ buildingId: 'test-room', action: 'terminal', eventId: 'blocking-station' });

    expect(assignInteriorOccupants(baseRoom, [work], 'test-room')[0]?.furnitureId).toBe(station.id);

    const unrelated = {
      id: 'unrelated-blocker', kind: 'chair' as const, assetId: 101,
      point: { x: 2, y: 2 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
    };
    const blocked = assignInteriorOccupants({ ...baseRoom, furniture: [station, unrelated] }, [work], 'test-room')[0]!;
    expect(blocked.furnitureId).toBe(station.id);
    expect(blocked.point).not.toEqual(station.interactionPoint);
    expect(isAdjacentToFurniture(blocked.point, station)).toBe(true);
    expect(blocked.missingSemantic).toBeUndefined();
  });
});
