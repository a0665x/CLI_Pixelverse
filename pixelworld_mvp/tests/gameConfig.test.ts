import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD_PIXELS, WORLD_TILES, displayScaleFor } from '../src/game/constants';
// @ts-expect-error Node is Vitest's runtime but its ambient types are not part of this app.
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('fixed village game config', () => {
  it('uses the expanded 48x28 world with a 1.5x desktop presentation', () => {
    expect(TILE_SIZE).toBe(16);
    expect(WORLD_TILES).toEqual({ width: 48, height: 28 });
    expect(WORLD_PIXELS).toEqual({ width: 768, height: 448 });
    expect(displayScaleFor(1280, 720)).toBe(1.5);
    expect(displayScaleFor(839, 479)).toBeCloseTo(479 / 448);
    expect(displayScaleFor(800, 230)).toBeCloseTo(230 / 448);
  });

  it('lets the canvas own the viewport while the collapsible panel floats above it', () => {
    expect(styles).toContain('#app-shell { position: relative; width: 100vw; height: 100vh; }');
    expect(styles).toContain('#game-root { position: relative; width: 100%; height: 100%;');
    expect(styles).toContain('#game-root canvas { position: absolute; top: 0; left: 0;');
    expect(styles).toContain('#test-panel-root { position: absolute;');
    expect(styles).not.toContain('grid-template-columns: minmax(0, 1fr) 264px;');
    expect(styles).not.toContain('max-width: 100%');
  });

  it('does not capture a simple house click before the pan threshold is crossed', () => {
    const pointerDown = mainSource.slice(
      mainSource.indexOf("gameRoot.addEventListener('pointerdown'"),
      mainSource.indexOf("gameRoot.addEventListener('pointermove'"),
    );
    const pointerMove = mainSource.slice(
      mainSource.indexOf("gameRoot.addEventListener('pointermove'"),
      mainSource.indexOf('const finishDrag'),
    );
    expect(pointerDown).not.toContain('setPointerCapture');
    expect(pointerMove).toContain('setPointerCapture');
  });

  it('uses functional glass only for floating village and cutaway controls', () => {
    expect(styles).toContain('--material-content:');
    expect(styles).toContain('--material-structural:');
    expect(styles).toContain('--material-glass:');
    expect(styles).toContain('--material-glass-border:');

    expect(styles).toMatch(/#village-zoom-controls[^{}]*\{[^}]*background:\s*var\(--material-glass\)/s);
    expect(styles).toMatch(/\.cutaway-dom-actions[^{}]*\{[^}]*background:\s*var\(--material-glass\)/s);
    expect(styles).toMatch(/\.cutaway-dom-categories[^{}]*\{[^}]*background:\s*var\(--material-glass\)/s);
    expect(styles).toMatch(/\.cutaway-dom-page[^{}]*\{[^}]*background:\s*var\(--material-glass\)/s);
    expect(styles).toMatch(/\.cutaway-dom-inspector[^{}]*\{[^}]*background:\s*var\(--material-structural\)/s);

    expect(styles).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(styles).toContain('@media (prefers-contrast: more)');
    expect(styles).toContain('#game-root canvas { position: absolute; top: 0; left: 0; image-rendering: pixelated; image-rendering: crisp-edges;');
  });

  it('removes redundant village zoom controls while a cutaway owns the compact header', () => {
    expect(styles).toMatch(/body:has\(\.cutaway-dom-panel\)\s+#village-zoom-controls\s*\{[^}]*display:\s*none/s);
  });

  it('hides the actual exterior status host without speculative label-layer selectors', () => {
    expect(markup).toContain('id="world-status-layer"');
    expect(styles).toMatch(/#world-status-layer\[hidden\]\s*\{\s*display:\s*none !important;\s*\}/);
    expect(styles).not.toContain('.village-exterior-label-layer');
    expect(styles).not.toContain('.village-exterior-status-layer');
    expect(styles).not.toMatch(/#world-status-layer[^{}]*transition:/);
  });

  it('reduced motion keeps layout transforms independent from press scale', () => {
    const reducedMotion = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
      styles.indexOf('@media (prefers-contrast: more)'),
    );
    expect(reducedMotion).not.toContain('transform: none');
    expect(reducedMotion).toContain('scale: 1');
    expect(styles).toContain('.cutaway-dom-panel button:active { scale: .97;');
  });

  it('reserves contextual editor regions and exposes keyboard tooltips', () => {
    expect(styles).toMatch(/\.cutaway-dom-header[^{}]*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*auto;/s);
    expect(styles).toMatch(/\.cutaway-dom-catalog\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;[^}]*overflow:\s*clip;/s);
    expect(styles).toMatch(/\.cutaway-dom-categories\s*\{[^}]*pointer-events:\s*auto;/s);
    expect(styles).toMatch(/\.cutaway-dom-page\s*\{[^}]*pointer-events:\s*auto;/s);
    expect(styles).toMatch(/\.cutaway-dom-inspector[^{}]*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*auto;[^}]*overflow:\s*clip;/s);
    expect(styles).not.toMatch(/\.cutaway-dom-catalog\s*\{[^}]*(?:height:\s*112px|background:\s*var\(--material-structural\))/s);
    expect(styles).not.toMatch(/\.cutaway-dom-inspector\s*\{[^}]*(?:width:\s*168px|inset:\s*40px)/s);
    expect(styles).toContain('.cutaway-context-menu { position: absolute; z-index: 4; display: grid;');
    expect(styles).toMatch(/\.cutaway-context-menu\s*\{[^}]*overflow:\s*hidden;/s);
    expect(styles).not.toMatch(/\.cutaway-(?:dom-inspector|context-menu|room-toolbar|dom-catalog)\s*\{[^}]*overflow(?:-x|-y)?:\s*(?:auto|scroll)/s);
    expect(styles).toContain('.cutaway-dom-panel button[data-tooltip]:focus-visible::after');
    expect(styles).toContain('.cutaway-context-menu, .cutaway-guide-popover { transition: none; }');
  });

  it('lets contained expanded room labels wrap without overflow truncation', () => {
    expect(styles).toMatch(/\.cutaway-room-labels\s*\{[^}]*overflow:\s*visible;/s);
    expect(styles).toMatch(/\.cutaway-room-label:hover[^{}]*\{[^}]*overflow:\s*visible;[^}]*overflow-wrap:\s*anywhere;/s);
  });

  it('makes every contextual glass surface opaque when transparency is reduced', () => {
    const reducedTransparency = styles.slice(
      styles.indexOf('@media (prefers-reduced-transparency: reduce)'),
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reducedTransparency).toContain('.cutaway-context-menu');
    expect(reducedTransparency).toContain('.cutaway-guide-popover');
    expect(reducedTransparency).toContain('background: #16231f');
  });
});
