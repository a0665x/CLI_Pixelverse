import assert from 'node:assert/strict';
import test from 'node:test';

import * as dashboardDisclosure from '../public/dashboard_disclosure.mjs';
import {
  deferDashboardCardFocus,
  readDashboardDisclosure,
  restoreDashboardCardFocus,
  toggleDashboardCard,
  writeDashboardDisclosure,
} from '../public/dashboard_disclosure.mjs';
import { getLocaleStrings } from '../public/ui_strings.mjs';

test('dashboard cards start closed and same-button activation closes the card', () => {
  const initial = readDashboardDisclosure(null);
  assert.deepEqual(initial, { activeCard: null, guideDismissed: false });

  const open = toggleDashboardCard(initial, 'events');
  assert.deepEqual(open, { activeCard: 'events', guideDismissed: false });
  assert.deepEqual(toggleDashboardCard({ ...open, guideDismissed: true }, 'events'), {
    activeCard: null,
    guideDismissed: true,
  });
  assert.deepEqual(toggleDashboardCard(open, 'agents'), { activeCard: 'agents', guideDismissed: false });
  assert.deepEqual(toggleDashboardCard(open, 'help', true), { activeCard: null, guideDismissed: false });
});

test('iframe pointer handoff preserves one matching cutaway focus lifecycle without stale reuse', () => {
  assert.equal(typeof dashboardDisclosure.createCutawayFocusHandoff, 'function');
  if (typeof dashboardDisclosure.createCutawayFocusHandoff !== 'function') return;
  const scheduled = [];
  const handoff = dashboardDisclosure.createCutawayFocusHandoff({
    schedule: (callback) => scheduled.push(callback) - 1,
    cancel: (handle) => { scheduled[handle] = null; },
  });
  const eventsTrigger = { dataset: { dashboardCard: 'events' }, focus() {} };

  handoff.framePointerDown(eventsTrigger);
  assert.equal(handoff.cutawayOpened(null), eventsTrigger);
  assert.equal(handoff.cutawayClosed(), eventsTrigger);
  assert.equal(handoff.cutawayClosed(), null);

  handoff.framePointerDown(eventsTrigger);
  scheduled.filter(Boolean).forEach((callback) => callback());
  assert.equal(handoff.cutawayOpened(null), null);
  assert.equal(handoff.cutawayClosed(), null);

  handoff.framePointerDown(eventsTrigger);
  handoff.reset();
  assert.equal(handoff.cutawayOpened(null), null);
  assert.equal(handoff.cutawayClosed(), null);
});

test('stored disclosure is validated and malformed storage fails closed', () => {
  const validStorage = {
    getItem: () => JSON.stringify({ activeCard: 'agents', guideDismissed: true }),
  };
  assert.deepEqual(readDashboardDisclosure(validStorage), {
    activeCard: 'agents',
    guideDismissed: true,
  });

  const invalidStorage = {
    getItem: () => JSON.stringify({ activeCard: 'diagnostics', guideDismissed: 'yes' }),
  };
  assert.deepEqual(readDashboardDisclosure(invalidStorage), {
    activeCard: null,
    guideDismissed: false,
  });
  assert.deepEqual(readDashboardDisclosure({ getItem: () => { throw new Error('denied'); } }), {
    activeCard: null,
    guideDismissed: false,
  });
});

test('storage writes report quota or privacy failures without throwing', () => {
  let stored = null;
  const storage = { setItem: (_key, value) => { stored = JSON.parse(value); } };
  const state = { activeCard: 'help', guideDismissed: true };

  assert.equal(writeDashboardDisclosure(storage, state), true);
  assert.deepEqual(stored, state);
  assert.equal(writeDashboardDisclosure({ setItem: () => { throw new Error('quota'); } }, state), false);
});

test('actual pointer, keyboard, and touch events resolve to input modalities', () => {
  assert.equal(typeof dashboardDisclosure.dashboardInputModality, 'function');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'keydown' }), 'keyboard');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'pointerdown', pointerType: 'touch' }), 'touch');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'pointerdown', pointerType: 'mouse' }), 'pointer');
});

test('closing a dashboard card restores focus to its trigger', () => {
  let focusCount = 0;
  const trigger = { focus: () => { focusCount += 1; } };
  assert.equal(restoreDashboardCardFocus(trigger), true);
  assert.equal(focusCount, 1);
  assert.equal(restoreDashboardCardFocus(null), false);
});

test('deferred focus wins after a focusable outside pointer target receives default focus', () => {
  const parentDocument = { activeElement: null };
  const trigger = {
    hidden: false,
    disabled: false,
    isConnected: true,
    getClientRects: () => [{ width: 100, height: 40 }],
    closest: () => null,
    focus: () => { parentDocument.activeElement = trigger; },
  };
  const outside = { focus: () => { parentDocument.activeElement = outside; } };
  const scheduled = [];

  deferDashboardCardFocus(trigger, { schedule: (callback) => scheduled.push(callback) - 1 });
  outside.focus();
  assert.equal(parentDocument.activeElement, outside);
  scheduled.shift()();
  assert.equal(parentDocument.activeElement, trigger);
});

