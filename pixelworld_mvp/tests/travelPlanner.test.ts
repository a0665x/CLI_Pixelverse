import { describe, expect, it } from 'vitest';
import type { AgentPresence } from '../src/agents/agentPresence';
import { planAgentTravel } from '../src/navigation/travelPlanner';
import type { StationAssignment } from '../src/stations/stationAllocator';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

const assignment = (stationId: string, x: number, y: number): StationAssignment => ({
  agentId: 'main', stationId, anchorId: `${stationId}:test`, point: { x, y },
  facing: 'up', action: 'plan', kind: 'interaction',
});

const inside = (buildingId: string, x: number, y: number): AgentPresence => ({
  kind: 'inside', buildingId, threshold: { x, y },
});

describe('planAgentTravel', () => {
  it('routes an outside Agent through the destination building door', () => {
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, assignment('think-plan', 11, 6))).toEqual({
      waypoints: [{ x: 11, y: 6 }, { x: 11, y: 5 }],
      destinationBuilding: { buildingId: 'thinkers-cottage', threshold: { x: 11, y: 5 } },
      stayInside: false,
    });
  });

  it('routes from one building door to another building door', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 11, 5), assignment('maker-edit', 42, 14))).toEqual({
      waypoints: [{ x: 11, y: 6 }, { x: 42, y: 14 }, { x: 42, y: 13 }],
      destinationBuilding: { buildingId: 'maker-workshop', threshold: { x: 42, y: 13 } },
      stayInside: false,
    });
  });

  it('routes from a building door to an outdoor assignment point', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 11, 5), assignment('village-square', 21, 14))).toEqual({
      waypoints: [{ x: 11, y: 6 }, { x: 21, y: 14 }],
      stayInside: false,
    });
  });

  it('keeps an Agent inside when changing stations in the same building', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 11, 5), assignment('think-plan', 12, 6))).toEqual({
      waypoints: [],
      destinationBuilding: { buildingId: 'thinkers-cottage', threshold: { x: 11, y: 5 } },
      stayInside: true,
    });
  });
});
