export const VILLAGE_FIRST_LAYOUT_KEY = 'pixelverse:village-first-layout:v1';

const DEFAULTS = Object.freeze({ topHeight: 56, rosterHeight: 128, detailWidth: 360 });
const LIMITS = Object.freeze({
  top: { min: 44, max: 120 },
  roster: { min: 96, max: 260 },
  detail: { min: 300, max: 520 },
  villageWidth: 520,
  villageHeight: 280,
  narrowWidth: 900,
});

const clamp = (value, { min, max }, fallback) => {
  const numeric = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback));
};

export function normalizeVillageFirstLayout(value = {}, viewport = {}) {
  const width = Number(viewport.width) || 1440;
  const height = Number(viewport.height) || 900;
  let topHeight = clamp(value.topHeight, LIMITS.top, DEFAULTS.topHeight);
  let rosterHeight = clamp(value.rosterHeight, LIMITS.roster, DEFAULTS.rosterHeight);
  const maxVertical = Math.max(LIMITS.top.min + LIMITS.roster.min, height - LIMITS.villageHeight);
  if (topHeight + rosterHeight > maxVertical) {
    rosterHeight = Math.max(LIMITS.roster.min, maxVertical - topHeight);
    if (topHeight + rosterHeight > maxVertical) topHeight = Math.max(LIMITS.top.min, maxVertical - rosterHeight);
  }
  const detailLimit = Math.max(LIMITS.detail.min, width - LIMITS.villageWidth);
  const detailWidth = clamp(value.detailWidth, {
    min: LIMITS.detail.min,
    max: Math.min(LIMITS.detail.max, detailLimit),
  }, DEFAULTS.detailWidth);
  return { topHeight, rosterHeight, detailWidth };
}

export function createVillageFirstLayoutController({
  workspace,
  handles = {},
  storage = globalThis.localStorage,
  viewport = () => ({ width: globalThis.innerWidth, height: globalThis.innerHeight }),
  eventTarget = globalThis.window,
  onResize = () => {},
} = {}) {
  let layout = normalizeVillageFirstLayout({}, viewport());
  let detailOpen = false;
  let started = false;
  let drag = null;
  const removals = [];

  const listen = (target, type, callback) => {
    target?.addEventListener?.(type, callback);
    removals.push(() => target?.removeEventListener?.(type, callback));
  };
  const isNarrow = () => Number(viewport().width) < LIMITS.narrowWidth;
  const persist = () => storage?.setItem?.(VILLAGE_FIRST_LAYOUT_KEY, JSON.stringify({ version: 1, ...layout }));
  const apply = () => {
    layout = normalizeVillageFirstLayout(layout, { ...viewport(), detailOpen });
    workspace?.style?.setProperty?.('--village-top-height', `${layout.topHeight}px`);
    workspace?.style?.setProperty?.('--village-roster-height', `${layout.rosterHeight}px`);
    workspace?.style?.setProperty?.('--agent-detail-width', `${layout.detailWidth}px`);
    workspace?.style?.setProperty?.('--agent-detail-track', detailOpen && !isNarrow() ? `${layout.detailWidth}px` : '0px');
    if (workspace?.dataset) {
      workspace.dataset.detailOpen = String(detailOpen);
      workspace.dataset.villageLayoutMode = isNarrow() ? 'narrow' : 'desktop';
    }
    const state = {
      top: [LIMITS.top, layout.topHeight, 'horizontal', isNarrow()],
      roster: [LIMITS.roster, layout.rosterHeight, 'horizontal', isNarrow()],
      detail: [LIMITS.detail, layout.detailWidth, 'vertical', isNarrow() || !detailOpen],
    };
    for (const [name, [limits, value, orientation, hidden]] of Object.entries(state)) {
      const handle = handles[name];
      if (!handle) continue;
      handle.hidden = hidden;
      handle.setAttribute?.('aria-orientation', orientation);
      handle.setAttribute?.('aria-valuemin', limits.min);
      handle.setAttribute?.('aria-valuemax', limits.max);
      handle.setAttribute?.('aria-valuenow', Math.round(value));
    }
    onResize({ ...layout, detailOpen, narrow: isNarrow() });
  };
  const change = (name, delta, save = true) => {
    const key = name === 'top' ? 'topHeight' : name === 'roster' ? 'rosterHeight' : 'detailWidth';
    layout = normalizeVillageFirstLayout({ ...layout, [key]: layout[key] + delta }, { ...viewport(), detailOpen });
    apply();
    if (save) persist();
  };
  const reset = () => {
    layout = normalizeVillageFirstLayout({}, { ...viewport(), detailOpen });
    apply();
    persist();
  };
  const onPointerMove = (event) => {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const coordinate = drag.name === 'detail' ? Number(event.clientX) : Number(event.clientY);
    const delta = drag.name === 'detail' ? drag.coordinate - coordinate : coordinate - drag.coordinate;
    drag.coordinate = coordinate;
    change(drag.name, delta);
  };
  const onPointerUp = (event) => {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    drag = null;
  };

  return {
    start() {
      if (started) return;
      started = true;
      try {
        const parsed = JSON.parse(storage?.getItem?.(VILLAGE_FIRST_LAYOUT_KEY) || 'null');
        if (parsed?.version === 1) layout = normalizeVillageFirstLayout(parsed, viewport());
      } catch { /* Preserve malformed storage until the user changes layout. */ }
      for (const name of ['top', 'roster', 'detail']) {
        const handle = handles[name];
        listen(handle, 'keydown', (event) => {
          const vertical = name !== 'detail';
          const negative = vertical ? event.key === 'ArrowUp' : event.key === 'ArrowRight';
          const positive = vertical ? event.key === 'ArrowDown' : event.key === 'ArrowLeft';
          if (!negative && !positive) return;
          event.preventDefault?.();
          change(name, (positive ? 1 : -1) * (event.shiftKey ? 16 : 4));
        });
        listen(handle, 'dblclick', reset);
        listen(handle, 'pointerdown', (event) => {
          if (isNarrow() || (name === 'detail' && !detailOpen)) return;
          event.preventDefault?.();
          drag = {
            name,
            pointerId: event.pointerId,
            coordinate: name === 'detail' ? Number(event.clientX) : Number(event.clientY),
          };
        });
      }
      listen(eventTarget, 'pointermove', onPointerMove);
      listen(eventTarget, 'pointerup', onPointerUp);
      listen(eventTarget, 'pointercancel', onPointerUp);
      listen(eventTarget, 'resize', apply);
      apply();
    },
    reset,
    getLayout: () => ({ ...layout }),
    setDetailOpen(open) { detailOpen = Boolean(open); apply(); },
    destroy() { removals.splice(0).forEach((remove) => remove()); drag = null; started = false; },
  };
}
