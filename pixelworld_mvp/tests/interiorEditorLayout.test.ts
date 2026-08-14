import { describe, expect, it } from 'vitest';
import { contextToolbarPlacement, interiorEditorLayout } from '../src/rendering/interiorEditorLayout';

describe('interior editor layout', () => {
  it('targets the approved 720 by 495 desktop frame', () => {
    const layout = interiorEditorLayout(960, 560, {
      editMode: false,
      catalogExpanded: false,
      inspectorExpanded: false,
    });
    expect(layout.frame).toEqual({ x: 120, y: 33, width: 720, height: 495 });
    expect(layout.room.y).toBeGreaterThanOrEqual(layout.header.y + layout.header.height);
    expect(layout.room.y + layout.room.height).toBeLessThanOrEqual(layout.catalog.y);
  });

  it('keeps every region inside a compact viewport', () => {
    const layout = interiorEditorLayout(640, 360, {
      editMode: true,
      catalogExpanded: true,
      inspectorExpanded: true,
    });
    for (const rect of Object.values(layout)) {
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(rect.y).toBeGreaterThanOrEqual(8);
      expect(rect.x + rect.width).toBeLessThanOrEqual(632);
      expect(rect.y + rect.height).toBeLessThanOrEqual(352);
    }
    expect(layout.room.y + layout.room.height).toBeLessThanOrEqual(layout.catalog.y);
  });

  it('flips the contextual toolbar away from room edges', () => {
    const room = { x: 120, y: 72, width: 720, height: 360 };
    expect(contextToolbarPlacement(
      { x: 130, y: 76, width: 80, height: 40 }, room, { width: 210, height: 32 },
    ).side).toBe('below');
    expect(contextToolbarPlacement(
      { x: 730, y: 390, width: 90, height: 35 }, room, { width: 210, height: 32 },
    ).side).toBe('above');
  });
});
