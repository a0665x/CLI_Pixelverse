import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as localeModule from '../public/ui_strings.mjs';

const locales = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR'];
const requiredKeys = [
  'commandDeck.topBar.label',
  'commandDeck.rails.agentsTitle',
  'commandDeck.rails.previousAgents',
  'commandDeck.rails.nextAgents',
  'commandDeck.rails.inspectorLabel',
  'commandDeck.rails.hookChannelsLabel',
  'commandDeck.layout.controlsLabel',
  'commandDeck.layout.collapseLeft',
  'commandDeck.layout.expandLeft',
  'commandDeck.layout.collapseRight',
  'commandDeck.layout.expandRight',
  'commandDeck.layout.collapseBottom',
  'commandDeck.layout.expandBottom',
  'commandDeck.layout.swapSides',
  'commandDeck.layout.reset',
  'commandDeck.layout.resizeLeft',
  'commandDeck.layout.resizeRight',
  'commandDeck.layout.resizeBottom',
  'commandDeck.timeline.title',
  'commandDeck.timeline.live',
  'commandDeck.timeline.paused',
  'commandDeck.timeline.resume',
  'commandDeck.timeline.summary',
  'commandDeck.timeline.eventLabel',
  'commandDeck.settings.label',
  'commandDeck.settings.languageSelector',
  'commandDeck.settings.exposureSelector',
  'commandDeck.settings.copyUrl',
  'commandDeck.camera.label',
  'commandDeck.camera.zoomIn',
  'commandDeck.camera.zoomOut',
  'commandDeck.camera.reset',
  'commandDeck.world.label',
  'commandDeck.world.frameTitle',
  'commandDeck.dynamic.page',
  'commandDeck.dynamic.lastSync',
  'commandDeck.dynamic.agentCount',
];

test('exports the required four-locale catalog interfaces', () => {
  assert.deepEqual(localeModule.SUPPORTED_LOCALES, locales);
  assert.equal(typeof localeModule.uiText, 'function');
  assert.equal(typeof localeModule.missingLocaleKeys, 'function');
  assert.equal(typeof localeModule.UI_CATALOG, 'object');
});

test('every command-deck locale has identical nested key coverage', () => {
  if (!localeModule.UI_CATALOG || !localeModule.missingLocaleKeys) return;
  assert.deepEqual(localeModule.missingLocaleKeys(localeModule.UI_CATALOG), {});
  for (const locale of locales) {
    for (const key of requiredKeys) {
      const rendered = localeModule.uiText(locale, key, {
        page: 2, count: 5, timestamp: '10:42:03', seconds: 9,
        name: 'Henry', state: 'Working', room: 'Workshop', category: 'tool', summary: 'Read README',
      });
      assert.ok(rendered && rendered !== key, `${locale} is missing ${key}`);
    }
  }
});

test('dynamic command-deck counts and timestamps format in every locale', () => {
  if (!localeModule.uiText) return;
  for (const locale of locales) {
    assert.match(localeModule.uiText(locale, 'commandDeck.dynamic.page', { page: 2, count: 5 }), /2/);
    assert.match(localeModule.uiText(locale, 'commandDeck.dynamic.page', { page: 2, count: 5 }), /5/);
    assert.match(localeModule.uiText(locale, 'commandDeck.dynamic.lastSync', { timestamp: '10:42:03', seconds: 9 }), /10:42:03/);
    assert.match(localeModule.uiText(locale, 'commandDeck.dynamic.lastSync', { timestamp: '10:42:03', seconds: 9 }), /9/);
    assert.match(localeModule.uiText(locale, 'commandDeck.timeline.summary', { state: 'Working', count: 3 }), /3/);
  }
});

test('product-owned command-deck DOM copy is declaratively localized', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const requiredBindings = [
    'data-i18n-aria-label="commandDeck.world.label"',
    'data-i18n-title="commandDeck.world.frameTitle"',
    'data-i18n-aria-label="commandDeck.layout.controlsLabel"',
    'data-i18n="commandDeck.rails.agentsTitle"',
    'data-i18n="commandDeck.timeline.title"',
    'data-i18n="commandDeck.timeline.resume"',
    'data-i18n-aria-label="commandDeck.settings.languageSelector"',
  ];
  requiredBindings.forEach((binding) => assert.ok(html.includes(binding), `missing ${binding}`));
  assert.doesNotMatch(html, /aria-label="(?:Agent village|World camera controls|Command deck layout controls|Agent force rail|Intelligence inspector|Live Hook channels|Resize (?:live agent rail|Hook rail|mission trace)|language selector|exposure selector)"/);
});

test('locale changes re-render active shell surfaces from retained state', async () => {
  const source = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  const setLocaleBody = source.match(/function setLocale\(locale\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(setLocaleBody, /applyStaticCopy\(\)/);
  assert.match(setLocaleBody, /renderMissionTrace\(currentMissionTrace/);
  assert.match(setLocaleBody, /renderLiveMonitoring\(currentSnapshot/);
  assert.match(setLocaleBody, /renderInspector\(/);
  assert.match(setLocaleBody, /pixelworldBridge\.setLocale\(currentLocale\)/);
});
