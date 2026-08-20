export const DEFAULT_RAIL_WIDTHS = Object.freeze({ left: 280, right: 260 });

const LIMITS = Object.freeze({
  left: { min: 180, max: 420 },
  right: { min: 180, max: 360 },
  map: 520,
  splitters: 16,
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function resolveRailWidths(widths = DEFAULT_RAIL_WIDTHS, viewportWidth = 1_440) {
  const available = Math.max(LIMITS.left.min + LIMITS.right.min, finite(viewportWidth, 1_440) - LIMITS.map - LIMITS.splitters);
  let left = clamp(finite(widths.left, DEFAULT_RAIL_WIDTHS.left), LIMITS.left.min, LIMITS.left.max);
  let right = clamp(finite(widths.right, DEFAULT_RAIL_WIDTHS.right), LIMITS.right.min, LIMITS.right.max);
  if (left + right > available) {
    right = Math.max(LIMITS.right.min, Math.min(right, available - left));
    left = Math.max(LIMITS.left.min, Math.min(left, available - right));
  }
  return { left: Math.round(left), right: Math.round(right) };
}

export function readRailWidths(storage, viewportWidth = 1_440) {
  let left = DEFAULT_RAIL_WIDTHS.left;
  let right = DEFAULT_RAIL_WIDTHS.right;
  try {
    const savedLeft = storage?.getItem?.('pixelverse:live-left-width');
    const savedRight = storage?.getItem?.('pixelverse:live-right-width');
    left = savedLeft === null || savedLeft === undefined || savedLeft === '' ? left : finite(savedLeft, left);
    right = savedRight === null || savedRight === undefined || savedRight === '' ? right : finite(savedRight, right);
  } catch {
    return resolveRailWidths(DEFAULT_RAIL_WIDTHS, viewportWidth);
  }
  return resolveRailWidths({ left, right }, viewportWidth);
}

export function clampRailWidth(side, proposed, { viewportWidth = 1_440, left = 280, right = 260 } = {}) {
  const limits = LIMITS[side];
  if (!limits) return finite(proposed, 0);
  const opposite = side === 'left' ? right : left;
  const capacity = finite(viewportWidth, 1_440) - LIMITS.map - LIMITS.splitters - opposite;
  return Math.round(clamp(finite(proposed, DEFAULT_RAIL_WIDTHS[side]), limits.min, Math.min(limits.max, capacity)));
}

export function nextRailWidth({ side, startWidth, deltaX, viewportWidth, widths }) {
  const directionalDelta = side === 'right' ? -finite(deltaX, 0) : finite(deltaX, 0);
  return clampRailWidth(side, finite(startWidth, DEFAULT_RAIL_WIDTHS[side]) + directionalDelta, {
    viewportWidth,
    ...widths,
  });
}

export function railDensity(width) {
  if (width < 230) return 'compact';
  if (width >= 340) return 'wide';
  return 'standard';
}

export function createLiveRailLayoutController({
  workspace,
  leftHandle,
  rightHandle,
  storage = window.localStorage,
  resizeTarget = window,
  viewportWidth = () => window.innerWidth,
} = {}) {
  let widths = readRailWidths(storage, viewportWidth());
  let drag = null;
  const listeners = [];

  const listen = (target, type, handler) => {
    target?.addEventListener?.(type, handler);
    listeners.push(() => target?.removeEventListener?.(type, handler));
  };
  const apply = () => {
    widths = resolveRailWidths(widths, viewportWidth());
    workspace?.style?.setProperty?.('--live-left-width', `${widths.left}px`);
    workspace?.style?.setProperty?.('--live-right-width', `${widths.right}px`);
    if (workspace) workspace.dataset.leftRailDensity = railDensity(widths.left);
    [[leftHandle, 'left'], [rightHandle, 'right']].forEach(([handle, side]) => {
      handle?.setAttribute?.('aria-valuemin', String(LIMITS[side].min));
      handle?.setAttribute?.('aria-valuemax', String(LIMITS[side].max));
      handle?.setAttribute?.('aria-valuenow', String(widths[side]));
    });
  };
  const persist = () => {
    try {
      storage?.setItem?.('pixelverse:live-left-width', String(widths.left));
      storage?.setItem?.('pixelverse:live-right-width', String(widths.right));
    } catch {
      // Layout remains usable in memory when storage is unavailable.
    }
  };
  const update = (side, value) => {
    widths = { ...widths, [side]: clampRailWidth(side, value, { viewportWidth: viewportWidth(), ...widths }) };
    apply();
  };
  const reset = (side) => { update(side, DEFAULT_RAIL_WIDTHS[side]); persist(); };
  const bindHandle = (handle, side) => {
    listen(handle, 'pointerdown', (event) => {
      drag = { side, pointerId: event.pointerId, startX: event.clientX, startWidth: widths[side] };
      handle.setPointerCapture?.(event.pointerId);
      workspace?.classList?.add('is-resizing-rails');
      event.preventDefault?.();
    });
    listen(handle, 'pointermove', (event) => {
      if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
      update(side, nextRailWidth({
        side,
        startWidth: drag.startWidth,
        deltaX: event.clientX - drag.startX,
        viewportWidth: viewportWidth(),
        widths,
      }));
    });
    const finish = (event) => {
      if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
      drag = null;
      workspace?.classList?.remove('is-resizing-rails');
      persist();
    };
    listen(handle, 'pointerup', finish);
    listen(handle, 'pointercancel', finish);
    listen(handle, 'dblclick', () => reset(side));
    listen(handle, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const amount = event.shiftKey ? 48 : 16;
      const delta = event.key === 'ArrowRight' ? amount : -amount;
      update(side, widths[side] + (side === 'right' ? -delta : delta));
      persist();
      event.preventDefault?.();
    });
  };

  return {
    start() {
      apply();
      bindHandle(leftHandle, 'left');
      bindHandle(rightHandle, 'right');
      listen(resizeTarget, 'resize', apply);
    },
    reset,
    destroy() {
      listeners.splice(0).forEach((release) => release());
      drag = null;
      workspace?.classList?.remove('is-resizing-rails');
    },
  };
}
