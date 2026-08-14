import { WORLD_PIXELS } from './constants';

export type VillageViewportMetrics = {
  fitScale: number;
  coverScale: number;
  multiplier: number;
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  mode: ViewportFrameMode;
};

export type ViewportFrameMode = 'cover' | 'fit' | 'free';
export type VillageCameraState = { mode: ViewportFrameMode; multiplier: number; panX: number; panY: number };

export const MIN_ZOOM_MULTIPLIER = .65;
export const MAX_ZOOM_MULTIPLIER = 2.4;
export const VILLAGE_ZOOM_SESSION_KEY = 'pixelverse:village-zoom:v1';
export const VILLAGE_CAMERA_SESSION_KEY = 'pixelverse:village-camera:v2';

export function shouldStartVillagePan(gesture: {
  button: number;
  overControls: boolean;
  cutawayOpen: boolean;
}): boolean {
  return gesture.button === 0 && !gesture.overControls && !gesture.cutawayOpen;
}

export function shouldHandleVillageWheel(gesture: { cutawayOpen: boolean; deltaY: number }): boolean {
  return gesture.deltaY !== 0 && !gesture.cutawayOpen;
}

type ZoomStorageReader = Pick<Storage, 'getItem'>;
type ZoomStorageWriter = Pick<Storage, 'setItem'>;

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

export function clampZoomMultiplier(value: number): number {
  return Math.min(MAX_ZOOM_MULTIPLIER, Math.max(MIN_ZOOM_MULTIPLIER, finite(value, 1)));
}

