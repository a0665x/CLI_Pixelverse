import { describe, expect, it } from 'vitest';
import { worldPointToOverlay } from '../src/rendering/domStatusOverlay';

describe('high-resolution DOM status positioning', () => {
  it('projects logical world coordinates into a fractionally scaled canvas rectangle', () => {
    expect(worldPointToOverlay(
      { x: 384, y: 224 },
      { left: 64, top: 24, width: 1_152, height: 672 },
    )).toEqual({ x: 640, y: 360 });
  });
});
