import { describe, expect, it } from 'vitest';
import { assignInteriorOccupants, type InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
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
});
