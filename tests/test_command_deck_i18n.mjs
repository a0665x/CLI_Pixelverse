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
  'commandDeck.inspector.title',
  'commandDeck.inspector.selectAgent',
  'commandDeck.inspector.empty',
  'commandDeck.inspector.currentTask',
  'commandDeck.inspector.lastUpdate',
  'commandDeck.inspector.room',
  'commandDeck.inspector.events',
  'commandDeck.inspector.agentFallback',
  'commandDeck.inspector.sessionNames.api',
  'commandDeck.inspector.sessionNames.cli',
  'commandDeck.inspector.sessionNames.gateway',
  'commandDeck.inspector.liveDetail',
  'commandDeck.inspector.rowState',
  'commandDeck.inspector.rowRoom',
  'commandDeck.inspector.rowTask',
  'commandDeck.inspector.rowEventTime',
  'commandDeck.inspector.latestEvent',
  'commandDeck.inspector.detailSeparator',
  'commandDeck.diagnostics.label',
  'commandDeck.diagnostics.explanation',
  'commandDeck.hook.guide',
  'commandDeck.hook.semantic.rest',
  'commandDeck.hook.semantic.search',
  'commandDeck.hook.semantic.work',
  'commandDeck.hook.categories.reasoning',
  'commandDeck.hook.categories.tool',
  'commandDeck.hook.categories.subagent',
  'commandDeck.hook.categories.session',
  'commandDeck.hook.categories.status',
  'commandDeck.hook.categories.message',
  'commandDeck.hook.categories.completion',
  'commandDeck.empty.events',
  'commandDeck.empty.agents',
  'commandDeck.empty.hooks',
  'commandDeck.error.read',
  'commandDeck.error.exposure',
  'commandDeck.error.unavailable',
  'commandDeck.interaction.at',
  'commandDeck.interaction.furnitureFallback',
  'commandDeck.interaction.actions.terminal',
  'commandDeck.interaction.actions.rest',
  'commandDeck.interaction.actions.planning',
  'commandDeck.interaction.actions.ponder',
  'commandDeck.interaction.actions.dispatch',
  'commandDeck.interaction.actions.notes',
  'commandDeck.interaction.actions.writing',
  'commandDeck.interaction.actions.neutral',
  'commandDeck.activity.thinking',
  'commandDeck.activity.planning',
  'commandDeck.activity.working',
  'commandDeck.activity.offline',
  'commandDeck.activity.waiting',
  'commandDeck.activity.external',
  'commandDeck.ambient.planning',
  'commandDeck.ambient.thinking',
  'commandDeck.ambient.working',
  'commandDeck.ambient.offline',
  'commandDeck.ambient.standby',
  'commandDeck.furniture.scale',
  'commandDeck.furniture.fallback',
  'commandDeck.furniture.coordinate',
  'commandDeck.accessibility.pose',
  'commandDeck.accessibility.interaction',
  'commandDeck.accessibility.poseFallback',
  'commandDeck.accessibility.appleDogDoor',
  'commandDeck.eventChip.pixel.blocked',
  'commandDeck.eventChip.pixel.reading_files',
  'commandDeck.eventChip.pixel.editing_files',
  'commandDeck.eventChip.pixel.shell_command',
  'commandDeck.eventChip.pixel.browsing',
  'commandDeck.eventChip.pixel.external_tool',
  'commandDeck.eventChip.pixel.responding',
  'commandDeck.eventChip.events.reasoning',
  'commandDeck.eventChip.events.taskStart',
  'commandDeck.eventChip.events.toolStart',
  'commandDeck.eventChip.events.toolDone',
  'commandDeck.eventChip.events.toolRoute',
  'commandDeck.eventChip.events.standby',
  'commandDeck.eventChip.states.working',
  'commandDeck.eventChip.states.planning',
  'commandDeck.eventChip.states.thinking',
  'commandDeck.eventChip.states.offline',
  'commandDeck.eventChip.states.standby',
  'commandDeck.eventChip.details.reasoning',
  'commandDeck.eventChip.details.taskStarted',
  'commandDeck.eventChip.details.started',
  'commandDeck.eventChip.details.finished',
  'commandDeck.eventChip.details.toolRoute',
  'commandDeck.eventChip.details.completed',
  'commandDeck.timelineDetail.labels.reasoning',
  'commandDeck.timelineDetail.labels.toolStart',
  'commandDeck.timelineDetail.labels.toolDone',
  'commandDeck.timelineDetail.labels.toolRoute',
  'commandDeck.timelineDetail.labels.complete',
  'commandDeck.timelineDetail.labels.tool',
  'commandDeck.timelineDetail.labels.thought',
  'commandDeck.timelineDetail.labels.status',
  'commandDeck.timelineDetail.labels.action',
  'commandDeck.timelineDetail.messages.reasoning',
  'commandDeck.timelineDetail.messages.started',
  'commandDeck.timelineDetail.messages.finished',
  'commandDeck.timelineDetail.messages.route',
  'commandDeck.timelineDetail.messages.completed',
  'commandDeck.timelineDetail.messages.returned',
  'commandDeck.timelineDetail.messages.toolStep',
  'commandDeck.timelineDetail.messages.thought',
  'commandDeck.timelineDetail.messages.status',
  'commandDeck.timelineDetail.messages.fallback',
];

