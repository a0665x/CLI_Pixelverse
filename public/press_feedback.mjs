const activeSetups = new WeakMap();

const PRESSABLE_SELECTOR = 'button, a[href], [role="button"]';
const DISABLED_SELECTOR = ':disabled, [aria-disabled="true"]';

export function setupPressFeedback(root = document, lifecycle = window) {
  const existing = activeSetups.get(root);
  if (existing) return existing;

  const controlPointers = new WeakMap();
  const pointerControls = new Map();
  const activeControls = new Set();

  const releasePointer = (pointerId) => {
    const control = pointerControls.get(pointerId);
    if (!control) return;
    pointerControls.delete(pointerId);
    const pointers = controlPointers.get(control);
    pointers?.delete(pointerId);
    if (pointers?.size) return;
    controlPointers.delete(control);
    activeControls.delete(control);
    delete control.dataset.pressed;
  };

  const clearAll = () => {
    for (const control of activeControls) {
      controlPointers.delete(control);
      delete control.dataset.pressed;
    }
    activeControls.clear();
    pointerControls.clear();
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const control = event.target?.closest?.(PRESSABLE_SELECTOR);
    if (!control || control.matches?.(DISABLED_SELECTOR)) return;

    const previous = pointerControls.get(event.pointerId);
    if (previous && previous !== control) releasePointer(event.pointerId);

    const pointers = controlPointers.get(control) ?? new Set();
    pointers.add(event.pointerId);
    controlPointers.set(control, pointers);
    pointerControls.set(event.pointerId, control);
    activeControls.add(control);
    control.dataset.pressed = 'true';
    try {
      control.setPointerCapture?.(event.pointerId);
    } catch {
      // Window lifecycle listeners still guarantee cleanup when capture is unavailable.
    }
  };

  const onPointerFinish = (event) => releasePointer(event.pointerId);
  const onVisibilityChange = () => {
    if (root.hidden || root.visibilityState === 'hidden') clearAll();
  };

  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('pointerup', onPointerFinish, true);
  root.addEventListener('pointercancel', onPointerFinish, true);
  root.addEventListener('lostpointercapture', onPointerFinish, true);
  root.addEventListener('visibilitychange', onVisibilityChange);
  lifecycle.addEventListener('pointerup', onPointerFinish, true);
  lifecycle.addEventListener('pointercancel', onPointerFinish, true);
  lifecycle.addEventListener('blur', clearAll);
  lifecycle.addEventListener('pagehide', clearAll);

  const teardown = () => {
    root.removeEventListener('pointerdown', onPointerDown, true);
    root.removeEventListener('pointerup', onPointerFinish, true);
    root.removeEventListener('pointercancel', onPointerFinish, true);
    root.removeEventListener('lostpointercapture', onPointerFinish, true);
    root.removeEventListener('visibilitychange', onVisibilityChange);
    lifecycle.removeEventListener('pointerup', onPointerFinish, true);
    lifecycle.removeEventListener('pointercancel', onPointerFinish, true);
    lifecycle.removeEventListener('blur', clearAll);
    lifecycle.removeEventListener('pagehide', clearAll);
    clearAll();
    if (activeSetups.get(root) === teardown) activeSetups.delete(root);
  };
  activeSetups.set(root, teardown);
  return teardown;
}
