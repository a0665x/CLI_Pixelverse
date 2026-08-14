import assert from 'node:assert/strict';
import test from 'node:test';

import * as dashboardDisclosure from '../public/dashboard_disclosure.mjs';
import {
  readDashboardDisclosure,
  shouldShowGuide,
  toggleDashboardDrawer,
  writeDashboardDisclosure,
} from '../public/dashboard_disclosure.mjs';
import { getLocaleStrings } from '../public/ui_strings.mjs';

test('secondary drawers start collapsed while core HUD stays visible', () => {
  const initial = readDashboardDisclosure(null);
  assert.deepEqual(initial, {
    activeDrawer: null,
    guideDismissed: false,
  });

  const open = toggleDashboardDrawer(initial, 'timeline');
  assert.deepEqual(open, { activeDrawer: 'timeline', guideDismissed: false });
  assert.deepEqual(toggleDashboardDrawer({ ...open, guideDismissed: true }, 'timeline'), {
    activeDrawer: null,
    guideDismissed: true,
  });
});

test('guide appears once for pointer, keyboard, and touch discovery', () => {
  for (const modality of ['pointer', 'keyboard', 'touch']) {
    assert.equal(shouldShowGuide({ guideDismissed: false }, modality), true);
  }
  assert.equal(shouldShowGuide({ guideDismissed: true }, 'pointer'), false);
  assert.equal(shouldShowGuide({ guideDismissed: false }, 'unknown'), false);
});

test('stored disclosure is validated and malformed storage fails closed', () => {
  const validStorage = {
    getItem: () => JSON.stringify({ activeDrawer: 'agents', guideDismissed: true }),
  };
  assert.deepEqual(readDashboardDisclosure(validStorage), {
    activeDrawer: 'agents',
    guideDismissed: true,
  });

  const invalidStorage = {
    getItem: () => JSON.stringify({ activeDrawer: 'settings', guideDismissed: 'yes' }),
  };
  assert.deepEqual(readDashboardDisclosure(invalidStorage), {
    activeDrawer: null,
    guideDismissed: false,
  });

  assert.deepEqual(readDashboardDisclosure({ getItem: () => { throw new Error('denied'); } }), {
    activeDrawer: null,
    guideDismissed: false,
  });
});

test('storage writes report quota or privacy failures without throwing', () => {
  let stored = null;
  const storage = { setItem: (_key, value) => { stored = JSON.parse(value); } };
  const state = { activeDrawer: 'diagnostics', guideDismissed: true };

  assert.equal(writeDashboardDisclosure(storage, state), true);
  assert.deepEqual(stored, state);
  assert.equal(writeDashboardDisclosure({ setItem: () => { throw new Error('quota'); } }, state), false);
});

test('actual pointer, keyboard, and touch events resolve to guide modalities', () => {
  assert.equal(typeof dashboardDisclosure.dashboardInputModality, 'function');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'keydown' }), 'keyboard');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'pointerdown', pointerType: 'touch' }), 'touch');
  assert.equal(dashboardDisclosure.dashboardInputModality({ type: 'pointerdown', pointerType: 'mouse' }), 'pointer');
});

test('persistent Help reopens guidance after first-use dismissal', () => {
  assert.equal(typeof dashboardDisclosure.dashboardGuideVisible, 'function');
  const dismissed = { activeDrawer: null, guideDismissed: true };
  assert.equal(dashboardDisclosure.dashboardGuideVisible(dismissed, 'keyboard', false), false);
  assert.equal(dashboardDisclosure.dashboardGuideVisible(dismissed, 'keyboard', true), true);
  assert.equal(dashboardDisclosure.dashboardGuideVisible({ guideDismissed: false }, 'touch', false), true);
});

test('the explicit Help dismiss action restores focus to the persistent Help control', () => {
  assert.equal(typeof dashboardDisclosure.restoreDashboardHelpFocus, 'function');
  let focusCount = 0;
  const helpButton = { focus: () => { focusCount += 1; } };
  assert.equal(dashboardDisclosure.restoreDashboardHelpFocus(helpButton), true);
  assert.equal(focusCount, 1);
  assert.equal(dashboardDisclosure.restoreDashboardHelpFocus(null), false);
});

test('live-region helper only writes when meaningful text changes', () => {
  assert.equal(typeof dashboardDisclosure.updateLiveRegionText, 'function');
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
  assert.equal(typeof dashboardDisclosure.applyMapLayerVisibility, 'function');
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

test('every locale provides persistent help and a diagnostic-specific explanation', () => {
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const copy = getLocaleStrings(locale);
    assert.equal(typeof copy.dashboardHelp, 'string');
    assert.equal(copy.dashboardHelp.length > 0, true);
    assert.equal(typeof copy.dashboardGuideTitle, 'string');
    assert.equal(typeof copy.diagnosticsExplanation, 'string');
    assert.equal(copy.diagnosticsExplanation.length > copy.dashboardPanels.length, true);
  }
});

test('diagnostics drawer controls render a diagnostics-specific localized label', () => {
  assert.equal(typeof dashboardDisclosure.renderDashboardDrawerControl, 'function');
  for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'ko-KR']) {
    const copy = getLocaleStrings(locale);
    const attributes = new Map();
    const button = {
      dataset: { dashboardDrawer: 'diagnostics' },
      title: '',
      setAttribute: (name, value) => attributes.set(name, String(value)),
    };
    const label = dashboardDisclosure.renderDashboardDrawerControl(button, {
      name: 'diagnostics',
      activeDrawer: null,
      copy,
    });
    assert.equal(typeof copy.diagnosticsLabel, 'string');
    assert.equal(label, copy.diagnosticsLabel);
    assert.equal(button.dataset.tooltip, copy.diagnosticsLabel);
    assert.equal(button.title, copy.diagnosticsLabel);
    assert.equal(attributes.get('aria-expanded'), 'false');
    assert.equal(attributes.get('aria-label'), `${copy.showPanels}: ${copy.diagnosticsLabel}`);
  }
});
