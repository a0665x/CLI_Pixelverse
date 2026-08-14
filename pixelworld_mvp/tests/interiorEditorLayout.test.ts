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

  it.each([
    [1, 1],
    [160, 180],
    [319, 279],
    [320, 280],
    [640, 360],
  ])('keeps every finite region inside a %sx%s viewport', (width, height) => {
    const layout = interiorEditorLayout(width, height, {
      editMode: true,
      catalogExpanded: true,
      inspectorExpanded: true,
    });

    for (const rect of Object.values(layout)) {
      expect(Number.isFinite(rect.x)).toBe(true);
      expect(Number.isFinite(rect.y)).toBe(true);
      expect(Number.isFinite(rect.width)).toBe(true);
      expect(Number.isFinite(rect.height)).toBe(true);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.width).toBeGreaterThanOrEqual(0);
      expect(rect.height).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    }
  });

  it('reserves a compact Properties bottom sheet instead of disabling the inspector', () => {
    const layout = interiorEditorLayout(319, 279, {
      editMode: true,
      catalogExpanded: false,
      inspectorExpanded: true,
    });

    expect(layout.inspector.width).toBe(layout.frame.width);
    expect(layout.inspector.height).toBeGreaterThan(0);
    expect(layout.inspector.x).toBe(layout.frame.x);
    expect(layout.inspector.y).toBe(layout.room.y + layout.room.height);
    expect(layout.catalog.height).toBe(0);
    expect(layout.room.y + layout.room.height).toBeLessThanOrEqual(layout.inspector.y);
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

  it('contains an oversized wrapped toolbar inside the reserved room', () => {
    const room = { x: 12, y: 48, width: 280, height: 144 };
    const placement = contextToolbarPlacement(
      { x: 120, y: 92, width: 32, height: 32 }, room, { width: 420, height: 260 },
    );
    expect(placement.width).toBeLessThanOrEqual(room.width);
    expect(placement.height).toBeLessThanOrEqual(room.height);
    expect(placement.x).toBeGreaterThanOrEqual(room.x);
    expect(placement.y).toBeGreaterThanOrEqual(room.y);
    expect(placement.x + placement.width).toBeLessThanOrEqual(room.x + room.width);
    expect(placement.y + placement.height).toBeLessThanOrEqual(room.y + room.height);
  });
});
