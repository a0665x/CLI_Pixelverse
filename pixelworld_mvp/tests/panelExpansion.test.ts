import { describe, expect, it, vi } from 'vitest';
import { bindPanelBreakpoint, initialPanelExpanded, PANEL_LAYOUT } from '../src/ui/TestPanel';

describe('initialPanelExpanded', () => {
  it('starts collapsed at both compact and desktop widths so the fixed village dominates', () => {
    expect(initialPanelExpanded(840)).toBe(false);
    expect(initialPanelExpanded(940)).toBe(false);
    expect(initialPanelExpanded(1280)).toBe(false);
  });

  it('tracks a 1280 to 840 breakpoint transition and removes the listener on cleanup', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    const query = {
      matches: true,
      addEventListener: vi.fn((_name: 'change', next: typeof listener) => { listener = next; }),
      removeEventListener: vi.fn(),
    };
    const states: boolean[] = [];
    const cleanup = bindPanelBreakpoint(query, (expanded) => states.push(expanded));
    listener?.({ matches: false });
    cleanup();
    expect(states).toEqual([false, false]);
    expect(query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('keeps the unclipped header at 44px and pads controls separately', () => {
    expect(PANEL_LAYOUT).toEqual({ headerClass: 'panel-header', controlsId: 'test-panel-controls', headerHeight: 44, controlsPadding: 10 });
  });
});
