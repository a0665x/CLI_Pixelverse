import { describe, expect, it } from 'vitest';
import {
  applyInteriorViewport,
  clampInteriorViewport,
  createInteriorViewport,
  interiorPanEligible,
  panInteriorViewport,
  unapplyInteriorViewport,
  zoomInteriorViewportAt,
} from '../src/rendering/interiorViewport';

const frame = { x: 100, y: 60, width: 600, height: 360 };
const content = { x: 150, y: 100, width: 500, height: 280 };

describe('interior viewport', () => {
  it('starts fitted without moving authored room coordinates', () => {
    const state = createInteriorViewport(frame);
    expect(state).toEqual({ zoom: 1, panX: 0, panY: 0, anchorX: 400, anchorY: 240 });
    expect(applyInteriorViewport(state, { x: 263.5, y: 177.25 })).toEqual({ x: 263.5, y: 177.25 });
  });

  it('zooms around the pointer and preserves the room point below it', () => {
    const initial = createInteriorViewport(frame);
    const pointer = { x: 220, y: 155 };
    const roomPoint = unapplyInteriorViewport(initial, pointer);
    const zoomed = zoomInteriorViewportAt(initial, pointer, 1.8, frame, content);

    expect(zoomed.zoom).toBeCloseTo(1.8);
    expect(applyInteriorViewport(zoomed, roomPoint).x).toBeCloseTo(pointer.x);
    expect(applyInteriorViewport(zoomed, roomPoint).y).toBeCloseTo(pointer.y);
  });

  it('pans only while zoomed and clamps enough content inside the frame', () => {
    const fitted = createInteriorViewport(frame);
    expect(panInteriorViewport(fitted, 80, 40, frame, content)).toEqual(fitted);

    const zoomed = zoomInteriorViewportAt(fitted, { x: 400, y: 240 }, 2.4, frame, content);
    const moved = panInteriorViewport(zoomed, 10_000, -10_000, frame, content);
    const topLeft = applyInteriorViewport(moved, { x: content.x, y: content.y });
    const bottomRight = applyInteriorViewport(moved, {
      x: content.x + content.width,
      y: content.y + content.height,
    });
    expect(topLeft.x).toBeLessThanOrEqual(frame.x + frame.width - 48);
    expect(bottomRight.x).toBeGreaterThanOrEqual(frame.x + 48);
    expect(topLeft.y).toBeLessThanOrEqual(frame.y + frame.height - 48);
    expect(bottomRight.y).toBeGreaterThanOrEqual(frame.y + 48);
  });

  it('reclamps the current transform for a resized frame', () => {
    const zoomed = zoomInteriorViewportAt(createInteriorViewport(frame), { x: 650, y: 350 }, 3, frame, content);
    const compact = { x: 40, y: 30, width: 360, height: 240 };
    const clamped = clampInteriorViewport(zoomed, compact, content);
    expect(clamped.anchorX).toBe(220);
    expect(clamped.anchorY).toBe(150);
    expect(Number.isFinite(clamped.panX)).toBe(true);
    expect(Number.isFinite(clamped.panY)).toBe(true);
  });

  it('keeps furniture, controls, and edit-mode marquee ahead of room panning', () => {
    const base = { button: 0, insideFrame: true, overInteractive: false, editMode: false, zoom: 1.5 };
    expect(interiorPanEligible(base)).toBe(true);
    expect(interiorPanEligible({ ...base, overInteractive: true })).toBe(false);
    expect(interiorPanEligible({ ...base, editMode: true })).toBe(false);
    expect(interiorPanEligible({ ...base, zoom: 1 })).toBe(false);
    expect(interiorPanEligible({ ...base, button: 1, editMode: true })).toBe(true);
  });
});
