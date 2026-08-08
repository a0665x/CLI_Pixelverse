import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD_PIXELS, WORLD_TILES, integerScaleFor } from '../src/game/constants';
// @ts-expect-error Node is Vitest's runtime but its ambient types are not part of this app.
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('fixed village game config', () => {
  it('uses the approved 40x22 world and pixel-perfect fixed camera settings', () => {
    expect(TILE_SIZE).toBe(16);
    expect(WORLD_TILES).toEqual({ width: 40, height: 22 });
    expect(WORLD_PIXELS).toEqual({ width: 640, height: 352 });
    expect(integerScaleFor(1280, 704)).toBe(2);
    expect(integerScaleFor(839, 479)).toBe(1);
  });

  it('lets the canvas own the viewport while the collapsible panel floats above it', () => {
    expect(styles).toContain('#app-shell { position: relative; width: 100vw; height: 100vh; }');
    expect(styles).toContain('#game-root { width: 100%; height: 100%;');
    expect(styles).toContain('#test-panel-root { position: absolute;');
    expect(styles).not.toContain('grid-template-columns: minmax(0, 1fr) 264px;');
    expect(styles).not.toContain('max-width: 100%');
  });
});
