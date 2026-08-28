import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VILLAGE_FIRST_LAYOUT_KEY,
  createVillageFirstLayoutController,
  normalizeVillageFirstLayout,
} from '../public/village_first_layout.mjs';

class Target {
  constructor() { this.listeners = new Map(); this.attributes = new Map(); this.dataset = {}; this.hidden = false; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, event = {}) { for (const callback of this.listeners.get(type) || []) callback({ preventDefault() {}, ...event }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

function fixture({ storage, width = 1024, height = 768 } = {}) {
  const values = storage?.values || new Map();
  const nextStorage = storage || {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const eventTarget = new Target();
  const handles = { top: new Target(), roster: new Target(), detail: new Target() };
  const css = new Map();
  const workspace = new Target();
  workspace.style = { setProperty: (key, value) => css.set(key, value) };
  const viewport = () => ({ width, height, detailOpen: workspace.dataset.detailOpen === 'true' });
  const controller = createVillageFirstLayoutController({ workspace, handles, storage: nextStorage, viewport, eventTarget });
  return { controller, handles, workspace, storage: nextStorage, eventTarget, css, viewport };
}

test('desktop normalization preserves the minimum village', () => {
  const layout = normalizeVillageFirstLayout(
    { topHeight: 500, rosterHeight: 500, detailWidth: 900 },
    { width: 1024, height: 768, detailOpen: true },
  );
  assert.ok(layout.topHeight + layout.rosterHeight + 280 <= 768);
  assert.ok(layout.detailWidth + 520 <= 1024);
});

test('pointer keyboard persistence and reset share one bounded state', () => {
  const first = fixture();
  first.controller.start();
  first.handles.top.dispatch('keydown', { key: 'ArrowDown' });
  first.handles.roster.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
  first.handles.detail.dispatch('keydown', { key: 'ArrowLeft' });
  first.handles.top.dispatch('pointerdown', { pointerId: 1, clientY: 100, clientX: 0 });
  first.eventTarget.dispatch('pointermove', { pointerId: 1, clientY: 110, clientX: 0 });
  first.eventTarget.dispatch('pointerup', { pointerId: 1 });
  const changed = first.controller.getLayout();
  assert.notDeepEqual(changed, normalizeVillageFirstLayout({}, first.viewport()));
  assert.equal(JSON.parse(first.storage.values.get(VILLAGE_FIRST_LAYOUT_KEY)).version, 1);

  const second = fixture({ storage: first.storage });
  second.controller.start();
  assert.deepEqual(second.controller.getLayout(), changed);
  second.handles.roster.dispatch('dblclick');
  assert.deepEqual(second.controller.getLayout(), normalizeVillageFirstLayout({}, second.viewport()));
});

test('malformed storage is preserved and narrow mode hides all splitters', () => {
  const first = fixture({ width: 800, height: 600 });
  first.storage.values.set(VILLAGE_FIRST_LAYOUT_KEY, '{broken');
  first.controller.start();
  assert.equal(first.storage.values.get(VILLAGE_FIRST_LAYOUT_KEY), '{broken');
  assert.ok(Object.values(first.handles).every(({ hidden }) => hidden));
  assert.equal(first.workspace.dataset.villageLayoutMode, 'narrow');
});

test('detail track opens within the desktop village width bound', () => {
  const view = fixture({ width: 1024 });
  view.controller.start();
  view.controller.setDetailOpen(true);
  assert.equal(view.workspace.dataset.detailOpen, 'true');
  assert.equal(view.css.get('--agent-detail-track'), `${view.controller.getLayout().detailWidth}px`);
  assert.ok(view.controller.getLayout().detailWidth <= 504);
});
