export function publishPixelworldSnapshot(frame, snapshot, sequence = Date.now(), origin = window.location.origin) {
  if (!frame?.contentWindow) return false;
  frame.contentWindow.postMessage({ type: 'pixelverse.world.snapshot', snapshot, sequence }, origin);
  return true;
}

export function publishPixelworldLocale(frame, locale, sequence = Date.now(), origin = window.location.origin) {
  if (!frame?.contentWindow) return false;
  frame.contentWindow.postMessage({ type: 'pixelverse.locale.update', locale, sequence }, origin);
  return true;
}

export function isPixelworldReadyMessage(value) {
  return Boolean(value && typeof value === 'object' && value.type === 'pixelverse.world.ready');
}

export function isPixelworldCutawayStateMessage(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.type === 'pixelverse.cutaway.state'
    && typeof value.open === 'boolean',
  );
}

export function createPixelworldBridge({
  frame,
  origin = globalThis.location?.origin || '',
  now = () => Date.now(),
  onCutawayStateChange = () => {},
} = {}) {
  let currentLocale = null;
  let currentSnapshot = null;
  let snapshotSequence = null;

  const replay = () => {
    let published = false;
    if (currentLocale) {
      published = publishPixelworldLocale(frame, currentLocale, now(), origin) || published;
    }
    if (currentSnapshot) {
      published = publishPixelworldSnapshot(
        frame,
        currentSnapshot,
        snapshotSequence ?? now(),
        origin,
      ) || published;
    }
    return published;
  };

  return {
    setLocale(locale, sequence = now()) {
      currentLocale = locale;
      return publishPixelworldLocale(frame, locale, sequence, origin);
    },
    setSnapshot(snapshot, sequence = now()) {
      currentSnapshot = snapshot;
      snapshotSequence = sequence;
      return publishPixelworldSnapshot(frame, snapshot, sequence, origin);
    },
    handleLoad() {
      return replay();
    },
    handleMessage(event) {
      if (event?.origin !== origin || event?.source !== frame?.contentWindow) return false;
      if (isPixelworldReadyMessage(event.data)) {
        replay();
        return true;
      }
      if (isPixelworldCutawayStateMessage(event.data)) {
        onCutawayStateChange(event.data.open);
        return true;
      }
      return false;
    },
  };
}

export function attachPixelworldBridge({ frame, messageTarget = globalThis.window, bridge } = {}) {
  if (!bridge) return () => {};
  const handleLoad = () => bridge.handleLoad();
  const handleMessage = (event) => bridge.handleMessage(event);
  frame?.addEventListener?.('load', handleLoad);
  messageTarget?.addEventListener?.('message', handleMessage);
  return () => {
    frame?.removeEventListener?.('load', handleLoad);
    messageTarget?.removeEventListener?.('message', handleMessage);
  };
}