export function readVillageZoom(storage: ZoomStorageReader = sessionStorage): number {
  const stored = Number(storage.getItem(VILLAGE_ZOOM_SESSION_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampZoomMultiplier(stored) : 1;
}

export function writeVillageZoom(storage: ZoomStorageWriter, multiplier: number): void {
  storage.setItem(VILLAGE_ZOOM_SESSION_KEY, String(clampZoomMultiplier(multiplier)));
}

export function readVillageCamera(storage: ZoomStorageReader = sessionStorage, fallbackMode: ViewportFrameMode = 'fit'): VillageCameraState {
  const fallback = { mode: fallbackMode, multiplier: 1, panX: 0, panY: 0 } as const;
  try {
    const parsed = JSON.parse(storage.getItem(VILLAGE_CAMERA_SESSION_KEY) || 'null') as Partial<VillageCameraState> | null;
    if (!parsed || !['cover', 'fit', 'free'].includes(String(parsed.mode))) return { ...fallback };
    const multiplier = Number(parsed.multiplier);
    const panX = Number(parsed.panX);
    const panY = Number(parsed.panY);
    if (![multiplier, panX, panY].every(Number.isFinite)) return { ...fallback };
    return { mode: parsed.mode as ViewportFrameMode, multiplier: clampZoomMultiplier(multiplier), panX, panY };
  } catch {
    return { ...fallback };
  }
}

export function writeVillageCamera(storage: ZoomStorageWriter, state: VillageCameraState): void {
  storage.setItem(VILLAGE_CAMERA_SESSION_KEY, JSON.stringify({
    mode: state.mode,
    multiplier: clampZoomMultiplier(state.multiplier),
    panX: finite(state.panX, 0),
    panY: finite(state.panY, 0),
  }));
}

export function clampPanOffset(value: number, renderedSize: number, viewportSize: number): number {
  const limit = Math.max(0, (finite(renderedSize, 0) - finite(viewportSize, 0)) / 2);
  return Math.min(limit, Math.max(-limit, finite(value, 0)));
}

export function villageViewportMetrics(
  availableWidth: number,
  availableHeight: number,
  multiplier = 1,
  mode: ViewportFrameMode = 'fit',
  panX = 0,
  panY = 0,
): VillageViewportMetrics {
  const safeWidth = Math.max(1, finite(availableWidth, WORLD_PIXELS.width));
  const safeHeight = Math.max(1, finite(availableHeight, WORLD_PIXELS.height));
  const fitScale = Math.min(safeWidth / WORLD_PIXELS.width, safeHeight / WORLD_PIXELS.height, 1.5);
  const coverScale = Math.min(Math.max(safeWidth / WORLD_PIXELS.width, safeHeight / WORLD_PIXELS.height), 1.5);
  const safeMultiplier = clampZoomMultiplier(multiplier);
  const scale = (mode === 'cover' ? coverScale : fitScale) * safeMultiplier;
  const width = WORLD_PIXELS.width * scale;
  const height = WORLD_PIXELS.height * scale;
  const boundedPanX = clampPanOffset(panX, width, safeWidth);
  const boundedPanY = clampPanOffset(panY, height, safeHeight);
  return {
    fitScale,
    coverScale,
    multiplier: safeMultiplier,
    scale,
    width,
    height,
    offsetX: ((safeWidth - width) / 2) + boundedPanX,
    offsetY: ((safeHeight - height) / 2) + boundedPanY,
    mode,
  };
}

export class VillageViewportController {
  private availableWidth = WORLD_PIXELS.width;
  private availableHeight = WORLD_PIXELS.height;
  private zoomMultiplier = 1;
  private frameMode: ViewportFrameMode;
  private panX = 0;
  private panY = 0;

  constructor(private readonly applyMetrics: (metrics: VillageViewportMetrics) => void, initialMode: ViewportFrameMode = 'fit') {
    this.frameMode = initialMode;
  }

  get multiplier(): number {
    return this.zoomMultiplier;
  }

  get mode(): ViewportFrameMode { return this.frameMode; }

  state(): VillageCameraState {
    return { mode: this.frameMode, multiplier: this.zoomMultiplier, panX: this.panX, panY: this.panY };
  }

  metrics(): VillageViewportMetrics {
    return villageViewportMetrics(
      this.availableWidth,
      this.availableHeight,
      this.zoomMultiplier,
      this.frameMode,
      this.panX,
      this.panY,
    );
  }

  resize(width: number, height: number): void {
    this.availableWidth = Math.max(1, width);
    this.availableHeight = Math.max(1, height);
    this.apply();
  }

  zoomBy(delta: number): void {
    const current = this.metrics();
    this.frameMode = 'free';
    this.zoomMultiplier = clampZoomMultiplier((current.scale / current.fitScale) + delta);
    this.apply();
  }

  setZoom(multiplier: number): void {
    this.frameMode = 'free';
    this.zoomMultiplier = clampZoomMultiplier(multiplier);
    this.apply();
  }

  zoomAt(pointerX: number, pointerY: number, factor: number): void {
    const before = this.metrics();
    const worldX = (finite(pointerX, this.availableWidth / 2) - before.offsetX) / before.scale;
    const worldY = (finite(pointerY, this.availableHeight / 2) - before.offsetY) / before.scale;
    this.frameMode = 'free';
    this.zoomMultiplier = clampZoomMultiplier((before.scale / before.fitScale) * finite(factor, 1));
    const centered = this.metrics();
    const desiredOffsetX = pointerX - (worldX * centered.scale);
    const desiredOffsetY = pointerY - (worldY * centered.scale);
    this.panX = desiredOffsetX - ((this.availableWidth - centered.width) / 2);
    this.panY = desiredOffsetY - ((this.availableHeight - centered.height) / 2);
    this.apply();
  }

  panBy(deltaX: number, deltaY: number): void {
    this.frameMode = 'free';
    this.panX += finite(deltaX, 0);
    this.panY += finite(deltaY, 0);
    this.apply();
  }

  restore(state: VillageCameraState): void {
    this.frameMode = state.mode;
    this.zoomMultiplier = clampZoomMultiplier(state.multiplier);
    this.panX = finite(state.panX, 0);
    this.panY = finite(state.panY, 0);
    this.apply();
  }

  fit(): void {
    this.frameMode = 'fit';
    this.zoomMultiplier = 1;
    this.panX = 0;
    this.panY = 0;
    this.apply();
  }

  cover(): void {
    this.frameMode = 'cover';
    this.zoomMultiplier = 1;
    this.panX = 0;
    this.panY = 0;
    this.apply();
  }

  private apply(): void {
    const metrics = this.metrics();
    this.panX = metrics.offsetX - ((this.availableWidth - metrics.width) / 2);
    this.panY = metrics.offsetY - ((this.availableHeight - metrics.height) / 2);
    this.applyMetrics(metrics);
  }
}
