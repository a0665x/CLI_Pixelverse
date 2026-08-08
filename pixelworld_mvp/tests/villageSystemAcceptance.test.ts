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

  it('enters Build Workshop for edit, then exits its door and uses the road to Signal Station for tool', () => {
    const edit = assignment('edit');
    const editPlan = planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, edit.assignment);
    const workshop = building('build-workshop');
    expect(editPlan).toMatchObject({
      waypoints: [workshop.entrance.outside, workshop.entrance.threshold],
      destinationBuilding: { buildingId: workshop.id, threshold: workshop.entrance.threshold },
    });

    const tool = assignment('tool');
    const toolPlan = planAgentTravel(WORLD_DEFINITION, inside(workshop.id), tool.assignment);
    const signal = building('signal-station');
    expect(toolPlan.waypoints).toEqual([
      workshop.entrance.outside, signal.entrance.outside, signal.entrance.threshold,
    ]);
    const path = findPathVia(grid, workshop.entrance.threshold, toolPlan.waypoints)!;
    expect(indexOfPoint(path, workshop.entrance.outside)).toBeLessThan(indexOfPoint(path, signal.entrance.outside));
    expect(indexOfPoint(path, signal.entrance.outside)).toBeLessThan(indexOfPoint(path, signal.entrance.threshold));
    expect(path.some(({ y, x }) => y === 8 && x > workshop.entrance.outside.x && x < signal.entrance.outside.x)).toBe(true);
  });

  it('routes think through Knowledge Hall and exits buildings for outdoor idle/blocked hooks', () => {
    const think = assignment('think');
    const knowledge = building('knowledge-hall');
    const signal = building('signal-station');
    const thinkPlan = planAgentTravel(WORLD_DEFINITION, inside(signal.id), think.assignment);
    expect(thinkPlan.waypoints).toEqual([
      signal.entrance.outside, knowledge.entrance.outside, knowledge.entrance.threshold,
    ]);

    for (const kind of ['idle', 'blocked'] as const) {
      const next = assignment(kind);
      const plan = planAgentTravel(WORLD_DEFINITION, inside(knowledge.id), next.assignment);
      expect(plan.destinationBuilding).toBeUndefined();
      expect(plan.waypoints[0]).toEqual(knowledge.entrance.outside);
      expect(plan.waypoints.at(-1)).toEqual(next.assignment.point);
      expect(findPathVia(grid, knowledge.entrance.threshold, plan.waypoints)).not.toBeNull();
    }
  });

  it('keeps clone inside Signal Station and heartbeat at the current presence', () => {
    const clone = assignment('clone');
    const signal = building('signal-station');
    expect(planAgentTravel(WORLD_DEFINITION, { kind: 'outside' }, clone.assignment)).toMatchObject({
      waypoints: [signal.entrance.outside, signal.entrance.threshold],
      destinationBuilding: { buildingId: signal.id },
    });
    const heartbeat = routeEvent(event('heartbeat'));
    expect(heartbeat.preserveLocation).toBe(true);
    expect(heartbeat).not.toHaveProperty('destinationId');
  });
});
