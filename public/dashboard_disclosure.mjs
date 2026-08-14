const STORAGE_KEY = 'pixelverse:dashboard-disclosure:v1';
const DRAWERS = new Set(['timeline', 'agents', 'diagnostics']);

const defaultDisclosure = () => ({ activeDrawer: null, guideDismissed: false });

export function readDashboardDisclosure(storage) {
  if (!storage) return defaultDisclosure();
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const activeDrawer = DRAWERS.has(value?.activeDrawer) ? value.activeDrawer : null;
    return { activeDrawer, guideDismissed: value?.guideDismissed === true };
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

export function toggleDashboardDrawer(state, requested) {
  if (!DRAWERS.has(requested)) return { ...state };
  return {
    ...state,
    activeDrawer: state.activeDrawer === requested ? null : requested,
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

export function restoreDashboardHelpFocus(helpButton) {
  if (typeof helpButton?.focus !== 'function') return false;
  helpButton.focus();
  return true;
}

export function dashboardDrawerLabel(copy, name) {
  if (name === 'timeline') return copy.eventBeltTitle;
  if (name === 'agents') return copy.inspectorTitle;
  if (name === 'diagnostics') return copy.diagnosticsLabel;
  return copy.dashboardPanels;
}

export function renderDashboardDrawerControl(button, { name, activeDrawer, copy }) {
  const label = dashboardDrawerLabel(copy, name);
  const expanded = activeDrawer === name;
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
