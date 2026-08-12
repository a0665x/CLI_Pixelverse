import { describe, expect, it, vi } from 'vitest';
import {
  VillageViewportController,
  clampPanOffset,
  clampZoomMultiplier,
  readVillageCamera,
  readVillageZoom,
  shouldStartVillagePan,
  villageViewportMetrics,
  writeVillageCamera,
  writeVillageZoom,
} from '../src/game/VillageViewportController';

describe('village viewport', () => {
  it('starts village panning only for primary gestures outside controls and cutaways', () => {
    expect(shouldStartVillagePan({ button: 0, overControls: false, cutawayOpen: false })).toBe(true);
    expect(shouldStartVillagePan({ button: 1, overControls: false, cutawayOpen: false })).toBe(false);
    expect(shouldStartVillagePan({ button: 0, overControls: true, cutawayOpen: false })).toBe(false);
    expect(shouldStartVillagePan({ button: 0, overControls: false, cutawayOpen: true })).toBe(false);
  });

  it('contains the entire 768x448 village at the exact available fractional scale', () => {
    const metrics = villageViewportMetrics(800, 230, 1);
    expect(metrics.fitScale).toBeCloseTo(230 / 448);
    expect(metrics.multiplier).toBe(1);
    expect(metrics.scale).toBeCloseTo(230 / 448);
    expect(metrics.width).toBeCloseTo(768 * (230 / 448));
    expect(metrics.height).toBeCloseTo(230);
  });

  it('persists zoom for the browser session and rejects malformed values', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(readVillageZoom(storage)).toBe(1);
    writeVillageZoom(storage, 1.45);
    expect(readVillageZoom(storage)).toBe(1.45);
    values.set('pixelverse:village-zoom:v1', 'not-a-number');
    expect(readVillageZoom(storage)).toBe(1);
  });

  it('clamps zoom to a useful range around fit', () => {
    expect(clampZoomMultiplier(.2)).toBe(.65);
    expect(clampZoomMultiplier(1.25)).toBe(1.25);
    expect(clampZoomMultiplier(4)).toBe(2.4);
  });

  it('preserves zoom across resize and fit resets it', () => {
    const apply = vi.fn();
    const viewport = new VillageViewportController(apply);
    viewport.resize(800, 230);
    viewport.zoomBy(.25);
    viewport.resize(1000, 400);
    expect(viewport.multiplier).toBe(1.25);
    expect(apply).toHaveBeenLastCalledWith(villageViewportMetrics(1000, 400, 1.25, 'free'));
    viewport.fit();
    expect(viewport.multiplier).toBe(1);
  });

  it('cover fills both viewport axes while fit contains the whole village', () => {
    const fit = villageViewportMetrics(800, 230, 1, 'fit');
    const cover = villageViewportMetrics(800, 230, 1, 'cover');
    expect(fit.width).toBeLessThanOrEqual(800);
    expect(fit.height).toBeLessThanOrEqual(230);
    expect(cover.width).toBeGreaterThanOrEqual(800);
    expect(cover.height).toBeGreaterThanOrEqual(230);
    expect(cover.offsetX).toBeCloseTo(0);
    expect(cover.offsetY).toBeLessThan(0);
  });

  it('keeps the world point below the pointer stable while zooming', () => {
    const apply = vi.fn();
    const viewport = new VillageViewportController(apply, 'fit');
    viewport.resize(800, 400);
    const before = viewport.metrics();
    const pointer = { x: 500, y: 120 };
    const worldBefore = {
      x: (pointer.x - before.offsetX) / before.scale,
      y: (pointer.y - before.offsetY) / before.scale,
    };
    viewport.zoomAt(pointer.x, pointer.y, 1.35);
    const after = viewport.metrics();
    expect((pointer.x - after.offsetX) / after.scale).toBeCloseTo(worldBefore.x);
    expect((pointer.y - after.offsetY) / after.scale).toBeCloseTo(worldBefore.y);
  });

  it('clamps pan so a zoomed village cannot be dragged beyond its edges', () => {
    expect(clampPanOffset(500, 1200, 800)).toBe(200);
    expect(clampPanOffset(-500, 1200, 800)).toBe(-200);
    expect(clampPanOffset(80, 600, 800)).toBe(0);
  });

  it('round-trips the complete camera session and rejects malformed data', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    writeVillageCamera(storage, { mode: 'free', multiplier: 1.4, panX: -22, panY: 17 });
    expect(readVillageCamera(storage, 'cover')).toEqual({ mode: 'free', multiplier: 1.4, panX: -22, panY: 17 });
    values.set('pixelverse:village-camera:v2', '{broken');
    expect(readVillageCamera(storage, 'cover')).toEqual({ mode: 'cover', multiplier: 1, panX: 0, panY: 0 });
  });

  it('preserves a free camera across resize while cover recomputes its fill scale', () => {
    const apply = vi.fn();
    const viewport = new VillageViewportController(apply, 'cover');
    viewport.resize(800, 230);
    const coverScale = viewport.metrics().scale;
    viewport.zoomAt(400, 115, 1.2);
    const freeMultiplier = viewport.multiplier;
    viewport.resize(1000, 400);
    expect(viewport.mode).toBe('free');
    expect(viewport.multiplier).toBe(freeMultiplier);
    viewport.cover();
    expect(viewport.mode).toBe('cover');
    expect(viewport.metrics().scale).not.toBe(coverScale);
  });
});
