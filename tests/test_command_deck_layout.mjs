import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMAND_DECK_LAYOUT_KEY,
  createCommandDeckLayoutController,
  normalizeCommandDeckLayout,
} from '../public/command_deck_layout.mjs';

const desktop = { width: 1_440, height: 900, topHeight: 44 };

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem(key, value) { values.set(key, value); writes.push([key, value]); },
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    dataset: {},
    attributes: new Map(),
    style: { values: new Map(), setProperty(key, value) { this.values.set(key, value); } },
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
    },
    setAttribute(key, value) { this.attributes.set(key, String(value)); },
    removeAttribute(key) { this.attributes.delete(key); },
    setPointerCapture() {},
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach((listener) => listener({
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        preventDefault() {},
        ...event,
      }));
    },
  };
}

function fixture({ storage = memoryStorage(), size = desktop } = {}) {
  const workspace = eventTarget();
  const leftHandle = eventTarget();
  const rightHandle = eventTarget();
  const bottomHandle = eventTarget();
  const resizeTarget = eventTarget();
  let viewport = { ...size };
  const controller = createCommandDeckLayoutController({
    workspace,
    leftHandle,
    rightHandle,
    bottomHandle,
    storage,
    resizeTarget,
    viewport: () => viewport,
  });
  return {
    controller,
    workspace,
    leftHandle,
    rightHandle,
    bottomHandle,
    resizeTarget,
    storage,
    setViewport(next) { viewport = { ...next }; },
  };
}

test('normalization preserves a safe minimum village at desktop viewport sizes', () => {
  const layout = normalizeCommandDeckLayout({
    leftWidth: 900,
    rightWidth: 900,
    bottomHeight: 700,
    leftDock: 'inspector',
    rightDock: 'agents',
    collapsed: { left: false, right: false, bottom: false },
  }, { width: 1_024, height: 768, topHeight: 44 });

  assert.ok(layout.leftWidth + layout.rightWidth + 16 + 520 <= 1_024);
  assert.ok(layout.bottomHeight + 8 + 320 <= 768 - 44);
  assert.equal(layout.leftDock, 'inspector');
  assert.equal(layout.rightDock, 'agents');
});

test('normalization rejects malformed values and keeps docks complementary', () => {
  const layout = normalizeCommandDeckLayout({
    leftWidth: 'nope', rightWidth: Infinity, bottomHeight: -4,
    leftDock: 'agents', rightDock: 'agents', collapsed: { left: 1, bottom: true },
  }, desktop);
  assert.deepEqual(layout, {
    leftWidth: 280,
    rightWidth: 260,
    bottomHeight: 180,
    leftDock: 'agents',
    rightDock: 'inspector',
    collapsed: { left: false, right: false, bottom: true },
  });
});

test('controller migrates live rail and v1 workbench values into one v2 object', () => {
  const storage = memoryStorage({
    'pixelverse:live-left-width': '296',
    'pixelverse:live-right-width': '276',
    'pixelverse:workbench-layout:v1': JSON.stringify({ sidebarWidth: 410, timelineHeight: 244 }),
  });
  const { controller } = fixture({ storage });
  controller.start();

  assert.deepEqual(controller.getLayout(), {
    leftWidth: 296,
    rightWidth: 276,
    bottomHeight: 244,
    leftDock: 'agents',
    rightDock: 'inspector',
    collapsed: { left: false, right: false, bottom: false },
  });
  assert.equal(storage.writes.at(-1)[0], COMMAND_DECK_LAYOUT_KEY);
});

test('invalid v2 storage falls back without destructively overwriting it', () => {
  const storage = memoryStorage({ [COMMAND_DECK_LAYOUT_KEY]: '{broken' });
  const { controller } = fixture({ storage });
  controller.start();
  assert.deepEqual(controller.getLayout(), normalizeCommandDeckLayout({}, desktop));
  assert.equal(storage.values.get(COMMAND_DECK_LAYOUT_KEY), '{broken');
  assert.equal(storage.writes.length, 0);
});

test('pointer and keyboard resizing clamp, persist, and survive reload', () => {
  const storage = memoryStorage();
  const first = fixture({ storage });
  first.controller.start();
  first.leftHandle.dispatch('keydown', { key: 'ArrowRight', shiftKey: false });
  first.bottomHandle.dispatch('pointerdown', { clientY: 600 });
  first.bottomHandle.dispatch('pointermove', { clientY: 540 });
  first.bottomHandle.dispatch('pointerup', { clientY: 540 });
  assert.equal(first.controller.getLayout().leftWidth, 296);
  assert.equal(first.controller.getLayout().bottomHeight, 240);

  const second = fixture({ storage });
  second.controller.start();
  assert.equal(second.controller.getLayout().leftWidth, 296);
  assert.equal(second.controller.getLayout().bottomHeight, 240);

  second.setViewport({ width: 1_024, height: 768, topHeight: 44 });
  second.resizeTarget.dispatch('resize');
  const clamped = second.controller.getLayout();
  assert.ok(clamped.leftWidth + clamped.rightWidth + 16 + 520 <= 1_024);
  assert.ok(clamped.bottomHeight + 8 + 320 <= 724);
});

test('collapse restores saved dimensions, swapping docks does not move DOM, and reset is complete', () => {
  const storage = memoryStorage();
  const { controller, workspace } = fixture({ storage });
  controller.start();
  controller.collapse('left');
  assert.equal(controller.getLayout().collapsed.left, true);
  assert.equal(workspace.style.values.get('--command-left-track'), '0px');
  controller.collapse('left');
  assert.equal(controller.getLayout().collapsed.left, false);
  assert.equal(controller.getLayout().leftWidth, 280);

  controller.swapSides();
  assert.equal(workspace.dataset.leftDock, 'inspector');
  assert.equal(workspace.dataset.rightDock, 'agents');
  controller.reset();
  assert.deepEqual(controller.getLayout(), normalizeCommandDeckLayout({}, desktop));
});

test('narrow mode does not apply or overwrite desktop geometry', () => {
  const saved = {
    leftWidth: 340, rightWidth: 300, bottomHeight: 220,
    leftDock: 'agents', rightDock: 'inspector',
    collapsed: { left: false, right: false, bottom: false },
  };
  const storage = memoryStorage({ [COMMAND_DECK_LAYOUT_KEY]: JSON.stringify(saved) });
  const narrow = fixture({ storage, size: { width: 720, height: 780, topHeight: 44 } });
  narrow.controller.start();

  assert.equal(narrow.workspace.dataset.commandDeckMode, 'narrow');
  assert.equal(narrow.workspace.style.values.has('--command-left-width'), false);
  assert.deepEqual(narrow.controller.getLayout(), saved);
  assert.equal(storage.writes.length, 0);
});
