import test from 'node:test';
import assert from 'node:assert/strict';
import * as workbenchLayout from '../public/workbench_layout.mjs';
import {
  clampSidebarWidth,
  clampTimelineHeight,
  layoutFromPointer,
  readWorkbenchLayout,
  timelineHeightBounds,
  workbenchTopFor,
  writeWorkbenchLayout,
} from '../public/workbench_layout.mjs';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.capturedPointer = null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }

  dispatch(type, event = {}) {
    const payload = {
      button: 0,
      pointerId: 1,
      preventDefault() {},
      ...event,
    };
    (this.listeners.get(type) || []).forEach((listener) => listener(payload));
  }

  setPointerCapture(pointerId) { this.capturedPointer = pointerId; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function fakeClassList() {
  const values = new Set();
  return {
    values,
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

function fakeStyle(initial = {}) {
  const properties = new Map(Object.entries(initial));
  return {
    properties,
    setProperty: (name, value) => properties.set(name, String(value)),
    removeProperty: (name) => properties.delete(name),
    getPropertyValue: (name) => properties.get(name) || '',
  };
}

test('workbench dimensions preserve useful space at viewport bounds', () => {
  assert.equal(clampSidebarWidth(100, 1280), 320);
  assert.equal(clampSidebarWidth(900, 1280), 576);
  assert.equal(clampTimelineHeight(80, 720), 180);
  assert.equal(clampTimelineHeight(650, 720), 374);
  assert.equal(clampTimelineHeight(650, 720, 252), 260);
  assert.deepEqual(timelineHeightBounds(420, 252), { min: 180, max: 180 });
});

test('village begins below a wrapped header instead of being covered by it', () => {
  assert.equal(workbenchTopFor(92), 138);
  assert.equal(workbenchTopFor(228), 252);
});

test('pointer movement maps one-to-one onto the matching boundary', () => {
  assert.equal(layoutFromPointer('sidebar', 440, 100, 137, { width: 1280, height: 720 }), 477);
  assert.equal(layoutFromPointer('timeline', 320, 500, 548, { width: 1280, height: 720 }), 272);
});

test('saved layout round-trips and malformed storage falls back safely', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 440, timelineHeight: 260 });
  writeWorkbenchLayout(storage, { sidebarWidth: 510, timelineHeight: 230 });
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 510, timelineHeight: 230 });
  values.set('pixelverse:workbench-layout:v1', '{bad json');
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 440, timelineHeight: 260 });
});

test('controller handles right-edge pointer and keyboard resizing and persists bounded values', () => {
  assert.equal(typeof workbenchLayout.setupWorkbenchLayoutController, 'function');
  const sidebarHandle = new FakeTarget();
  const timelineHandle = new FakeTarget();
  const resizeTarget = new FakeTarget();
  const properties = new Map();
  const root = { style: { setProperty: (name, value) => properties.set(name, value) } };
  const classList = fakeClassList();
  const body = { classList };
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let resizeCount = 0;
  const controller = workbenchLayout.setupWorkbenchLayoutController({
    sidebarHandle,
    timelineHandle,
    resizeTarget,
    root,
    body,
    storage,
    sidebarEdge: 'right',
    viewport: () => ({ width: 1280, height: 900, workbenchTop: 138 }),
    onResize: () => { resizeCount += 1; },
  });

  assert.equal(properties.get('--sidebar-width'), '440px');
  assert.equal(properties.get('--timeline-height'), '260px');
  sidebarHandle.dispatch('pointerdown', { clientX: 100 });
  sidebarHandle.dispatch('pointermove', { clientX: 60 });
  assert.equal(properties.get('--sidebar-width'), '480px');
  assert.equal(classList.values.has('workbench-resizing--sidebar'), true);
  sidebarHandle.dispatch('pointerup', { clientX: 60 });
  assert.equal(classList.values.has('workbench-resizing--sidebar'), false);
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 480, timelineHeight: 260 });

  sidebarHandle.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(properties.get('--sidebar-width'), '492px');
  timelineHandle.dispatch('pointerdown', { clientY: 500 });
  timelineHandle.dispatch('pointermove', { clientY: 540 });
  timelineHandle.dispatch('pointerup', { clientY: 540 });
  assert.equal(properties.get('--timeline-height'), '220px');
  timelineHandle.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(properties.get('--timeline-height'), '232px');
  assert.equal(Number(sidebarHandle.attributes.get('aria-valuemax')) >= 492, true);
  assert.equal(Number(timelineHandle.attributes.get('aria-valuemax')) >= 232, true);
  assert.equal(resizeCount >= 4, true);

  controller.destroy();
  assert.equal((resizeTarget.listeners.get('resize') || []).length, 0);
});

