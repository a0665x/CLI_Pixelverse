import { describe, expect, it, vi } from 'vitest';
import { EventIngress } from '../src/events/eventIngress';
import { WorldScene } from '../src/scenes/WorldScene';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
} }));

const event = (eventId: string, agentId: string, kind: 'clone' | 'edit' = 'clone') => ({
  eventId, timestamp: 1, source: 'demo' as const, agentId, agentRole: agentId === 'main' ? 'main' as const : 'subagent' as const,
  kind, phase: 'working', activityLabel: kind,
});

function harness(options: { size?: number; kind?: 'interaction' | 'queue' } = {}) {
  const callbacks = new Map<string, (() => void) | undefined>();
  const makeAgent = (id: string) => ({
    agentId: id, role: id === 'main' ? 'main' : 'subagent', cancel: vi.fn(), heartbeat: vi.fn(),
    dispatch: vi.fn((_event, _assignment, _route, callback) => { callbacks.set(id, callback); return true; }),
  });
  const agents = new Map([['main', makeAgent('main')], ['subagent-1', makeAgent('subagent-1')]]);
  const size = options.size ?? 2;
  const registry = {
    get: (id: string) => agents.get(id),
    canCreateSubagent: (reserved = 0) => size + reserved < 11,
    createSubagent: vi.fn(), destroy: vi.fn(),
  };
  let sequence = 0;
  const allocator = {
    assignmentFor: vi.fn(), releaseAgent: vi.fn(),
    assign: vi.fn((agentId: string) => ({ ok: true, assignment: {
      agentId, stationId: 'dispatch-pad', anchorId: `anchor-${sequence++}`, point: { x: 34, y: 8 }, facing: 'up', action: 'dispatch', kind: options.kind ?? 'interaction',
    } })),
  };
  const scene = Object.assign(Object.create(WorldScene.prototype), {
    ingress: new EventIngress(), allocator, agents: registry, pendingCloneAgents: new Set<string>(),
    statusOverlay: { publish: vi.fn(), showError: vi.fn(), attachAgent: vi.fn(), destroy: vi.fn() },
    worldDefinition: { stations: [{ id: 'dispatch-pad', buildingId: 'signal-station' }] },
    bindAgentSelection: vi.fn(), notifyRoster: vi.fn(), listeners: new Set(),
  }) as WorldScene;
  return { scene, agents, registry, allocator, callbacks };
}

describe('WorldScene clone reservations', () => {
  it('uses the normalized Agent id throughout accepted dispatch', () => {
    const { scene, agents, allocator } = harness();
    const padded = { ...event('normalized', 'main', 'edit'), agentId: ' main ' };

    expect(scene.dispatchWorldEvent(padded)).toEqual({ ok: true });
    expect(allocator.assign).toHaveBeenCalledWith('main', 'editing-desk', expect.any(Set));
    expect(agents.get('main')!.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'main' }), expect.objectContaining({ agentId: 'main' }), expect.any(Object), undefined,
    );
    expect((scene as unknown as { statusOverlay: { publish: ReturnType<typeof vi.fn> } }).statusOverlay.publish)
      .toHaveBeenCalledWith(agents.get('main'), expect.objectContaining({ agentId: 'main' }), expect.any(Object), undefined);
  });

  it('rejects queued clones without dispatching', () => {
    const { scene, agents } = harness({ kind: 'queue' });
    expect(scene.dispatchWorldEvent(event('q', 'main'))).toEqual({ ok: false, reason: 'clone-queue' });
    expect(agents.get('main')!.dispatch).not.toHaveBeenCalled();
    expect((scene as unknown as { statusOverlay: { showError: ReturnType<typeof vi.fn> } }).statusOverlay.showError)
      .toHaveBeenCalledWith(agents.get('main'), 'clone-queue');
  });

  it('rejects clones at the main-plus-ten cap', () => {
    const { scene, agents } = harness({ size: 11 });
    expect(scene.dispatchWorldEvent(event('cap', 'main'))).toEqual({ ok: false, reason: 'agent-cap' });
    expect((scene as unknown as { statusOverlay: { showError: ReturnType<typeof vi.fn> } }).statusOverlay.showError)
      .toHaveBeenCalledWith(agents.get('main'), 'agent-cap');
  });

  it('publishes station-full and no-path failures to the overlay', () => {
    const stationFull = harness();
    stationFull.allocator.assign.mockReturnValueOnce({ ok: false, reason: 'station-full' } as never);
    expect(stationFull.scene.dispatchWorldEvent(event('full', 'main', 'edit'))).toEqual({ ok: false, reason: 'station-full' });
    expect((stationFull.scene as unknown as { statusOverlay: { showError: ReturnType<typeof vi.fn> } }).statusOverlay.showError)
      .toHaveBeenCalledWith(stationFull.agents.get('main'), 'station-full');

    const noPath = harness();
    noPath.agents.get('main')!.dispatch.mockReturnValueOnce(false);
    noPath.allocator.assign.mockReturnValueOnce({ ok: true, assignment: {
      agentId: 'main', stationId: 'dispatch-pad', anchorId: 'blocked', point: { x: 34, y: 8 }, facing: 'up', action: 'dispatch', kind: 'interaction',
    } } as never).mockReturnValueOnce({ ok: false, reason: 'station-full' } as never);
    expect(noPath.scene.dispatchWorldEvent(event('path', 'main', 'edit'))).toEqual({ ok: false, reason: 'no-path' });
    expect((noPath.scene as unknown as { statusOverlay: { showError: ReturnType<typeof vi.fn> } }).statusOverlay.showError)
      .toHaveBeenCalledWith(noPath.agents.get('main'), 'no-path');
  });

  it('counts concurrent pending clones against capacity', () => {
    const { scene } = harness({ size: 10 });
    expect(scene.dispatchWorldEvent(event('one', 'main'))).toEqual({ ok: true });
    expect(scene.dispatchWorldEvent(event('two', 'subagent-1'))).toEqual({ ok: false, reason: 'agent-cap' });
  });

  it('releases a pending clone when its Agent is retargeted', () => {
    const { scene } = harness({ size: 10 });
    expect(scene.dispatchWorldEvent(event('one', 'main'))).toEqual({ ok: true });
    expect(scene.dispatchWorldEvent(event('edit', 'main', 'edit'))).toEqual({ ok: true });
    expect(scene.dispatchWorldEvent(event('two', 'subagent-1'))).toEqual({ ok: true });
  });

  it('releases reservations on arrival and scene cleanup', () => {
    const { scene, callbacks } = harness({ size: 10 });
    expect(scene.dispatchWorldEvent(event('one', 'main'))).toEqual({ ok: true });
    callbacks.get('main')?.();
    expect(scene.dispatchWorldEvent(event('two', 'subagent-1'))).toEqual({ ok: true });
    (scene as unknown as { cleanupAgents(): void }).cleanupAgents();
    expect((scene as unknown as { pendingCloneAgents: Set<string> }).pendingCloneAgents.size).toBe(0);
  });
});
