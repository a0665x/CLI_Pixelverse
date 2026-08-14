export const WORKBENCH_LAYOUT_KEY = 'pixelverse:workbench-layout:v1';
export const DEFAULT_WORKBENCH_LAYOUT = Object.freeze({ sidebarWidth: 440, timelineHeight: 260 });
export const MIN_VILLAGE_HEIGHT = 180;
const LEGACY_SIZE_KEYS = Object.freeze({
  sidebar: 'pixelverse:size:sidebar',
  timeline: 'pixelverse:size:timeline',
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function clampSidebarWidth(value, viewportWidth = window.innerWidth) {
  return Math.round(clamp(finite(value, DEFAULT_WORKBENCH_LAYOUT.sidebarWidth), 320, Math.min(620, viewportWidth * 0.45)));
}

export function timelineHeightBounds(viewportHeight = window.innerHeight, workbenchTop = 138) {
  const min = 180;
  const availableMaximum = finite(viewportHeight, 720)
    - finite(workbenchTop, 138)
    - 28
    - MIN_VILLAGE_HEIGHT;
  return { min, max: Math.max(min, Math.round(Math.min(620, viewportHeight * .6, availableMaximum))) };
}

export function clampTimelineHeight(value, viewportHeight = window.innerHeight, workbenchTop = 138) {
  const bounds = timelineHeightBounds(viewportHeight, workbenchTop);
  return Math.round(clamp(finite(value, DEFAULT_WORKBENCH_LAYOUT.timelineHeight), bounds.min, bounds.max));
}

export function workbenchTopFor(headerHeight) {
  return Math.max(138, Math.round(finite(headerHeight, 0) + 24));
}

export function layoutFromPointer(axis, startValue, startPointer, currentPointer, viewport) {
  const delta = finite(currentPointer, 0) - finite(startPointer, 0);
  return axis === 'sidebar'
    ? clampSidebarWidth(finite(startValue, DEFAULT_WORKBENCH_LAYOUT.sidebarWidth) + delta, viewport.width)
    : clampTimelineHeight(
      finite(startValue, DEFAULT_WORKBENCH_LAYOUT.timelineHeight) - delta,
      viewport.height,
      viewport.workbenchTop,
    );
}

function storedWorkbenchLayout(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(WORKBENCH_LAYOUT_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const sidebarWidth = finite(parsed.sidebarWidth, NaN);
    const timelineHeight = finite(parsed.timelineHeight, NaN);
    if (!Number.isFinite(sidebarWidth) || !Number.isFinite(timelineHeight)) return null;
    return { sidebarWidth, timelineHeight };
  } catch {
    return null;
  }
}

export function readWorkbenchLayout(storage = localStorage) {
  return storedWorkbenchLayout(storage) || { ...DEFAULT_WORKBENCH_LAYOUT };
}

export function writeWorkbenchLayout(storage, layout) {
  try {
    storage?.setItem(WORKBENCH_LAYOUT_KEY, JSON.stringify({
      sidebarWidth: Math.round(layout.sidebarWidth),
      timelineHeight: Math.round(layout.timelineHeight),
    }));
  } catch {
    return false;
  }
  return true;
}

function legacySize(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return { present: raw != null, value: Number(raw) };
  } catch {
    return { present: false, value: NaN };
  }
}

export function migrateLegacyWorkbenchLayout(storage, viewport) {
  const stored = storedWorkbenchLayout(storage);
  const sidebar = legacySize(storage, LEGACY_SIZE_KEYS.sidebar);
  const timeline = legacySize(storage, LEGACY_SIZE_KEYS.timeline);
  const base = stored || {
    sidebarWidth: sidebar.value > 0 ? sidebar.value : DEFAULT_WORKBENCH_LAYOUT.sidebarWidth,
    timelineHeight: timeline.value > 0 ? timeline.value : DEFAULT_WORKBENCH_LAYOUT.timelineHeight,
  };
  const layout = {
    sidebarWidth: clampSidebarWidth(base.sidebarWidth, viewport.width),
    timelineHeight: clampTimelineHeight(base.timelineHeight, viewport.height, viewport.workbenchTop),
  };
  if ((sidebar.present || timeline.present) && writeWorkbenchLayout(storage, layout)) {
    try {
      storage?.removeItem(LEGACY_SIZE_KEYS.sidebar);
      storage?.removeItem(LEGACY_SIZE_KEYS.timeline);
    } catch {
      // The bounded v1 layout remains authoritative even if privacy settings block cleanup.
    }
  }
  return layout;
}

function clearOwnedInlineSize(panel, property) {
  if (typeof panel?.style?.removeProperty === 'function') panel.style.removeProperty(property);
  else if (panel?.style) panel.style[property] = '';
}

export function legacyResizablePanels(panels = []) {
  return Array.from(panels).filter((panel) => {
    const key = panel?.dataset?.resizablePanel;
    if (key === 'sidebar') {
      clearOwnedInlineSize(panel, 'width');
      return false;
    }
    if (key === 'timeline') {
      clearOwnedInlineSize(panel, 'height');
      return false;
    }
    return true;
  });
}

export function setupWorkbenchLayoutController({
  sidebarHandle,
  timelineHandle,
  sidebarPanel,
  timelinePanel,
  root = globalThis.document?.documentElement,
  body = globalThis.document?.body,
  storage = globalThis.localStorage,
  resizeTarget = globalThis.window,
  viewport = () => ({
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
    workbenchTop: 138,
  }),
  sidebarEdge = 'left',
  isMobile = () => false,
  onResize = () => {},
  observeHeader = null,
} = {}) {
  if (!sidebarHandle || !timelineHandle || !root?.style || !body?.classList) {
    return { destroy() {}, getLayout: () => ({ ...DEFAULT_WORKBENCH_LAYOUT }) };
  }

  legacyResizablePanels([sidebarPanel, timelinePanel]);
  let layout = migrateLegacyWorkbenchLayout(storage, viewport());
  let dragging = null;
  const removers = [];
  const listen = (target, type, listener) => {
    target?.addEventListener?.(type, listener);
    removers.push(() => target?.removeEventListener?.(type, listener));
  };

  const apply = ({ persist = false, announceResize = false } = {}) => {
    const size = viewport();
    layout = {
      sidebarWidth: clampSidebarWidth(layout.sidebarWidth, size.width),
      timelineHeight: clampTimelineHeight(layout.timelineHeight, size.height, size.workbenchTop),
    };
    root.style.setProperty('--sidebar-width', `${layout.sidebarWidth}px`);
    root.style.setProperty('--timeline-height', `${layout.timelineHeight}px`);
    root.style.setProperty('--workbench-top', `${size.workbenchTop}px`);
    sidebarHandle.setAttribute('aria-valuenow', String(layout.sidebarWidth));
    sidebarHandle.setAttribute('aria-valuemax', String(Math.round(Math.min(620, size.width * .45))));
    timelineHandle.setAttribute('aria-valuenow', String(layout.timelineHeight));
    timelineHandle.setAttribute('aria-valuemax', String(timelineHeightBounds(size.height, size.workbenchTop).max));
    if (persist) writeWorkbenchLayout(storage, layout);
    if (announceResize) onResize();
    return { ...layout };
  };

  const finish = (event = {}) => {
    if (!dragging || (event.pointerId != null && event.pointerId !== dragging.pointerId)) return;
    dragging.handle.removeAttribute('data-active');
    body.classList.remove('workbench-resizing', `workbench-resizing--${dragging.axis}`);
    dragging = null;
    apply({ persist: true, announceResize: true });
  };

  const bind = (handle, axis) => {
    listen(handle, 'pointerdown', (event) => {
      if (isMobile() || event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      dragging = {
        axis,
        handle,
        pointerId: event.pointerId,
        startPointer: axis === 'sidebar' ? event.clientX : event.clientY,
        startValue: axis === 'sidebar' ? layout.sidebarWidth : layout.timelineHeight,
      };
      handle.dataset.active = 'true';
      body.classList.add('workbench-resizing', `workbench-resizing--${axis}`);
    });
    listen(handle, 'pointermove', (event) => {
      if (!dragging || dragging.pointerId !== event.pointerId || dragging.axis !== axis) return;
      const pointer = axis === 'sidebar' && sidebarEdge === 'right'
        ? dragging.startPointer - (event.clientX - dragging.startPointer)
        : axis === 'sidebar' ? event.clientX : event.clientY;
      const value = layoutFromPointer(axis, dragging.startValue, dragging.startPointer, pointer, viewport());
      if (axis === 'sidebar') layout.sidebarWidth = value;
      else layout.timelineHeight = value;
      apply();
    });
    listen(handle, 'pointerup', finish);
    listen(handle, 'pointercancel', finish);
    listen(handle, 'dblclick', () => {
      if (axis === 'sidebar') layout.sidebarWidth = DEFAULT_WORKBENCH_LAYOUT.sidebarWidth;
      else layout.timelineHeight = DEFAULT_WORKBENCH_LAYOUT.timelineHeight;
      apply({ persist: true, announceResize: true });
    });
    listen(handle, 'keydown', (event) => {
      const sidebarKey = axis === 'sidebar' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
      const timelineKey = axis === 'timeline' && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
      if (!sidebarKey && !timelineKey) return;
      event.preventDefault();
      if (axis === 'sidebar') {
        const physicalDirection = event.key === 'ArrowRight' ? 1 : -1;
        layout.sidebarWidth += physicalDirection * (sidebarEdge === 'right' ? -12 : 12);
      } else {
        layout.timelineHeight += event.key === 'ArrowUp' ? 12 : -12;
      }
      apply({ persist: true, announceResize: true });
    });
  };

  bind(sidebarHandle, 'sidebar');
  bind(timelineHandle, 'timeline');
  const handleViewportResize = () => apply();
  listen(resizeTarget, 'resize', handleViewportResize);
  const stopObservingHeader = observeHeader?.(handleViewportResize);
  apply();

  return {
    getLayout: () => ({ ...layout }),
    destroy() {
      removers.splice(0).forEach((remove) => remove());
      stopObservingHeader?.();
    },
  };
}
