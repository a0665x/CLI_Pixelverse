import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { NavigationGrid } from '../src/navigation/navigationGrid';

vi.mock('phaser', () => ({ default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } } }));

const chain = (state: Record<string, unknown> = {}) => Object.assign(state, {
  setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
  setText: vi.fn().mockReturnThis(), setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; return this; }),
  setTexture: vi.fn().mockReturnThis(), setY: vi.fn(function (this: { y: number }, y: number) { this.y = y; return this; }),
  setAlpha: vi.fn().mockReturnThis(), destroy: vi.fn(),
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
    const event = { eventId: 'a', timestamp: 1, source: 'demo' as const, agentId: 'main', agentRole: 'main' as const, kind: 'edit' as const, phase: 'working', activityLabel: 'work' };
    const route = { destinationId: 'queue-plaza', preserveLocation: false, action: 'queue' as const, bubblePolicy: 'persistent' as const, bubbleText: 'wait', priority: 1 };
    const first = { agentId: 'main', stationId: 'queue-plaza', anchorId: 'a', point: { x: 20, y: 12 }, facing: 'down' as const, action: 'queue' as const, kind: 'interaction' as const };
    const staleArrival = vi.fn();
    expect(agent.dispatch(event, first, route, staleArrival)).toBe(true);
    agent.update(100);
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

    const second = { ...first, anchorId: 'b', point: { x: 21, y: 12 }, facing: 'right' as const };
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
});
