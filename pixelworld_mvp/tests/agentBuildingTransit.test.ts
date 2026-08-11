import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTravelPlan } from '../src/agents/agentPresence';
import type { NavigationGrid } from '../src/navigation/navigationGrid';

vi.mock('phaser', () => ({
  default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } },
}));

interface FakeSprite {
  x: number;
  y: number;
  visible: boolean;
  setOrigin: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setTexture: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const chain = (state: Record<string, unknown> = {}) => Object.assign(state, {
  setOrigin: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
  setVisible: vi.fn(function (this: { visible: boolean }, visible: boolean) { this.visible = visible; return this; }),
  setText: vi.fn().mockReturnThis(),
  setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; return this; }),
  setTexture: vi.fn().mockReturnThis(), setY: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), destroy: vi.fn(),
});

const event = (eventId: string) => ({
  eventId, timestamp: 1, source: 'demo' as const, agentId: 'main', agentRole: 'main' as const,
  kind: 'edit' as const, phase: 'working', activityLabel: 'work',
});
const route = { destinationId: 'station', preserveLocation: false, action: 'type' as const, bubblePolicy: 'persistent' as const, bubbleText: 'work', priority: 1 };
const assignment = (point: { x: number; y: number }, stationId = 'station') => ({
  agentId: 'main', stationId, anchorId: `${stationId}:slot`, point,
  facing: 'right' as const, action: 'type' as const, kind: 'interaction' as const,
});
const plan = (waypoints: Array<{ x: number; y: number }>, destinationBuilding?: AgentTravelPlan['destinationBuilding']): AgentTravelPlan => destinationBuilding
  ? { waypoints, destinationBuilding, stayInside: false }
  : { waypoints, stayInside: false };

function harness(blocked: Array<{ x: number; y: number }> = []) {
  const sprite = chain({ x: 0, y: 0, visible: true }) as unknown as FakeSprite;
  const icon = chain({ x: 0, y: 0 });
  const scene = {
    add: { image: vi.fn((x: number, y: number) => { sprite.x = x; sprite.y = y; return sprite; }), text: vi.fn(() => icon) },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
  };
  const blockedKeys = new Set(blocked.map(({ x, y }) => `${x},${y}`));
  const isWalkable = ({ x, y }: { x: number; y: number }) => x >= 0 && x < 10 && y >= 0 && y < 3 && !blockedKeys.has(`${x},${y}`);
  const grid = {
    isWalkable,
    costAt(point: { x: number; y: number }) { return isWalkable(point) ? 1 : undefined; },
  } as unknown as NavigationGrid;
  return import('../src/agents/AgentController').then(({ AgentController }) => ({
    agent: new AgentController(scene as never, 'main', 'main', { x: 0, y: 1 }, grid),
    sprite,
  }));
}

const arrive = (agent: { update(deltaMs: number): void }) => agent.update(10_000);

