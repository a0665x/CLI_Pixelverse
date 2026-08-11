import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD_PIXELS, WORLD_TILES, displayScaleFor } from '../src/game/constants';
// @ts-expect-error Node is Vitest's runtime but its ambient types are not part of this app.
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('fixed village game config', () => {
  it('uses the expanded 48x28 world with a 1.5x desktop presentation', () => {
    expect(TILE_SIZE).toBe(16);
    expect(WORLD_TILES).toEqual({ width: 48, height: 28 });
    expect(WORLD_PIXELS).toEqual({ width: 768, height: 448 });
    expect(displayScaleFor(1280, 720)).toBe(1.5);
    expect(displayScaleFor(839, 479)).toBe(1);
  });

  it('lets the canvas own the viewport while the collapsible panel floats above it', () => {
    expect(styles).toContain('#app-shell { position: relative; width: 100vw; height: 100vh; }');
    expect(styles).toContain('#game-root { width: 100%; height: 100%;');
    expect(styles).toContain('#test-panel-root { position: absolute;');
    expect(styles).not.toContain('grid-template-columns: minmax(0, 1fr) 264px;');
    expect(styles).not.toContain('max-width: 100%');
  });
});
