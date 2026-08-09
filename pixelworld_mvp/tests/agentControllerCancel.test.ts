import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import type { AgentTravelPlan } from '../src/agents/agentPresence';

vi.mock('phaser', () => ({ default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } } }));

const chain = (state: Record<string, unknown> = {}) => Object.assign(state, {
  setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
  setText: vi.fn().mockReturnThis(), setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; return this; }),
  setTexture: vi.fn().mockReturnThis(), setY: vi.fn(function (this: { y: number }, y: number) { this.y = y; return this; }),
  setAlpha: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), destroy: vi.fn(),
});

describe('AgentController cancellation', () => {
  beforeEach(() => vi.resetModules());

  it('freezes at the exact pixel, clears route state, and preserves the next dispatch origin', async () => {
    const sprite = chain({ x: 0, y: 0 }) as ReturnType<typeof chain> & { x: number; y: number };
    const icon = chain({ x: 0, y: 0 });
    const scene = {
      add: { image: vi.fn((x: number, y: number) => { sprite.x = x; sprite.y = y; return sprite; }), text: vi.fn(() => icon) },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    };
    const { AgentController } = await import('../src/agents/AgentController');
    const agent = new AgentController(scene as never, 'main', 'main', WORLD_DEFINITION.spawn, NavigationGrid.fromWorld(WORLD_DEFINITION));
    expect(scene.add.image).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number),
      'modern-agent-adam',
      3,
    );
    const event = { eventId: 'a', timestamp: 1, source: 'demo' as const, agentId: 'main', agentRole: 'main' as const, kind: 'edit' as const, phase: 'working', activityLabel: 'work' };
    const route = { destinationId: 'queue-benches', preserveLocation: false, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: 'wait', priority: 1 };
    const first = { agentId: 'main', stationId: 'queue-benches', anchorId: 'a', point: { x: 16, y: 12 }, facing: 'down' as const, action: 'queue' as const, kind: 'interaction' as const };
    const staleArrival = vi.fn();
    expect(agent.dispatch(event, first, route, staleArrival)).toBe(true);
    agent.update(100);
    expect(sprite.setTexture).toHaveBeenLastCalledWith('modern-agent-adam', expect.any(Number));
    const logical = { x: sprite.x, y: sprite.y };
    agent.applyRenderOffset(6);
    sprite.y -= 1;
    vi.spyOn(agent.actions, 'stop')
      .mockImplementationOnce(() => { sprite.y += 1; })
      .mockImplementation(() => undefined);
    agent.cancel();
    expect({ x: sprite.x, y: sprite.y }).toEqual(logical);
    expect(agent).toMatchObject({ currentPath: [] });
    expect(agent.currentEvent).toBeUndefined();
    expect(agent.currentRoute).toBeUndefined();
    expect(agent.currentAssignment).toBeUndefined();

    const second = { ...first, anchorId: 'b', point: { x: 17, y: 11 }, facing: 'right' as const };
    expect(agent.dispatch({ ...event, eventId: 'b' }, second, route)).toBe(true);
    agent.update(0);
    expect({ x: sprite.x, y: sprite.y }).toEqual(logical);
    let previous = { ...logical };
    for (let index = 0; index < 20; index += 1) {
      agent.update(100);
      const current = { x: sprite.x, y: sprite.y };
      expect(current.x === previous.x || current.y === previous.y).toBe(true);
      previous = current;
    }
    expect(staleArrival).not.toHaveBeenCalled();
  });

  it('keeps a cancelled departure outside instead of restoring hidden inside presence', async () => {
    const sprite = chain({ x: 0, y: 0, visible: true }) as ReturnType<typeof chain> & { x: number; y: number; visible: boolean };
    sprite.setVisible.mockImplementation(function (this: { visible: boolean }, visible: boolean) { this.visible = visible; return this; });
    const icon = chain({ x: 0, y: 0 });
    const scene = {
      add: { image: vi.fn((x: number, y: number) => { sprite.x = x; sprite.y = y; return sprite; }), text: vi.fn(() => icon) },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    };
    const { AgentController } = await import('../src/agents/AgentController');
    const agent = new AgentController(scene as never, 'main', 'main', WORLD_DEFINITION.spawn, NavigationGrid.fromWorld(WORLD_DEFINITION));
    const event = { eventId: 'enter', timestamp: 1, source: 'demo' as const, agentId: 'main', agentRole: 'main' as const, kind: 'edit' as const, phase: 'working', activityLabel: 'work' };
    const route = { destinationId: 'station', preserveLocation: false, action: 'type' as const, bubblePolicy: 'persistent' as const, bubbleText: 'work', priority: 1 };
    const building = WORLD_DEFINITION.buildings[0]!;
    const assignment = { agentId: 'main', stationId: 'station', anchorId: 'slot', point: building.entrance.threshold, facing: 'up' as const, action: 'type' as const, kind: 'interaction' as const };
    const enterPlan: AgentTravelPlan = {
      waypoints: [building.entrance.outside, building.entrance.threshold],
      destinationBuilding: { buildingId: building.id, threshold: building.entrance.threshold },
      stayInside: false,
    };
    expect(agent.dispatch(event, assignment, route, undefined, enterPlan)).toBe(true);
    for (let index = 0; index < 20 && agent.presence().kind === 'outside'; index += 1) agent.update(100_000);
    expect(agent.presence().kind).toBe('inside');

    const outdoor = { ...assignment, stationId: 'plaza', point: WORLD_DEFINITION.spawn };
    expect(agent.dispatch({ ...event, eventId: 'leave' }, outdoor, route, undefined, {
      waypoints: [building.entrance.outside, outdoor.point], stayInside: false,
    })).toBe(true);
    agent.update(100);
    agent.cancel();

    expect(agent.presence()).toEqual({ kind: 'outside' });
    expect(sprite.visible).toBe(true);
  });
});
