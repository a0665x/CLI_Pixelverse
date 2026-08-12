import { describe, expect, it, vi } from 'vitest';
import { WorldScene } from '../src/scenes/WorldScene';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
} }));

describe('WorldScene live roster reconciliation', () => {
  it('creates stable agents, dispatches changed work, and removes stale agents', () => {
    const controllers = new Map<string, { agentId: string; role: 'main' | 'subagent'; sprite: { setInteractive: ReturnType<typeof vi.fn> } }>();
    controllers.set('main', { agentId: 'main', role: 'main', sprite: { setInteractive: vi.fn() } });
    const ensure = vi.fn((id: string, role: 'main' | 'subagent') => {
      const existing = controllers.get(id);
      if (existing) return { agent: existing, created: false };
      const agent = { agentId: id, role, sprite: { setInteractive: vi.fn(() => ({ on: vi.fn() })) } };
      controllers.set(id, agent);
      return { agent, created: true };
    });
    const remove = vi.fn((id: string) => controllers.delete(id));
    const scene = Object.assign(Object.create(WorldScene.prototype), {
      sceneReady: true,
      agents: { ensure, remove, all: () => [...controllers.values()] },
      statusOverlay: { attachAgent: vi.fn(), detachAgent: vi.fn() },
      allocator: { releaseAgent: vi.fn() },
      liveAgentSignatures: new Map(),
      pendingCloneAgents: new Set(),
      bindAgentSelection: vi.fn(), notifyRoster: vi.fn(),
      dispatchWorldEvent: vi.fn(() => ({ ok: true })),
    }) as WorldScene;
    const snapshot = { agents: [
      { agent: 'codex-main', role: 'main_agent', state: 'working', pixel_state: 'editing_files', task: '整合地圖' },
      { agent: 'reviewer', role: 'subagent', state: 'working', pixel_state: 'reading_files', task: '審查' },
    ] };

    expect(scene.syncLiveSnapshot(snapshot, 7)).toEqual({ added: 2, removed: 1, dispatched: 2 });
    expect(controllers.has('main')).toBe(false);
    expect(scene.syncLiveSnapshot(snapshot, 8)).toEqual({ added: 0, removed: 0, dispatched: 0 });
    expect(scene.dispatchWorldEvent).toHaveBeenCalledTimes(2);

    expect(scene.syncLiveSnapshot({ agents: [snapshot.agents[0]!] }, 9)).toEqual({ added: 0, removed: 1, dispatched: 0 });
    expect(remove).toHaveBeenCalledWith('reviewer');
  });
});
