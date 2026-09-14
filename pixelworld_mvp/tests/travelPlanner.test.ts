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
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, assignment('think-plan', 13, 5))).toEqual({
      waypoints: [{ x: 13, y: 5 }, { x: 13, y: 4 }],
      destinationBuilding: { buildingId: 'thinkers-cottage', threshold: { x: 13, y: 4 } },
      stayInside: false,
    });
  });

  it('routes from one building door to another building door', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 13, 4), assignment('maker-edit', 41, 17))).toEqual({
      waypoints: [{ x: 13, y: 5 }, { x: 41, y: 17 }, { x: 41, y: 16 }],
      destinationBuilding: { buildingId: 'maker-workshop', threshold: { x: 41, y: 16 } },
      stayInside: false,
    });
  });

  it('routes from a building door to an outdoor assignment point', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 13, 4), assignment('village-square', 21, 14))).toEqual({
      waypoints: [{ x: 13, y: 5 }, { x: 21, y: 14 }],
      stayInside: false,
    });
  });

  it('keeps an Agent inside when changing stations in the same building', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('thinkers-cottage', 13, 4), assignment('think-plan', 14, 5))).toEqual({
      waypoints: [],
      destinationBuilding: { buildingId: 'thinkers-cottage', threshold: { x: 13, y: 4 } },
      stayInside: true,
    });
  });
});
