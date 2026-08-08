import { describe, expect, it } from 'vitest';
import type { AgentPresence } from '../src/agents/agentPresence';
import { routeEvent } from '../src/events/behaviorRouter';
import { findPathVia } from '../src/navigation/aStar';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { planAgentTravel } from '../src/navigation/travelPlanner';
import { StationAllocator } from '../src/stations/stationAllocator';
import type { AgentWorldEvent, GridPoint, WorldEventKind } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

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

  it('enters Maker Workshop for edit, then exits its door and crosses the north bridge for web research', () => {
    const edit = assignment('edit');
    const editPlan = planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, edit.assignment);
    const workshop = building('maker-workshop');
    expect(editPlan).toMatchObject({
      waypoints: [workshop.entrance.outside, workshop.entrance.threshold],
      destinationBuilding: { buildingId: workshop.id, threshold: workshop.entrance.threshold },
    });

    const web = assignment('web');
    const webPlan = planAgentTravel(WORLD_DEFINITION, inside(workshop.id), web.assignment);
    const research = building('research-library');
    expect(webPlan.waypoints).toEqual([
      workshop.entrance.outside, research.entrance.outside, research.entrance.threshold,
    ]);
    const path = findPathVia(grid, workshop.entrance.threshold, webPlan.waypoints)!;
    expect(indexOfPoint(path, workshop.entrance.outside)).toBeLessThan(indexOfPoint(path, research.entrance.outside));
    expect(indexOfPoint(path, research.entrance.outside)).toBeLessThan(indexOfPoint(path, research.entrance.threshold));
    expect(path.some(({ y, x }) => y === 8 && x >= 18 && x <= 20)).toBe(true);
  });

  it('routes think through Research Library, idle to Rest Cabin, and blocked to the outdoor apron', () => {
    const think = assignment('think');
    const research = building('research-library');
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
    const blockedPlan = planAgentTravel(WORLD_DEFINITION, inside(research.id), blocked.assignment);
    expect(blockedPlan.destinationBuilding).toBeUndefined();
    expect(blockedPlan.waypoints[0]).toEqual(research.entrance.outside);
    expect(blockedPlan.waypoints.at(-1)).toEqual(blocked.assignment.point);
    expect(findPathVia(grid, research.entrance.threshold, blockedPlan.waypoints)).not.toBeNull();
  });

  it('keeps clone inside Collaboration Barn and heartbeat at the current presence', () => {
    const clone = assignment('clone');
    const signal = building('collaboration-barn');
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, clone.assignment)).toMatchObject({
      waypoints: [signal.entrance.outside, signal.entrance.threshold],
      destinationBuilding: { buildingId: signal.id },
    });
    const heartbeat = routeEvent(event('heartbeat'));
    expect(heartbeat.preserveLocation).toBe(true);
    expect(heartbeat).not.toHaveProperty('destinationId');
  });
});
