const STORAGE_KEY = 'pixelverse:dashboard-disclosure:v2';
const CARDS = new Set(['events', 'agents', 'help']);

const defaultDisclosure = () => ({ activeCard: null, guideDismissed: false });

export function readDashboardDisclosure(storage) {
  if (!storage) return defaultDisclosure();
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const activeCard = CARDS.has(value?.activeCard) ? value.activeCard : null;
    return { activeCard, guideDismissed: value?.guideDismissed === true };
  } catch {
    return defaultDisclosure();
  }
}

export function writeDashboardDisclosure(storage, state) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return false;
  }
  return true;
}

export function toggleDashboardCard(state, requested, blocked = false) {
  if (!CARDS.has(requested)) return { ...state };
  if (blocked) return { ...state, activeCard: null };
  return {
    ...state,
    activeCard: state.activeCard === requested ? null : requested,
  };
}

export function createCutawayFocusHandoff({
  schedule = (callback) => typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(callback)
    : globalThis.setTimeout(callback, 0),
  cancel = (handle) => typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame(handle)
    : globalThis.clearTimeout(handle),
} = {}) {
  let pendingTrigger = null;
  let activeTrigger = null;
  let expiryHandle = null;
  let pointerInProgress = false;
  const clearExpiry = () => {
    if (expiryHandle === null) return;
    cancel?.(expiryHandle);
    expiryHandle = null;
  };
  const usable = (trigger) => trigger && trigger.isConnected !== false ? trigger : null;
  const expirePendingAfterFrame = () => {
    clearExpiry();
    if (!pendingTrigger) return null;
    expiryHandle = schedule(() => {
      expiryHandle = null;
      if (!pointerInProgress) pendingTrigger = null;
    });
    return expiryHandle;
  };
  return {
    framePointerDown(trigger) {
      clearExpiry();
      pointerInProgress = true;
      pendingTrigger = usable(trigger);
      if (!pendingTrigger) return null;
      expirePendingAfterFrame();
      return pendingTrigger;
    },
    framePointerComplete() {
      pointerInProgress = false;
      if (!pendingTrigger) {
        clearExpiry();
        return null;
      }
      expirePendingAfterFrame();
      return pendingTrigger;
    },
    frameCutawayOpened() {
      pointerInProgress = false;
      clearExpiry();
      activeTrigger = usable(pendingTrigger) || usable(activeTrigger);
      pendingTrigger = null;
      return activeTrigger;
    },
    cutawayOpened(fallbackTrigger) {
      pointerInProgress = false;
      clearExpiry();
      activeTrigger = usable(activeTrigger) || usable(pendingTrigger) || usable(fallbackTrigger);
      pendingTrigger = null;
      return activeTrigger;
    },
    cutawayClosed() {
      pointerInProgress = false;
      clearExpiry();
      pendingTrigger = null;
      const trigger = usable(activeTrigger);
      activeTrigger = null;
      return trigger;
    },
    reset() {
      pointerInProgress = false;
      clearExpiry();
      pendingTrigger = null;
      activeTrigger = null;
    },
  };
}

export function shouldShowGuide(state, modality) {
  return state.guideDismissed !== true
    && (modality === 'pointer' || modality === 'keyboard' || modality === 'touch');
}

export function dashboardInputModality(event = {}) {
  if (event.type === 'keydown') return 'keyboard';
  if (event.pointerType === 'touch') return 'touch';
  return 'pointer';
}

export function dashboardGuideVisible(state, modality, forcedOpen = false) {
  return forcedOpen || shouldShowGuide(state, modality);
}

export function restoreDashboardCardFocus(trigger) {
  if (typeof trigger?.focus !== 'function') return false;
  if (trigger.hidden || trigger.disabled || trigger.getAttribute?.('aria-hidden') === 'true') return false;
  if ('isConnected' in trigger && !trigger.isConnected) return false;
  if (trigger.closest?.('[hidden], [aria-hidden="true"]')) return false;
  if (typeof trigger.getClientRects === 'function' && trigger.getClientRects().length === 0) return false;
  trigger.focus();
  return true;
}

export function deferDashboardCardFocus(trigger, {
  schedule = (callback) => globalThis.setTimeout(callback, 0),
  cancel = (handle) => globalThis.clearTimeout(handle),
} = {}) {
  let active = true;
  const handle = schedule(() => {
    if (!active) return;
    active = false;
    restoreDashboardCardFocus(trigger);
  });
  return () => {
    if (!active) return false;
    active = false;
    cancel?.(handle);
    return true;
  };
}

export function activeDashboardCardTrigger(activeCard, lastTrigger, buttons = []) {
  if (!CARDS.has(activeCard)) return null;
  if (lastTrigger?.dataset?.dashboardCard === activeCard) return lastTrigger;
  return (Array.isArray(buttons) ? buttons : [])
    .find((button) => button?.dataset?.dashboardCard === activeCard) || null;
}

export function dashboardCardLabel(copy, name) {
  if (name === 'events') return copy.dashboardEvents;
  if (name === 'agents') return copy.dashboardAgents;
  if (name === 'help') return copy.dashboardHelp;
  return copy.dashboardPanels;
}

export function renderDashboardCardControl(button, { name, activeCard, copy, blocked = false }) {
  const label = dashboardCardLabel(copy, name);
  const expanded = !blocked && activeCard === name;
  const setAttribute = (attribute, value) => {
    const next = String(value);
    if (button.getAttribute?.(attribute) === next) return;
    button.setAttribute(attribute, next);
  };
  if (button.disabled !== blocked) button.disabled = blocked;
  setAttribute('aria-disabled', blocked);
  setAttribute('aria-expanded', expanded);
  setAttribute('aria-label', `${expanded ? copy.hidePanels : copy.showPanels}: ${label}`);
  if (button.dataset.tooltip !== label) button.dataset.tooltip = label;
  if (button.title !== label) button.title = label;
  return label;
}

export function updateLiveRegionText(node, text) {
  if (!node || node.textContent === text) return false;
  node.textContent = text;
  return true;
}
