import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD_PIXELS, WORLD_TILES, integerScaleFor } from '../src/game/constants';

describe('fixed village game config', () => {
  it('uses the approved 40x22 world and pixel-perfect fixed camera settings', () => {
    expect(TILE_SIZE).toBe(16);
    expect(WORLD_TILES).toEqual({ width: 40, height: 22 });
    expect(WORLD_PIXELS).toEqual({ width: 640, height: 352 });
    expect(integerScaleFor(1280, 704)).toBe(2);
    expect(integerScaleFor(839, 479)).toBe(1);
  });
});
