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

export function toggleDashboardCard(state, requested) {
  if (!CARDS.has(requested)) return { ...state };
  return {
    ...state,
    activeCard: state.activeCard === requested ? null : requested,
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
  trigger.focus();
  return true;
}

export function dashboardCardLabel(copy, name) {
  if (name === 'events') return copy.dashboardEvents;
  if (name === 'agents') return copy.dashboardAgents;
  if (name === 'help') return copy.dashboardHelp;
  return copy.dashboardPanels;
}

export function renderDashboardCardControl(button, { name, activeCard, copy }) {
  const label = dashboardCardLabel(copy, name);
  const expanded = activeCard === name;
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', `${expanded ? copy.hidePanels : copy.showPanels}: ${label}`);
  button.dataset.tooltip = label;
  button.title = label;
  return label;
}

export function updateLiveRegionText(node, text) {
  if (!node || node.textContent === text) return false;
  node.textContent = text;
  return true;
}

export function applyMapLayerVisibility({ frame, legacyStage, legacyControls } = {}, legacyActive = false) {
  const update = (element, hidden) => {
    if (!element) return;
    element.hidden = hidden;
    element.inert = hidden;
    element.setAttribute?.('aria-hidden', String(hidden));
  };
  update(frame, legacyActive);
  update(legacyStage, !legacyActive);
  update(legacyControls, !legacyActive);
}