const cloneCatalog = (value) => Object.fromEntries(Object.entries(value).map(([key, child]) => [
  key,
  child && typeof child === 'object' && !Array.isArray(child) ? cloneCatalog(child) : child,
]));

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

test('missingLocaleKeys requires all supported locales and detects extras symmetrically', () => {
  const catalog = {
    'en-US': { common: 'Common', englishOnly: 'English' },
    'zh-TW': { common: '共同', extra: '額外' },
    'ja-JP': { common: '共通' },
  };
  assert.deepEqual(localeModule.missingLocaleKeys(catalog), {
    'en-US': ['extra'],
    'zh-TW': ['englishOnly'],
    'ja-JP': ['englishOnly', 'extra'],
    'ko-KR': ['common', 'englishOnly', 'extra'],
  });

  const missingFamily = cloneCatalog(localeModule.UI_CATALOG);
  delete missingFamily['ko-KR'].commandDeck.inspector;
  assert.ok(localeModule.missingLocaleKeys(missingFamily)['ko-KR'].some((key) => key.startsWith('commandDeck.inspector.')));
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

test('exports production formatters used by active rendered locale surfaces', () => {
  for (const name of [
    'interactionText', 'ambientText', 'activityHintForLocale', 'timelineItemForLocale',
    'furnitureCoordinateText', 'poseLabelForLocale',
  ]) assert.equal(typeof localeModule[name], 'function', `${name} must be exported`);
});

test('AppleDog door accessibility title is catalog-owned in all locales', async () => {
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /AppleDog door tile/);
  assert.match(app, /commandDeck\.accessibility\.appleDogDoor/);
  assert.equal(new Set(locales.map((locale) => localeModule.uiText(locale, 'commandDeck.accessibility.appleDogDoor'))).size, 4);
});

test('production app wires every retained-state rerender through the locale controller', async () => {
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  const configuration = app.match(/const localeController = createCommandDeckLocaleController\(\{([\s\S]*?)\n\}\);\nlocaleController\.attach\(\);/)?.[1];
  assert.ok(configuration, 'production locale controller configuration is missing');
  for (const callback of [
    'applyStaticCopy', 'renderSnapshot', 'renderMissionTrace', 'renderLiveMonitoring',
    'resolveSelection: resolveCurrentCommandSelection', 'renderInspector',
  ]) assert.ok(configuration.includes(callback), `production locale controller is missing ${callback}`);
});
