import { describe, expect, it, vi } from 'vitest';
import { WorldScene } from '../src/scenes/WorldScene';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Math: {
    Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    Distance: { Between: vi.fn(() => 0) },
  },
} }));

describe('WorldScene locale propagation', () => {
  it('applies a locale selected before the cutaway system is created', () => {
    const cutawaySetLocale = vi.fn();
    const statusSetLocale = vi.fn();
    const scene = Object.create(WorldScene.prototype) as WorldScene;

    scene.setLocale('ja-JP');
    (scene as unknown as { attachCutawaySystem(system: { setLocale(locale: string): void }): void })
      .attachCutawaySystem({ setLocale: cutawaySetLocale });
    (scene as unknown as { attachStatusOverlay(system: { setLocale(locale: string): void }): void })
      .attachStatusOverlay({ setLocale: statusSetLocale });

    expect(cutawaySetLocale).toHaveBeenCalledWith('ja-JP');
    expect(statusSetLocale).toHaveBeenCalledWith('ja-JP');
  });

  it('retains the application locale and updates both visible scene systems', () => {
    const cutawaySetLocale = vi.fn();
    const statusSetLocale = vi.fn();
    const scene = Object.assign(Object.create(WorldScene.prototype), {
      cutawaySystem: { setLocale: cutawaySetLocale },
      statusOverlay: { setLocale: statusSetLocale },
    }) as WorldScene;

    scene.setLocale('ja-JP');
    scene.setLocale('ko-KR');

    expect(cutawaySetLocale.mock.calls).toEqual([['ja-JP'], ['ko-KR']]);
    expect(statusSetLocale.mock.calls).toEqual([['ja-JP'], ['ko-KR']]);
    expect((scene as unknown as { locale: string }).locale).toBe('ko-KR');
  });
});
