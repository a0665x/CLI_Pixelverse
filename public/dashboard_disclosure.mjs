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
