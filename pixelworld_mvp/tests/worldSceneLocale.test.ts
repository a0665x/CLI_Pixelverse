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
    const scene = Object.create(WorldScene.prototype) as WorldScene;

    scene.setLocale('ja-JP');
    (scene as unknown as { attachCutawaySystem(system: { setLocale(locale: string): void }): void })
      .attachCutawaySystem({ setLocale: cutawaySetLocale });

    expect(cutawaySetLocale).toHaveBeenCalledWith('ja-JP');
  });

  it('retains the application locale and updates the cutaway system', () => {
    const cutawaySetLocale = vi.fn();
    const scene = Object.assign(Object.create(WorldScene.prototype), {
      cutawaySystem: { setLocale: cutawaySetLocale },
    }) as WorldScene;

    scene.setLocale('ja-JP');
    scene.setLocale('ko-KR');

    expect(cutawaySetLocale.mock.calls).toEqual([['ja-JP'], ['ko-KR']]);
    expect((scene as unknown as { locale: string }).locale).toBe('ko-KR');
  });
});
