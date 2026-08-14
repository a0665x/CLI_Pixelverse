export interface InteriorViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteriorViewportPoint { x: number; y: number }

export interface InteriorViewportState {
  zoom: number;
  panX: number;
  panY: number;
  anchorX: number;
  anchorY: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MIN_VISIBLE_PIXELS = 48;

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

export function createInteriorViewport(frame: InteriorViewportRect): InteriorViewportState {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    anchorX: frame.x + frame.width / 2,
    anchorY: frame.y + frame.height / 2,
  };
}

export function applyInteriorViewport(
  state: InteriorViewportState,
  point: InteriorViewportPoint,
): InteriorViewportPoint {
  return {
    x: state.anchorX + (point.x - state.anchorX) * state.zoom + state.panX,
    y: state.anchorY + (point.y - state.anchorY) * state.zoom + state.panY,
  };
}

export function unapplyInteriorViewport(
  state: InteriorViewportState,
  point: InteriorViewportPoint,
): InteriorViewportPoint {
  return {
    x: state.anchorX + (point.x - state.anchorX - state.panX) / state.zoom,
    y: state.anchorY + (point.y - state.anchorY - state.panY) / state.zoom,
  };
}

function axisPanBounds(
  frameStart: number,
  frameSize: number,
  contentStart: number,
  contentSize: number,
  anchor: number,
  zoom: number,
): readonly [number, number] {
  if (contentSize * zoom <= frameSize) return [0, 0];
  const transformedStart = anchor + (contentStart - anchor) * zoom;
  const transformedEnd = anchor + (contentStart + contentSize - anchor) * zoom;
  return [
    frameStart + MIN_VISIBLE_PIXELS - transformedEnd,
    frameStart + frameSize - MIN_VISIBLE_PIXELS - transformedStart,
  ];
}

export function clampInteriorViewport(
  state: InteriorViewportState,
  frame: InteriorViewportRect,
  content: InteriorViewportRect,
): InteriorViewportState {
  const zoom = clamp(finite(state.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const anchorX = frame.x + frame.width / 2;
  const anchorY = frame.y + frame.height / 2;
  const anchorShiftX = state.anchorX - anchorX;
  const anchorShiftY = state.anchorY - anchorY;
  const requestedPanX = finite(state.panX, 0) + anchorShiftX * (1 - zoom);
  const requestedPanY = finite(state.panY, 0) + anchorShiftY * (1 - zoom);
  const [minPanX, maxPanX] = axisPanBounds(frame.x, frame.width, content.x, content.width, anchorX, zoom);
  const [minPanY, maxPanY] = axisPanBounds(frame.y, frame.height, content.y, content.height, anchorY, zoom);
  return {
    zoom,
    panX: zoom === 1 ? 0 : clamp(requestedPanX, minPanX, maxPanX),
    panY: zoom === 1 ? 0 : clamp(requestedPanY, minPanY, maxPanY),
    anchorX,
    anchorY,
  };
}

export function zoomInteriorViewportAt(
  state: InteriorViewportState,
  pointer: InteriorViewportPoint,
  zoom: number,
  frame: InteriorViewportRect,
  content: InteriorViewportRect,
): InteriorViewportState {
  const nextZoom = clamp(finite(zoom, state.zoom), MIN_ZOOM, MAX_ZOOM);
  const ratio = nextZoom / state.zoom;
  return clampInteriorViewport({
    ...state,
    zoom: nextZoom,
    panX: pointer.x - state.anchorX - (pointer.x - state.anchorX - state.panX) * ratio,
    panY: pointer.y - state.anchorY - (pointer.y - state.anchorY - state.panY) * ratio,
  }, frame, content);
}

export function panInteriorViewport(
  state: InteriorViewportState,
  deltaX: number,
  deltaY: number,
  frame: InteriorViewportRect,
  content: InteriorViewportRect,
): InteriorViewportState {
  if (state.zoom <= 1) return clampInteriorViewport(state, frame, content);
  return clampInteriorViewport({
    ...state,
    panX: state.panX + finite(deltaX, 0),
    panY: state.panY + finite(deltaY, 0),
  }, frame, content);
}

export function interiorPanEligible(gesture: {
  button: number;
  insideFrame: boolean;
  overInteractive: boolean;
  editMode: boolean;
  zoom: number;
}): boolean {
  if (!gesture.insideFrame || gesture.overInteractive || gesture.zoom <= 1) return false;
  if (gesture.button === 1) return true;
  return gesture.button === 0 && !gesture.editMode;
}
