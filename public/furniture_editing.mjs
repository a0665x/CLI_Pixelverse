export const EDIT_BOUNDS = Object.freeze({ min: 6, max: 94 });
export const DEFAULT_SNAP_STEP = 0.5;
export const COARSE_SNAP_STEP = 1;
export const GRID_STEP = 10;

export function clampPercent(value, bounds = EDIT_BOUNDS) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : bounds.min;
  return Math.max(bounds.min, Math.min(bounds.max, numeric));
}

export function snapPercent(value, step = DEFAULT_SNAP_STEP) {
  const safeStep = Number(step) > 0 ? Number(step) : DEFAULT_SNAP_STEP;
  return Number((Math.round(Number(value) / safeStep) * safeStep).toFixed(2));
}

export function resolveSnapStep(shiftKey = false) {
  return shiftKey ? COARSE_SNAP_STEP : DEFAULT_SNAP_STEP;
}

export function normalizePercent(value, { bounds = EDIT_BOUNDS, step = DEFAULT_SNAP_STEP } = {}) {
  return snapPercent(clampPercent(value, bounds), step);
}

export function buildGridLines(step = GRID_STEP, bounds = EDIT_BOUNDS) {
  const safeStep = Number(step) > 0 ? Number(step) : GRID_STEP;
  const lines = [];
  for (let value = safeStep; value < 100; value += safeStep) {
    if (value <= bounds.min || value >= bounds.max) continue;
    lines.push(Number(value.toFixed(2)));
  }
  return lines;
}

export function formatPercent(value) {
  return Number(clampPercent(value)).toFixed(1);
}
