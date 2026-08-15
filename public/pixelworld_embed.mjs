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

const CUTAWAY_OPEN_EVENT = 'pixelworld:cutaway-open';

const usableRect = (rect) => Boolean(
  rect
  && [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
  && rect.right > rect.left
  && rect.bottom > rect.top,
);

const rectsIntersect = (left, right) => (
  left.left < right.right && left.right > right.left
  && left.top < right.bottom && left.bottom > right.top
);

export function cutawayChromeCollidesWithHost({ hostRects = [], childRects = [], frameRect } = {}) {
  if (!frameRect || !Number.isFinite(frameRect.left) || !Number.isFinite(frameRect.top)) return false;
  const hosts = hostRects.filter(usableRect);
  const children = childRects.filter(usableRect).map((rect) => ({
    left: frameRect.left + rect.left,
    top: frameRect.top + rect.top,
    right: frameRect.left + rect.right,
    bottom: frameRect.top + rect.bottom,
  }));
  return hosts.some((host) => children.some((child) => rectsIntersect(host, child)));
}

export function createCutawayStatusRailController({
  body,
  frame,
  hostElements = [],
  childSelector = '.cutaway-dom-header',
} = {}) {
  const clear = () => body?.classList?.remove?.('cutaway-status-rail');
  return {
    sync() {
      if (body?.dataset?.pixelworldCutaway !== 'open') {
        clear();
        return false;
      }
      // Measure the unobstructed baseline. Removing and restoring the class in
      // one task does not paint an intermediate frame, and prevents the rail's
      // own shifted iframe/compact HUD geometry from feeding back into policy.
      clear();
      let childElements;
      try {
        childElements = [...(frame?.contentDocument?.querySelectorAll?.(childSelector) ?? [])];
      } catch {
        clear();
        return false;
      }
      const frameRect = frame?.getBoundingClientRect?.();
      const childRects = childElements
        .filter((element) => !element.hidden)
        .map((element) => element.getBoundingClientRect());
      // InteriorCutawaySystem centers a frame capped at 720x495 with an 8px
      // margin. Reconstruct its natural header origin from the now-full iframe;
      // the measured header height remains authoritative.
      const centeredChildRects = frameRect?.width > 0 && frameRect?.height > 0
        ? childRects.map((rect) => {
          const width = Math.min(720, Math.max(0, frameRect.width - 16));
          const height = Math.min(495, Math.max(0, frameRect.height - 16));
          const left = (frameRect.width - width) / 2;
          const top = (frameRect.height - height) / 2;
          return { left, top, right: left + width, bottom: top + (rect.bottom - rect.top) };
        })
        : childRects;
      const required = cutawayChromeCollidesWithHost({
        hostRects: hostElements
          .map((entry) => ({
            element: entry?.element ?? entry,
            minimumHeight: Number(entry?.minimumHeight) || 0,
          }))
          .filter(({ element }) => element && !element.hidden)
          .map(({ element, minimumHeight }) => {
            const rect = element.getBoundingClientRect();
            return minimumHeight > 0
              ? {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: Math.max(rect.bottom, rect.top + minimumHeight),
              }
              : rect;
          }),
        childRects: centeredChildRects,
        frameRect,
      });
      body?.classList?.toggle?.('cutaway-status-rail', required);
      return required;
    },
    clear,
  };
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
      onCutawayStateChange(false);
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

export function attachPixelworldBridge({
  frame,
  messageTarget = globalThis.window,
  bridge,
  origin = globalThis.location?.origin || '',
  onFrameLoad = () => {},
  onFrameCutawayOpen = () => {},
  onFramePointerDown = () => {},
  onFramePointerComplete = () => {},
  onFrameEscape = () => {},
} = {}) {
  if (!bridge) return () => {};
  let childDocument = null;
  let childWindow = null;
  const handleChildCutawayOpen = (event) => onFrameCutawayOpen(event);
  const handleChildPointerDown = (event) => onFramePointerDown(event);
  const handleChildPointerComplete = (event) => onFramePointerComplete(event);
  const handleChildKeydown = (event) => {
    if (event?.key === 'Escape') onFrameEscape(event);
  };
  const detachChildDocument = () => {
    childWindow?.removeEventListener?.(CUTAWAY_OPEN_EVENT, handleChildCutawayOpen);
    childDocument?.removeEventListener?.('pointerdown', handleChildPointerDown, true);
    childDocument?.removeEventListener?.('pointerup', handleChildPointerComplete, true);
    childDocument?.removeEventListener?.('pointercancel', handleChildPointerComplete, true);
    childDocument?.removeEventListener?.('keydown', handleChildKeydown, true);
    childDocument = null;
    childWindow = null;
  };
  const attachChildDocument = () => {
    detachChildDocument();
    let candidate;
    try {
      candidate = frame?.contentDocument;
      if (!candidate || candidate.defaultView !== frame?.contentWindow) return false;
      if (!origin || candidate.location?.origin !== origin) return false;
      candidate.defaultView.addEventListener?.(CUTAWAY_OPEN_EVENT, handleChildCutawayOpen);
      candidate.addEventListener('pointerdown', handleChildPointerDown, true);
      candidate.addEventListener('pointerup', handleChildPointerComplete, true);
      candidate.addEventListener('pointercancel', handleChildPointerComplete, true);
      candidate.addEventListener('keydown', handleChildKeydown, true);
    } catch {
      detachChildDocument();
      return false;
    }
    childDocument = candidate;
    childWindow = candidate.defaultView;
    return true;
  };
  const handleLoad = () => {
    detachChildDocument();
    onFrameLoad();
    bridge.handleLoad();
    attachChildDocument();
  };
  const handleMessage = (event) => bridge.handleMessage(event);
  frame?.addEventListener?.('load', handleLoad);
  messageTarget?.addEventListener?.('message', handleMessage);
  attachChildDocument();
  return () => {
    detachChildDocument();
    frame?.removeEventListener?.('load', handleLoad);
    messageTarget?.removeEventListener?.('message', handleMessage);
  };
}

export function attachPageLifecycleCleanup({ pageTarget = globalThis.window, cleanup = () => {} } = {}) {
  let cleaned = false;
  const handlePageHide = (event) => {
    if (event?.persisted || cleaned) return;
    cleaned = true;
    cleanup();
  };
  pageTarget?.addEventListener?.('pagehide', handlePageHide);
  return () => pageTarget?.removeEventListener?.('pagehide', handlePageHide);
}
