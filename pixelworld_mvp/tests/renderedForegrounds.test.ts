import { describe, expect, it } from 'vitest';
import { clearRenderedForegrounds } from '../src/rendering/renderedForegrounds';

describe('rendered foreground lifecycle', () => {
  it('clears stale foregrounds before a scene restart repopulates them', () => {
    const renderedForegrounds = [{ id: 'old-tree' }];

    clearRenderedForegrounds(renderedForegrounds);
    expect(renderedForegrounds).toEqual([]);

    renderedForegrounds.push({ id: 'new-tree' });
    expect(renderedForegrounds).toEqual([{ id: 'new-tree' }]);
  });
});
