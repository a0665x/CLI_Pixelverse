import { describe, expect, it } from 'vitest';
import type { AgentPresence } from '../src/agents/agentPresence';
import { routeEvent } from '../src/events/behaviorRouter';
import { findPathVia } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { planAgentTravel } from '../src/navigation/travelPlanner';
import { StationAllocator } from '../src/stations/stationAllocator';
import type { AgentWorldEvent, GridPoint, WorldEventKind } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { assignInteriorOccupants } from '../src/rendering/interiorAssignment';
import { INTERIOR_DEFINITIONS } from '../src/world/interiorDefinitions';

const event = (kind: WorldEventKind): AgentWorldEvent => ({
  eventId: `accept-${kind}`,
  timestamp: 1,
  source: 'demo',
  agentId: 'main',
  agentRole: 'main',
  kind,
  phase: kind,
  activityLabel: kind,
});

const building = (id: string) => WORLD_DEFINITION.buildings.find((item) => item.id === id)!;
const inside = (buildingId: string): AgentPresence => ({
  kind: 'inside',
  buildingId,
  threshold: { ...building(buildingId).entrance.threshold },
});
const assignment = (kind: WorldEventKind) => {
  const route = routeEvent(event(kind));
  expect(route.destinationId).toBeTruthy();
  const result = new StationAllocator(WORLD_DEFINITION.stations).assign('main', route.destinationId!);
  expect(result.ok).toBe(true);
  return { route, assignment: result.ok ? result.assignment : undefined! };
};
const indexOfPoint = (points: GridPoint[], target: GridPoint) =>
  points.findIndex(({ x, y }) => x === target.x && y === target.y);

describe('complete GBA village hook workflow', () => {
  const grid = NavigationGrid.fromWorld(WORLD_DEFINITION);

  it('enters Maker Workshop for edit, then exits its door and walks to the Web / MCP Lab', () => {
    const edit = assignment('edit');
    const editPlan = planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, edit.assignment);
    const workshop = building('maker-workshop');
    expect(editPlan).toMatchObject({
      waypoints: [workshop.entrance.outside, workshop.entrance.threshold],
      destinationBuilding: { buildingId: workshop.id, threshold: workshop.entrance.threshold },
    });

    const web = assignment('web');
    const webPlan = planAgentTravel(WORLD_DEFINITION, inside(workshop.id), web.assignment);
    const research = building('network-lab');
    expect(webPlan.waypoints).toEqual([
      workshop.entrance.outside, research.entrance.outside, research.entrance.threshold,
    ]);
    const path = findPathVia(grid, workshop.entrance.threshold, webPlan.waypoints)!;
    expect(indexOfPoint(path, workshop.entrance.outside)).toBeLessThan(indexOfPoint(path, research.entrance.outside));
    expect(indexOfPoint(path, research.entrance.outside)).toBeLessThan(indexOfPoint(path, research.entrance.threshold));
    expect(path.length).toBeGreaterThan(2);
    expect(path.every((point) => grid.isWalkable(point))).toBe(true);
  });

  it('routes think, idle, and blocked into their distinct functional houses', () => {
    const think = assignment('think');
    const research = building('thinkers-cottage');
    const collaboration = building('collaboration-barn');
    const thinkPlan = planAgentTravel(WORLD_DEFINITION, inside(collaboration.id), think.assignment);
    expect(thinkPlan.waypoints).toEqual([
      collaboration.entrance.outside, research.entrance.outside, research.entrance.threshold,
    ]);

    const idle = assignment('idle');
    const rest = building('rest-cabin');
    expect(planAgentTravel(WORLD_DEFINITION, inside(research.id), idle.assignment)).toMatchObject({
      waypoints: [research.entrance.outside, rest.entrance.outside, rest.entrance.threshold],
      destinationBuilding: { buildingId: rest.id },
    });

    const blocked = assignment('blocked');
    const recovery = building('recovery-clinic');
    const blockedPlan = planAgentTravel(WORLD_DEFINITION, inside(research.id), blocked.assignment);
    expect(blockedPlan.destinationBuilding).toMatchObject({ buildingId: recovery.id });
    expect(blockedPlan.waypoints).toEqual([
      research.entrance.outside, recovery.entrance.outside, recovery.entrance.threshold,
    ]);
    expect(findPathVia(grid, research.entrance.threshold, blockedPlan.waypoints)).not.toBeNull();
  });

  it('routes clone and heartbeat into their own observable houses', () => {
    const clone = assignment('clone');
    const signal = building('collaboration-barn');
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, clone.assignment)).toMatchObject({
      waypoints: [signal.entrance.outside, signal.entrance.threshold],
      destinationBuilding: { buildingId: signal.id },
    });
    const heartbeat = routeEvent(event('heartbeat'));
    expect(heartbeat).toMatchObject({ preserveLocation: false, destinationId: 'heartbeat-pulse' });
  });

  it('completes Hook routing against a custom semantic workstation with no exact action metadata', () => {
    const route = routeEvent(event('tool'));
    const room = {
      ...INTERIOR_DEFINITIONS['maker-workshop'], width: 9, height: 7,
      furniture: [{
        id: 'player-desk', kind: 'desk' as const, point: { x: 4, y: 3 }, facing: 'down' as const,
        supportedActions: [], icon: 'generic' as const, blocksNavigation: true,
        interactionPoint: { x: 4, y: 5 },
      }],
      overflow: [],
    };

    expect(assignInteriorOccupants(room, [{
      agentId: 'main', role: 'main', buildingId: 'player-house', action: route.action,
      eventKind: 'tool', eventId: 'custom-semantic-work',
    }], 'player-house')[0]).toMatchObject({ furnitureId: 'player-desk', point: { x: 4, y: 4 } });
  });
});
