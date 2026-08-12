import test from 'node:test';
import assert from 'node:assert/strict';
import { setupPressFeedback } from '../public/press_feedback.mjs';

class EventFixture {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, target = this, init = {}) {
    const event = {
      type,
      target,
      currentTarget: this,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      ...init,
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }
}

class ElementFixture {
  constructor(tagName = 'button', parent = null) {
    this.tagName = tagName.toLowerCase();
    this.parent = parent;
    this.dataset = {};
    this.disabled = false;
    this.ariaDisabled = false;
    this.href = '';
    this.role = '';
    this.capturedPointers = new Set();
    this.captureError = null;
  }

  closest() {
    if (this.disabled || this.ariaDisabled) return this;
    if (this.tagName === 'button' || (this.tagName === 'a' && this.href) || this.role === 'button') return this;
    return this.parent?.closest() ?? null;
  }

  matches(selector) {
    return selector === ':disabled, [aria-disabled="true"]' && (this.disabled || this.ariaDisabled);
  }

  setPointerCapture(pointerId) {
    if (this.captureError) throw this.captureError;
    this.capturedPointers.add(pointerId);
  }
}

function fixture() {
  const documentFixture = new EventFixture();
  documentFixture.hidden = false;
  documentFixture.visibilityState = 'visible';
  const windowFixture = new EventFixture();
  return {
    documentFixture,
    windowFixture,
    button: new ElementFixture('button'),
    otherButton: new ElementFixture('button'),
  };
}

function pointer(target, pointerId, overrides = {}) {
  return { pointerId, pointerType: 'touch', button: 0, target, ...overrides };
}

test('press feedback marks on pointerdown and clears on pointerup or pointercancel', () => {
  const { documentFixture, windowFixture, button } = fixture();
  setupPressFeedback(documentFixture, windowFixture);

  documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  assert.equal(button.dataset.pressed, 'true');
  documentFixture.dispatch('pointerup', button, pointer(button, 1));
  assert.equal(button.dataset.pressed, undefined);

  documentFixture.dispatch('pointerdown', button, pointer(button, 2));
  documentFixture.dispatch('pointercancel', button, pointer(button, 2));
  assert.equal(button.dataset.pressed, undefined);
});

test('lost pointer capture clears only its pointer and retains another active press', () => {
  const { documentFixture, windowFixture, button } = fixture();
  setupPressFeedback(documentFixture, windowFixture);

  documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  documentFixture.dispatch('pointerdown', button, pointer(button, 2));
  documentFixture.dispatch('lostpointercapture', button, pointer(button, 1));
  assert.equal(button.dataset.pressed, 'true');

  documentFixture.dispatch('lostpointercapture', button, pointer(button, 2));
  assert.equal(button.dataset.pressed, undefined);
});

test('one pointer moving to another control releases only its previous control', () => {
  const { documentFixture, windowFixture, button, otherButton } = fixture();
  setupPressFeedback(documentFixture, windowFixture);

  documentFixture.dispatch('pointerdown', button, pointer(button, 4));
  documentFixture.dispatch('pointerdown', otherButton, pointer(otherButton, 4));

  assert.equal(button.dataset.pressed, undefined);
  assert.equal(otherButton.dataset.pressed, 'true');
});

test('window and page lifecycle events clear presses that finish outside the document', () => {
  const cleanupEvents = ['pointerup', 'pointercancel', 'blur', 'pagehide'];
  for (const [index, type] of cleanupEvents.entries()) {
    const { documentFixture, windowFixture, button } = fixture();
    setupPressFeedback(documentFixture, windowFixture);
    documentFixture.dispatch('pointerdown', button, pointer(button, index + 1));

    windowFixture.dispatch(type, windowFixture, pointer(windowFixture, index + 1));

    assert.equal(button.dataset.pressed, undefined, `${type} must clear the press`);
  }
});

test('lifecycle cleanup resets pointer bookkeeping before the control is pressed again', () => {
  const { documentFixture, windowFixture, button } = fixture();
  setupPressFeedback(documentFixture, windowFixture);

  documentFixture.dispatch('pointerdown', button, pointer(button, 21));
  windowFixture.dispatch('blur');
  documentFixture.dispatch('pointerdown', button, pointer(button, 22));
  documentFixture.dispatch('pointerup', button, pointer(button, 22));

  assert.equal(button.dataset.pressed, undefined);
});

test('hidden document clears every active pointer', () => {
  const { documentFixture, windowFixture, button, otherButton } = fixture();
  setupPressFeedback(documentFixture, windowFixture);
  documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  documentFixture.dispatch('pointerdown', otherButton, pointer(otherButton, 2));

  documentFixture.hidden = true;
  documentFixture.visibilityState = 'hidden';
  documentFixture.dispatch('visibilitychange');

  assert.equal(button.dataset.pressed, undefined);
  assert.equal(otherButton.dataset.pressed, undefined);
});

test('setup is idempotent and one teardown removes the installed behavior', () => {
  const { documentFixture, windowFixture, button } = fixture();
  const firstTeardown = setupPressFeedback(documentFixture, windowFixture);
  const secondTeardown = setupPressFeedback(documentFixture, windowFixture);
  assert.equal(secondTeardown, firstTeardown);

  firstTeardown();
  documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  assert.equal(button.dataset.pressed, undefined);
});

test('disabled controls and non-primary mouse buttons never enter pressed state', () => {
  const { documentFixture, windowFixture, button, otherButton } = fixture();
  setupPressFeedback(documentFixture, windowFixture);
  button.disabled = true;
  otherButton.ariaDisabled = true;

  documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  documentFixture.dispatch('pointerdown', otherButton, pointer(otherButton, 2));
  button.disabled = false;
  documentFixture.dispatch('pointerdown', button, pointer(button, 3, { pointerType: 'mouse', button: 2 }));

  assert.equal(button.dataset.pressed, undefined);
  assert.equal(otherButton.dataset.pressed, undefined);
});

test('pointer capture failure is safe and click activation is not intercepted or delayed', () => {
  const { documentFixture, windowFixture, button } = fixture();
  let clicks = 0;
  button.captureError = new Error('capture unavailable');
  documentFixture.addEventListener('click', () => { clicks += 1; });
  setupPressFeedback(documentFixture, windowFixture);

  const down = documentFixture.dispatch('pointerdown', button, pointer(button, 1));
  const click = documentFixture.dispatch('click', button);

  assert.equal(button.dataset.pressed, 'true');
  assert.equal(button.capturedPointers.size, 0);
  assert.equal(down.defaultPrevented, false);
  assert.equal(down.propagationStopped, false);
  assert.equal(clicks, 1);
  assert.equal(click.defaultPrevented, false);
});
