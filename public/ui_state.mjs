export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 2.25;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampZoom(scale) {
  return clamp(Number(scale || 1), MIN_ZOOM, MAX_ZOOM);
}

export function clampCameraOffset(offset, viewport, stage, scale = 1) {
  const nextScale = clampZoom(scale);
  const scaledWidth = stage.width * nextScale;
  const scaledHeight = stage.height * nextScale;
  const minX = Math.min(0, viewport.width - scaledWidth);
  const minY = Math.min(0, viewport.height - scaledHeight);
  return {
    x: clamp(offset.x, minX, 0),
    y: clamp(offset.y, minY, 0),
  };
}

export function nextDraggedOffset(start, delta, bounds = null) {
  const raw = { x: start.x + delta.x, y: start.y + delta.y };
  if (!bounds) return raw;
  return {
    x: clamp(raw.x, bounds.minX, bounds.maxX),
    y: clamp(raw.y, bounds.minY, bounds.maxY),
  };
}

export function centeredCamera(viewport, stage, scale = 1) {
  const nextScale = clampZoom(scale);
  return clampCameraOffset({
    x: Math.round((viewport.width - (stage.width * nextScale)) / 2),
    y: Math.round((viewport.height - (stage.height * nextScale)) / 2),
  }, viewport, stage, nextScale);
}

export function nextZoomState({ offset, scale, viewport, stage, pointer, deltaY }) {
  const currentScale = clampZoom(scale);
  const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
  const nextScale = clampZoom(currentScale * factor);
  if (Math.abs(nextScale - currentScale) < 0.0001) {
    return { offset: clampCameraOffset(offset, viewport, stage, currentScale), scale: currentScale };
  }

  const anchor = {
    x: (pointer.x - offset.x) / currentScale,
    y: (pointer.y - offset.y) / currentScale,
  };
  const nextOffset = clampCameraOffset({
    x: pointer.x - (anchor.x * nextScale),
    y: pointer.y - (anchor.y * nextScale),
  }, viewport, stage, nextScale);

  return { offset: nextOffset, scale: nextScale };
}
