import { describe, expect, it, vi } from 'vitest';
import { InteriorFocusController } from '../src/rendering/InteriorFocusController';
import { WorldScene } from '../src/scenes/WorldScene';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Math: {
    Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    Distance: { Between: vi.fn(() => 0) },
  },
} }));

interface ExteriorStatusHarness {
  visible: boolean;
  setLocale: ReturnType<typeof vi.fn>;
  setExteriorLabelsVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function sceneHarness() {
  const calls: string[] = [];
  let scene: WorldScene;
  const status: ExteriorStatusHarness = {
    visible: true,
    setLocale: vi.fn(),
    setExteriorLabelsVisible: vi.fn((visible: boolean) => {
      calls.push(`status:${visible}`);
      status.visible = visible;
    }),
    destroy: vi.fn(() => calls.push('status:destroy')),
  };
  let roomLabelsVisible = true;
  const cutaway = {
    roomLabelsVisible: () => roomLabelsVisible,
    setRoomLabelsVisible: vi.fn((visible: boolean) => { roomLabelsVisible = visible; }),
    destroy: vi.fn(() => {
      calls.push('cutaway:destroy');
      scene.setInteriorFocused(false);
    }),
  };
  const focusController = new InteriorFocusController();
  const originalFocusDestroy = focusController.destroy.bind(focusController);
  focusController.destroy = vi.fn(() => {
    calls.push('focus:destroy');
    originalFocusDestroy();
  });
  scene = Object.assign(Object.create(WorldScene.prototype), {
    locale: 'zh-TW',
    focusController,
    cutawaySystem: cutaway,
    statusOverlay: status,
    animalSystem: { destroy: vi.fn() },
    agents: { destroy: vi.fn() },
    pendingCloneAgents: new Set(),
    liveAgentSignatures: new Map(),
    listeners: new Set(),
  }) as WorldScene;
  (scene as unknown as { attachStatusOverlay(system: ExteriorStatusHarness): void }).attachStatusOverlay(status);
  return { calls, cutaway, focusController, scene, status };
}

describe('WorldScene interior focus integration', () => {
  it('hides the real exterior status owner while preserving cutaway room labels', () => {
    const { cutaway, scene, status } = sceneHarness();

    scene.setInteriorFocused(true);
    scene.setInteriorFocused(true);

    expect(status.visible).toBe(false);
    expect(status.setExteriorLabelsVisible.mock.calls).toEqual([[false]]);
    expect(cutaway.roomLabelsVisible()).toBe(true);
    expect(cutaway.setRoomLabelsVisible).not.toHaveBeenCalled();

    scene.setInteriorFocused(false);

    expect(status.visible).toBe(true);
    expect(status.setExteriorLabelsVisible.mock.calls).toEqual([[false], [true]]);
    expect(cutaway.roomLabelsVisible()).toBe(true);
    expect(cutaway.setRoomLabelsVisible).not.toHaveBeenCalled();
  });

  it('tears down the cutaway before restoring focus and destroying exterior status', () => {
    const { calls, scene } = sceneHarness();
    scene.setInteriorFocused(true);

    (scene as unknown as { cleanupAgents(): void }).cleanupAgents();
    (scene as unknown as { cleanupAgents(): void }).cleanupAgents();

    expect(calls.slice(1)).toEqual([
      'cutaway:destroy',
      'status:true',
      'focus:destroy',
      'status:destroy',
    ]);
  });
});