test('legacy sidebar and timeline sizes migrate once into the bounded controller without inline competition', () => {
  const sidebarHandle = new FakeTarget();
  const timelineHandle = new FakeTarget();
  const resizeTarget = new FakeTarget();
  const rootStyle = fakeStyle();
  const root = { style: rootStyle };
  const body = { classList: fakeClassList() };
  const sidebarPanel = { dataset: { resizablePanel: 'sidebar' }, style: fakeStyle({ width: '910px' }) };
  const timelinePanel = { dataset: { resizablePanel: 'timeline' }, style: fakeStyle({ height: '680px' }) };
  const inspectorPanel = { dataset: { resizablePanel: 'inspector' }, style: fakeStyle({ height: '300px' }) };
  const values = new Map([
    ['pixelverse:size:sidebar', '9999'],
    ['pixelverse:size:timeline', '9999'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  assert.equal(typeof workbenchLayout.legacyResizablePanels, 'function');
  assert.deepEqual(
    workbenchLayout.legacyResizablePanels([sidebarPanel, timelinePanel, inspectorPanel]),
    [inspectorPanel],
  );
  const controller = workbenchLayout.setupWorkbenchLayoutController({
    sidebarHandle,
    timelineHandle,
    sidebarPanel,
    timelinePanel,
    resizeTarget,
    root,
    body,
    storage,
    sidebarEdge: 'right',
    viewport: () => ({ width: 1280, height: 720, workbenchTop: 138 }),
  });

  assert.equal(rootStyle.getPropertyValue('--sidebar-width'), '576px');
  assert.equal(rootStyle.getPropertyValue('--timeline-height'), '374px');
  assert.equal(sidebarPanel.style.getPropertyValue('width'), '');
  assert.equal(timelinePanel.style.getPropertyValue('height'), '');
  assert.equal(values.has('pixelverse:size:sidebar'), false);
  assert.equal(values.has('pixelverse:size:timeline'), false);
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 576, timelineHeight: 374 });

  sidebarHandle.dispatch('pointerdown', { clientX: 100 });
  sidebarHandle.dispatch('pointermove', { clientX: 130 });
  sidebarHandle.dispatch('pointerup', { clientX: 130 });
  timelineHandle.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(rootStyle.getPropertyValue('--sidebar-width'), '546px');
  assert.equal(rootStyle.getPropertyValue('--timeline-height'), '362px');
  assert.equal(sidebarPanel.style.getPropertyValue('width'), '');
  assert.equal(timelinePanel.style.getPropertyValue('height'), '');
  assert.deepEqual(readWorkbenchLayout(storage), { sidebarWidth: 546, timelineHeight: 362 });

  controller.destroy();

  values.set('pixelverse:size:sidebar', '320');
  values.set('pixelverse:size:timeline', '180');
  const restoredController = workbenchLayout.setupWorkbenchLayoutController({
    sidebarHandle,
    timelineHandle,
    sidebarPanel,
    timelinePanel,
    resizeTarget,
    root,
    body,
    storage,
    sidebarEdge: 'right',
    viewport: () => ({ width: 1280, height: 720, workbenchTop: 138 }),
  });
  assert.equal(rootStyle.getPropertyValue('--sidebar-width'), '546px');
  assert.equal(rootStyle.getPropertyValue('--timeline-height'), '362px');
  assert.equal(values.has('pixelverse:size:sidebar'), false);
  assert.equal(values.has('pixelverse:size:timeline'), false);
  restoredController.destroy();
});
