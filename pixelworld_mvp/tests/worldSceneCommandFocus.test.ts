import { describe, expect, it, vi } from 'vitest';
import { WorldScene } from '../src/scenes/WorldScene';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
} }));

function harness() {
  const select = vi.fn((id: string) => ['main', 'sub'].includes(id));
  const open = vi.fn();
  const scene = Object.assign(Object.create(WorldScene.prototype), {
    sceneReady: true,
    agents: { select },
    cutawaySystem: { open },
    listeners: new Set(),
    commandSelectionListeners: new Set(),
    lastLiveSnapshot: {
      agents: [{ agent: 'main', room_key: 'maker-workshop' }, { agent: 'sub', room_key: 'network-lab' }],
      events: [{ id: 'evt-sub', agent: 'sub', buildingId: 'network-lab' }],
    },
    notifyRoster: vi.fn(),
  }) as WorldScene;
  return { open, scene, select };
}

describe('WorldScene command focus endpoint', () => {
  it('routes parent agent, building, and event focus to visible village owners without echo', () => {
    const { open, scene, select } = harness();
    const emitted = vi.fn();
    scene.onCommandSelection(emitted);

    expect(scene.focusCommandSelection({ kind: 'agent', id: 'main' })).toBe(true);
    expect(scene.focusCommandSelection({ kind: 'building', id: 'maker-workshop' })).toBe(true);
    expect(scene.focusCommandSelection({ kind: 'building', id: 'code_workbench' })).toBe(true);
    expect(scene.focusCommandSelection({ kind: 'event', id: 'evt-sub' })).toBe(true);
    expect(scene.focusCommandSelection({
      kind: 'event', id: 'retained-event', agentId: 'main', buildingId: 'code_workbench',
    })).toBe(true);

    expect(select.mock.calls).toEqual([['main'], ['sub'], ['main']]);
    expect(open.mock.calls).toEqual([['maker-workshop'], ['maker-workshop'], ['network-lab'], ['maker-workshop']]);
    expect(emitted).not.toHaveBeenCalled();
  });

  it('publishes iframe agent and building clicks as command selections', () => {
    const { scene } = harness();
    const emitted: unknown[] = [];
    const detach = scene.onCommandSelection((selection) => emitted.push(selection));

    expect(scene.selectAgent('sub')).toBe(true);
    expect(scene.selectBuilding('network-lab')).toBe(true);
    detach();
    scene.selectAgent('main');

    expect(emitted).toEqual([
      { kind: 'agent', id: 'sub' },
      { kind: 'building', id: 'tool_forge' },
    ]);
  });
});
