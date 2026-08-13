import { describe, expect, it } from 'vitest';
import { assignInteriorOccupants, type InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { interiorInteractionPoint } from '../src/rendering/prefabGeometry';
import { interiorPath } from '../src/rendering/interiorMotion';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';

const snapshot = (overrides: Partial<InteriorAgentSnapshot>): InteriorAgentSnapshot => ({
  agentId: 'main', role: 'main', buildingId: 'rest-cabin', action: 'rest',
  eventKind: 'idle', eventId: 'idle-1', ...overrides,
});

describe('interior occupant assignment', () => {
  it('seats idle at the sofa and puts offline at the bed', () => {
    const rest = INTERIOR_DEFINITIONS['rest-cabin'];
    expect(assignInteriorOccupants(rest, [snapshot({})])[0]).toMatchObject({
      agentId: 'main', furnitureId: 'rest-sofa-a', icon: 'rest', seated: true,
    });
    expect(assignInteriorOccupants(rest, [snapshot({ action: 'offline', eventKind: 'offline' })])[0]).toMatchObject({
      furnitureId: 'rest-bed-a', icon: 'offline', seated: true,
    });
  });

  it('maps web work to an action-bearing research workstation and changes station by activity cycle id', () => {
    const research = INTERIOR_DEFINITIONS['research-library'];
    const first = assignInteriorOccupants(research, [snapshot({
      buildingId: 'research-library', action: 'signal', eventKind: 'web', eventId: 'web-cycle-0',
    })])[0]!;
    const second = assignInteriorOccupants(research, [snapshot({
      buildingId: 'research-library', action: 'signal', eventKind: 'web', eventId: 'web-cycle-1',
    })])[0]!;

    expect(research.furniture.find(({ id }) => id === first.furnitureId)?.supportedActions).toContain('signal');
    expect(research.furniture.find(({ id }) => id === second.furnitureId)?.supportedActions).toContain('signal');
    expect(first.furnitureId).not.toBe(second.furnitureId);
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
    const anchor = interiorInteractionPoint(maker, furniture);
    const door = { x: Math.floor(maker.width / 2), y: maker.height - 1 };
    const path = interiorPath(maker, door, anchor, furniture.id);

    expect(furniture.supportedActions).toContain('terminal');
    expect(assigned.point).toEqual(anchor);
    expect(path.at(-1)).toEqual(anchor);
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
      expect(assignment.point).toEqual(room.furniture.find(({ id }) => id === assignment.furnitureId)!.interactionPoint);
    });
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
    expect(blocked.furnitureId).toBeUndefined();
    expect(blocked.point).toEqual({ x: 1, y: 4 });
  });
});
