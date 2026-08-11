import { describe, expect, it, vi } from 'vitest';
import { AmbientAnimalSystem, advanceAnimal, animalShouldFlip, pointInsideRect } from '../src/rendering/AmbientAnimalSystem';
import type { AmbientAnimalDefinition } from '../src/world/types';

const cow: AmbientAnimalDefinition = {
  id: 'cow-test', species: 'cow', patrolBounds: { x: 4, y: 5, width: 3, height: 2 },
  start: { x: 5, y: 6 }, speed: 8,
};

describe('ambient animal motion', () => {
  it('is deterministic and stays inside its declared pasture', () => {
    const state = { point: { ...cow.start }, targetIndex: 0, idleMs: 0, direction: 'idle' as const };
    const first = advanceAnimal(state, cow, 1_000);
    const second = advanceAnimal(state, cow, 1_000);

    expect(first).toEqual(second);
    expect(pointInsideRect(first.point, cow.patrolBounds)).toBe(true);
    expect(first).not.toHaveProperty('navigationGrid');
  });

  it('grazes horizontally so a side-facing animal never appears to crab-walk', () => {
    const left = advanceAnimal({
      point: { x: 5, y: 6 }, targetIndex: 0, idleMs: 0, direction: 'idle',
    }, cow, 500);
    const right = advanceAnimal({
      point: { x: 4.5, y: 6 }, targetIndex: 1, idleMs: 0, direction: 'left',
    }, cow, 500);

    expect(left.point.y).toBe(6);
    expect(left.direction).toBe('left');
    expect(right.point.y).toBe(6);
    expect(right.direction).toBe('right');
  });

  it('keeps the last facing while pausing to graze', () => {
    const paused = advanceAnimal({
      point: { x: 5, y: 6 }, targetIndex: 0, idleMs: 400, direction: 'left',
    }, cow, 100);

    expect(paused.direction).toBe('left');
    expect(paused.point).toEqual({ x: 5, y: 6 });
  });

  it('honors each source sprite direction so the left-facing pig never walks backward', () => {
    expect(animalShouldFlip('pig', 'left')).toBe(false);
    expect(animalShouldFlip('pig', 'right')).toBe(true);
    expect(animalShouldFlip('sheep', 'left')).toBe(true);
    expect(animalShouldFlip('sheep', 'right')).toBe(false);
  });

  it('owns only ambient sprites and destroys every one', () => {
    const sprites: Array<{ destroyed: boolean }> = [];
    const scene = { add: { image: vi.fn(() => {
      const sprite = {
        destroyed: false, x: 0, y: 0,
        setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; return this; }),
        setFlipX: vi.fn().mockReturnThis(), destroy: vi.fn(function (this: { destroyed: boolean }) { this.destroyed = true; }),
      };
      sprites.push(sprite);
      return sprite;
    }) } };
    const system = new AmbientAnimalSystem(scene as never, [cow]);

    system.update(500);
    system.destroy();

    expect(sprites).toHaveLength(1);
    expect(sprites.every(({ destroyed }) => destroyed)).toBe(true);
  });
});
