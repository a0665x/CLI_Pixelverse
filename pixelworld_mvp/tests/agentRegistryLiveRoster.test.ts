import { describe, expect, it, vi } from 'vitest';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

vi.mock('phaser', () => ({
  default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } },
}));

const chain = (state: Record<string, unknown> = {}) => Object.assign(state, {
  setOrigin: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
  setVisible: vi.fn(function (this: { visible: boolean }, visible: boolean) { this.visible = visible; return this; }),
  setText: vi.fn().mockReturnThis(), setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
    this.x = x; this.y = y; return this;
  }),
  setTexture: vi.fn().mockReturnThis(), setY: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), destroy: vi.fn(),
});

function harness() {
  const sprites: Array<ReturnType<typeof chain>> = [];
  const scene = {
    add: {
      image: vi.fn((x: number, y: number) => {
        const sprite = chain({ x, y, visible: true });
        sprites.push(sprite);
        return sprite;
      }),
      text: vi.fn(() => chain({ x: 0, y: 0, visible: true })),
    },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
  };
  return import('../src/agents/AgentRegistry').then(({ AgentRegistry }) => ({
    registry: new AgentRegistry(scene as never, NavigationGrid.fromWorld(WORLD_DEFINITION), WORLD_DEFINITION.spawn),
    sprites,
  }));
}

describe('AgentRegistry live roster', () => {
  it('adds stable backend IDs and removes the selected controller safely', async () => {
    const { registry } = await harness();
    const main = registry.ensure('codex-main', 'main', WORLD_DEFINITION.spawn);
    const clone = registry.ensure('reviewer-2', 'subagent', WORLD_DEFINITION.spawn);

    expect(main?.created).toBe(true);
    expect(clone?.created).toBe(true);
    expect(registry.ensure('reviewer-2', 'subagent', WORLD_DEFINITION.spawn)).toMatchObject({ created: false });
    expect(registry.select('reviewer-2')).toBe(true);

    const removedSprite = clone!.agent.sprite as unknown as { destroy: ReturnType<typeof vi.fn> };
    expect(registry.remove('reviewer-2')).toBe(true);
    expect(removedSprite.destroy).toHaveBeenCalledOnce();
    expect(registry.get('reviewer-2')).toBeUndefined();
    expect(registry.selected()).toBeDefined();
    expect(registry.selected().agentId).not.toBe('reviewer-2');
  });

  it('supports at least thirty-two simultaneous live agents', async () => {
    const { registry } = await harness();
    const created = Array.from({ length: 32 }, (_, index) => (
      registry.ensure(`live-${index}`, index === 0 ? 'main' : 'subagent', WORLD_DEFINITION.spawn)
    ));

    expect(created.every(Boolean)).toBe(true);
    expect(created.every((result) => result?.created)).toBe(true);
    expect(registry.all().filter(({ agentId }) => agentId.startsWith('live-'))).toHaveLength(32);
  });
});
