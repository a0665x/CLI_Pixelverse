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
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, assignment('planning-board', 5, 8))).toEqual({
      waypoints: [{ x: 6, y: 7 }, { x: 6, y: 6 }],
      destinationBuilding: { buildingId: 'knowledge-hall', threshold: { x: 6, y: 6 } },
      stayInside: false,
    });
  });

  it('routes from one building door to another building door', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('knowledge-hall', 6, 6), assignment('editing-desk', 18, 8))).toEqual({
      waypoints: [{ x: 6, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 6 }],
      destinationBuilding: { buildingId: 'build-workshop', threshold: { x: 20, y: 6 } },
      stayInside: false,
    });
  });

  it('routes from a building door to an outdoor assignment point', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('knowledge-hall', 6, 6), assignment('arrival', 20, 11))).toEqual({
      waypoints: [{ x: 6, y: 7 }, { x: 20, y: 11 }],
      stayInside: false,
    });
  });

  it('keeps an Agent inside when changing stations in the same building', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('knowledge-hall', 6, 6), assignment('reading-desk', 8, 8))).toEqual({
      waypoints: [],
      destinationBuilding: { buildingId: 'knowledge-hall', threshold: { x: 6, y: 6 } },
      stayInside: true,
    });
  });
});
