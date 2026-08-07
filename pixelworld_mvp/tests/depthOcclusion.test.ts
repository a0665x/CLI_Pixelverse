import { describe, expect, it } from 'vitest';
import { depthFromFootY, shouldFadeForeground } from '../src/rendering/DepthOcclusionSystem';

describe('depth and foreground occlusion', () => {
  it('uses foot Y with a stable tie breaker', () => {
    expect(depthFromFootY(160, 2)).toBe(160.002);
    expect(depthFromFootY(160, 3)).toBeGreaterThan(depthFromFootY(160, 2));
  });

  it('fades only when the selected Agent is fully covered and behind the baseline', () => {
    const foreground = { x: 10, y: 10, width: 48, height: 48 };
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 35, 58)).toBe(true);
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 70, 58)).toBe(false);
    expect(shouldFadeForeground({ x: 0, y: 0, width: 12, height: 20 }, foreground, 20, 58)).toBe(false);
  });
});
