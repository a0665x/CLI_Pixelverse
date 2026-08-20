export const COMMAND_DECK_LAYOUT_KEY = 'pixelverse:command-deck-layout:v2';

const DEFAULT_LAYOUT = Object.freeze({
  leftWidth: 280,
  rightWidth: 260,
  bottomHeight: 180,
  leftDock: 'agents',
  rightDock: 'inspector',
  collapsed: Object.freeze({ left: false, right: false, bottom: false }),
});

const LIMITS = Object.freeze({
  left: Object.freeze({ min: 180, max: 420 }),
  right: Object.freeze({ min: 180, max: 360 }),
  bottom: Object.freeze({ min: 120, max: 360 }),
  villageWidth: 520,
  villageHeight: 320,
  splitter: 8,
  narrowWidth: 900,
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value, fallback) => {
  const numeric = finite(value, fallback);
  return numeric > 0 ? numeric : fallback;
};
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const defaultLayout = () => ({
  ...DEFAULT_LAYOUT,
  collapsed: { ...DEFAULT_LAYOUT.collapsed },
});

function normalizedViewport(viewport = {}) {
  return {
    width: positive(viewport.width, 1_440),
    height: positive(viewport.height, 900),
    topHeight: Math.max(0, finite(viewport.topHeight, 44)),
  };
}

export function normalizeCommandDeckLayout(value = {}, viewport = {}) {
  const size = normalizedViewport(viewport);
  const source = value && typeof value === 'object' ? value : {};
  const availableRails = Math.max(
    LIMITS.left.min + LIMITS.right.min,
    size.width - LIMITS.villageWidth - (LIMITS.splitter * 2),
  );
  let leftWidth = clamp(
    positive(source.leftWidth, DEFAULT_LAYOUT.leftWidth),
    LIMITS.left.min,
    LIMITS.left.max,
  );
  let rightWidth = clamp(
    positive(source.rightWidth, DEFAULT_LAYOUT.rightWidth),
    LIMITS.right.min,
    LIMITS.right.max,
  );
  if (leftWidth + rightWidth > availableRails) {
    rightWidth = Math.max(LIMITS.right.min, Math.min(rightWidth, availableRails - leftWidth));
    leftWidth = Math.max(LIMITS.left.min, Math.min(leftWidth, availableRails - rightWidth));
  }

  const availableBottom = Math.max(
    LIMITS.bottom.min,
    size.height - size.topHeight - LIMITS.villageHeight - LIMITS.splitter,
  );
  const bottomHeight = clamp(
    positive(source.bottomHeight, DEFAULT_LAYOUT.bottomHeight),
    LIMITS.bottom.min,
    Math.min(LIMITS.bottom.max, availableBottom),
  );
  const leftDock = source.leftDock === 'inspector' ? 'inspector' : 'agents';
  const rightDock = source.rightDock === (leftDock === 'agents' ? 'inspector' : 'agents')
    ? source.rightDock
    : leftDock === 'agents' ? 'inspector' : 'agents';

  return {
    leftWidth: Math.round(leftWidth),
    rightWidth: Math.round(rightWidth),
    bottomHeight: Math.round(bottomHeight),
    leftDock,
    rightDock,
    collapsed: {
      left: source.collapsed?.left === true,
      right: source.collapsed?.right === true,
      bottom: source.collapsed?.bottom === true,
    },
  };
}

function validStoredLayout(value) {
  return value && typeof value === 'object'
    && positive(value.leftWidth, 0) > 0
    && positive(value.rightWidth, 0) > 0
    && positive(value.bottomHeight, 0) > 0
    && (value.leftDock === 'agents' || value.leftDock === 'inspector')
    && (value.rightDock === 'agents' || value.rightDock === 'inspector')
    && value.leftDock !== value.rightDock
    && value.collapsed && typeof value.collapsed === 'object';
}

function storedLayout(storage) {
  let raw;
  try {
    raw = storage?.getItem?.(COMMAND_DECK_LAYOUT_KEY);
  } catch {
    return { status: 'unavailable', layout: null };
  }
  if (raw == null || raw === '') return { status: 'missing', layout: null };
  try {
    const parsed = JSON.parse(raw);
    return validStoredLayout(parsed)
      ? { status: 'valid', layout: parsed }
      : { status: 'invalid', layout: null };
  } catch {
    return { status: 'invalid', layout: null };
  }
}

function legacyNumber(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    const value = Number(raw);
    return raw != null && raw !== '' && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function legacyLayout(storage) {
  const leftWidth = legacyNumber(storage, 'pixelverse:live-left-width');
  const rightWidth = legacyNumber(storage, 'pixelverse:live-right-width');
  let workbench = null;
  try {
    const parsed = JSON.parse(storage?.getItem?.('pixelverse:workbench-layout:v1') || 'null');
    if (parsed && typeof parsed === 'object') workbench = parsed;
  } catch {
    workbench = null;
  }
  const sidebarWidth = positive(workbench?.sidebarWidth, 0) || null;
  const bottomHeight = positive(workbench?.timelineHeight, 0) || null;
  const present = leftWidth !== null || rightWidth !== null || sidebarWidth !== null || bottomHeight !== null;
  return {
    present,
    layout: {
      ...defaultLayout(),
      leftWidth: leftWidth ?? DEFAULT_LAYOUT.leftWidth,
      rightWidth: rightWidth ?? sidebarWidth ?? DEFAULT_LAYOUT.rightWidth,
      bottomHeight: bottomHeight ?? DEFAULT_LAYOUT.bottomHeight,
    },
  };
}

function writeLayout(storage, layout) {
  try {
    storage?.setItem?.(COMMAND_DECK_LAYOUT_KEY, JSON.stringify({ version: 2, ...layout }));
    return true;
  } catch {
    return false;
  }
}

export function createCommandDeckLayoutController({
  workspace,
  leftHandle,
  rightHandle,
  bottomHandle,
  storage = globalThis.localStorage,
  resizeTarget = globalThis.window,
  viewport = () => ({
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
    topHeight: 44,
  }),
  onResize = () => {},
} = {}) {
  const initialStored = storedLayout(storage);
  const initialSize = normalizedViewport(viewport());
  const initialNarrow = initialSize.width < LIMITS.narrowWidth;
  const legacy = initialStored.status === 'missing' ? legacyLayout(storage) : { present: false, layout: null };
  const initialValue = initialStored.layout || legacy.layout || defaultLayout();
  let layout = normalizeCommandDeckLayout(
    initialValue,
    initialNarrow ? { width: 1_440, height: 900, topHeight: 44 } : initialSize,
  );
  let drag = null;
  let started = false;
  const listeners = [];

  const listen = (target, type, handler) => {
    target?.addEventListener?.(type, handler);
    listeners.push(() => target?.removeEventListener?.(type, handler));
  };

  const sizeBounds = (size) => ({
    leftMax: Math.min(LIMITS.left.max, Math.max(LIMITS.left.min, size.width - LIMITS.villageWidth - 16 - layout.rightWidth)),
    rightMax: Math.min(LIMITS.right.max, Math.max(LIMITS.right.min, size.width - LIMITS.villageWidth - 16 - layout.leftWidth)),
    bottomMax: Math.min(LIMITS.bottom.max, Math.max(LIMITS.bottom.min, size.height - size.topHeight - LIMITS.villageHeight - 8)),
  });

  const setHandleState = (handle, value, minimum, maximum) => {
    handle?.setAttribute?.('aria-valuemin', String(minimum));
    handle?.setAttribute?.('aria-valuemax', String(Math.round(maximum)));
    handle?.setAttribute?.('aria-valuenow', String(value));
  };

  const apply = ({ persist = false, announce = false } = {}) => {
    const size = normalizedViewport(viewport());
    const narrow = size.width < LIMITS.narrowWidth;
    workspace && (workspace.dataset.commandDeckMode = narrow ? 'narrow' : 'desktop');
    if (!narrow) layout = normalizeCommandDeckLayout(layout, size);
    if (workspace) {
      workspace.dataset.leftDock = layout.leftDock;
      workspace.dataset.rightDock = layout.rightDock;
      workspace.dataset.collapsedLeft = String(layout.collapsed.left);
      workspace.dataset.collapsedRight = String(layout.collapsed.right);
      workspace.dataset.collapsedBottom = String(layout.collapsed.bottom);
      workspace.dataset.leftRailDensity = layout.leftWidth < 230 ? 'compact' : layout.leftWidth >= 340 ? 'wide' : 'standard';
    }
    if (!narrow) {
      workspace?.style?.setProperty?.('--command-left-width', `${layout.leftWidth}px`);
      workspace?.style?.setProperty?.('--command-right-width', `${layout.rightWidth}px`);
      workspace?.style?.setProperty?.('--command-bottom-height', `${layout.bottomHeight}px`);
      workspace?.style?.setProperty?.('--command-left-track', layout.collapsed.left ? '0px' : `${layout.leftWidth}px`);
      workspace?.style?.setProperty?.('--command-right-track', layout.collapsed.right ? '0px' : `${layout.rightWidth}px`);
      workspace?.style?.setProperty?.('--command-bottom-track', layout.collapsed.bottom ? '0px' : `${layout.bottomHeight}px`);
    }
    const bounds = sizeBounds(size);
    setHandleState(leftHandle, layout.leftWidth, LIMITS.left.min, bounds.leftMax);
    setHandleState(rightHandle, layout.rightWidth, LIMITS.right.min, bounds.rightMax);
    setHandleState(bottomHandle, layout.bottomHeight, LIMITS.bottom.min, bounds.bottomMax);
    if (persist && !narrow) writeLayout(storage, layout);
    if (announce) onResize({ ...layout, collapsed: { ...layout.collapsed } });
  };

  const update = (region, value, options = {}) => {
    if (region === 'left') layout.leftWidth = value;
    else if (region === 'right') layout.rightWidth = value;
    else if (region === 'bottom') layout.bottomHeight = value;
    apply(options);
  };

  const bindHandle = (handle, region) => {
    if (!handle) return;
    listen(handle, 'pointerdown', (event) => {
      if (event.button !== 0 || normalizedViewport(viewport()).width < LIMITS.narrowWidth) return;
      const vertical = region !== 'bottom';
      drag = {
        region,
        pointerId: event.pointerId,
        startPointer: vertical ? event.clientX : event.clientY,
        startValue: region === 'left' ? layout.leftWidth : region === 'right' ? layout.rightWidth : layout.bottomHeight,
      };
      handle.setPointerCapture?.(event.pointerId);
      workspace?.classList?.add?.('is-resizing-command-deck');
      handle.dataset.active = 'true';
      event.preventDefault?.();
    });
    listen(handle, 'pointermove', (event) => {
      if (!drag || drag.region !== region || drag.pointerId !== event.pointerId) return;
      const current = region === 'bottom' ? event.clientY : event.clientX;
      const delta = current - drag.startPointer;
      const directional = region === 'right' || region === 'bottom' ? -delta : delta;
      update(region, drag.startValue + directional);
    });
    const finish = (event) => {
      if (!drag || drag.region !== region || drag.pointerId !== event.pointerId) return;
      drag = null;
      handle.removeAttribute?.('data-active');
      workspace?.classList?.remove?.('is-resizing-command-deck');
      apply({ persist: true, announce: true });
    };
    listen(handle, 'pointerup', finish);
    listen(handle, 'pointercancel', finish);
    listen(handle, 'dblclick', () => update(
      region,
      region === 'left' ? DEFAULT_LAYOUT.leftWidth : region === 'right' ? DEFAULT_LAYOUT.rightWidth : DEFAULT_LAYOUT.bottomHeight,
      { persist: true, announce: true },
    ));
    listen(handle, 'keydown', (event) => {
      const horizontal = region !== 'bottom' && ['ArrowLeft', 'ArrowRight'].includes(event.key);
      const vertical = region === 'bottom' && ['ArrowUp', 'ArrowDown'].includes(event.key);
      if (!horizontal && !vertical) return;
      const amount = event.shiftKey ? 48 : 16;
      const positiveDirection = region === 'left'
        ? event.key === 'ArrowRight'
        : region === 'right'
          ? event.key === 'ArrowLeft'
          : event.key === 'ArrowUp';
      const value = region === 'left' ? layout.leftWidth : region === 'right' ? layout.rightWidth : layout.bottomHeight;
      update(region, value + (positiveDirection ? amount : -amount), { persist: true, announce: true });
      event.preventDefault?.();
    });
  };

  return {
    start() {
      if (started) return;
      started = true;
      bindHandle(leftHandle, 'left');
      bindHandle(rightHandle, 'right');
      bindHandle(bottomHandle, 'bottom');
      listen(resizeTarget, 'resize', () => apply({ announce: true }));
      apply();
      if (initialStored.status === 'missing' && legacy.present && !initialNarrow) writeLayout(storage, layout);
    },
    reset() {
      layout = normalizeCommandDeckLayout(defaultLayout(), viewport());
      apply({ persist: true, announce: true });
      return this.getLayout();
    },
    collapse(region) {
      if (!['left', 'right', 'bottom'].includes(region)) return this.getLayout();
      layout.collapsed = { ...layout.collapsed, [region]: !layout.collapsed[region] };
      apply({ persist: true, announce: true });
      return this.getLayout();
    },
    swapSides() {
      [layout.leftDock, layout.rightDock] = [layout.rightDock, layout.leftDock];
      apply({ persist: true, announce: true });
      return this.getLayout();
    },
    getLayout: () => ({ ...layout, collapsed: { ...layout.collapsed } }),
    destroy() {
      listeners.splice(0).forEach((release) => release());
      drag = null;
      started = false;
      workspace?.classList?.remove?.('is-resizing-command-deck');
    },
  };
}
