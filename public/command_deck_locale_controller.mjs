import { normalizeLocale } from './ui_strings.mjs';

export function createCommandDeckLocaleController({
  initialLocale = 'en-US',
  localeSelect,
  storage = globalThis.localStorage,
  bridge,
  getSnapshot = () => null,
  getMissionTrace = () => null,
  getSelection = () => null,
  applyStaticCopy = () => {},
  renderSnapshot = () => {},
  renderMissionTrace = () => {},
  renderLiveMonitoring = () => {},
  resolveSelection = () => null,
  renderInspector = () => {},
  onLocale = () => {},
} = {}) {
  let locale = normalizeLocale(initialLocale);
  const setLocale = (nextLocale) => {
    locale = normalizeLocale(nextLocale);
    onLocale(locale);
    storage?.setItem?.('pixelverse:locale', locale);
    applyStaticCopy();
    bridge?.setLocale?.(locale);
    const snapshot = getSnapshot();
    const missionTrace = getMissionTrace();
    if (snapshot) renderSnapshot(snapshot);
    if (missionTrace) renderMissionTrace(missionTrace, { structureChanged: true });
    if (snapshot) renderLiveMonitoring(snapshot);
    renderInspector(resolveSelection(getSelection())?.agent || null);
    return locale;
  };
  const handleChange = (event) => setLocale(event?.target?.value);
  const attach = () => {
    localeSelect?.addEventListener?.('change', handleChange);
    return () => localeSelect?.removeEventListener?.('change', handleChange);
  };
  return { attach, setLocale, getLocale: () => locale };
}
