import { describe, expect, it } from 'vitest';
import { agentAnimationFrame } from '../src/rendering/agentAnimation';

describe('authored Agent animation', () => {
  it('uses the Adam sheet authored idle directions without mirroring', () => {
    expect(agentAnimationFrame('down', false, 0)).toBe(3);
    expect(agentAnimationFrame('up', false, 0)).toBe(1);
    expect(agentAnimationFrame('left', false, 0)).toBe(2);
    expect(agentAnimationFrame('right', false, 0)).toBe(0);
  });

  it('cycles the authored six-frame walk row for every direction', () => {
    expect([0, 120, 240, 360, 480, 600].map((ms) => agentAnimationFrame('right', true, ms)))
      .toEqual([24, 25, 26, 27, 28, 29]);
    expect(agentAnimationFrame('up', true, 0)).toBe(30);
    expect(agentAnimationFrame('left', true, 0)).toBe(36);
    expect(agentAnimationFrame('down', true, 0)).toBe(42);
  });
});
