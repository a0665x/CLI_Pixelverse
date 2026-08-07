import { describe, expect, it } from 'vitest';
import { initialPanelExpanded } from '../src/ui/TestPanel';

describe('initialPanelExpanded', () => {
  it('starts collapsed at 840px and expanded at 940px', () => {
    expect(initialPanelExpanded(840)).toBe(false);
    expect(initialPanelExpanded(940)).toBe(true);
  });
});
