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
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, assignment('research-plan', 4, 7))).toEqual({
      waypoints: [{ x: 5, y: 7 }, { x: 5, y: 6 }],
      destinationBuilding: { buildingId: 'research-library', threshold: { x: 5, y: 6 } },
      stayInside: false,
    });
  });

  it('routes from one building door to another building door', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('research-library', 5, 6), assignment('maker-edit', 26, 7))).toEqual({
      waypoints: [{ x: 5, y: 7 }, { x: 28, y: 7 }, { x: 28, y: 6 }],
      destinationBuilding: { buildingId: 'maker-workshop', threshold: { x: 28, y: 6 } },
      stayInside: false,
    });
  });

  it('routes from a building door to an outdoor assignment point', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('research-library', 5, 6), assignment('arrival', 15, 11))).toEqual({
      waypoints: [{ x: 5, y: 7 }, { x: 15, y: 11 }],
      stayInside: false,
    });
  });

  it('keeps an Agent inside when changing stations in the same building', () => {
    expect(planAgentTravel(WORLD_DEFINITION, inside('research-library', 5, 6), assignment('research-read', 6, 7))).toEqual({
      waypoints: [],
      destinationBuilding: { buildingId: 'research-library', threshold: { x: 5, y: 6 } },
      stayInside: true,
    });
  });
});