test('deferred focus is cancellable and never targets a hidden cutaway trigger', () => {
  const scheduled = [];
  let focused = false;
  const trigger = {
    hidden: false,
    disabled: false,
    isConnected: true,
    getClientRects: () => [],
    closest: () => null,
    focus: () => { focused = true; },
  };
  const cancel = deferDashboardCardFocus(trigger, {
    schedule: (callback) => scheduled.push(callback) - 1,
    cancel: (handle) => { scheduled[handle] = null; },
  });
  cancel();
  scheduled.filter(Boolean).forEach((callback) => callback());
  assert.equal(focused, false);

  const pending = [];
  deferDashboardCardFocus(trigger, { schedule: (callback) => pending.push(callback) - 1 });
  pending.shift()();
  assert.equal(focused, false);
});

test('cutaway focus target is empty when no dashboard card is active', () => {
  assert.equal(typeof dashboardDisclosure.activeDashboardCardTrigger, 'function');
  const staleTrigger = { dataset: { dashboardCard: 'events' } };
  const agentsTrigger = { dataset: { dashboardCard: 'agents' } };

  assert.equal(dashboardDisclosure.activeDashboardCardTrigger(null, staleTrigger, [staleTrigger, agentsTrigger]), null);
  assert.equal(
    dashboardDisclosure.activeDashboardCardTrigger('agents', staleTrigger, [staleTrigger, agentsTrigger]),
    agentsTrigger,
  );
});

test('live-region helper only writes when meaningful text changes', () => {
  let writes = 0;
  let value = '';
  const node = {
    get textContent() { return value; },
    set textContent(next) { writes += 1; value = next; },
  };

  assert.equal(dashboardDisclosure.updateLiveRegionText(node, 'Henry · Working'), true);
  assert.equal(dashboardDisclosure.updateLiveRegionText(node, 'Henry · Working'), false);
  assert.equal(dashboardDisclosure.updateLiveRegionText(node, 'Henry · Idle'), true);
  assert.equal(writes, 2);
});

test('map layer helper makes the iframe interactive by default and restores legacy editing on demand', () => {
  const element = () => ({ hidden: false, inert: false, attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, String(value)); } });
  const frame = element();
  const legacyStage = element();
  const legacyControls = element();

  dashboardDisclosure.applyMapLayerVisibility({ frame, legacyStage, legacyControls }, false);
  assert.equal(frame.hidden, false);
  assert.equal(frame.inert, false);
  assert.equal(legacyStage.hidden, true);
  assert.equal(legacyStage.inert, true);
  assert.equal(legacyControls.hidden, true);

  dashboardDisclosure.applyMapLayerVisibility({ frame, legacyStage, legacyControls }, true);
  assert.equal(frame.hidden, true);
  assert.equal(frame.inert, true);
  assert.equal(legacyStage.hidden, false);
  assert.equal(legacyStage.inert, false);
  assert.equal(legacyControls.hidden, false);
});

test('every locale provides the three dashboard card labels and pagination copy', () => {
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const copy = getLocaleStrings(locale);
    for (const key of ['dashboardEvents', 'dashboardAgents', 'dashboardHelp', 'dashboardPrevious', 'dashboardNext']) {
      assert.equal(typeof copy[key], 'string', `${locale}.${key}`);
      assert.equal(copy[key].length > 0, true, `${locale}.${key}`);
    }
    assert.equal(typeof copy.dashboardPage, 'function');
    assert.match(copy.dashboardPage(2, 4), /2/);
    assert.match(copy.dashboardPage(2, 4), /4/);
  }
});

test('dashboard card controls render localized labels and mutual expanded state', () => {
  assert.equal(typeof dashboardDisclosure.renderDashboardCardControl, 'function');
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const copy = getLocaleStrings(locale);
    const attributes = new Map();
    const button = {
      dataset: { dashboardCard: 'events' },
      title: '',
      setAttribute: (name, value) => attributes.set(name, String(value)),
    };
    const label = dashboardDisclosure.renderDashboardCardControl(button, {
      name: 'events',
      activeCard: 'agents',
      copy,
    });
    assert.equal(label, copy.dashboardEvents);
    assert.equal(button.dataset.tooltip, copy.dashboardEvents);
    assert.equal(button.title, copy.dashboardEvents);
    assert.equal(attributes.get('aria-expanded'), 'false');
    assert.equal(attributes.get('aria-label'), `${copy.showPanels}: ${copy.dashboardEvents}`);
  }
});

test('cutaway-open controls are explicitly disabled and collapsed', () => {
  const copy = getLocaleStrings('en-US');
  const attributes = new Map();
  const button = {
    dataset: { dashboardCard: 'events' },
    disabled: false,
    title: '',
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  };

  dashboardDisclosure.renderDashboardCardControl(button, {
    name: 'events', activeCard: 'events', copy, blocked: true,
  });

  assert.equal(button.disabled, true);
  assert.equal(attributes.get('aria-disabled'), 'true');
  assert.equal(attributes.get('aria-expanded'), 'false');
});

test('dashboard card controls perform no attribute or label writes for identical state', () => {
  const copy = getLocaleStrings('en-US');
  const attributes = new Map();
  let writes = 0;
  let title = '';
  const dataset = {};
  const button = {
    dataset,
    get title() { return title; },
    set title(value) { writes += 1; title = value; },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute(name, value) { writes += 1; attributes.set(name, String(value)); },
  };

  dashboardDisclosure.renderDashboardCardControl(button, { name: 'agents', activeCard: 'agents', copy });
  writes = 0;
  dashboardDisclosure.renderDashboardCardControl(button, { name: 'agents', activeCard: 'agents', copy });
  assert.equal(writes, 0);
});