describe('AgentController building presence', () => {
  beforeEach(() => vi.resetModules());

  it('enters a building only after reaching its threshold', async () => {
    const { agent, sprite } = await harness();
    const threshold = { x: 4, y: 1 };

    expect(agent.dispatch(event('enter'), assignment(threshold), route, undefined,
      plan([{ x: 3, y: 1 }, threshold], { buildingId: 'forge', threshold }))).toBe(true);
    expect(agent.presence()).toEqual({ kind: 'outside' });
    expect(sprite.visible).toBe(true);

    arrive(agent);

    expect(agent.presence()).toEqual({ kind: 'inside', buildingId: 'forge', threshold });
    expect(sprite.visible).toBe(false);
  });

  it('starts an inside-to-outside trip at the stored threshold and crosses the old outside point', async () => {
    const { agent, sprite } = await harness();
    const threshold = { x: 4, y: 1 };
    const oldOutside = { x: 3, y: 1 };
    expect(agent.dispatch(event('enter'), assignment(threshold), route, undefined,
      plan([oldOutside, threshold], { buildingId: 'forge', threshold }))).toBe(true);
    arrive(agent);
    sprite.x = 999;
    sprite.y = 999;

    expect(agent.dispatch(event('leave'), assignment({ x: 0, y: 1 }, 'plaza'), route, undefined,
      plan([oldOutside, { x: 0, y: 1 }]))).toBe(true);

    expect(agent.presence()).toEqual({ kind: 'outside' });
    expect(sprite.visible).toBe(true);
    expect(agent.currentPath.slice(0, 2)).toEqual([threshold, oldOutside]);
    expect(agent.tilePosition()).toEqual(threshold);
  });

  it('travels from one building threshold to another through both outside points', async () => {
    const { agent, sprite } = await harness();
    const firstThreshold = { x: 2, y: 1 };
    expect(agent.dispatch(event('enter-a'), assignment(firstThreshold), route, undefined,
      plan([{ x: 1, y: 1 }, firstThreshold], { buildingId: 'a', threshold: firstThreshold }))).toBe(true);
    arrive(agent);
    const secondThreshold = { x: 7, y: 1 };

    expect(agent.dispatch(event('enter-b'), assignment(secondThreshold), route, undefined,
      plan([{ x: 3, y: 1 }, { x: 6, y: 1 }, secondThreshold], { buildingId: 'b', threshold: secondThreshold }))).toBe(true);
    expect(agent.currentPath).toEqual([
      firstThreshold, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, secondThreshold,
    ]);
    expect(sprite.visible).toBe(true);
    arrive(agent);
    expect(agent.presence()).toEqual({ kind: 'inside', buildingId: 'b', threshold: secondThreshold });
    expect(sprite.visible).toBe(false);
  });

  it('retargets within the same building without revealing the Agent', async () => {
    const { agent, sprite } = await harness();
    const threshold = { x: 4, y: 1 };
    expect(agent.dispatch(event('enter'), assignment(threshold), route, undefined,
      plan([{ x: 3, y: 1 }, threshold], { buildingId: 'forge', threshold }))).toBe(true);
    arrive(agent);
    const onArrive = vi.fn();

    expect(agent.dispatch(event('inside-work'), assignment({ x: 8, y: 2 }, 'forge-desk'), route, onArrive, {
      waypoints: [], destinationBuilding: { buildingId: 'forge', threshold }, stayInside: true,
    })).toBe(true);

    expect(agent.presence()).toEqual({ kind: 'inside', buildingId: 'forge', threshold });
    expect(sprite.visible).toBe(false);
    expect(agent.currentEvent?.eventId).toBe('inside-work');
    expect(agent.currentPath).toEqual([]);
    expect(onArrive).toHaveBeenCalledOnce();
  });

  it('keeps a hidden inside Agent unchanged when a complete route cannot be planned', async () => {
    const { agent, sprite } = await harness([{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }]);
    const threshold = { x: 2, y: 1 };
    expect(agent.dispatch(event('enter'), assignment(threshold), route, undefined,
      plan([{ x: 1, y: 1 }, threshold], { buildingId: 'a', threshold }))).toBe(true);
    arrive(agent);

    expect(agent.dispatch(event('blocked'), assignment({ x: 8, y: 1 }, 'b'), route, undefined,
      plan([{ x: 3, y: 1 }, { x: 8, y: 1 }]))).toBe(false);

    expect(agent.presence()).toEqual({ kind: 'inside', buildingId: 'a', threshold });
    expect(sprite.visible).toBe(false);
    expect(agent.currentEvent?.eventId).toBe('enter');
  });

  it('cycles authored LimeZu right-facing walk frames while the taller main Agent walks', async () => {
    const { agent, sprite } = await harness();
    expect(agent.dispatch(event('walk'), assignment({ x: 9, y: 1 }), route)).toBe(true);

    agent.update(100);
    agent.update(100);
    agent.update(100);
    agent.update(100);

    const frames = sprite.setTexture.mock.calls.map((call) => call[1]);
    expect(new Set(frames)).toEqual(new Set([24, 25, 26, 27]));
  });

  it('excludes hidden inside Agents from registry overlap offsets', async () => {
    const sprites: FakeSprite[] = [];
    const scene = {
      add: {
        image: vi.fn((x: number, y: number) => {
          const sprite = chain({ x, y, visible: true }) as unknown as FakeSprite;
          sprites.push(sprite);
          return sprite;
        }),
        text: vi.fn(() => chain({ x: 0, y: 0 })),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    };
    const isWalkable = ({ x, y }: { x: number; y: number }) => x >= 0 && x < 10 && y >= 0 && y < 3;
    const grid = {
      isWalkable,
      costAt(point: { x: number; y: number }) { return isWalkable(point) ? 1 : undefined; },
    } as unknown as NavigationGrid;
    const { AgentRegistry } = await import('../src/agents/AgentRegistry');
    const registry = new AgentRegistry(scene as never, grid, { x: 0, y: 1 });
    const main = registry.selected();
    const threshold = { x: 2, y: 1 };
    expect(main.dispatch(event('enter'), assignment(threshold), route, undefined,
      plan([{ x: 1, y: 1 }, threshold], { buildingId: 'forge', threshold }))).toBe(true);
    arrive(main);
    registry.createSubagent(threshold);

    registry.update(0);

    expect(sprites[0]!.x).toBe(threshold.x * 16 + 8);
    expect(sprites[1]!.x).toBe(threshold.x * 16 + 8);
  });
});
