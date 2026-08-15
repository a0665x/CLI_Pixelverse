import { describe, expect, it } from 'vitest';
import { dragPresentation } from '../src/rendering/interiorDragPresentation';

describe('interior drag presentation', () => {
  it('lifts and slightly fades a valid dragging item', () => {
    expect(dragPresentation('valid', 'dragging', false)).toEqual({
      scale: 1.035, alpha: 0.94, tone: 'valid', durationMs: 90,
    });
  });

  it('keeps legacy overlap feedback non-red because overlap is an accepted composition', () => {
    expect(dragPresentation('overlap', 'returning', false)).toEqual({
      scale: 1, alpha: 1, tone: 'valid', durationMs: 140,
    });
  });

  it('removes transform motion while retaining valid and invalid feedback', () => {
    expect(dragPresentation('blocks-door', 'dragging', true)).toEqual({
      scale: 1, alpha: 0.94, tone: 'invalid', durationMs: 0,
    });
    expect(dragPresentation('valid', 'idle', true).tone).toBe('neutral');
  });
});
